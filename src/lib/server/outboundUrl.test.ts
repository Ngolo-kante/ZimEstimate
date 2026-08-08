import { describe, expect, it } from 'vitest';
import { isPublicIpAddress, validatePublicHttpUrl } from './outboundUrl';

describe('outbound URL validation', () => {
  it.each(['127.0.0.1', '10.0.0.1', '169.254.169.254', '192.168.1.2', '::1', 'fd00::1']) (
    'rejects private address %s',
    (address) => expect(isPublicIpAddress(address)).toBe(false)
  );

  it.each(['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'])(
    'accepts public address %s',
    (address) => expect(isPublicIpAddress(address)).toBe(true)
  );

  it('accepts a public HTTPS destination', async () => {
    const result = await validatePublicHttpUrl(
      'https://supplier.example/products',
      async () => [{ address: '203.0.114.10', family: 4 }]
    );
    expect(result.toString()).toBe('https://supplier.example/products');
  });

  it.each([
    'http://127.0.0.1/admin',
    'http://169.254.169.254/latest/meta-data',
    'https://localhost/config',
    'https://metadata.google.internal/',
    'https://example.com:8443/private',
    'https://user:password@example.com/',
  ])('rejects unsafe destination %s', async (url) => {
    await expect(validatePublicHttpUrl(url)).rejects.toThrow();
  });

  it('rejects hostnames that resolve to private addresses', async () => {
    await expect(
      validatePublicHttpUrl('https://rebind.example', async () => [
        { address: '93.184.216.34', family: 4 },
        { address: '127.0.0.1', family: 4 },
      ])
    ).rejects.toThrow('Private network');
  });
});
