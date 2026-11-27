const DEFAULT_ALLOWED_ORIGINS = [
  'https://codegrill.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

export function parseAllowedOrigins(envValue = process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGIN || '') {
  const raw = String(envValue || '').trim();
  if (!raw || raw === '*') {
    if (process.env.ALLOW_WILDCARD_CORS === 'true') return ['*'];
    return [...DEFAULT_ALLOWED_ORIGINS];
  }
  return raw
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

export function resolveCorsOrigin(requestOrigin, allowedOrigins = parseAllowedOrigins()) {
  if (!requestOrigin) return '';
  const normalized = String(requestOrigin).trim().replace(/\/+$/, '');
  if (allowedOrigins.includes('*')) return '*';
  if (allowedOrigins.includes(normalized)) return normalized;
  return '';
}

export function buildCorsHeaders(requestOrigin, allowedOrigins = parseAllowedOrigins()) {
  const matched = resolveCorsOrigin(requestOrigin, allowedOrigins);
  const headers = {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (matched) {
    headers['Access-Control-Allow-Origin'] = matched;
  }
  return headers;
}
