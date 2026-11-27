import { createApiHandler } from '../server/index.mjs';

const handler = createApiHandler();

export default async function vercelApiHandler(req, res) {
  const parsed = new URL(req.url || '/', `http://${req.headers?.host || 'localhost'}`);
  const rewrittenPath = parsed.searchParams.get('__path');
  if (rewrittenPath !== null) {
    parsed.searchParams.delete('__path');
    const qs = parsed.searchParams.toString();
    const isRewriteTarget = parsed.pathname === '/api/index' || parsed.pathname === '/api/index.js' || parsed.pathname === '/api';
    const targetPath = isRewriteTarget
      ? `/api/${rewrittenPath.replace(/^\/+/, '')}`
      : parsed.pathname;
    req.url = `${targetPath}${qs ? `?${qs}` : ''}`;
  }
  return handler(req, res);
}
