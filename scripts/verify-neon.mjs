import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';
import { createNeonStore } from '../server/neonStore.mjs';

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim();
  try {
    const envRaw = readFileSync(new URL('../.env', import.meta.url), 'utf8');
    for (const line of envRaw.split(/\r?\n/)) {
      const m = /^\s*DATABASE_URL\s*=\s*(.+?)\s*$/.exec(line);
      if (m) return m[1].replace(/^['"]|['"]$/g, '').trim();
    }
  } catch {
    // .env not found
  }
  return '';
}

const databaseUrl = loadDatabaseUrl();
if (!databaseUrl) {
  console.error('DATABASE_URL is not set in environment or .env');
  process.exit(1);
}

const sql = neon(databaseUrl);
const migrationSql = readFileSync(new URL('../db/migrations/0001_init.sql', import.meta.url), 'utf8');
const statements = migrationSql
  .split(/;\s*(?:\r?\n|$)/)
  .map((s) => s.trim())
  .filter(Boolean);

console.log(`Applying ${statements.length} migration statements from db/migrations/0001_init.sql...`);
for (const stmt of statements) {
  await sql.query(stmt);
}
console.log('Migration applied cleanly.');

const store = await createNeonStore(databaseUrl, 'default');
const uidA = `__codegrill_smoke_a_${Date.now()}__`;
const uidB = `__codegrill_smoke_b_${Date.now()}__`;
const sheetIdA = `custom-smoke-a-${Date.now().toString(36)}`;

try {
  // 1. Live ping
  assert.equal(await store.ping(), true, 'ping() must return true');

  // 2. Full progress write + per-note timestamp fidelity
  const noteTs = '2026-11-27T12:34:56.000Z';
  const saved1 = await store.saveProgress(uidA, {
    locale: 'en',
    completed: ['two-sum'],
    bookmarked: ['two-sum', 'valid-anagram'],
    notes: { 'two-sum': 'Live Neon hash map note' },
    notesUpdatedAt: { 'two-sum': noteTs },
    activity: { '2026-11-27': 2 },
  });
  assert.deepEqual(saved1.completed, ['two-sum']);
  assert.equal(saved1.notes['two-sum'], 'Live Neon hash map note');
  assert.equal(saved1.notesUpdatedAt['two-sum'], noteTs);
  assert.equal(saved1.activity['2026-11-27'], 2);
  assert.ok(saved1.updatedAt, 'updatedAt revision must be returned');

  // 3. Locale-only partial update preserves problem rows
  const savedLocale = await store.saveProgress(uidA, { locale: 'ja', expectedUpdatedAt: saved1.updatedAt });
  assert.equal(savedLocale.locale, 'ja');
  assert.deepEqual(savedLocale.completed, ['two-sum']);
  assert.equal(savedLocale.notes['two-sum'], 'Live Neon hash map note');

  // 4. Completed-only partial update preserves bookmarks & notes
  const savedPartial = await store.saveProgress(uidA, {
    completed: ['two-sum', 'valid-anagram'],
    expectedUpdatedAt: savedLocale.updatedAt,
  });
  assert.ok(savedPartial.completed.includes('valid-anagram'));
  assert.ok(savedPartial.bookmarked.includes('two-sum'));
  assert.equal(savedPartial.notes['two-sum'], 'Live Neon hash map note');

  // 5. Stale expectedUpdatedAt rejected with 409 Conflict without mutating rows
  await assert.rejects(
    () => store.saveProgress(uidA, {
      completed: [],
      bookmarked: [],
      notes: {},
      expectedUpdatedAt: saved1.updatedAt,
    }),
    (err) => err?.statusCode === 409 && Boolean(err?.current),
  );
  const afterConflict = await store.getProgress(uidA);
  assert.ok(afterConflict.completed.includes('valid-anagram'), 'Stale 409 must not mutate user_progress');

  // 6. Atomic restoreWorkspace: valid owned sheet + linked profile + progress (verifies CASE::smallint succeeds on owned sheet)
  const restoredA = await store.restoreWorkspace(
    uidA,
    {
      progressPatch: { completed: ['two-sum'], bookmarked: ['two-sum'], notes: { 'two-sum': 'Restored note' }, notesUpdatedAt: { 'two-sum': noteTs } },
      linkedProfiles: { leetcode: { handle: 'smoke_lc' } },
      customSheets: [{ id: sheetIdA, names: { en: 'Smoke Sheet A' }, descriptions: { en: 'Live PG test' }, slugs: ['two-sum'] }],
      expectedUpdatedAt: afterConflict.updatedAt,
    },
    undefined,
    uidA,
  );
  assert.equal(restoredA.ok, true);
  assert.deepEqual(restoredA.progress.completed, ['two-sum']);
  assert.equal(restoredA.profiles.leetcode?.handle, 'smoke_lc');
  assert.equal(restoredA.customSheets[0]?.names?.en, 'Smoke Sheet A');
  assert.deepEqual(restoredA.customSheets[0]?.slugs, ['two-sum']);

  // 7. Cross-account sheet ID collision in restoreWorkspace aborts with 403 and rolls back progress!
  const seedB = await store.saveProgress(uidB, { completed: ['group-anagrams'] });
  await assert.rejects(
    () => store.restoreWorkspace(
      uidB,
      {
        progressPatch: { completed: ['two-sum'] },
        customSheets: [{ id: sheetIdA, names: { en: 'Hijack' }, slugs: ['two-sum'] }],
        expectedUpdatedAt: seedB.updatedAt,
      },
      undefined,
      uidB,
    ),
    (err) => err?.statusCode === 403,
  );
  const afterForbiddenB = await store.getProgress(uidB);
  assert.deepEqual(afterForbiddenB.completed, ['group-anagrams'], '403 sheet collision must roll back progress mutation in Neon');

  // 8. Atomic resetProgress clears user_progress + activity_json and advances updated_at
  const preResetRev = restoredA.progress.updatedAt;
  const resetA = await store.resetProgress(uidA);
  assert.deepEqual(resetA.completed, []);
  assert.deepEqual(resetA.activity, {});
  assert.notEqual(resetA.updatedAt, preResetRev);
  await assert.rejects(
    () => store.saveProgress(uidA, { completed: ['two-sum'], expectedUpdatedAt: preResetRev }),
    (err) => err?.statusCode === 409,
  );

  console.log('ALL LIVE NEON POSTGRESQL CHECKS PASSED.');
} finally {
  await sql`DELETE FROM users WHERE id = ANY(${[uidA, uidB]})`;
  console.log('Cleaned up temporary smoke-test rows.');
}
