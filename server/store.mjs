import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { normalizeLinkedProfiles } from '../src/profiles.mjs';

const DEFAULT_PROFILE = {
  locale: 'en',
  completed: [],
  bookmarked: [],
  notes: {},
  solvedAt: {},
  activity: {},
  linkedProfiles: {},
  updatedAt: null,
};

export function computeStreaks(activity = {}) {
  let current = 0;
  const cursor = new Date();
  for (let i = 0; i < 365; i += 1) {
    const key = cursor.toISOString().slice(0, 10);
    if (activity[key] > 0) {
      current += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    } else if (i === 0) {
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    } else {
      break;
    }
  }

  const activeDays = Object.entries(activity)
    .filter(([, count]) => count > 0)
    .map(([day]) => day)
    .sort();
  let longest = 0;
  let run = 0;
  let prevTime = null;
  for (const day of activeDays) {
    const ts = Date.parse(`${day}T00:00:00Z`);
    if (prevTime !== null && ts - prevTime === 86400000) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
    prevTime = ts;
  }
  return { current, longest };
}

export function buildAnalytics(profile, problems, categories, activityDays = 28) {
  const completedSet = new Set(profile.completed || []);
  const bookmarkedSet = new Set(profile.bookmarked || []);
  const solvedAt = profile.solvedAt || {};
  const activity = profile.activity || {};

  const byDifficulty = { Easy: { done: 0, total: 0 }, Medium: { done: 0, total: 0 }, Hard: { done: 0, total: 0 } };
  const byTopicMap = new Map(categories.map((c) => [c.id, { id: c.id, done: 0, total: 0 }]));

  for (const problem of problems) {
    const diff = byDifficulty[problem.difficulty];
    if (diff) {
      diff.total += 1;
      if (completedSet.has(problem.slug)) diff.done += 1;
    }
    const topicBucket = byTopicMap.get(problem.category_id);
    if (topicBucket) {
      topicBucket.total += 1;
      if (completedSet.has(problem.slug)) topicBucket.done += 1;
    }
  }

  const ledger = [];
  const today = new Date();
  for (let offset = activityDays - 1; offset >= 0; offset -= 1) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - offset);
    const date = d.toISOString().slice(0, 10);
    ledger.push({ date, count: Number(activity[date] || 0) });
  }

  // Spaced-repetition revision queue: bookmarked first, then oldest solved problems
  const revisionQueue = [
    ...[...bookmarkedSet].map((slug) => ({ slug, reason: 'bookmarked', ts: solvedAt[slug] || '' })),
    ...[...completedSet]
      .filter((slug) => !bookmarkedSet.has(slug))
      .map((slug) => ({ slug, reason: 'spaced', ts: solvedAt[slug] || '' }))
      .sort((a, b) => a.ts.localeCompare(b.ts)),
  ].slice(0, 6);

  const streaks = computeStreaks(activity);
  return {
    solvedCount: completedSet.size,
    totalCount: problems.length,
    bookmarkedCount: bookmarkedSet.size,
    streak: streaks.current,
    longestStreak: streaks.longest,
    byDifficulty,
    byTopic: [...byTopicMap.values()],
    ledger,
    revisionQueue,
  };
}

export function createStore(filePath, defaultProfileId = 'default') {
  let state = null;
  let writeQueue = Promise.resolve();

  async function load() {
    if (state) return state;
    try {
      const raw = await readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      state = {
        profiles: parsed.profiles && typeof parsed.profiles === 'object' ? parsed.profiles : {},
        customSheets: Array.isArray(parsed.customSheets) ? parsed.customSheets : [],
      };
    } catch {
      state = { profiles: {}, customSheets: [] };
    }
    return state;
  }

  async function persist() {
    const snapshot = JSON.stringify(state, null, 2);
    writeQueue = writeQueue.then(async () => {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, snapshot, 'utf8');
    });
    return writeQueue;
  }

  function safeProfileId(id) {
    const clean = String(id || defaultProfileId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
    return clean || defaultProfileId;
  }

  return {
    async getProgress(profileId = defaultProfileId) {
      const data = await load();
      const id = safeProfileId(profileId);
      const profile = { ...DEFAULT_PROFILE, ...(data.profiles[id] || {}) };
      const streaks = computeStreaks(profile.activity);
      return { ...profile, streak: streaks.current, longestStreak: streaks.longest };
    },
    async saveProgress(profileId = defaultProfileId, patch = {}, validSlugs) {
      const data = await load();
      const id = safeProfileId(profileId);
      const current = { ...DEFAULT_PROFILE, ...(data.profiles[id] || {}) };
      const completed = Array.isArray(patch.completed)
        ? [...new Set(patch.completed.filter((s) => !validSlugs || validSlugs.has(s)))]
        : current.completed;
      const bookmarked = Array.isArray(patch.bookmarked)
        ? [...new Set(patch.bookmarked.filter((s) => !validSlugs || validSlugs.has(s)))]
        : current.bookmarked;
      const notes = patch.notes && typeof patch.notes === 'object'
        ? Object.fromEntries(
            Object.entries(patch.notes)
              .filter(([slug, text]) => (!validSlugs || validSlugs.has(slug)) && typeof text === 'string' && text.trim())
              .map(([slug, text]) => [slug, text.slice(0, 4000)]),
          )
        : current.notes;
      const locale = typeof patch.locale === 'string' ? patch.locale : current.locale;

      const nowIso = new Date().toISOString();
      const solvedAt = { ...(current.solvedAt || {}) };
      const newlySolved = completed.filter((slug) => !current.completed.includes(slug));
      for (const slug of newlySolved) solvedAt[slug] = nowIso;
      for (const slug of Object.keys(solvedAt)) {
        if (!completed.includes(slug)) delete solvedAt[slug];
      }

      const activity = { ...(current.activity || {}) };
      if (newlySolved.length > 0) {
        const today = nowIso.slice(0, 10);
        activity[today] = (activity[today] || 0) + newlySolved.length;
      }

      const next = {
        locale,
        completed,
        bookmarked,
        notes,
        solvedAt,
        activity,
        linkedProfiles: current.linkedProfiles || {},
        updatedAt: nowIso,
      };
      data.profiles[id] = next;
      await persist();
      const streaks = computeStreaks(activity);
      return { ...next, streak: streaks.current, longestStreak: streaks.longest };
    },
    async getLinkedProfiles(profileId = defaultProfileId) {
      const data = await load();
      const id = safeProfileId(profileId);
      const current = data.profiles[id] || DEFAULT_PROFILE;
      return normalizeLinkedProfiles(current.linkedProfiles || {});
    },
    async saveLinkedProfiles(profileId = defaultProfileId, rawProfiles = {}) {
      const data = await load();
      const id = safeProfileId(profileId);
      const current = { ...DEFAULT_PROFILE, ...(data.profiles[id] || {}) };
      const linkedProfiles = normalizeLinkedProfiles(rawProfiles);
      data.profiles[id] = {
        ...current,
        linkedProfiles,
        updatedAt: new Date().toISOString(),
      };
      await persist();
      return linkedProfiles;
    },
    async resetProgress(profileId = defaultProfileId) {
      const data = await load();
      const id = safeProfileId(profileId);
      const currentLocale = data.profiles[id]?.locale || DEFAULT_PROFILE.locale;
      const currentLinked = data.profiles[id]?.linkedProfiles || {};
      const fresh = {
        ...DEFAULT_PROFILE,
        locale: currentLocale,
        linkedProfiles: currentLinked,
        updatedAt: new Date().toISOString(),
      };
      data.profiles[id] = fresh;
      await persist();
      return { ...fresh, streak: 0, longestStreak: 0 };
    },
    async listCustomSheets() {
      const data = await load();
      return data.customSheets;
    },
    async addCustomSheet(sheet) {
      const data = await load();
      data.customSheets = [sheet, ...data.customSheets.filter((s) => s.id !== sheet.id)];
      await persist();
      return sheet;
    },
    async deleteCustomSheet(id) {
      const data = await load();
      const before = data.customSheets.length;
      data.customSheets = data.customSheets.filter((s) => s.id !== id);
      if (data.customSheets.length !== before) await persist();
      return data.customSheets.length !== before;
    },
  };
}
