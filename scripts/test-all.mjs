import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
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
import { getMessages } from '../src/i18n.mjs';
import { createStore } from '../server/store.mjs';
import { createPluginRegistry } from '../server/plugins/registry.mjs';
import { pickDailyProblem } from '../server/index.mjs';

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

console.log('All unit and integration tests passed.');
