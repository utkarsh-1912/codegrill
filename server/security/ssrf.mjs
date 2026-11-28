import { lookup } from 'node:dns/promises';
import { get } from 'node:https';
import { isIP } from 'node:net';

const MAX_REDIRECTS = 3;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2 MB hard cap

function ipv4ToInt(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0);
}

function inIpv4Cidr(ipInt, baseIp, prefixLen) {
  const baseInt = ipv4ToInt(baseIp);
  if (baseInt === null) return false;
  const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

const BLOCKED_IPV4_CIDRS = [
  ['0.0.0.0', 8],          // Unspecified / "this" network
  ['10.0.0.0', 8],         // RFC1918 Private
  ['100.64.0.0', 10],      // CGNAT (RFC6598)
  ['127.0.0.0', 8],        // Loopback
  ['169.254.0.0', 16],     // Link-local & Cloud Metadata (169.254.169.254)
  ['172.16.0.0', 12],      // RFC1918 Private
  ['192.0.0.0', 24],       // IETF Protocol Assignments
  ['192.0.2.0', 24],       // TEST-NET-1
  ['192.168.0.0', 16],     // RFC1918 Private
  ['198.18.0.0', 15],      // Benchmarking
  ['198.51.100.0', 24],    // TEST-NET-2
  ['203.0.113.0', 24],     // TEST-NET-3
  ['224.0.0.0', 4],        // Multicast
  ['240.0.0.0', 4],        // Reserved / Broadcast
];

function expandIpv6(ip) {
  const clean = ip.toLowerCase().split('%')[0];
  // Handle IPv4-mapped or IPv4-compatible IPv6 suffixes (e.g. ::ffff:127.0.0.1)
  const lastColon = clean.lastIndexOf(':');
  let working = clean;
  if (lastColon !== -1 && clean.slice(lastColon + 1).includes('.')) {
    const v4Int = ipv4ToInt(clean.slice(lastColon + 1));
    if (v4Int === null) return null;
    const hi = ((v4Int >>> 16) & 0xffff).toString(16);
    const lo = (v4Int & 0xffff).toString(16);
    working = `${clean.slice(0, lastColon)}:${hi}:${lo}`;
  }
  const halves = working.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':').filter(Boolean) : [];
  const right = halves[1] ? halves[1].split(':').filter(Boolean) : [];
  const missing = 8 - (left.length + right.length);
  if (halves.length === 1 && missing !== 0) return null;
  if (missing < 0) return null;
  const groups = [...left, ...Array(missing).fill('0'), ...right];
  if (groups.length !== 8) return null;
  const nums = groups.map((g) => parseInt(g, 16));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 0xffff)) return null;
  return nums;
}

export function isBlockedIp(rawIp) {
  const ip = String(rawIp || '').trim().replace(/^\[|\]$/g, '');
  const version = isIP(ip);
  if (version === 4) {
    const ipInt = ipv4ToInt(ip);
    if (ipInt === null) return true;
    return BLOCKED_IPV4_CIDRS.some(([base, prefix]) => inIpv4Cidr(ipInt, base, prefix));
  }
  if (version === 6) {
    const groups = expandIpv6(ip);
    if (!groups) return true;
    const allZero = groups.every((g) => g === 0);
    if (allZero) return true; // ::
    const isLoopback = groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1;
    if (isLoopback) return true; // ::1
    // IPv4-mapped ::ffff:0:0/96, IPv4-compatible ::/96, or NAT64 64:ff9b::/96
    const isV4Mapped = groups.slice(0, 5).every((g) => g === 0) && (groups[5] === 0xffff || groups[5] === 0);
    const isNat64 = groups[0] === 0x0064 && groups[1] === 0xff9b && groups.slice(2, 6).every((g) => g === 0);
    if (isV4Mapped || isNat64) {
      const a = (groups[6] >>> 8) & 0xff;
      const b = groups[6] & 0xff;
      const c = (groups[7] >>> 8) & 0xff;
      const d = groups[7] & 0xff;
      return isBlockedIp(`${a}.${b}.${c}.${d}`);
    }
    // Discard-only 100::/64
    if (groups[0] === 0x0100 && groups[1] === 0 && groups[2] === 0 && groups[3] === 0) return true;
    // Unique Local Address fc00::/7
    if ((groups[0] & 0xfe00) === 0xfc00) return true;
    // Link-local fe80::/10 and deprecated site-local fec0::/10
    if ((groups[0] & 0xffc0) === 0xfe80 || (groups[0] & 0xffc0) === 0xfec0) return true;
    // Multicast ff00::/8
    if ((groups[0] & 0xff00) === 0xff00) return true;
    // Documentation 2001:db8::/32
    if (groups[0] === 0x2001 && groups[1] === 0x0db8) return true;
    return false;
  }
  return true;
}

export function isSafePublicUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:' || url.username || url.password) return false;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (!host) return false;
    if (
      host === 'localhost' ||
      host === 'metadata.google.internal' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host.endsWith('.localhost')
    ) {
      return false;
    }
    if (isIP(host)) {
      return !isBlockedIp(host);
    }
    // Block decimal / octal / hex single-integer IP tricks (e.g., https://2130706433)
    if (/^(0x[0-9a-f]+|\d+)$/i.test(host)) return false;
    return host.includes('.');
  } catch {
    return false;
  }
}

async function resolvePublicTarget(rawUrl, dnsLookup = lookup) {
  if (!isSafePublicUrl(rawUrl)) {
    throw new Error('Blocked unsafe or non-public URL');
  }
  const url = new URL(rawUrl);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const family = isIP(host);
  const records = family ? [{ address: host, family }] : await dnsLookup(host, { all: true });
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('Could not resolve target hostname');
  }
  for (const rec of records) {
    if (isBlockedIp(rec.address)) {
      throw new Error('Target hostname resolved to a blocked private IP address');
    }
  }
  return { url, records };
}

export async function assertSafePublicUrl(rawUrl, dnsLookup = lookup) {
  return (await resolvePublicTarget(rawUrl, dnsLookup)).url;
}

function requestPinned({ url, records }, headers, signal) {
  return new Promise((resolve, reject) => {
    const request = get(url, {
      agent: false,
      signal,
      headers: { ...headers, 'accept-encoding': 'identity' },
      lookup(_host, options, callback) {
        const candidates = options.family ? records.filter((record) => record.family === options.family) : records;
        if (!candidates.length) return callback(new Error('No approved address for this connection'));
        if (options.all) return callback(null, candidates);
        return callback(null, candidates[0].address, candidates[0].family);
      },
    }, resolve);
    request.once('error', reject);
  });
}

async function readResponseWithLimit(response, maxBytes) {
  const contentLength = Number(response.headers['content-length'] || 0);
  if (contentLength > maxBytes) {
    throw new Error(`Response exceeds ${Math.round(maxBytes / (1024 * 1024))} MB limit`);
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of response) {
    total += chunk.length;
    if (total > maxBytes) {
      throw new Error(`Response exceeds ${Math.round(maxBytes / (1024 * 1024))} MB limit`);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function safeFetchText(rawUrl, {
  signal,
  headers = {},
  timeoutMs = 9000,
  maxBytes = MAX_RESPONSE_BYTES,
  maxRedirects = MAX_REDIRECTS,
  allowedContentTypes = null,
  requestImpl = requestPinned,
  dnsLookup,
} = {}) {
  let currentUrl = rawUrl;
  const timeout = AbortSignal.timeout(timeoutMs);
  const activeSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const target = await resolvePublicTarget(currentUrl, dnsLookup);
    activeSignal.throwIfAborted();
    const response = await requestImpl(target, headers, activeSignal);
    const status = response.statusCode;
    const ok = status >= 200 && status < 300;
    const contentType = response.headers['content-type'] || '';

    try {
      if (status >= 300 && status < 400) {
        const location = response.headers.location;
        if (!location) throw new Error(`Redirect HTTP ${status} without Location header`);
        if (hop === maxRedirects) throw new Error('Too many redirects');
        currentUrl = new URL(location, currentUrl).href;
        continue;
      }

      if (allowedContentTypes && ok && contentType &&
          !allowedContentTypes.some((prefix) => contentType.toLowerCase().startsWith(prefix))) {
        throw new Error(`Unsupported content type: ${contentType.split(';')[0]}`);
      }
      const text = ok ? await readResponseWithLimit(response, maxBytes) : '';
      return { ok, status, finalUrl: currentUrl, contentType, text };
    } finally {
      response.destroy();
    }
  }
  throw new Error('Too many redirects');
}
