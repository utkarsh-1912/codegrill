import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  CODING_PLATFORMS,
  buildProfileUrl,
  computeCombinedProfileStats,
  normalizeLinkedProfiles,
  sanitizeHandle,
} from '../src/profiles.mjs';
import { BUILTIN_SHEETS, normalizeCustomSheet } from '../src/sheets.mjs';
import { ROADMAP_DOMAINS, buildDomainRoadmap } from '../src/domainRoadmaps.mjs';
import { CODEFORCES_PROBLEMS, HACKERRANK_PROBLEMS, mergeCatalogProblems } from '../src/externalProblems.mjs';
import {
  ROOM_FORMATS,
  buildRoomDebriefMarkdown,
  buildRoomShareUrl,
  createDefaultRoomState,
  parseRoomInput,
  roomsDirectory,
} from '../src/rooms.mjs';
import { getAllTrackModules } from '../src/trackContent.mjs';
import { getMessages } from '../src/i18n.mjs';
import { createStore } from '../server/store.mjs';
import { createPluginRegistry } from '../server/plugins/registry.mjs';
import { createApiHandler, pickDailyProblem } from '../server/index.mjs';
import { assertSafePublicUrl, isBlockedIp, isSafePublicUrl, safeFetchText } from '../server/security/ssrf.mjs';
import { buildCorsHeaders } from '../server/security/cors.mjs';
import { checkRateLimit, clearRateLimitMemory } from '../server/security/rateLimit.mjs';
import { requireAuthenticatedUser } from '../server/middleware/auth.mjs';
import { buildRecurringContests } from '../server/contests.mjs';

// 1. Coding platform profiles & aggregation
assert.ok(CODING_PLATFORMS.length >= 6, 'Expected at least 6 coding platforms');
assert.equal(sanitizeHandle('leetcode', 'https://leetcode.com/u/neal_wu/'), 'neal_wu');
assert.equal(sanitizeHandle('codeforces', '@tourist'), 'tourist');
assert.equal(buildProfileUrl('atcoder', 'chokudai'), 'https://atcoder.jp/users/chokudai');

const normalized = normalizeLinkedProfiles({
  leetcode: { handle: 'https://leetcode.com/u/neal_wu/', solved: 420, easy: 120, medium: 220, hard: 80, rating: 2450, rank: 'Guardian', source: 'live' },
  codeforces: { handle: 'tourist', solved: 1800, rating: 3900, rank: 'legendary grandmaster', source: 'live' },
  github: { handle: 'torvalds', extraCount: 10, extraLabel: 'repos', source: 'live' },
});
const combined = computeCombinedProfileStats(normalized, 50);
assert.equal(combined.linkedCount, 3);
assert.equal(combined.totalSolved, 2270);
assert.equal(combined.highestRating, 3900);
assert.equal(combined.highestRatingPlatform, 'Codeforces');

// 2. i18n coverage across all 6 locales
for (const code of ['en', 'ja', 'hi', 'es', 'zh', 'ko']) {
  const m = getMessages(code);
  assert.ok(m.nav?.roadmap, `Missing nav.roadmap for ${code}`);
  assert.ok(m.profiles?.title, `Missing profiles.title for ${code}`);
  assert.ok(Array.isArray(m.practice?.verbalSteps) && m.practice.verbalSteps.length === 4, `Missing practice.verbalSteps for ${code}`);
}

// 3. Sheets validation
assert.ok(BUILTIN_SHEETS.length >= 6, 'Expected >= 6 built-in sheets');
const validSlugs = new Set(['two-sum', 'contains-duplicate']);
const custom = normalizeCustomSheet({ name: 'My Sprint', slugs: ['two-sum', 'invalid-slug'] }, validSlugs);
assert.deepEqual(custom.slugs, ['two-sum']);

// 4. Plugin registry URL matching
const plugins = createPluginRegistry();
assert.ok(plugins.list().length >= 3, 'Expected >= 3 content plugins');
assert.equal(plugins.resolve('https://www.youtube.com/watch?v=3OamzN90kPg')?.id, 'youtube-video');
assert.equal(plugins.resolve('https://github.com/doocs/leetcode/blob/main/README.md')?.id, 'github-content');
assert.equal(plugins.resolve('https://medium.com/@beccajonas3/neetcode-75-arrays-and-hashing-c215f1f750a5')?.id, 'web-article');

// 5. Backend store persistence (isolated temp dir)
const tmp = mkdtempSync(join(tmpdir(), 'codegrill-test-'));
try {
  const store = createStore(join(tmp, 'store.json'), 'test-user');
  const saved = await store.saveProgress('test-user', { completed: ['two-sum'], bookmarked: ['two-sum'] }, validSlugs);
  assert.deepEqual(saved.completed, ['two-sum']);
  assert.ok(saved.streak >= 1);

  const savedProfiles = await store.saveLinkedProfiles('test-user', normalized);
  assert.equal(savedProfiles.leetcode.handle, 'neal_wu');

  const afterReset = await store.resetProgress('test-user');
  assert.deepEqual(afterReset.completed, []);
  const keptProfiles = await store.getLinkedProfiles('test-user');
  assert.equal(keptProfiles.leetcode.handle, 'neal_wu');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// 6. Daily challenge deterministic selection
const dailyA = pickDailyProblem(
  [{ slug: 'two-sum', leetcode_id: 1, difficulty: 'Easy', category_id: 'arrays-hashing' }],
  new Date('2026-01-01T00:00:00Z'),
);
assert.equal(dailyA.slug, 'two-sum');

// 7. Multi-domain roadmap DAG integrity (System Design, LLD, SQL, Concurrency, AI/Behavioral)
assert.equal(ROADMAP_DOMAINS.length, 6);
for (const dom of ROADMAP_DOMAINS.filter((d) => d.id !== 'dsa')) {
  const topics = buildDomainRoadmap(dom.id, {});
  assert.ok(topics.length >= 4, `Expected >= 4 topics in domain ${dom.id}`);
  assert.ok(topics.some((t) => t.ready), `Expected at least one ready foundation topic in ${dom.id}`);
}

// 8. Codeforces & HackerRank integrated problems & sheets
assert.ok(CODEFORCES_PROBLEMS.length >= 15, 'Expected >= 15 Codeforces problems');
assert.ok(HACKERRANK_PROBLEMS.length >= 12, 'Expected >= 12 HackerRank problems');
const merged = mergeCatalogProblems([{ slug: 'two-sum', leetcode_id: 1, leetcode_url: 'https://leetcode.com/problems/two-sum/' }]);
assert.equal(merged.length, 1 + CODEFORCES_PROBLEMS.length + HACKERRANK_PROBLEMS.length);
assert.ok(BUILTIN_SHEETS.some((s) => s.id === 'codeforces-core'), 'Missing codeforces-core sheet');
assert.ok(BUILTIN_SHEETS.some((s) => s.id === 'hackerrank-kit'), 'Missing hackerrank-kit sheet');

// 9. Study Rooms & Mock Interview Studio helpers
assert.equal(ROOM_FORMATS.length, 4);
const dir = roomsDirectory();
const parsedId = parseRoomInput('abc12345', dir);
assert.equal(parsedId?.roomId, 'abc12345');
const parsedShare = parseRoomInput('https://codegrill.app/rooms?room=xyz98765&mode=hld&problem=two-sum', dir);
assert.equal(parsedShare?.roomId, 'xyz98765');
assert.equal(parsedShare?.mode, 'hld');
assert.equal(parsedShare?.problem, 'two-sum');
const parsedColabs = parseRoomInput('https://utkristi-colabs.vercel.app/editor/room99', dir);
assert.equal(parsedColabs?.roomId, 'room99');
assert.equal(
  buildRoomShareUrl('https://codegrill.app', { roomId: 'room99', mode: 'lld', problem: 'two-sum' }),
  'https://codegrill.app/rooms?room=room99&mode=lld&problem=two-sum',
);
const defState = createDefaultRoomState('hld');
assert.equal(defState.mode, 'hld');
assert.ok(defState.checklist.length >= 4);
const debrief = buildRoomDebriefMarkdown({
  roomId: 'room99',
  mode: 'hld',
  exerciseTitle: 'Design a URL Shortener',
  role: 'interviewer',
  participants: ['Alex (interviewer)'],
  elapsedMin: 40,
  checklist: defState.checklist.map((_, i) => i < 3),
  scores: { approach: 4, communication: 4, execution: 3, tradeoffs: 4 },
  notes: '## Architecture',
});
assert.ok(debrief.includes('Strong Hire'));
assert.ok(debrief.includes('Design a URL Shortener'));

// 10. Complete Interview Tracks content coverage (guides, questions, videos, docs)
const seedData = JSON.parse(readFileSync(new URL('../src/multilingual_leetcode_dataset.json', import.meta.url), 'utf8'));
const trackMods = getAllTrackModules(seedData);
assert.ok(trackMods.length >= 14, `Expected >= 14 track modules, got ${trackMods.length}`);
for (const mod of trackMods) {
  assert.ok(mod.studyGuide && mod.studyGuide.length > 80, `${mod.id} missing built-in studyGuide`);
  assert.ok(Array.isArray(mod.questions) && mod.questions.length >= 2, `${mod.id} missing practice questions`);
  assert.ok((mod.resources?.en?.youtube || []).length >= 1, `${mod.id} missing video walkthrough`);
  assert.ok((mod.resources?.en?.articles || []).length >= 1, `${mod.id} missing doc/repo resource`);
}

// 11. Security: SSRF IP & URL hardening (IPv4 private, metadata, CGNAT, IPv6 ULA/link-local/mapped)
for (const badIp of [
  '127.0.0.1', '10.0.0.1', '172.16.0.5', '192.168.1.1',
  '169.254.169.254', '0.0.0.0', '100.64.0.1',
  '::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1',
  '::ffff:127.0.0.1', '::ffff:169.254.169.254',
]) {
  assert.equal(isBlockedIp(badIp), true, `Expected ${badIp} to be blocked`);
}
assert.equal(isBlockedIp('8.8.8.8'), false);
assert.equal(isBlockedIp('2606:4700:4700::1111'), false);
assert.equal(isSafePublicUrl('https://github.com/utkarsh-1912/codegrill'), true);
assert.equal(isSafePublicUrl('https://169.254.169.254/latest/meta-data/'), false);
assert.equal(isSafePublicUrl('https://[::ffff:127.0.0.1]/admin'), false);
assert.equal(isSafePublicUrl('https://2130706433/'), false);
assert.equal(isSafePublicUrl('http://example.com'), false);

// 12. Security: Strict CORS allowlist + Vary: Origin
const allowedCors = buildCorsHeaders('https://codegrill.vercel.app', ['https://codegrill.vercel.app', 'http://localhost:5173']);
assert.equal(allowedCors['Access-Control-Allow-Origin'], 'https://codegrill.vercel.app');
assert.equal(allowedCors.Vary, 'Origin');
const blockedCors = buildCorsHeaders('https://evil.example.com', ['https://codegrill.vercel.app']);
assert.equal(blockedCors['Access-Control-Allow-Origin'], undefined);

// 13. Security: Tiered rate limiting
clearRateLimitMemory();
const r1 = await checkRateLimit({ key: 'test-rl-key', limit: 2, windowSec: 60 });
const r2 = await checkRateLimit({ key: 'test-rl-key', limit: 2, windowSec: 60 });
const r3 = await checkRateLimit({ key: 'test-rl-key', limit: 2, windowSec: 60 });
assert.equal(r1.allowed, true);
assert.equal(r2.allowed, true);
assert.equal(r3.allowed, false);

// 14. Security: Auth middleware enforces 401 when required
const unauth = await requireAuthenticatedUser({ headers: {} }, { enforce: true });
assert.equal(unauth.ok, false);
assert.equal(unauth.status, 401);
const guestAllowed = await requireAuthenticatedUser({ headers: {} }, { enforce: false });
assert.equal(guestAllowed.ok, true);

// 15. Contest Calendar recurring schedule
const recurringContests = buildRecurringContests(new Date('2026-11-27T00:00:00Z'));
assert.ok(recurringContests.length >= 4);
assert.ok(recurringContests.every((c) => c.startTimeMs > Date.parse('2026-11-27T00:00:00Z')));

// 16. API Security & Benchmark Integration Tests (in-process HTTP handler)
clearRateLimitMemory();
const tmpHttp = mkdtempSync(join(tmpdir(), 'codegrill-http-'));
const apiHandler = createApiHandler({
  storePath: join(tmpHttp, 'store.json'),
  requireAuth: true,
  allowedOrigins: 'https://codegrill.vercel.app,http://localhost:5173',
});

async function invokeApi(method, path, { headers = {}, body = null, handler = apiHandler } = {}) {
  const req = {
    method,
    url: path,
    headers: { host: 'codegrill.vercel.app', ...headers },
    body,
    socket: { remoteAddress: '203.0.113.10' },
    async *[Symbol.asyncIterator]() {
      if (body !== null && typeof body === 'string') yield Buffer.from(body);
    },
  };
  let status = 200;
  let resHeaders = {};
  let rawBody = '';
  const res = {
    writeHead(code, hdrs = {}) {
      status = code;
      for (const [k, v] of Object.entries(hdrs)) resHeaders[k.toLowerCase()] = v;
    },
    end(chunk = '') {
      rawBody += String(chunk || '');
    },
  };
  await handler(req, res);
  return {
    status,
    headers: resHeaders,
    json: rawBody ? JSON.parse(rawBody) : null,
  };
}

try {
  // Health & OWASP security headers
  const healthRes = await invokeApi('GET', '/api/health', {
    headers: { origin: 'https://codegrill.vercel.app' },
  });
  assert.equal(healthRes.status, 200);
  assert.equal(healthRes.headers['x-content-type-options'], 'nosniff');
  assert.equal(healthRes.headers['x-frame-options'], 'DENY');
  assert.equal(healthRes.headers['referrer-policy'], 'strict-origin-when-cross-origin');
  assert.equal(healthRes.headers['access-control-allow-origin'], 'https://codegrill.vercel.app');
  assert.equal(healthRes.headers.vary, 'Origin');

  // Disallowed CORS origin must NOT be echoed
  const badOriginRes = await invokeApi('GET', '/api/health', {
    headers: { origin: 'https://evil.example.com' },
  });
  assert.equal(badOriginRes.headers['access-control-allow-origin'], undefined);

  // Unauthenticated mutations MUST fail with 401 when requireAuth=true
  const unauthPut = await invokeApi('PUT', '/api/progress', {
    headers: { 'content-type': 'application/json' },
    body: { completed: ['two-sum'] },
  });
  assert.equal(unauthPut.status, 401);

  const unauthImport = await invokeApi('POST', '/api/progress/import', {
    headers: { 'content-type': 'application/json' },
    body: { completed: ['two-sum'] },
  });
  assert.equal(unauthImport.status, 401);

  assert.equal((await invokeApi('GET', '/api/progress?profile=test-user')).status, 401);
  assert.equal((await invokeApi('GET', '/api/u/test-user')).status, 404);
  const hostedHandler = createApiHandler({ workspaceApiEnabled: false });
  const hostedHealth = await invokeApi('GET', '/api/health', { handler: hostedHandler });
  assert.equal(hostedHealth.json.workspaceApiEnabled, false);
  assert.equal(hostedHealth.json.cloudDb, false);
  assert.equal((await invokeApi('GET', '/api/profiles', { handler: hostedHandler })).status, 503);
  assert.equal((await invokeApi('GET', '/api/catalog', { handler: hostedHandler })).status, 200);

  const isolatedSheets = createStore(join(tmpHttp, 'isolated-sheets.json'));
  await Promise.all([
    isolatedSheets.addCustomSheet({ id: 'sheet', name: 'First sheet' }, 'first'),
    isolatedSheets.addCustomSheet({ id: 'sheet', name: 'Second sheet' }, 'second'),
  ]);
  assert.equal((await isolatedSheets.listCustomSheets('first'))[0].name, 'First sheet');
  assert.equal((await isolatedSheets.listCustomSheets('second'))[0].name, 'Second sheet');
  assert.equal(await isolatedSheets.deleteCustomSheet('sheet', 'unknown'), false);
  assert.equal(await isolatedSheets.deleteCustomSheet('sheet', 'first'), true);
  assert.equal((await isolatedSheets.listCustomSheets('second')).length, 1);

  // SSRF metadata endpoint MUST be blocked
  const ssrfRes = await invokeApi('GET', `/api/plugins/fetch?url=${encodeURIComponent('https://169.254.169.254/latest/meta-data/')}`);
  assert.equal(ssrfRes.status, 400);

  // Contests endpoint returns valid upcoming contests
  const contestsRes = await invokeApi('GET', '/api/contests');
  assert.equal(contestsRes.status, 200);
  assert.ok(Array.isArray(contestsRes.json?.contests) && contestsRes.json.contests.length >= 4);

  // Guest plugin rate limit enforces HTTP 429 on 11th request
  clearRateLimitMemory();
  let lastStatus = 200;
  for (let i = 0; i < 11; i += 1) {
    const r = await invokeApi('GET', `/api/plugins/fetch?url=${encodeURIComponent('https://127.0.0.1/secret')}`);
    lastStatus = r.status;
  }
  assert.equal(lastStatus, 429, 'Expected HTTP 429 after exceeding guest plugin rate limit');

  // 17. Lossless Guest -> Auth import (preserves activity counts + newer notesUpdatedAt wins) & Public Portfolio /api/u/:handle
  const localHandler = createApiHandler({
    storePath: join(tmpHttp, 'import-store.json'),
    requireAuth: false,
  });
  async function invokeLocal(method, path, body = null) {
    let status = 200;
    let rawBody = '';
    await localHandler(
      { method, url: path, headers: { host: 'localhost' }, body, socket: { remoteAddress: '127.0.0.1' } },
      { writeHead(code) { status = code; }, end(chunk = '') { rawBody += String(chunk || ''); } },
    );
    return { status, json: rawBody ? JSON.parse(rawBody) : null };
  }

  // Seed newer cloud note
  await invokeLocal('PUT', '/api/progress?profile=alice', {
    completed: ['two-sum'],
    notes: { 'two-sum': 'Newer cloud note' },
    notesUpdatedAt: { 'two-sum': '2026-11-27T12:00:00.000Z' },
    isPublicProfile: true,
    handle: 'alice-dev',
  });
  // Import older guest note + historical activity
  const mergedRes = await invokeLocal('POST', '/api/progress/import?profile=alice', {
    completed: ['valid-anagram'],
    notes: { 'two-sum': 'Stale guest note', 'valid-anagram': 'Sort or count' },
    notesUpdatedAt: { 'two-sum': '2026-11-20T12:00:00.000Z', 'valid-anagram': '2026-11-27T12:05:00.000Z' },
    activity: { '2026-11-25': 3, '2026-11-26': 2 },
  });
  assert.equal(mergedRes.status, 200);
  assert.equal(mergedRes.json.progress.notes['two-sum'], 'Newer cloud note');
  assert.equal(mergedRes.json.progress.notes['valid-anagram'], 'Sort or count');
  assert.equal(mergedRes.json.progress.activity['2026-11-25'], 3);
  assert.equal(mergedRes.json.progress.activity['2026-11-26'], 2);

  // Public portfolio returns 200 for published handle WITHOUT exposing private notes or bookmarks, 404 for unknown
  const pubRes = await invokeLocal('GET', '/api/u/alice-dev');
  assert.equal(pubRes.status, 200);
  assert.equal(pubRes.json.handle, 'alice-dev');
  assert.ok(pubRes.json.progress.completed.includes('two-sum'));
  assert.equal(pubRes.json.progress.notes, undefined, 'Public portfolio must never expose private notes');
  assert.equal(pubRes.json.progress.notesUpdatedAt, undefined, 'Public portfolio must never expose notesUpdatedAt');
  assert.equal(pubRes.json.progress.bookmarked, undefined, 'Public portfolio must never expose private bookmarks');
  const missingPub = await invokeLocal('GET', '/api/u/nonexistent-user');
  assert.equal(missingPub.status, 404);

  // 19. Neon sheet ownership guard, stale-row cleanup, timestamp fidelity, partial updates, OCC 409 conflicts & Cloud DB fail-loud
  const { createNeonStore } = await import('../server/neonStore.mjs');
  const { exportLocalWorkspaceBackup, importLocalWorkspaceBackup, mergeNotesByTimestamp, scopedStorageKey } = await import('../src/storageAdapter.mjs');

  // Guest & account-scoped JSON backup must include codegrill:study:v1 (solved, notes, activity)
  const memStore = new Map();
  const prevLS = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (memStore.has(k) ? memStore.get(k) : null),
    setItem: (k, v) => memStore.set(k, String(v)),
    removeItem: (k) => memStore.delete(k),
  };
  try {
    memStore.set('codegrill:study:v1', JSON.stringify({ completed: ['two-sum'], notes: { 'two-sum': 'Hash map' }, activity: { '2026-11-27': 1 } }));
    const guestBackup = exportLocalWorkspaceBackup('');
    assert.deepEqual(guestBackup.data['codegrill:study:v1']?.completed, ['two-sum'], 'Guest backup must include codegrill:study:v1 progress');
    assert.equal(guestBackup.data['codegrill:study:v1']?.notes?.['two-sum'], 'Hash map', 'Guest backup must include notes');

    memStore.clear();
    const restoreRes = importLocalWorkspaceBackup(guestBackup, 'uid-alice');
    assert.ok(restoreRes.restoredKeys >= 1);
    const restoredAlice = JSON.parse(memStore.get('codegrill:study:v1:uid:uid-alice') || '{}');
    assert.deepEqual(restoredAlice.completed, ['two-sum'], 'Restoring backup for signed-in user must populate UID-scoped progress key');
  } finally {
    globalThis.localStorage = prevLS;
  }

  // Per-account storage scoping isolates multi-tab sessions
  assert.equal(scopedStorageKey('codegrill:study:v1', ''), 'codegrill:study:v1');
  assert.equal(scopedStorageKey('codegrill:study:v1', 'uid-alice'), 'codegrill:study:v1:uid:uid-alice');
  assert.notEqual(scopedStorageKey('codegrill:study:v1', 'uid-alice'), scopedStorageKey('codegrill:study:v1', 'uid-bob'));

  // HTTP 409 Conflict test on stale expectedUpdatedAt (local store via API handler)
  const firstPut = await invokeLocal('PUT', '/api/progress?profile=occ-user', {
    completed: ['two-sum'],
    notes: { 'two-sum': 'Device A note' },
  });
  assert.equal(firstPut.status, 200);
  const rev1 = firstPut.json.updatedAt;
  const secondPut = await invokeLocal('PUT', '/api/progress?profile=occ-user', {
    completed: ['two-sum', 'valid-anagram'],
    notes: { 'two-sum': 'Device B newer note' },
    expectedUpdatedAt: rev1,
  });
  assert.equal(secondPut.status, 200);
  const stalePut = await invokeLocal('PUT', '/api/progress?profile=occ-user', {
    completed: ['two-sum'],
    notes: { 'two-sum': 'Stale Device A overwrite' },
    expectedUpdatedAt: rev1,
  });
  assert.equal(stalePut.status, 409, 'Stale expectedUpdatedAt must fail with HTTP 409 Conflict');
  assert.equal(stalePut.json.code, 'REVISION_CONFLICT');
  assert.equal(stalePut.json.progress.notes['two-sum'], 'Device B newer note', '409 must return latest server progress without overwriting');

  // Startup timestamp-aware note merge: newer remote beats stale local, newer local beats older remote
  const startupMerged = mergeNotesByTimestamp(
    { 'two-sum': 'Newer cloud note', 'valid-anagram': 'Older cloud note' },
    { 'two-sum': '2026-11-27T12:00:00.000Z', 'valid-anagram': '2026-11-20T12:00:00.000Z' },
    { 'two-sum': 'Stale local note', 'valid-anagram': 'Newer local note', 'group-anagrams': 'Local only' },
    { 'two-sum': '2026-11-19T12:00:00.000Z', 'valid-anagram': '2026-11-27T13:00:00.000Z', 'group-anagrams': '2026-11-27T13:05:00.000Z' },
  );
  assert.equal(startupMerged.notes['two-sum'], 'Newer cloud note', 'Newer remote note must beat stale local note on startup');
  assert.equal(startupMerged.notes['valid-anagram'], 'Newer local note', 'Newer local note must beat older remote note on startup');
  assert.equal(startupMerged.notes['group-anagrams'], 'Local only', 'Local-only note must be preserved on startup');

  // Conflict recovery note merge with preferRemoteDeletions must NOT resurrect older local notes deleted remotely
  const conflictMerged = mergeNotesByTimestamp(
    { 'two-sum': 'Cloud kept' },
    { 'two-sum': '2026-11-27T12:00:00.000Z' },
    { 'two-sum': 'Older local', 'deleted-remotely': 'Stale deleted note', 'brand-new-local': 'Written after cloud rev' },
    { 'two-sum': '2026-11-26T12:00:00.000Z', 'deleted-remotely': '2026-11-27T11:00:00.000Z', 'brand-new-local': '2026-11-27T12:05:00.000Z' },
    '2026-11-27T12:00:00.000Z',
    { preferRemoteDeletions: true },
  );
  assert.equal(conflictMerged.notes['two-sum'], 'Cloud kept');
  assert.equal(conflictMerged.notes['deleted-remotely'], undefined, 'Older local note deleted on newer cloud revision must not be resurrected');
  assert.equal(conflictMerged.notes['brand-new-local'], 'Written after cloud rev', 'Local note strictly newer than cloud revision must be preserved');

  // Executable Neon store partial-update, zero-read-before-write & lock-first RepeatableRead OCC 409 transaction test
  const executedQueries = [];
  let transactionCount = 0;
  let lastTxnOpts = null;
  let preTxnSelectCount = 0;
  let mockUserUpdatedAt = '2026-11-27T10:00:00.000Z';
  let mockUserUpdatedInCurrentTxn = false;
  const mockRows = new Map([
    ['two-sum', { problem_id: 'two-sum', status: 'solved', bookmarked: true, notes: 'Cloud hash map', updated_at: '2026-11-27T10:00:00.000Z' }],
  ]);
  function makeMockSql() {
    const runQuery = async (strings, ...values) => {
      const text = strings.join('?').replace(/\s+/g, ' ').trim();
      executedQueries.push({ text, values });
      if (text.startsWith('SELECT 1 / CASE')) {
        if (!mockUserUpdatedInCurrentTxn) {
          const divZero = new Error('division by zero');
          divZero.code = '22012';
          throw divZero;
        }
        return [{ revision_lock_ok: 1 }];
      }
      if (text.startsWith('SELECT id, handle')) {
        return [{ id: 'u1', handle: 'u1', display_name: '', preferred_locale: 'en', is_public_profile: false, activity_json: {}, updated_at: mockUserUpdatedAt }];
      }
      if (text.startsWith('SELECT problem_id, status')) {
        return [...mockRows.values()];
      }
      if (text.startsWith('UPDATE users SET')) {
        if (text.includes("date_trunc('milliseconds', updated_at) = ?::timestamptz")) {
          const expected = values[values.length - 1];
          if (expected !== mockUserUpdatedAt) return [];
        }
        mockUserUpdatedAt = new Date(Date.parse(mockUserUpdatedAt) + 1000).toISOString();
        mockUserUpdatedInCurrentTxn = true;
        return [{ updated_at: mockUserUpdatedAt }];
      }
      if (text.startsWith("UPDATE user_progress SET status = 'unsolved'")) {
        const keep = text.includes('ANY(?)') ? new Set(values[1] || []) : new Set();
        for (const [k, row] of mockRows.entries()) if (!keep.has(k)) row.status = 'unsolved';
        return [];
      }
      if (text.startsWith('UPDATE user_progress SET bookmarked = FALSE')) {
        const keep = text.includes('ANY(?)') ? new Set(values[1] || []) : new Set();
        for (const [k, row] of mockRows.entries()) if (!keep.has(k)) row.bookmarked = false;
        return [];
      }
      if (text.startsWith("UPDATE user_progress SET notes = ''")) {
        const keep = text.includes('ANY(?)') ? new Set(values[1] || []) : new Set();
        for (const [k, row] of mockRows.entries()) if (!keep.has(k)) row.notes = '';
        return [];
      }
      if (text.startsWith('INSERT INTO user_progress') && text.includes("status = 'solved'")) {
        const slug = values[1];
        const cur = mockRows.get(slug) || { problem_id: slug, status: 'unsolved', bookmarked: false, notes: '', updated_at: '' };
        cur.status = 'solved';
        mockRows.set(slug, cur);
        return [];
      }
      if (text.startsWith('INSERT INTO user_progress') && text.includes('bookmarked = TRUE')) {
        const slug = values[1];
        const cur = mockRows.get(slug) || { problem_id: slug, status: 'unsolved', bookmarked: false, notes: '', updated_at: '' };
        cur.bookmarked = true;
        mockRows.set(slug, cur);
        return [];
      }
      if (text.startsWith('INSERT INTO user_progress') && text.includes('notes = EXCLUDED.notes')) {
        const slug = values[1];
        const cur = mockRows.get(slug) || { problem_id: slug, status: 'unsolved', bookmarked: false, notes: '', updated_at: '' };
        cur.notes = values[2];
        cur.updated_at = values[3];
        mockRows.set(slug, cur);
        return [];
      }
      if (text.startsWith("DELETE FROM user_progress WHERE user_id = ? AND status = 'unsolved' AND bookmarked = FALSE AND notes = ''")) {
        for (const [k, row] of [...mockRows.entries()]) {
          if (row.status === 'unsolved' && !row.bookmarked && row.notes === '') mockRows.delete(k);
        }
        return [];
      }
      return [];
    };
    const fn = (strings, ...values) => runQuery(strings, ...values);
    fn.transaction = async (cb, opts) => {
      transactionCount += 1;
      lastTxnOpts = opts || null;
      mockUserUpdatedInCurrentTxn = false;
      const queries = cb((strings, ...values) => ({ strings, values }));
      const results = [];
      for (const q of queries) {
        results.push(await runQuery(q.strings, ...q.values));
      }
      return results;
    };
    return fn;
  }
  const mockNeon = await createNeonStore('postgres://mock', 'u1', { sqlClient: makeMockSql() });

  // Locale-only update must NOT delete or touch user_progress
  await mockNeon.saveProgress('u1', { locale: 'ja' });
  assert.equal(transactionCount, 0, 'Locale-only update must not run user_progress delete/upsert transaction');
  assert.ok(mockRows.has('two-sum'), 'Locale-only update must preserve existing user_progress rows');

  // Partial completed-only update must NOT read user_progress before transaction, must preserve bookmarks/notes, and run in RepeatableRead transaction
  const queryCountBeforePartial = executedQueries.length;
  await mockNeon.saveProgress('u1', { completed: ['two-sum', 'valid-anagram'] });
  const partialQueries = executedQueries.slice(queryCountBeforePartial);
  const firstWriteIdx = partialQueries.findIndex((q) => q.text.startsWith('UPDATE user_progress'));
  preTxnSelectCount = partialQueries.slice(0, firstWriteIdx).filter((q) => q.text.startsWith('SELECT problem_id')).length;
  assert.equal(preTxnSelectCount, 0, 'Partial save must not read user_progress before starting sql.transaction');
  assert.equal(transactionCount, 1, 'Problem write must execute inside sql.transaction');
  assert.equal(lastTxnOpts?.isolationLevel, 'RepeatableRead', 'Neon progress transaction must run under RepeatableRead isolation');
  assert.equal(mockRows.get('two-sum')?.bookmarked, true, 'Partial completed update must preserve existing bookmark');
  assert.equal(mockRows.get('two-sum')?.notes, 'Cloud hash map', 'Partial completed update must preserve existing note');
  assert.equal(mockRows.get('valid-anagram')?.status, 'solved', 'Partial completed update must persist newly solved problem');

  // Stale expectedUpdatedAt in Neon must abort BEFORE any user_progress write and throw 409 Conflict
  const queryCountBeforeConflict = executedQueries.length;
  await assert.rejects(
    () => mockNeon.saveProgress('u1', {
      completed: [],
      bookmarked: [],
      notes: {},
      expectedUpdatedAt: '2020-01-01T00:00:00.000Z',
    }),
    (err) => err?.statusCode === 409 && Boolean(err?.current),
  );
  const conflictQueries = executedQueries.slice(queryCountBeforeConflict);
  assert.equal(
    conflictQueries.filter((q) => q.text.includes('user_progress') && !q.text.startsWith('SELECT')).length,
    0,
    'Stale Neon save must abort BEFORE executing any user_progress mutation',
  );
  assert.ok(mockRows.has('two-sum') && mockRows.has('valid-anagram'), 'Stale Neon save must leave existing rows untouched');

  // Full snapshot removing valid-anagram with matching expectedUpdatedAt must prune stale row inside transaction
  await mockNeon.saveProgress('u1', { completed: ['two-sum'], bookmarked: [], notes: {}, expectedUpdatedAt: mockUserUpdatedAt });
  assert.equal(transactionCount, 3, 'Full progress snapshot must execute inside sql.transaction');
  assert.ok(!mockRows.has('valid-anagram'), 'Removed problem must be deleted from user_progress');

  // Neon resetProgress must lock users BEFORE deleting user_progress (matching saveProgress/restoreWorkspace), clear activity_json, and advance updated_at
  const preResetRev = mockUserUpdatedAt;
  const resetQueryStart = executedQueries.length;
  await mockNeon.resetProgress('u1');
  const resetQueries = executedQueries.slice(resetQueryStart);
  const usersResetIdx = resetQueries.findIndex((q) => q.text.startsWith('UPDATE users SET') && q.text.includes("activity_json = '{}'::jsonb"));
  const progressDeleteIdx = resetQueries.findIndex((q) => q.text.startsWith('DELETE FROM user_progress'));
  assert.ok(usersResetIdx >= 0 && progressDeleteIdx > usersResetIdx, 'Neon resetProgress must lock/update users before deleting user_progress');
  assert.notEqual(mockUserUpdatedAt, preResetRev, 'Neon resetProgress must advance users.updated_at');
  await assert.rejects(
    () => mockNeon.saveProgress('u1', { completed: ['two-sum'], expectedUpdatedAt: preResetRev }),
    (err) => err?.statusCode === 409,
  );

  const neonSrc = readFileSync(new URL('../server/neonStore.mjs', import.meta.url), 'utf8');
  assert.ok(neonSrc.includes('WHERE custom_sheets.user_id = ${uid}'), 'Neon sheet upsert must enforce ownership check');
  assert.ok(neonSrc.includes('err.statusCode = 403'), 'Neon sheet ownership mismatch must signal 403');
  assert.ok(
    neonSrc.includes("date_trunc('milliseconds', NOW())") && neonSrc.includes("date_trunc('milliseconds', updated_at)"),
    'Neon OCC revision must use millisecond-aligned timestamps to match JS ISO precision',
  );
  assert.ok(
    neonSrc.includes("AND status = 'unsolved'") && neonSrc.includes('AND bookmarked = FALSE') && neonSrc.includes("AND notes = ''"),
    'Neon saveProgress must prune empty rows atomically inside the transaction',
  );
  assert.ok(
    neonSrc.includes('notesTsObj[slug]') && neonSrc.includes('::timestamptz'),
    'Neon saveProgress must preserve per-note timestamps from notesUpdatedAt',
  );
  const mainSrc = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
  assert.ok(
    mainSrc.includes('notes,\n            notesUpdatedAt,') || mainSrc.includes('notes,\r\n            notesUpdatedAt,'),
    'Client guest import must transmit per-note notesUpdatedAt timestamps',
  );
  assert.ok(
    mainSrc.includes('if (!res?.ok || !res?.progress)') && mainSrc.includes('signOutAuth();'),
    'Client sign-in must fail closed and clear auth session when guest import fails',
  );
  assert.ok(
    mainSrc.includes('mergeNotesByTimestamp(') && mainSrc.includes('keep hydratedRef.current = false'),
    'Startup sync must merge notes by timestamp and keep cloud saves disabled on failed read',
  );
  assert.ok(
    mainSrc.includes('scopedStorageKey(preferenceKey,') && mainSrc.includes('expectedUpdatedAt: cloudRevisionRef.current'),
    'Client must isolate multi-tab workspaces per UID and send expectedUpdatedAt for OCC conflict detection',
  );
  assert.ok(
    mainSrc.includes('writeLocalCustomSheets(next, activeUid)') && mainSrc.includes('cloud.getCustomSheets()'),
    'Custom sheets must be UID-scoped locally and loaded via authenticated cloud adapter when signed in',
  );
  assert.ok(
    mainSrc.includes('{ preferRemoteDeletions: true }') && mainSrc.includes('writeLocalProfiles(nextProfiles, uid)'),
    'Conflict recovery must honor remote deletions and signed-in profile saves must stay UID-scoped',
  );
  assert.ok(
    mainSrc.includes('if (!hydratedRef.current || !cloudRevisionRef.current)') && mainSrc.includes('cloud.restoreWorkspace({'),
    'Signed-in backup restore must require hydrated revision and call atomic restoreWorkspace',
  );

  // Executable test: POST /api/progress/restore requires valid expectedUpdatedAt, rejects malformed (400) & stale (409), enforces ownerId, and preserves omitted progress
  const restoreMissingRev = await invokeLocal('POST', '/api/progress/restore?profile=occ-user', {
    progressPatch: { completed: ['two-sum'] },
  });
  assert.equal(restoreMissingRev.status, 400, 'Atomic restore without expectedUpdatedAt must be rejected with 400');

  const restoreMalformedRev = await invokeLocal('POST', '/api/progress/restore?profile=occ-user', {
    progressPatch: { completed: ['two-sum'] },
    expectedUpdatedAt: 'not-a-valid-date',
  });
  assert.equal(restoreMalformedRev.status, 400, 'Atomic restore with malformed expectedUpdatedAt must be rejected with 400');

  await assert.rejects(
    () => mockNeon.restoreWorkspace('u1', { progressPatch: { completed: [] }, expectedUpdatedAt: 'garbage-ts' }),
    (err) => err?.statusCode === 400,
  );
  assert.ok(
    neonSrc.includes('INSERT INTO custom_sheets (id, user_id, title, description, problem_ids, is_public, updated_at)'),
    'Neon restoreWorkspace must match 0001_init.sql custom_sheets columns (title, problem_ids, updated_at)',
  );

  // Verify JSON store restoreWorkspace uses ownerId consistently for listing and ownership checks
  const ownerStore = createStore(join(tmpHttp, 'owner-restore-store.json'));
  const aliceSeed = await ownerStore.saveProgress('uid-alice', { completed: ['two-sum'] });
  const aliceRestore = await ownerStore.restoreWorkspace(
    'uid-alice',
    {
      progressPatch: null,
      customSheets: [{ id: 'custom-owned-1', names: { en: 'Alice Sheet' }, slugs: ['two-sum'] }],
      expectedUpdatedAt: aliceSeed.updatedAt,
    },
    undefined,
    'uid-alice',
  );
  assert.ok(aliceRestore.customSheets.some((s) => s.id === 'custom-owned-1'), 'Restored sheet must appear in owner listCustomSheets');
  const bobSeed = await ownerStore.saveProgress('uid-bob', { completed: [] });
  await assert.rejects(
    () => ownerStore.restoreWorkspace(
      'uid-bob',
      {
        progressPatch: null,
        customSheets: [{ id: 'custom-owned-1', names: { en: 'Hijacked Sheet' }, slugs: ['two-sum'] }],
        expectedUpdatedAt: bobSeed.updatedAt,
      },
      undefined,
      'uid-bob',
    ),
    (err) => err?.statusCode === 403,
  );

  const occBeforeRestore = await invokeLocal('GET', '/api/progress?profile=occ-user');
  const restoreStale = await invokeLocal('POST', '/api/progress/restore?profile=occ-user', {
    progressPatch: { completed: [] },
    expectedUpdatedAt: '2020-01-01T00:00:00.000Z',
  });
  assert.equal(restoreStale.status, 409, 'Atomic restore with stale expectedUpdatedAt must fail with 409');

  // Saved custom sheet (names.en + slugs) must round-trip cleanly through normalizeCustomSheet and POST /api/progress/restore
  const testSlugs = new Set(['two-sum', 'valid-anagram']);
  const savedFormatSheet = normalizeCustomSheet({ id: 'custom-restored-1', name: 'Restored Sheet', slugs: ['two-sum'] }, testSlugs);
  const reNormalizedSheet = normalizeCustomSheet(savedFormatSheet, testSlugs);
  assert.equal(reNormalizedSheet.names.en, 'Restored Sheet', 'normalizeCustomSheet must be idempotent on saved names.en format');
  assert.deepEqual(reNormalizedSheet.slugs, ['two-sum']);

  const restoreSheetsOnly = await invokeLocal('POST', '/api/progress/restore?profile=occ-user', {
    progressPatch: null,
    customSheets: [savedFormatSheet],
    expectedUpdatedAt: occBeforeRestore.json.updatedAt,
  });
  assert.equal(restoreSheetsOnly.status, 200, 'Atomic sheets-only restore with saved names.en format must succeed');
  assert.ok(restoreSheetsOnly.json.progress.completed.includes('valid-anagram'), 'Sheets-only restore must preserve existing solved problems');
  assert.equal(restoreSheetsOnly.json.progress.notes['two-sum'], 'Device B newer note', 'Sheets-only restore must preserve existing notes');
  assert.ok(restoreSheetsOnly.json.customSheets.some((s) => s.id === 'custom-restored-1'), 'Sheets-only restore must persist custom sheets');

  // Verify Neon restoreWorkspace casts runtime CASE result (never a constant literal) and returns UI-shaped customSheets (names.en + slugs)
  assert.ok(
    neonSrc.includes('END)::smallint AS sheet_ownership_ok') && !neonSrc.includes("'999999'::smallint"),
    'Neon ownership check must cast the runtime CASE expression to smallint, never a constant literal',
  );
  const mockSheetSql = async () => [{ id: 'custom-neon-1', title: 'Neon Sheet', description: 'From PG', problem_ids: ['two-sum'], updated_at: '2026-11-27T12:00:00.000Z' }];
  const mockSheetNeon = await createNeonStore('postgres://mock', 'u1', { sqlClient: mockSheetSql });
  const neonListedSheets = await mockSheetNeon.listCustomSheets('u1');
  assert.equal(neonListedSheets[0]?.names?.en, 'Neon Sheet', 'Neon listCustomSheets must return names.en for UI');
  assert.deepEqual(neonListedSheets[0]?.slugs, ['two-sum'], 'Neon listCustomSheets must return slugs array for UI');
  const profileSrc = readFileSync(new URL('../src/ProfilePage.jsx', import.meta.url), 'utf8');
  assert.ok(
    profileSrc.includes('await onRestoreBackup(raw)') && !profileSrc.includes('window.location.reload()'),
    'ProfilePage backup restore must await onRestoreBackup instead of blindly reloading',
  );
  assert.ok(
    profileSrc.includes('onUpdatePortfolioSettings') && profileSrc.includes('t.studio.auth.publishPortfolio'),
    'ProfilePage must provide a localized public portfolio publishing control',
  );
  const firebaseAuthMod = await import('../src/firebaseAuth.mjs');
  assert.equal(typeof firebaseAuthMod.signInWithGoogle, 'function', 'firebaseAuth must export signInWithGoogle');
  assert.equal(typeof firebaseAuthMod.isGoogleAuthConfigured, 'function', 'firebaseAuth must export isGoogleAuthConfigured');
  assert.ok(profileSrc.includes('t.studio.auth.continueWithGoogle') && profileSrc.includes('signInWithGoogle()'), 'ProfilePage must expose localized Google sign-in button');

  // Executable test: POST /api/progress/import retries on 409 Conflict and preserves concurrent cloud edit
  let importSaveCalls = 0;
  const retryBaseStore = createStore(join(tmpHttp, 'import-retry-store.json'));
  await retryBaseStore.saveProgress('retry-user', {
    completed: ['two-sum'],
    notes: { 'two-sum': 'Initial cloud note' },
  });
  const raceInjectingStore = {
    ...retryBaseStore,
    async saveProgress(profileId, patch, validSlugsArg) {
      importSaveCalls += 1;
      if (importSaveCalls === 1) {
        // Simulate another device committing 'group-anagrams' concurrently before our import saves
        const concurrentSaved = await retryBaseStore.saveProgress(profileId, {
          completed: ['two-sum', 'group-anagrams'],
          notes: { 'two-sum': 'Initial cloud note', 'group-anagrams': 'Concurrent device B note' },
        }, validSlugsArg);
        const conflict = new Error('Conflict: remote progress has a newer revision');
        conflict.statusCode = 409;
        conflict.current = concurrentSaved;
        throw conflict;
      }
      return retryBaseStore.saveProgress(profileId, patch, validSlugsArg);
    },
  };
  const retryHandler = createApiHandler({ store: raceInjectingStore, requireAuth: false });
  let retryStatus = 0;
  let retryRaw = '';
  await retryHandler(
    {
      method: 'POST',
      url: '/api/progress/import?profile=retry-user',
      headers: { host: 'localhost' },
      body: { completed: ['valid-anagram'], notes: { 'valid-anagram': 'Guest note' } },
      socket: { remoteAddress: '127.0.0.1' },
    },
    { writeHead(code) { retryStatus = code; }, end(chunk = '') { retryRaw += String(chunk || ''); } },
  );
  const retryJson = JSON.parse(retryRaw);
  assert.equal(retryStatus, 200, 'POST /api/progress/import must succeed after retrying 409 Conflict');
  assert.equal(importSaveCalls, 2, 'POST /api/progress/import must retry saveProgress after 409');
  assert.ok(retryJson.progress.completed.includes('group-anagrams'), 'Retry must preserve concurrent cloud solved problem');
  assert.ok(retryJson.progress.completed.includes('valid-anagram'), 'Retry must include imported guest solved problem');
  assert.equal(retryJson.progress.notes['group-anagrams'], 'Concurrent device B note', 'Retry must preserve concurrent cloud note');

  const extManifest = JSON.parse(readFileSync(new URL('../extension/manifest.json', import.meta.url), 'utf8'));
  assert.equal(extManifest.action?.default_popup, 'popup.html', 'Extension manifest must expose popup.html setup flow');
  const brokenDbHandler = createApiHandler({ databaseUrl: 'not-a-valid-postgres-url' });
  let dbFailStatus = 200;
  await brokenDbHandler(
    { method: 'GET', url: '/api/health', headers: { host: 'localhost' }, socket: { remoteAddress: '127.0.0.1' } },
    { writeHead(code) { dbFailStatus = code; }, end() {} },
  );
  assert.equal(dbFailStatus, 503, 'Broken DATABASE_URL must fail loud with 503 instead of silently falling back');

  // 18. SSRF DNS rebinding & redirect hop validation
  await assert.rejects(
    () => assertSafePublicUrl('https://internal.example.com/secret', async () => [{ address: '10.0.0.5', family: 4 }]),
    /blocked private/i,
  );
  await assert.rejects(
    () => assertSafePublicUrl('https://meta.example.com/', async () => [{ address: '169.254.169.254', family: 4 }]),
    /blocked private/i,
  );
  await assert.rejects(
    () => assertSafePublicUrl('https://v6.example.com/', async () => [{ address: '::ffff:127.0.0.1', family: 6 }]),
    /blocked private/i,
  );

  // Redirect to cloud metadata IP must be blocked, and >3 redirect hops must be rejected
  await assert.rejects(
    () => safeFetchText('https://1.1.1.1/start', {
      requestImpl: async () => ({
        statusCode: 302,
        headers: { location: 'https://169.254.169.254/latest/meta-data/' },
        destroy() {},
      }),
    }),
    /Blocked unsafe/i,
  );
  await assert.rejects(
    () => safeFetchText('https://1.1.1.1/loop', {
      requestImpl: async () => ({
        statusCode: 302,
        headers: { location: 'https://1.1.1.1/loop' },
        destroy() {},
      }),
    }),
    /Too many redirects/i,
  );
} finally {
  rmSync(tmpHttp, { recursive: true, force: true });
}

console.log('All unit and integration tests passed.');
