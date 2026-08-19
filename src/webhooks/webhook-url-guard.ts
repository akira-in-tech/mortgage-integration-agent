import { lookup as dnsLookup } from 'node:dns/promises';
import { isIPv4, isIPv6 } from 'node:net';

/**
 * Section 16.4's own named threat-model concern: a webhook `targetUrl`
 * (Section 14.1) is a caller-supplied address this codebase's own worker
 * process later makes a real outbound HTTP request to (M4-004's
 * `webhook-dispatch.service.ts`) — an unrestricted target is a classic
 * SSRF vector, letting a caller aim the platform's own network position
 * at an internal service (a database, a cloud metadata endpoint, another
 * tenant's simulator) that isn't reachable from outside. This guard is
 * the fix: reject any target whose scheme isn't `http`/`https`, or whose
 * hostname is a literal IP or resolves (via a real DNS lookup, every
 * returned address checked, not just the first) to a private, loopback,
 * link-local, or otherwise non-public range.
 *
 * Deliberately not a complete "cloud SSRF" defense — no redirect
 * following is involved (this only validates the URL string itself, not
 * what a malicious server might later redirect a request to; the actual
 * `fetch()` call in `webhook-dispatch.service.ts` uses the platform
 * default of following redirects, a known, separately-scoped residual
 * gap), and IPv6 range coverage is the common, security-relevant subset
 * (loopback, link-local, unique-local, IPv4-mapped) rather than
 * exhaustive. Proportionate to a synthetic/demo product's real threat
 * model, not a claim of complete SSRF immunity.
 */
export class WebhookTargetBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookTargetBlockedError';
  }
}

interface Ipv4Range {
  base: number;
  prefixLength: number;
}

function ipv4ToInt(address: string): number {
  return address
    .split('.')
    .reduce((acc, octet) => (acc << 8) + Number(octet), 0);
}

function range(cidr: string): Ipv4Range {
  const [base, prefixLength] = cidr.split('/');
  return { base: ipv4ToInt(base), prefixLength: Number(prefixLength) };
}

// The security-relevant IANA special-purpose IPv4 registry entries: not
// globally reachable, so never a legitimate public webhook receiver.
const BLOCKED_IPV4_RANGES: Ipv4Range[] = [
  range('0.0.0.0/8'), // "this" network
  range('10.0.0.0/8'), // private
  range('100.64.0.0/10'), // carrier-grade NAT
  range('127.0.0.0/8'), // loopback
  range('169.254.0.0/16'), // link-local — includes 169.254.169.254, the common cloud metadata address
  range('172.16.0.0/12'), // private
  range('192.0.0.0/24'), // IETF protocol assignments
  range('192.0.2.0/24'), // documentation (TEST-NET-1)
  range('192.168.0.0/16'), // private
  range('198.18.0.0/15'), // benchmarking
  range('198.51.100.0/24'), // documentation (TEST-NET-2)
  range('203.0.113.0/24'), // documentation (TEST-NET-3)
  range('224.0.0.0/4'), // multicast
  range('240.0.0.0/4'), // reserved, including the 255.255.255.255 broadcast address
];

function isBlockedIpv4(address: string): boolean {
  const value = ipv4ToInt(address);
  return BLOCKED_IPV4_RANGES.some(
    ({ base, prefixLength }) =>
      value >>> (32 - prefixLength) === base >>> (32 - prefixLength),
  );
}

/** Expands any valid textual IPv6 form (including `::` shorthand and an embedded IPv4 tail) into eight 16-bit groups, as a single 128-bit integer. */
function ipv6ToBigInt(address: string): bigint {
  let normalized = address;
  const ipv4Tail = normalized.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (ipv4Tail) {
    const octets = ipv4Tail[1].split('.').map(Number);
    const hex = octets.map((o) => o.toString(16).padStart(2, '0'));
    normalized =
      normalized.slice(0, normalized.length - ipv4Tail[1].length) +
      `${hex[0]}${hex[1]}:${hex[2]}${hex[3]}`;
  }
  const [head, tail] = normalized.includes('::')
    ? normalized.split('::')
    : [normalized, undefined];
  const headGroups = head ? head.split(':').filter(Boolean) : [];
  const tailGroups = tail !== undefined ? tail.split(':').filter(Boolean) : [];
  const missing = 8 - headGroups.length - tailGroups.length;
  const groups = [
    ...headGroups,
    ...Array(Math.max(missing, 0)).fill('0'),
    ...tailGroups,
  ];
  return groups.reduce(
    (acc, group) => (acc << 16n) + BigInt(parseInt(group || '0', 16)),
    0n,
  );
}

function isBlockedIpv6(address: string): boolean {
  const value = ipv6ToBigInt(address);
  if (value === 0n) return true; // ::  (unspecified)
  if (value === 1n) return true; // ::1 (loopback)
  const firstGroup = value >> 112n;
  if (firstGroup >= 0xfc00n && firstGroup <= 0xfdffn) return true; // fc00::/7 unique local
  if (firstGroup >= 0xfe80n && firstGroup <= 0xfebfn) return true; // fe80::/10 link-local
  if (firstGroup >= 0xff00n && firstGroup <= 0xffffn) return true; // ff00::/8 multicast
  // ::ffff:0:0/96 IPv4-mapped — unwrap and re-check the embedded IPv4 address.
  if (value >> 32n === 0xffffn) {
    const embedded = value & 0xffffffffn;
    const octets = [
      (embedded >> 24n) & 0xffn,
      (embedded >> 16n) & 0xffn,
      (embedded >> 8n) & 0xffn,
      embedded & 0xffn,
    ];
    return isBlockedIpv4(octets.join('.'));
  }
  return false;
}

function isBlockedAddress(address: string): boolean {
  if (isIPv4(address)) return isBlockedIpv4(address);
  if (isIPv6(address)) return isBlockedIpv6(address);
  return true; // Not a recognizable literal IP — fail closed.
}

/**
 * Throws `WebhookTargetBlockedError` if `targetUrl` is not a plausible
 * public HTTP(S) receiver. Callers decide how to surface that — the API
 * layer (`WebhookEndpointService.create`) turns it into a 400 at
 * registration time; the delivery path (`webhook-dispatch.service.ts`)
 * re-checks immediately before every dispatch attempt (not just once at
 * registration) since DNS answers can legitimately change between when
 * an endpoint was registered and when a retried delivery, possibly hours
 * or days later, actually fires — a check that only ran once at
 * registration would miss a DNS-rebinding-style change entirely.
 */
export async function assertPublicWebhookTarget(
  targetUrl: string,
): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    throw new WebhookTargetBlockedError(`"${targetUrl}" is not a valid URL`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new WebhookTargetBlockedError(
      `webhook target must use http or https, got "${parsed.protocol}"`,
    );
  }

  // `URL#hostname` keeps the surrounding brackets for an IPv6 literal
  // (e.g. "[::1]") — `net.isIPv6`/DNS lookups both expect the bare form.
  const hostname = parsed.hostname;
  const bareHostname =
    hostname.startsWith('[') && hostname.endsWith(']')
      ? hostname.slice(1, -1)
      : hostname;
  const literalFamily = isIPv4(bareHostname) ? 4 : isIPv6(bareHostname) ? 6 : 0;
  let addresses: string[];
  if (literalFamily) {
    addresses = [bareHostname];
  } else {
    try {
      const results = await dnsLookup(hostname, { all: true });
      addresses = results.map((r) => r.address);
    } catch (error) {
      // A hostname that doesn't resolve at all (typo, decommissioned
      // domain, an attacker-controlled name deliberately left
      // unresolvable to probe this guard's own error handling) can't be
      // proven safe — fail closed with a clean error instead of letting
      // a raw Node DNS error (ENOTFOUND, etc.) propagate.
      throw new WebhookTargetBlockedError(
        `webhook target host "${hostname}" could not be resolved: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (addresses.length === 0) {
    throw new WebhookTargetBlockedError(
      `webhook target host "${hostname}" did not resolve to any address`,
    );
  }
  const blocked = addresses.filter((address) => isBlockedAddress(address));
  if (blocked.length > 0) {
    throw new WebhookTargetBlockedError(
      `webhook target host "${hostname}" resolves to a private or reserved address (${blocked.join(', ')}) and cannot be used`,
    );
  }
}
