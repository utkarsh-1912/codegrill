import { createVerify } from 'node:crypto';

const FIREBASE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let certCache = { certs: null, expiresAt: 0 };

function decodeBase64Url(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

async function getFirebasePublicCerts() {
  if (certCache.certs && certCache.expiresAt > Date.now()) {
    return certCache.certs;
  }
  const res = await fetch(FIREBASE_CERTS_URL, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error('Failed to load Firebase public certificates');
  const certs = await res.json();
  const cc = res.headers.get('cache-control') || '';
  const maxAgeMatch = /max-age=(\d+)/i.exec(cc);
  const ttlSec = maxAgeMatch ? Math.max(60, Number(maxAgeMatch[1])) : 3600;
  certCache = { certs, expiresAt: Date.now() + ttlSec * 1000 };
  return certs;
}

export function isAuthEnforced() {
  return Boolean(process.env.FIREBASE_PROJECT_ID || process.env.REQUIRE_AUTH !== 'false' ||
    process.env.NODE_ENV === 'production' || process.env.VERCEL === '1');
}

export async function verifyBearerToken(authHeader, { projectId = process.env.FIREBASE_PROJECT_ID || '' } = {}) {
  if (!projectId) return null;
  const raw = String(authHeader || '').trim();
  if (!raw.toLowerCase().startsWith('bearer ')) return null;
  const token = raw.slice(7).trim();
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const header = JSON.parse(decodeBase64Url(parts[0]).toString('utf8'));
    const payload = JSON.parse(decodeBase64Url(parts[1]).toString('utf8'));
    if (header.alg !== 'RS256' || !header.kid) return null;

    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) return null;
    if (!Number.isFinite(payload.exp) || payload.exp <= nowSec) return null;
    if (!Number.isFinite(payload.iat) || payload.iat > nowSec) return null;
    if (!Number.isFinite(payload.auth_time) || payload.auth_time > nowSec) return null;
    if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`) return null;

    const certs = await getFirebasePublicCerts();
    const pem = certs?.[header.kid];
    if (!pem) return null;

    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);
    verifier.end();
    const valid = verifier.verify(pem, decodeBase64Url(parts[2]));
    if (!valid) return null;

    return {
      uid: payload.sub,
      email: payload.email || '',
      name: payload.name || '',
    };
  } catch {
    return null;
  }
}

export async function requireAuthenticatedUser(req, { enforce = isAuthEnforced() } = {}) {
  const user = await verifyBearerToken(req?.headers?.authorization);
  if (user) return { ok: true, user };
  if (!enforce) {
    return { ok: true, user: null };
  }
  return {
    ok: false,
    status: 401,
    error: 'Authentication required. Provide a valid Authorization: Bearer <token> header.',
  };
}
