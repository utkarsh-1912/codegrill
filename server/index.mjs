import http from 'node:http';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createPluginRegistry } from './plugins/registry.mjs';
import { fetchYouTubeTranscript } from './plugins/transcript.mjs';
import { fetchPlatformProfile } from './plugins/profiles.mjs';
import { parseExternalPracticeUrl } from '../src/externalImport.mjs';
import { buildAnalytics, createStore } from './store.mjs';
import { createNeonStore } from './neonStore.mjs';
import { getPublicConfig, loadServerConfig } from './config.mjs';
import { buildCorsHeaders, parseAllowedOrigins } from './security/cors.mjs';
import { checkRateLimit, getClientIp } from './security/rateLimit.mjs';
import { isAuthEnforced, requireAuthenticatedUser, verifyBearerToken } from './middleware/auth.mjs';
import { fetchUpcomingContests } from './contests.mjs';
import { BUILTIN_SHEETS, normalizeCustomSheet } from '../src/sheets.mjs';
import { mergeCatalogProblems } from '../src/externalProblems.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const curriculum = JSON.parse(readFileSync(join(__dirname, '../src/roadmap.generated.json'), 'utf8'));
const seed = JSON.parse(readFileSync(join(__dirname, '../src/multilingual_leetcode_dataset.json'), 'utf8'));
const allProblems = mergeCatalogProblems(curriculum.problems);
const validSlugs = new Set(allProblems.map(({ slug }) => slug));

const profileSyncCache = new Map();
const SYNC_CACHE_TTL_MS = 30 * 60 * 1000;

export function pickDailyProblem(problems, date = new Date()) {
  const dayKey = date.toISOString().slice(0, 10);
  let hash = 0;
  for (let i = 0; i < dayKey.length; i += 1) {
    hash = (hash * 31 + dayKey.charCodeAt(i)) >>> 0;
  }
  const problem = problems[hash % problems.length];
  return { date: dayKey, slug: problem.slug, leetcode_id: problem.leetcode_id, difficulty: problem.difficulty, category_id: problem.category_id };
}

export function createApiHandler(configOverrides = {}) {
  const config = { ...loadServerConfig(), ...configOverrides };
  const allowedOrigins = parseAllowedOrigins(configOverrides.allowedOrigins || process.env.ALLOWED_ORIGINS || config.corsOrigin);
  const enforceAuth = configOverrides.requireAuth ?? isAuthEnforced();
  const databaseUrl = configOverrides.databaseUrl ?? process.env.DATABASE_URL ?? '';
  const workspaceApiEnabled = configOverrides.workspaceApiEnabled ?? (process.env.VERCEL !== '1' || Boolean(databaseUrl));
  const plugins = createPluginRegistry(undefined, {
    cacheTtlMs: config.pluginCacheTtlMs,
    fetchTimeoutMs: config.pluginFetchTimeoutMs,
  });
  const localStore = configOverrides.store || createStore(config.storePath, config.defaultProfile);
  let storePromise = null;
  async function getStore() {
    if (!databaseUrl) return localStore;
    if (!storePromise) {
      storePromise = createNeonStore(databaseUrl, config.defaultProfile).catch((err) => {
        storePromise = null;
        const wrapped = new Error(`Cloud database unavailable: ${err?.message || 'Neon initialization failed'}`);
        wrapped.statusCode = 503;
        throw wrapped;
      });
    }
    return storePromise;
  }

  function sendJson(req, res, status, payload, extraHeaders = {}) {
    const body = JSON.stringify(payload);
    const cors = buildCorsHeaders(req.headers?.origin, allowedOrigins);
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      ...cors,
      ...extraHeaders,
    });
    res.end(body);
  }

  async function readJsonBody(req) {
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      if (Buffer.byteLength(JSON.stringify(req.body)) > 512 * 1024) throw new Error('Request body too large');
      if (Array.isArray(req.body)) throw new Error('Expected a JSON object');
      return req.body;
    }
    const chunks = [];
    let size = 0;
    const body = typeof req.body === 'string' || Buffer.isBuffer(req.body) ? [Buffer.from(req.body)] : req;
    for await (const chunk of body) {
      size += chunk.length;
      if (size > 512 * 1024) throw new Error('Request body too large');
      chunks.push(chunk);
    }
    const raw = Buffer.concat(chunks).toString('utf8').trim();
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Expected a JSON object');
    return parsed;
  }

  async function resolveUserProfileId(req, url) {
    const auth = await requireAuthenticatedUser(req, { enforce: enforceAuth });
    if (!auth.ok) return { error: auth.error, status: auth.status };
    if (auth.user) {
      const profileId = 'firebase-' + createHash('sha256').update(auth.user.uid).digest('hex');
      return { profileId, user: auth.user };
    }
    const profileId = url.searchParams.get('profile') || config.defaultProfile;
    if (!/^[a-zA-Z0-9_-]{1,48}$/.test(profileId)) return { error: 'Invalid profile ID', status: 400 };
    return { profileId, user: null };
  }

  return async function handleApiRequest(req, res) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, buildCorsHeaders(req.headers?.origin, allowedOrigins));
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers?.host || 'localhost'}`);
    const pathname = url.pathname;

    try {
      const store = await getStore();
      if (req.method === 'GET' && pathname === '/api/health') {
        const isCloudDb = store.driver === 'neon-postgresql';
        if (typeof store.ping === 'function') {
          await store.ping();
        }
        return sendJson(req, res, 200, {
          ok: true,
          service: `${config.brand.name}-backend`,
          authEnforced: enforceAuth,
          cloudDb: isCloudDb,
          workspaceApiEnabled,
          problems: allProblems.length,
          topics: curriculum.roadmap_categories.length,
          locales: seed.platform_metadata.supported_locales.map((l) => l.code),
          plugins: plugins.list(),
        });
      }

      if (req.method === 'GET' && pathname === '/api/config') {
        return sendJson(req, res, 200, {
          ...getPublicConfig(config, plugins.list()),
          authEnabled: enforceAuth,
          cloudDb: store.driver === 'neon-postgresql',
          workspaceApiEnabled,
        });
      }

      if (!workspaceApiEnabled && /^\/api\/(?:progress|analytics|sheets|profiles)(?:\/|$)/.test(pathname) &&
          pathname !== '/api/profiles/sync') {
        return sendJson(req, res, 503, { error: 'Workspace storage is unavailable on this deployment' });
      }

      if (req.method === 'GET' && pathname === '/api/daily') {
        return sendJson(req, res, 200, pickDailyProblem(allProblems));
      }

      // Unified multi-platform public REST API: GET /api/platforms/:platform/user/:handle
      const platformUserMatch = /^\/api\/platforms\/([a-z0-9_-]{2,20})\/user\/([^/]{1,80})$/i.exec(pathname);
      if (req.method === 'GET' && platformUserMatch) {
        const user = await verifyBearerToken(req.headers?.authorization);
        const rl = await checkRateLimit({
          key: user ? `sync:u:${user.uid}` : `sync:ip:${getClientIp(req)}`,
          limit: user ? 20 : 10,
          windowSec: 3600,
        });
        if (!rl.allowed) {
          return sendJson(req, res, 429, { error: 'Profile sync rate limit exceeded', retryAfterSec: rl.resetSec }, {
            'Retry-After': String(rl.resetSec),
          });
        }
        const platform = platformUserMatch[1].toLowerCase();
        const handle = decodeURIComponent(platformUserMatch[2]).trim();
        const cacheKey = `${platform}:${handle.toLowerCase()}`;
        const cached = profileSyncCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
          return sendJson(req, res, 200, { ...cached.payload, cached: true }, { 'Cache-Control': 'public, max-age=300' });
        }
        const result = await fetchPlatformProfile(platform, handle, config.pluginFetchTimeoutMs);
        if (result?.ok) {
          profileSyncCache.set(cacheKey, { payload: result, expiresAt: Date.now() + SYNC_CACHE_TTL_MS });
        }
        return sendJson(req, res, result.ok ? 200 : 404, result, { 'Cache-Control': 'public, max-age=300' });
      }

      // Universal question/contest URL importer: POST /api/platforms/import-url
      if (req.method === 'POST' && pathname === '/api/platforms/import-url') {
        const body = await readJsonBody(req);
        try {
          const item = parseExternalPracticeUrl(body?.url);
          const imported = [item];
          // For Codeforces contests, optionally expand problems A, B, C... from official standings API
          if (item.platform === 'codeforces' && item.kind === 'contest' && item.contestId) {
            try {
              const cfRes = await fetch(
                `https://codeforces.com/api/contest.standings?contestId=${encodeURIComponent(item.contestId)}&from=1&count=1`,
                { signal: AbortSignal.timeout(5000) },
              );
              if (cfRes.ok) {
                const cfData = await cfRes.json();
                const probs = cfData?.result?.problems;
                if (Array.isArray(probs) && probs.length > 0) {
                  for (const p of probs.slice(0, 12)) {
                    imported.push({
                      id: `cf-p-${item.contestId}${String(p.index || '').toLowerCase()}`,
                      platform: 'codeforces',
                      platformLabel: 'Codeforces',
                      kind: 'problem',
                      slug: `cf-${item.contestId}${String(p.index || '').toLowerCase()}`,
                      title: `${item.contestId}${p.index}. ${p.name}`,
                      url: `https://codeforces.com/contest/${item.contestId}/problem/${p.index}`,
                    });
                  }
                }
              }
            } catch {
              // Keep base contest item if standings unavailable
            }
          }
          return sendJson(req, res, 200, { ok: true, items: imported });
        } catch (err) {
          return sendJson(req, res, 400, { error: err?.message || 'Invalid problem or contest URL' });
        }
      }

      if (req.method === 'GET' && (pathname === '/api/contests' || pathname === '/api/platforms/contests')) {
        const forceRefresh = url.searchParams.get('refresh') === '1';
        const contests = await fetchUpcomingContests({ timeoutMs: config.pluginFetchTimeoutMs, forceRefresh });
        return sendJson(req, res, 200, { contests }, { 'Cache-Control': forceRefresh ? 'no-store' : 'public, max-age=300, s-maxage=900' });
      }

      if (req.method === 'GET' && pathname === '/api/analytics') {
        const resolved = await resolveUserProfileId(req, url);
        if (resolved.error) return sendJson(req, res, resolved.status, { error: resolved.error });
        const profile = await store.getProgress(resolved.profileId);
        return sendJson(
          req,
          res,
          200,
          buildAnalytics(profile, allProblems, curriculum.roadmap_categories, config.interview.activityDays),
        );
      }

      if (req.method === 'GET' && pathname === '/api/catalog') {
        return sendJson(req, res, 200, {
          categories: curriculum.roadmap_categories,
          problems: allProblems,
          languages: curriculum.languages,
          locales: seed.platform_metadata.supported_locales,
        });
      }

      if (req.method === 'GET' && pathname === '/api/plugins/list') {
        return sendJson(req, res, 200, { plugins: plugins.list() });
      }

      if (req.method === 'GET' && pathname === '/api/plugins/fetch') {
        const target = url.searchParams.get('url') || '';
        const locale = url.searchParams.get('locale') || seed.platform_metadata.default_locale;
        if (!target) return sendJson(req, res, 400, { error: 'Missing url parameter' });

        const user = await verifyBearerToken(req.headers?.authorization);
        const rl = await checkRateLimit({
          key: user ? `plugin:u:${user.uid}` : `plugin:ip:${getClientIp(req)}`,
          limit: user ? 30 : 10,
          windowSec: 60,
        });
        if (!rl.allowed) {
          return sendJson(req, res, 429, { error: 'Plugin rate limit exceeded', retryAfterSec: rl.resetSec }, {
            'Retry-After': String(rl.resetSec),
            'X-RateLimit-Limit': String(rl.limit),
            'X-RateLimit-Remaining': '0',
          });
        }
        const result = await plugins.fetch(target, { locale });
        return sendJson(req, res, 200, result, {
          'X-RateLimit-Limit': String(rl.limit),
          'X-RateLimit-Remaining': String(rl.remaining),
        });
      }

      if (req.method === 'GET' && pathname === '/api/plugins/transcript') {
        const videoId = url.searchParams.get('videoId') || '';
        const locale = url.searchParams.get('locale') || seed.platform_metadata.default_locale;
        if (!videoId) return sendJson(req, res, 400, { error: 'Missing videoId parameter' });

        const user = await verifyBearerToken(req.headers?.authorization);
        const rl = await checkRateLimit({
          key: user ? `transcript:u:${user.uid}` : `transcript:ip:${getClientIp(req)}`,
          limit: user ? 30 : 10,
          windowSec: 60,
        });
        if (!rl.allowed) {
          return sendJson(req, res, 429, { error: 'Transcript rate limit exceeded', retryAfterSec: rl.resetSec }, {
            'Retry-After': String(rl.resetSec),
          });
        }
        const result = await fetchYouTubeTranscript(videoId, locale);
        return sendJson(req, res, 200, result);
      }

      if (req.method === 'GET' && pathname === '/api/progress') {
        const resolved = await resolveUserProfileId(req, url);
        if (resolved.error) return sendJson(req, res, resolved.status, { error: resolved.error });
        const progress = await store.getProgress(resolved.profileId);
        return sendJson(req, res, 200, progress);
      }

      if (req.method === 'PUT' && pathname === '/api/progress') {
        const resolved = await resolveUserProfileId(req, url, { mutate: true });
        if (resolved.error) return sendJson(req, res, resolved.status, { error: resolved.error });
        const body = await readJsonBody(req);
        if (
          body.expectedUpdatedAt !== undefined &&
          body.expectedUpdatedAt !== null &&
          body.expectedUpdatedAt !== '' &&
          (typeof body.expectedUpdatedAt !== 'string' || Number.isNaN(Date.parse(body.expectedUpdatedAt)))
        ) {
          return sendJson(req, res, 400, { error: 'Invalid expectedUpdatedAt timestamp' });
        }
        try {
          const saved = await store.saveProgress(resolved.profileId, body, validSlugs);
          return sendJson(req, res, 200, saved);
        } catch (err) {
          if (err?.statusCode === 400) {
            return sendJson(req, res, 400, { error: err.message || 'Invalid request' });
          }
          if (err?.statusCode === 409) {
            return sendJson(req, res, 409, {
              error: err.message || 'Conflict: remote progress has a newer revision',
              code: 'REVISION_CONFLICT',
              progress: err.current || null,
            });
          }
          throw err;
        }
      }

      // Deterministic Guest -> Auth merge import route (OCC retry loop + timestamp-aware note resolution + lossless activity union)
      if (req.method === 'POST' && pathname === '/api/progress/import') {
        const resolved = await resolveUserProfileId(req, url, { mutate: true });
        if (resolved.error) return sendJson(req, res, resolved.status, { error: resolved.error });
        const body = await readJsonBody(req);

        let saved = null;
        let lastConflictProgress = null;
        const maxAttempts = 3;
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          const existing = attempt === 0 || !lastConflictProgress
            ? await store.getProgress(resolved.profileId)
            : lastConflictProgress;
          const mergedCompleted = [...new Set([...(existing.completed || []), ...(body.completed || [])])];
          const mergedBookmarked = [...new Set([...(existing.bookmarked || []), ...(body.bookmarked || [])])];

          const existingNotes = existing.notes || {};
          const incomingNotes = body.notes && typeof body.notes === 'object' ? body.notes : {};
          const existingTs = existing.notesUpdatedAt || {};
          const incomingTs = body.notesUpdatedAt && typeof body.notesUpdatedAt === 'object' ? body.notesUpdatedAt : {};
          const mergedNotes = { ...existingNotes };
          const mergedNotesUpdatedAt = { ...existingTs };
          for (const [slug, text] of Object.entries(incomingNotes)) {
            if (typeof text !== 'string' || !text.trim()) continue;
            const curTs = Date.parse(existingTs[slug] || existing.updatedAt || '') || 0;
            const incTs = Date.parse(incomingTs[slug] || body.updatedAt || '') || 0;
            if (!existingNotes[slug] || incTs >= curTs) {
              mergedNotes[slug] = text;
              mergedNotesUpdatedAt[slug] = incomingTs[slug] || body.updatedAt || new Date().toISOString();
            }
          }

          const mergedActivity = { ...(existing.activity || {}) };
          for (const [day, count] of Object.entries(body.activity || {})) {
            if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
              mergedActivity[day] = Math.max(Number(mergedActivity[day] || 0), Number(count || 0));
            }
          }
          try {
            saved = await store.saveProgress(resolved.profileId, {
              locale: body.locale || existing.locale,
              completed: mergedCompleted,
              bookmarked: mergedBookmarked,
              notes: mergedNotes,
              notesUpdatedAt: mergedNotesUpdatedAt,
              activity: mergedActivity,
              isPublicProfile: typeof body.isPublicProfile === 'boolean' ? body.isPublicProfile : existing.isPublicProfile,
              handle: typeof body.handle === 'string' ? body.handle : existing.handle,
              expectedUpdatedAt: existing.updatedAt || undefined,
            }, validSlugs);
            break;
          } catch (err) {
            if (err?.statusCode === 409) {
              lastConflictProgress = err.current || null;
              if (attempt === maxAttempts - 1) {
                return sendJson(req, res, 409, {
                  error: err.message || 'Conflict: concurrent cloud edit during import',
                  code: 'REVISION_CONFLICT',
                  progress: lastConflictProgress,
                });
              }
              continue;
            }
            throw err;
          }
        }
        if (body.linkedProfiles && typeof body.linkedProfiles === 'object') {
          const existingProfiles = await store.getLinkedProfiles(resolved.profileId);
          await store.saveLinkedProfiles(resolved.profileId, { ...existingProfiles, ...body.linkedProfiles });
        }
        if (Array.isArray(body.customSheets)) {
          const owner = resolved.user ? resolved.profileId : null;
          const existingSheets = await store.listCustomSheets(owner);
          const seenIds = new Set(existingSheets.map((s) => s.id));
          for (const rawSheet of body.customSheets) {
            const norm = normalizeCustomSheet(rawSheet, validSlugs);
            if (!seenIds.has(norm.id)) {
              await store.addCustomSheet(norm, owner);
              seenIds.add(norm.id);
            }
          }
        }
        return sendJson(req, res, 200, { ok: true, progress: saved });
      }

      // Atomic full/partial workspace restore route (single transaction for progress + linked profiles + custom sheets with OCC)
      if (req.method === 'POST' && pathname === '/api/progress/restore') {
        const resolved = await resolveUserProfileId(req, url, { mutate: true });
        if (resolved.error) return sendJson(req, res, resolved.status, { error: resolved.error });
        const body = await readJsonBody(req);
        if (typeof body.expectedUpdatedAt !== 'string' || !body.expectedUpdatedAt.trim() || Number.isNaN(Date.parse(body.expectedUpdatedAt))) {
          return sendJson(req, res, 400, { error: 'A valid ISO expectedUpdatedAt revision is required for atomic restore' });
        }
        const normalizedSheets = Array.isArray(body.customSheets)
          ? body.customSheets.map((s) => normalizeCustomSheet(s, validSlugs))
          : null;
        try {
          const owner = resolved.user ? resolved.profileId : null;
          const result = await store.restoreWorkspace(
            resolved.profileId,
            {
              progressPatch: body.progressPatch || null,
              linkedProfiles: body.linkedProfiles || null,
              customSheets: normalizedSheets,
              expectedUpdatedAt: body.expectedUpdatedAt,
            },
            validSlugs,
            owner,
          );
          return sendJson(req, res, 200, result);
        } catch (err) {
          if (err?.statusCode === 409) {
            return sendJson(req, res, 409, {
              error: err.message || 'Conflict: remote progress has a newer revision',
              code: 'REVISION_CONFLICT',
              progress: err.current || null,
            });
          }
          if (err?.statusCode === 403) {
            return sendJson(req, res, 403, { error: err.message || 'Forbidden' });
          }
          throw err;
        }
      }

      if (req.method === 'DELETE' && pathname === '/api/progress') {
        const resolved = await resolveUserProfileId(req, url, { mutate: true });
        if (resolved.error) return sendJson(req, res, resolved.status, { error: resolved.error });
        const fresh = await store.resetProgress(resolved.profileId);
        return sendJson(req, res, 200, fresh);
      }

      if (req.method === 'GET' && pathname === '/api/profiles') {
        const resolved = await resolveUserProfileId(req, url);
        if (resolved.error) return sendJson(req, res, resolved.status, { error: resolved.error });
        const profiles = await store.getLinkedProfiles(resolved.profileId);
        return sendJson(req, res, 200, { profiles });
      }

      if (req.method === 'PUT' && pathname === '/api/profiles') {
        const resolved = await resolveUserProfileId(req, url, { mutate: true });
        if (resolved.error) return sendJson(req, res, resolved.status, { error: resolved.error });
        const body = await readJsonBody(req);
        const saved = await store.saveLinkedProfiles(resolved.profileId, body?.profiles || body);
        return sendJson(req, res, 200, { profiles: saved });
      }

      if (req.method === 'GET' && pathname === '/api/profiles/sync') {
        const platform = (url.searchParams.get('platform') || '').trim().toLowerCase();
        const handle = (url.searchParams.get('handle') || '').trim();
        if (!platform || !handle) return sendJson(req, res, 400, { error: 'Missing platform or handle parameter' });

        const user = await verifyBearerToken(req.headers?.authorization);
        const rl = await checkRateLimit({
          key: user ? `sync:u:${user.uid}` : `sync:ip:${getClientIp(req)}`,
          limit: user ? 10 : 3,
          windowSec: 3600,
        });
        if (!rl.allowed) {
          return sendJson(req, res, 429, { error: 'Profile sync rate limit exceeded', retryAfterSec: rl.resetSec }, {
            'Retry-After': String(rl.resetSec),
          });
        }

        const cacheKey = `${platform}:${handle.toLowerCase()}`;
        const cached = profileSyncCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
          return sendJson(req, res, 200, { ...cached.payload, cached: true }, { 'Cache-Control': 'private, max-age=300' });
        }

        const result = await fetchPlatformProfile(platform, handle, config.pluginFetchTimeoutMs);
        if (result?.ok) {
          profileSyncCache.set(cacheKey, { payload: result, expiresAt: Date.now() + SYNC_CACHE_TTL_MS });
        }
        return sendJson(req, res, 200, result, { 'Cache-Control': 'private, max-age=300' });
      }

      if (req.method === 'GET' && pathname.startsWith('/api/u/')) {
        const handle = decodeURIComponent(pathname.slice('/api/u/'.length)).trim();
        if (!handle || !/^[a-zA-Z0-9._-]{1,40}$/.test(handle)) {
          return sendJson(req, res, 400, { error: 'Invalid handle' });
        }
        const portfolio = await store.getPublicPortfolio?.(handle);
        if (!portfolio) {
          return sendJson(req, res, 404, { error: 'No published portfolio found' });
        }
        // Explicit public DTO allowlist: never expose private notes, bookmarks, or email
        const publicProgress = {
          completed: Array.isArray(portfolio.progress?.completed) ? portfolio.progress.completed : [],
          activity: portfolio.progress?.activity && typeof portfolio.progress.activity === 'object'
            ? portfolio.progress.activity
            : {},
          streak: Number(portfolio.progress?.streak || 0),
          longestStreak: Number(portfolio.progress?.longestStreak || 0),
          updatedAt: portfolio.progress?.updatedAt || null,
        };
        const analytics = buildAnalytics(
          publicProgress,
          allProblems,
          curriculum.roadmap_categories,
          config.interview.activityDays,
        );
        return sendJson(req, res, 200, {
          handle: portfolio.handle,
          displayName: portfolio.displayName || '',
          progress: publicProgress,
          profiles: portfolio.profiles || {},
          analytics,
        });
      }

      if (req.method === 'GET' && pathname === '/api/sheets') {
        const resolved = await resolveUserProfileId(req, url);
        const custom = resolved.error ? [] : await store.listCustomSheets(resolved.user ? resolved.profileId : null);
        return sendJson(req, res, 200, { builtin: BUILTIN_SHEETS, custom });
      }

      if (req.method === 'POST' && pathname === '/api/sheets') {
        const resolved = await resolveUserProfileId(req, url, { mutate: true });
        if (resolved.error) return sendJson(req, res, resolved.status, { error: resolved.error });
        const body = await readJsonBody(req);
        const sheet = normalizeCustomSheet(body, validSlugs);
        const saved = await store.addCustomSheet(sheet, resolved.user ? resolved.profileId : null);
        return sendJson(req, res, 201, saved);
      }

      if (req.method === 'DELETE' && pathname.startsWith('/api/sheets/')) {
        const resolved = await resolveUserProfileId(req, url, { mutate: true });
        if (resolved.error) return sendJson(req, res, resolved.status, { error: resolved.error });
        const id = decodeURIComponent(pathname.slice('/api/sheets/'.length));
        const removed = await store.deleteCustomSheet(id, resolved.user ? resolved.profileId : null);
        return sendJson(req, res, removed ? 200 : 404, { ok: removed, id });
      }

      return sendJson(req, res, 404, { error: 'Not found' });
    } catch (error) {
      const code = Number(error?.statusCode) || 400;
      return sendJson(req, res, code, { error: error?.message || 'Request failed' });
    }
  };
}

export function createServer(configOverrides = {}) {
  return http.createServer(createApiHandler(configOverrides));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const config = loadServerConfig();
  const server = createServer(config);
  server.listen(config.port, config.host, () => {
    console.log(`${config.brand.name} backend listening on http://${config.host}:${config.port}`);
  });
}
