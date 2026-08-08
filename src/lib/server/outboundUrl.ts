import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.google',
]);

type ResolvedAddress = { address: string; family: number };
type AddressResolver = (hostname: string) => Promise<ResolvedAddress[]>;

const defaultResolver: AddressResolver = (hostname) =>
  lookup(hostname, { all: true, verbatim: true });

function isPublicIpv4(address: string): boolean {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b, c] = octets;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 0 && c === 0) return false;
  if (a === 192 && b === 0 && c === 2) return false;
  if (a === 192 && b === 168) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

function isPublicIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split('%')[0];
  // Public global-unicast IPv6 space is 2000::/3. Keeping the allow rule this
  // narrow also rejects loopback, link-local, unique-local, multicast, and
  // IPv4-mapped addresses without relying on fragile textual expansion.
  if (!/^[23][0-9a-f]{3}:/.test(normalized)) return false;
  if (normalized.startsWith('2001:db8:')) return false;
  return true;
}

export function isPublicIpAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family === 6) return isPublicIpv6(address);
  return false;
}

export async function validatePublicHttpUrl(
  value: string | URL,
  resolver: AddressResolver = defaultResolver
): Promise<URL> {
  const parsed = value instanceof URL ? new URL(value.toString()) : new URL(value);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP and HTTPS scraper URLs are allowed.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Credentials are not allowed in scraper URLs.');
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (
    BLOCKED_HOSTNAMES.has(hostname)
    || hostname.endsWith('.localhost')
    || hostname.endsWith('.local')
    || hostname.endsWith('.internal')
    || hostname.endsWith('.home.arpa')
  ) {
    throw new Error('Private network scraper destinations are not allowed.');
  }

  const expectedPort = parsed.protocol === 'https:' ? '443' : '80';
  if (parsed.port && parsed.port !== expectedPort) {
    throw new Error('Only standard HTTP and HTTPS ports are allowed.');
  }

  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await resolver(hostname);

  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicIpAddress(address))) {
    throw new Error('Private network scraper destinations are not allowed.');
  }

  return parsed;
}
