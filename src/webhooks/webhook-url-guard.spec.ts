import 'reflect-metadata';
import {
  assertPublicWebhookTarget,
  WebhookTargetBlockedError,
} from './webhook-url-guard';

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

  describe('hostname targets (real DNS resolution)', () => {
    it('blocks "localhost", which resolves to a loopback address', async () => {
      await expect(
        assertPublicWebhookTarget('http://localhost/hook'),
      ).rejects.toThrow(WebhookTargetBlockedError);
    });

    it('allows a real public hostname', async () => {
      await expect(
        assertPublicWebhookTarget('https://example.com/hook'),
      ).resolves.toBeUndefined();
    });

    it('fails closed with a clean error for a hostname that does not resolve at all, rather than leaking a raw DNS error', async () => {
      await expect(
        assertPublicWebhookTarget(
          'https://this-subdomain-does-not-exist.example.com/hook',
        ),
      ).rejects.toThrow(WebhookTargetBlockedError);
    });
  });
});
