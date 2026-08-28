import 'reflect-metadata';
import {
  assertPublicWebhookTarget,
  isSandboxEnvironment,
  WebhookTargetBlockedError,
} from './webhook-url-guard';
import { NodeEnvironment } from '../config/env.validation';

describe('assertPublicWebhookTarget', () => {
  it('rejects a malformed URL', async () => {
    await expect(assertPublicWebhookTarget('not a url')).rejects.toThrow(
      WebhookTargetBlockedError,
    );
  });

  it('rejects a non-http(s) scheme', async () => {
    await expect(
      assertPublicWebhookTarget('ftp://example.com/hook'),
    ).rejects.toThrow(WebhookTargetBlockedError);
    await expect(
      assertPublicWebhookTarget('file:///etc/passwd'),
    ).rejects.toThrow(WebhookTargetBlockedError);
  });

  describe('IPv4 literal targets', () => {
    const blocked = [
      '0.0.0.0',
      '10.0.0.1',
      '100.64.0.1',
      '127.0.0.1',
      '169.254.169.254', // the common cloud-metadata address
      '172.16.0.1',
      '172.31.255.255',
      '192.0.0.1',
      '192.0.2.1',
      '192.168.1.1',
      '198.18.0.1',
      '198.51.100.1',
      '203.0.113.1',
      '224.0.0.1',
      '255.255.255.255',
    ];
    it.each(blocked)('blocks %s', async (ip) => {
      await expect(
        assertPublicWebhookTarget(`http://${ip}/hook`),
      ).rejects.toThrow(WebhookTargetBlockedError);
    });

    const allowed = ['8.8.8.8', '1.1.1.1', '93.184.216.34'];
    it.each(allowed)('allows %s', async (ip) => {
      await expect(
        assertPublicWebhookTarget(`http://${ip}/hook`),
      ).resolves.toBeUndefined();
    });

    it('does not misclassify a public address one bit outside a blocked range', async () => {
      // 172.32.0.1 is one address past 172.16.0.0/12's upper bound
      // (172.31.255.255) — a naive octet-prefix check could get this
      // wrong; a real CIDR mask check must not.
      await expect(
        assertPublicWebhookTarget('http://172.32.0.1/hook'),
      ).resolves.toBeUndefined();
    });
  });

  describe('IPv6 literal targets', () => {
    const blocked = [
      '::1', // loopback
      '::', // unspecified
      'fc00::1', // unique local
      'fd12:3456:789a::1', // unique local
      'fe80::1', // link-local
      'ff02::1', // multicast
      '::ffff:127.0.0.1', // IPv4-mapped loopback
      '::ffff:10.0.0.1', // IPv4-mapped private
    ];
    it.each(blocked)('blocks %s', async (ip) => {
      await expect(
        assertPublicWebhookTarget(`http://[${ip}]/hook`),
      ).rejects.toThrow(WebhookTargetBlockedError);
    });

    it('allows a public IPv6 literal', async () => {
      await expect(
        assertPublicWebhookTarget('http://[2606:4700:4700::1111]/hook'),
      ).resolves.toBeUndefined();
    });

    it('allows an IPv4-mapped public address', async () => {
      await expect(
        assertPublicWebhookTarget('http://[::ffff:8.8.8.8]/hook'),
      ).resolves.toBeUndefined();
    });
  });

  describe('hostname targets', () => {
    it('blocks "localhost", which resolves to a loopback address', async () => {
      // DNS is an untrusted input to the SSRF decision. Supplying the answer
      // directly keeps the security test deterministic on offline CI runners
      // while exercising the same production classification path.
      await expect(
        assertPublicWebhookTarget('http://localhost/hook', {
          resolveHostname: async () => ['127.0.0.1'],
        }),
      ).rejects.toThrow(WebhookTargetBlockedError);
    });

    it('allows a hostname resolving only to public addresses', async () => {
      await expect(
        assertPublicWebhookTarget('https://example.com/hook', {
          resolveHostname: async () => ['93.184.216.34'],
        }),
      ).resolves.toBeUndefined();
    });

    it('fails closed with a clean error for a hostname that does not resolve at all, rather than leaking a raw DNS error', async () => {
      await expect(
        assertPublicWebhookTarget(
          'https://this-subdomain-does-not-exist.example.com/hook',
          {
            resolveHostname: async () => {
              throw Object.assign(new Error('getaddrinfo ENOTFOUND'), {
                code: 'ENOTFOUND',
              });
            },
          },
        ),
      ).rejects.toThrow(WebhookTargetBlockedError);
    });
  });

  describe('allowLoopbackForSandbox (M5-013)', () => {
    it('still blocks loopback by default (option omitted)', async () => {
      await expect(
        assertPublicWebhookTarget('http://127.0.0.1:4000/inbound'),
      ).rejects.toThrow(WebhookTargetBlockedError);
    });

    it('still blocks loopback when the option is explicitly false', async () => {
      await expect(
        assertPublicWebhookTarget('http://127.0.0.1:4000/inbound', {
          allowLoopbackForSandbox: false,
        }),
      ).rejects.toThrow(WebhookTargetBlockedError);
    });

    it('allows an IPv4 loopback literal when the option is true', async () => {
      await expect(
        assertPublicWebhookTarget('http://127.0.0.1:4000/inbound', {
          allowLoopbackForSandbox: true,
        }),
      ).resolves.toBeUndefined();
    });

    it('allows "localhost" (resolves to loopback) when the option is true', async () => {
      await expect(
        assertPublicWebhookTarget('http://localhost:4000/inbound', {
          allowLoopbackForSandbox: true,
          resolveHostname: async () => ['127.0.0.1'],
        }),
      ).resolves.toBeUndefined();
    });

    it('allows an IPv6 loopback literal when the option is true', async () => {
      await expect(
        assertPublicWebhookTarget('http://[::1]:4000/inbound', {
          allowLoopbackForSandbox: true,
        }),
      ).resolves.toBeUndefined();
    });

    it('does NOT extend the exception to any other private/reserved range even when true — only loopback is ever relaxed', async () => {
      await expect(
        assertPublicWebhookTarget('http://10.0.0.5/hook', {
          allowLoopbackForSandbox: true,
        }),
      ).rejects.toThrow(WebhookTargetBlockedError);
      await expect(
        assertPublicWebhookTarget('http://169.254.169.254/hook', {
          allowLoopbackForSandbox: true,
        }),
      ).rejects.toThrow(WebhookTargetBlockedError);
      await expect(
        assertPublicWebhookTarget('http://[fc00::1]/hook', {
          allowLoopbackForSandbox: true,
        }),
      ).rejects.toThrow(WebhookTargetBlockedError);
    });
  });
});

describe('isSandboxEnvironment', () => {
  it('is true only for development and test', () => {
    expect(isSandboxEnvironment(NodeEnvironment.Development)).toBe(true);
    expect(isSandboxEnvironment(NodeEnvironment.Test)).toBe(true);
  });

  it('is false for staging and production — the two environments meant to mirror production security posture', () => {
    expect(isSandboxEnvironment(NodeEnvironment.Staging)).toBe(false);
    expect(isSandboxEnvironment(NodeEnvironment.Production)).toBe(false);
  });
});
