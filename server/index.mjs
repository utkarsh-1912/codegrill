import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createPluginRegistry } from './plugins/registry.mjs';
import { buildAnalytics, createStore } from './store.mjs';
import { getPublicConfig, loadServerConfig } from './config.mjs';
import { BUILTIN_SHEETS, normalizeCustomSheet } from '../src/sheets.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const curriculum = JSON.parse(readFileSync(join(__dirname, '../src/roadmap.generated.json'), 'utf8'));
const seed = JSON.parse(readFileSync(join(__dirname, '../src/multilingual_leetcode_dataset.json'), 'utf8'));
const validSlugs = new Set(curriculum.problems.map(({ slug }) => slug));

export function pickDailyProblem(problems, date = new Date()) {
  const dayKey = date.toISOString().slice(0, 10);
  let hash = 0;
  for (let i = 0; i < dayKey.length; i += 1) {
    hash = (hash * 31 + dayKey.charCodeAt(i)) >>> 0;
  }
  const problem = problems[hash % problems.length];
  return { date: dayKey, slug: problem.slug, leetcode_id: problem.leetcode_id, difficulty: problem.difficulty, category_id: problem.category_id };
}

export function createServer(configOverrides = {}) {
  const config = { ...loadServerConfig(), ...configOverrides };
  const plugins = createPluginRegistry(undefined, {
    cacheTtlMs: config.pluginCacheTtlMs,
    fetchTimeoutMs: config.pluginFetchTimeoutMs,
  });
  const store = createStore(config.storePath, config.defaultProfile);

  function sendJson(res, status, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': config.corsOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  }

  async function readJsonBody(req) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 512 * 1024) throw new Error('Request body too large');
      chunks.push(chunk);
    }
    const raw = Buffer.concat(chunks).toString('utf8').trim();
    return raw ? JSON.parse(raw) : {};
  }

  return http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': config.corsOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    try {
      if (req.method === 'GET' && pathname === '/api/health') {
        return sendJson(res, 200, {
          ok: true,
          service: `${config.brand.name}-backend`,
          problems: curriculum.problems.length,
          topics: curriculum.roadmap_categories.length,
          locales: seed.platform_metadata.supported_locales.map((l) => l.code),
          plugins: plugins.list(),
        });
      }

      if (req.method === 'GET' && pathname === '/api/config') {
        return sendJson(res, 200, getPublicConfig(config, plugins.list()));
      }

      if (req.method === 'GET' && pathname === '/api/daily') {
        return sendJson(res, 200, pickDailyProblem(curriculum.problems));
      }

      if (req.method === 'GET' && pathname === '/api/analytics') {
        const profileId = url.searchParams.get('profile') || config.defaultProfile;
        const profile = await store.getProgress(profileId);
        return sendJson(
          res,
          200,
          buildAnalytics(profile, curriculum.problems, curriculum.roadmap_categories, config.interview.activityDays),
        );
      }

      if (req.method === 'GET' && pathname === '/api/catalog') {
        return sendJson(res, 200, {
          categories: curriculum.roadmap_categories,
          problems: curriculum.problems,
          languages: curriculum.languages,
          locales: seed.platform_metadata.supported_locales,
        });
      }

      if (req.method === 'GET' && pathname === '/api/plugins/list') {
        return sendJson(res, 200, { plugins: plugins.list() });
      }

      if (req.method === 'GET' && pathname === '/api/plugins/fetch') {
        const target = url.searchParams.get('url') || '';
        const locale = url.searchParams.get('locale') || seed.platform_metadata.default_locale;
        if (!target) return sendJson(res, 400, { error: 'Missing url parameter' });
        const result = await plugins.fetch(target, { locale });
        return sendJson(res, 200, result);
      }

      if (req.method === 'GET' && pathname === '/api/progress') {
        const profile = url.searchParams.get('profile') || config.defaultProfile;
        const progress = await store.getProgress(profile);
        return sendJson(res, 200, progress);
      }

      if (req.method === 'PUT' && pathname === '/api/progress') {
        const profile = url.searchParams.get('profile') || config.defaultProfile;
        const body = await readJsonBody(req);
        const saved = await store.saveProgress(profile, body, validSlugs);
        return sendJson(res, 200, saved);
      }

      if (req.method === 'DELETE' && pathname === '/api/progress') {
        const profile = url.searchParams.get('profile') || config.defaultProfile;
        const fresh = await store.resetProgress(profile);
        return sendJson(res, 200, fresh);
      }

      if (req.method === 'GET' && pathname === '/api/sheets') {
        const custom = await store.listCustomSheets();
        return sendJson(res, 200, { builtin: BUILTIN_SHEETS, custom });
      }

      if (req.method === 'POST' && pathname === '/api/sheets') {
        const body = await readJsonBody(req);
        const sheet = normalizeCustomSheet(body, validSlugs);
        const saved = await store.addCustomSheet(sheet);
        return sendJson(res, 201, saved);
      }

      if (req.method === 'DELETE' && pathname.startsWith('/api/sheets/')) {
        const id = decodeURIComponent(pathname.slice('/api/sheets/'.length));
        const removed = await store.deleteCustomSheet(id);
        return sendJson(res, removed ? 200 : 404, { ok: removed, id });
      }

      return sendJson(res, 404, { error: 'Not found' });
    } catch (error) {
      return sendJson(res, 400, { error: error?.message || 'Request failed' });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const config = loadServerConfig();
  const server = createServer(config);
  server.listen(config.port, config.host, () => {
    console.log(`${config.brand.name} backend listening on http://${config.host}:${config.port}`);
  });
}
