import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { matchingProblems, resourcesFor, roadmapFor, safeUrl } from '../src/catalog.mjs';
import { newRoomId, problemShareUrl, roomEditor, roomInvite, roomsDirectory, studyLocation } from '../src/rooms.mjs';
import { BUILTIN_SHEETS, buildWeeklyPlan, normalizeCustomSheet, resolveSheetProblems } from '../src/sheets.mjs';
import { MESSAGES, SUPPORTED_LOCALES, getMessages } from '../src/i18n.mjs';
import { createPluginRegistry } from '../server/plugins/registry.mjs';
import { extractYouTubeId } from '../server/plugins/youtube.mjs';
import { toGitHubRawUrl } from '../server/plugins/github.mjs';
import { getPublicConfig, loadServerConfig } from '../server/config.mjs';
import { buildAnalytics } from '../server/store.mjs';
import { pickDailyProblem } from '../server/index.mjs';

const seed = JSON.parse(readFileSync(new URL('../src/multilingual_leetcode_dataset.json', import.meta.url), 'utf8'));
const curriculum = JSON.parse(readFileSync(new URL('../src/roadmap.generated.json', import.meta.url), 'utf8'));
const { problems, roadmap_categories: categories, directories, languages } = curriculum;
const metadata = seed.platform_metadata;
const { supported_locales: locales, default_locale: defaultLocale } = metadata;
const modules = [...seed.system_design_modules, ...seed.ai_engineer_modules, ...seed.fde_modules];
const topics = new Set(categories.map(({ id }) => id));
assert.equal(topics.size, categories.length, 'Topic identifiers must be unique');
assert.equal(categories.length, 18);
assert.equal(problems.length, 150);
assert.equal(new Set(problems.map(({ slug }) => slug)).size, problems.length);
assert.equal(new Set(problems.map(({ leetcode_id }) => leetcode_id)).size, problems.length);
assert.equal(new Set(modules.map(({ id }) => id)).size, modules.length);
assert.equal(new Set(directories.map(({ url }) => url)).size, directories.length);

for (const { code } of locales) {
  for (const category of categories) assert.ok(category.labels[code], category.id + ' lacks a ' + code + ' label');
  assert.ok(directories.some(({ locale, url }) => locale === code && safeUrl(url)), code + ' lacks study directories');
  for (const item of seed.problems) {
    const problem = problems.find(({ slug }) => slug === item.slug);
    assert.ok(problem.translations[code]?.title, item.slug + ' lacks its original ' + code + ' title');
  }
}
for (const problem of problems) {
  assert.ok(topics.has(problem.category_id), problem.slug + ' has an unknown topic');
  assert.ok(safeUrl(problem.leetcode_url), problem.slug + ' has an invalid practice URL');
  assert.ok(problem.translations.en.title);
  const english = resourcesFor(problem.resources, 'en');
  const chinese = resourcesFor(problem.resources, 'zh');
  assert.ok(english.some(({ kind }) => kind === 'video'), problem.slug + ' lacks a walkthrough');
  assert.ok(english.some(({ kind, platform }) => kind === 'article' && platform === 'GitHub'));
  assert.ok(chinese.some(({ locale, kind, platform }) => locale === 'zh' && kind === 'article' && platform === 'GitHub'));
  assert.ok(Object.keys(problem.solutions).length > 0);
  for (const [language, url] of Object.entries(problem.solutions)) {
    assert.ok(Object.hasOwn(languages, language) && safeUrl(url)?.hostname === 'github.com');
  }
}
for (const module of modules) {
  assert.ok(module.titles[defaultLocale], module.id + ' lacks a default title');
  assert.ok(resourcesFor(module.resources, defaultLocale).length, module.id + ' lacks default study links');
}

const initialRoadmap = roadmapFor(categories, problems, new Set());
assert.deepEqual(initialRoadmap.filter(({ ready }) => ready).map(({ id }) => id), ['arrays-hashing']);
const firstTopicSlugs = problems.filter(({ category_id }) => category_id === 'arrays-hashing').map(({ slug }) => slug);
const updatedRoadmap = roadmapFor(categories, problems, new Set(firstTopicSlugs));
assert.equal(updatedRoadmap.find(({ id }) => id === 'arrays-hashing').complete, true);
assert.equal(updatedRoadmap.find(({ id }) => id === 'two-pointers').ready, true);
assert.equal(updatedRoadmap.find(({ id }) => id === 'trees').ready, false);
assert.throws(() => roadmapFor([{ id: 'cycle', prerequisites: ['cycle'] }], [], new Set()), /prerequisites/);

const twoSum = problems.find(({ slug }) => slug === 'two-sum');
assert.deepEqual(matchingProblems(problems, categories, {
  query: ' 2数の和 ', topic: 'arrays-hashing', difficulty: 'Easy', locale: 'ja',
}).map(({ slug }) => slug), ['two-sum']);
assert.ok(resourcesFor(twoSum.resources, 'ja').every(({ locale }) => locale === 'ja'));
const englishFallback = resourcesFor(twoSum.resources, 'hi');
assert.ok(englishFallback.length);
assert.ok(englishFallback.every(({ locale }) => locale === 'en'));
const fallbackVideo = new URL(englishFallback.find(({ kind }) => kind === 'video').url);
assert.equal(fallbackVideo.searchParams.get('cc_lang_pref'), 'hi');
assert.equal(fallbackVideo.searchParams.get('cc_load_policy'), '1');
assert.equal(safeUrl('javascript:alert(1)'), null);

const lobby = roomsDirectory();
assert.equal(lobby.origin, 'https://utkristi-colabs.vercel.app');
assert.match(newRoomId(), /^[a-z0-9]{8}$/);
assert.equal(roomEditor('abc12345', lobby).href, 'https://utkristi-colabs.vercel.app/editor/abc12345');
assert.equal(roomInvite(' abc12345 ', lobby).pathname, '/editor/abc12345');
assert.equal(roomInvite(lobby.origin + '/editor/abc12345?role=viewer', lobby).search, '?role=viewer');
assert.equal(roomInvite(lobby.origin + '/?room=abc12345', lobby).pathname, '/editor/abc12345');
assert.equal(roomInvite('https://utkristi-colabs.vercel.app.example.org/editor/abc12345', lobby), null);
assert.equal(roomInvite(lobby.origin + '/editor/%5Btoomid%5D', lobby), null);
assert.equal(roomInvite(lobby.origin + '/about', lobby), null);
assert.equal(roomEditor('../other', lobby), null);
assert.equal(roomsDirectory('http://example.org'), null);
const share = new URL(problemShareUrl('https://codegrill.example/?private=placeholder#rooms', 'two-sum'));
const problemSlugs = new Set(problems.map(({ slug }) => slug));
assert.equal(share.search, '');
assert.deepEqual(studyLocation(share.hash, problemSlugs), { page: 'problems', problem: 'two-sum' });
assert.deepEqual(studyLocation('#rooms?problem=two-sum', problemSlugs), { page: 'rooms', problem: 'two-sum' });
assert.deepEqual(studyLocation('#problems?problem=unknown', problemSlugs), { page: 'problems', problem: '' });

// Verify curated sheets & custom series
assert.ok(BUILTIN_SHEETS.length >= 6);
for (const sheet of BUILTIN_SHEETS) {
  for (const code of SUPPORTED_LOCALES) {
    assert.ok(sheet.names[code], `${sheet.id} missing ${code} name`);
    assert.ok(sheet.descriptions[code], `${sheet.id} missing ${code} description`);
  }
  const resolved = resolveSheetProblems(sheet, problems);
  if (sheet.slugs !== null) {
    assert.equal(resolved.length, sheet.slugs.length, `${sheet.id} contains unknown problem slugs`);
  } else {
    assert.equal(resolved.length, problems.length);
  }
}
const weekly = buildWeeklyPlan(resolveSheetProblems(BUILTIN_SHEETS.find((s) => s.id === 'grind-75'), problems), 8, 8);
assert.ok(weekly.length > 0 && weekly.reduce((n, b) => n + b.problems.length, 0) === 75);
const custom = normalizeCustomSheet({ name: 'My Sprint', slugs: ['two-sum', 'unknown-slug'] }, problemSlugs);
assert.deepEqual(custom.slugs, ['two-sum']);

// Verify complete i18n coverage
for (const code of SUPPORTED_LOCALES) {
  const m = getMessages(code);
  assert.ok(m?.nav?.sheets, `${code} missing nav.sheets`);
  assert.ok(m?.viewer?.pluginBadge, `${code} missing viewer.pluginBadge`);
  assert.ok(m?.sheets?.createSeries, `${code} missing sheets.createSeries`);
  assert.ok(m?.ledger?.dailyEyebrow, `${code} missing ledger.dailyEyebrow`);
  assert.ok(m?.practice?.verbalSteps?.length === 4, `${code} missing practice.verbalSteps`);
  assert.ok(m?.faq?.length >= 4, `${code} missing faq`);
}

// Verify zero-hardcode server config, daily challenge, and analytics
const serverCfg = loadServerConfig();
const pubCfg = getPublicConfig(serverCfg);
assert.ok(pubCfg.planner.minWeeks < pubCfg.planner.maxWeeks);
assert.ok(pubCfg.interview.defaultTimerMinutes > 0);
const daily = pickDailyProblem(problems, new Date('2026-11-26T00:00:00Z'));
assert.ok(problemSlugs.has(daily.slug), 'Daily challenge must be a valid catalog problem');
const analytics = buildAnalytics({ completed: ['two-sum'], bookmarked: ['two-sum'], activity: { '2026-11-26': 1 } }, problems, categories, pubCfg.interview.activityDays);
assert.equal(analytics.solvedCount, 1);
assert.equal(analytics.ledger.length, pubCfg.interview.activityDays);

// Verify built-in content & video plugins
const registry = createPluginRegistry();
assert.equal(registry.list().length, 3);
assert.equal(registry.resolve('https://www.youtube.com/watch?v=KLlXCFG5TnA')?.id, 'youtube-video');
assert.equal(extractYouTubeId('https://youtu.be/KLlXCFG5TnA'), 'KLlXCFG5TnA');
assert.equal(registry.resolve('https://github.com/neetcode-gh/leetcode/blob/main/python/0001-two-sum.py')?.id, 'github-content');
assert.equal(
  toGitHubRawUrl('https://github.com/neetcode-gh/leetcode/blob/main/python/0001-two-sum.py')?.rawUrl,
  'https://raw.githubusercontent.com/neetcode-gh/leetcode/main/python/0001-two-sum.py',
);
assert.equal(registry.resolve('https://medium.com/some-article')?.id, 'web-article');
assert.equal(registry.resolve('http://localhost:3000/secret'), null);

console.log(`Verified ${categories.length} topics, ${problems.length} problems, ${BUILTIN_SHEETS.length} sheets, ${SUPPORTED_LOCALES.length} locales, ${registry.list().length} plugins, and the Colabs room link contract.`);
