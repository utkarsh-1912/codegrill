// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApiHandler } from '../server/index.mjs';
import { getClientIp } from '../server/security/rateLimit.mjs';
import { isBlockedIp, isSafePublicUrl } from '../server/security/ssrf.mjs';

async function callApi(handler, { method = 'GET', url = '/api/health', headers = {}, body = null } = {}) {
  let status = 0;
  let resHeaders = {};
  let text = '';
  const req = {
    method,
    url,
    headers: { host: 'localhost:4000', ...headers },
    body,
    socket: { remoteAddress: headers['x-forwarded-for'] || '127.0.0.1' },
  };
  const res = {
    writeHead(s, h = {}) {
      status = s;
      resHeaders = h;
    },
    end(b = '') {
      text = typeof b === 'string' ? b : Buffer.from(b).toString('utf8');
    },
  };
  await handler(req, res);
  return { status, headers: resHeaders, data: text ? JSON.parse(text) : {} };
}

describe('SSRF IPv4 & IPv6 blocking', () => {
  it('blocks private IPv4, link-local metadata, IPv6 ULA/link-local, IPv4-mapped, and NAT64', () => {
    const blocked = [
      '127.0.0.1',
      '10.0.0.5',
      '172.16.0.1',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '::1',
      '::',
      'fc00::1',
      'fd12:3456:789a::1',
      'fe80::1',
      'fec0::1',
      '100::1',
      '::ffff:127.0.0.1',
      '::ffff:169.254.169.254',
      '64:ff9b::127.0.0.1',
      '64:ff9b::169.254.169.254',
    ];
    for (const ip of blocked) {
      expect(isBlockedIp(ip), `Expected ${ip} to be blocked`).toBe(true);
    }

    expect(isBlockedIp('1.1.1.1')).toBe(false);
    expect(isBlockedIp('8.8.8.8')).toBe(false);
    expect(isBlockedIp('2606:4700:4700::1111')).toBe(false);
    expect(isSafePublicUrl('https://169.254.169.254/latest/meta-data/')).toBe(false);
    expect(isSafePublicUrl('https://[::ffff:127.0.0.1]/')).toBe(false);
    expect(isSafePublicUrl('https://[fc00::1]/')).toBe(false);
    expect(isSafePublicUrl('https://example.com/docs')).toBe(true);
  });
});

describe('API HTTP integration: 401, 409, and 429 paths', () => {
  let tmpDir;
  let storePath;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'codegrill-vitest-'));
    storePath = join(tmpDir, 'store.json');
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns 401 Unauthorized on protected progress endpoints when requireAuth is enforced', async () => {
    const handler = createApiHandler({ requireAuth: true, databaseUrl: '', storePath });

    const r1 = await callApi(handler, { method: 'GET', url: '/api/progress' });
    expect(r1.status).toBe(401);

    const r2 = await callApi(handler, {
      method: 'POST',
      url: '/api/progress/import',
      body: { completed: ['two-sum'] },
    });
    expect(r2.status).toBe(401);

    const r3 = await callApi(handler, {
      method: 'POST',
      url: '/api/progress/restore',
      body: { expectedUpdatedAt: new Date().toISOString() },
    });
    expect(r3.status).toBe(401);
  });

  it('returns 409 REVISION_CONFLICT on stale expectedUpdatedAt for PUT /api/progress and POST /api/progress/restore', async () => {
    const handler = createApiHandler({ requireAuth: false, databaseUrl: '', storePath });

    const initial = await callApi(handler, { method: 'GET', url: '/api/progress?profile=occ-test' });
    expect(initial.status).toBe(200);

    const firstWrite = await callApi(handler, {
      method: 'PUT',
      url: '/api/progress?profile=occ-test',
      body: { completed: ['two-sum'] },
    });
    expect(firstWrite.status).toBe(200);
    expect(firstWrite.data.updatedAt).toBeTruthy();

    const secondWrite = await callApi(handler, {
      method: 'PUT',
      url: '/api/progress?profile=occ-test',
      body: { completed: ['two-sum', 'group-anagrams'], expectedUpdatedAt: firstWrite.data.updatedAt },
    });
    expect(secondWrite.status).toBe(200);
    expect(secondWrite.data.updatedAt).not.toBe(firstWrite.data.updatedAt);

    // Stale PUT using firstWrite.data.updatedAt must return 409 REVISION_CONFLICT
    const stalePut = await callApi(handler, {
      method: 'PUT',
      url: '/api/progress?profile=occ-test',
      body: { completed: ['two-sum'], expectedUpdatedAt: firstWrite.data.updatedAt },
    });
    expect(stalePut.status).toBe(409);
    expect(stalePut.data.code).toBe('REVISION_CONFLICT');

    // Stale restore using firstWrite.data.updatedAt must also return 409 REVISION_CONFLICT
    const staleRestore = await callApi(handler, {
      method: 'POST',
      url: '/api/progress/restore?profile=occ-test',
      body: { completed: ['two-sum'], expectedUpdatedAt: firstWrite.data.updatedAt },
    });
    expect(staleRestore.status).toBe(409);
    expect(staleRestore.data.code).toBe('REVISION_CONFLICT');
  });

  it('returns 429 Too Many Requests with Retry-After after exhausting plugin rate limit', async () => {
    const handler = createApiHandler({ requireAuth: false, databaseUrl: '', storePath });
    const clientIp = '203.0.113.77';

    // Unauthenticated /api/plugins/fetch allows 10 requests per 60s per IP
    for (let i = 0; i < 10; i += 1) {
      await callApi(handler, {
        method: 'GET',
        url: '/api/plugins/fetch?url=https%3A%2F%2F127.0.0.1%2Fblocked',
        headers: { 'x-forwarded-for': clientIp },
      });
    }

    const limited = await callApi(handler, {
      method: 'GET',
      url: '/api/plugins/fetch?url=https%3A%2F%2F127.0.0.1%2Fblocked',
      headers: { 'x-forwarded-for': clientIp },
    });
    expect(limited.status).toBe(429);
    expect(limited.headers['Retry-After']).toBeDefined();
    expect(limited.headers['X-RateLimit-Remaining']).toBe('0');
  });

  it('guards getClientIp against leftmost x-forwarded-for spoofing', () => {
    expect(
      getClientIp({
        headers: {
          'x-forwarded-for': '1.2.3.4, 203.0.113.88',
          'x-vercel-forwarded-for': '198.51.100.42',
        },
      }),
    ).toBe('198.51.100.42');

    expect(
      getClientIp({
        headers: {
          'x-forwarded-for': '1.2.3.4, 203.0.113.88',
          'x-real-ip': '198.51.100.99',
        },
      }),
    ).toBe('198.51.100.99');

    expect(
      getClientIp({
        headers: {
          'x-forwarded-for': '1.2.3.4, 203.0.113.88',
        },
      }),
    ).toBe('203.0.113.88');
  });
});
