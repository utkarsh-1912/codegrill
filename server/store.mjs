import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
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
  let loading;
  let writeQueue = Promise.resolve();

  async function load() {
    loading ??= readState().catch((error) => {
      loading = undefined;
      throw error;
    });
    return loading;
  }

  async function readState() {
    try {
      const raw = await readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        profiles: Object.assign(Object.create(null), parsed.profiles),
        customSheets: Array.isArray(parsed.customSheets) ? parsed.customSheets : [],
      };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return { profiles: Object.create(null), customSheets: [] };
    }
  }

  async function persist() {
    const snapshot = JSON.stringify(await load(), null, 2);
    writeQueue = writeQueue.catch(() => {}).then(async () => {
      await mkdir(dirname(filePath), { recursive: true });
      const temporary = filePath + '.' + randomUUID() + '.tmp';
      try {
        await writeFile(temporary, snapshot, { mode: 0o600 });
        await rename(temporary, filePath);
      } finally {
        await rm(temporary, { force: true });
      }
    });
    return writeQueue;
  }

  function safeProfileId(id) {
    if (/^firebase-[a-f0-9]{64}$/.test(id)) return id;
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
      if (
        typeof patch.expectedUpdatedAt === 'string' &&
        patch.expectedUpdatedAt &&
        current.updatedAt &&
        current.updatedAt !== patch.expectedUpdatedAt
      ) {
        const conflict = new Error('Conflict: remote progress has a newer revision');
        conflict.statusCode = 409;
        conflict.current = await this.getProgress(id);
        throw conflict;
      }
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

      const prevUpdatedMs = current.updatedAt ? Date.parse(current.updatedAt) : 0;
      const nowIso = new Date(Math.max(Date.now(), Number.isFinite(prevUpdatedMs) ? prevUpdatedMs + 1 : 0)).toISOString();
      const notesUpdatedAt = { ...(current.notesUpdatedAt || {}) };
      if (patch.notesUpdatedAt && typeof patch.notesUpdatedAt === 'object') {
        for (const [slug, ts] of Object.entries(patch.notesUpdatedAt)) {
          if (typeof ts === 'string' && ts) notesUpdatedAt[slug] = ts;
        }
      }
      for (const [slug, text] of Object.entries(notes)) {
        if (current.notes?.[slug] !== text && !patch.notesUpdatedAt?.[slug]) {
          notesUpdatedAt[slug] = nowIso;
        }
      }
      for (const slug of Object.keys(notesUpdatedAt)) {
        if (!notes[slug]) delete notesUpdatedAt[slug];
      }

      const solvedAt = { ...(current.solvedAt || {}) };
      const newlySolved = completed.filter((slug) => !current.completed.includes(slug));
      for (const slug of newlySolved) solvedAt[slug] = nowIso;
      for (const slug of Object.keys(solvedAt)) {
        if (!completed.includes(slug)) delete solvedAt[slug];
      }

      const activity = { ...(current.activity || {}) };
      if (patch.activity && typeof patch.activity === 'object') {
        for (const [day, count] of Object.entries(patch.activity)) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
            const num = Math.max(0, Math.floor(Number(count) || 0));
            if (num > 0) activity[day] = Math.max(Number(activity[day] || 0), num);
          }
        }
      } else if (newlySolved.length > 0) {
        const today = nowIso.slice(0, 10);
        activity[today] = (activity[today] || 0) + newlySolved.length;
      }

      const next = {
        locale,
        completed,
        bookmarked,
        notes,
        notesUpdatedAt,
        solvedAt,
        activity,
        isPublicProfile: typeof patch.isPublicProfile === 'boolean'
          ? patch.isPublicProfile
          : Boolean(current.isPublicProfile),
        handle: typeof patch.handle === 'string' ? patch.handle.slice(0, 40) : (current.handle || ''),
        linkedProfiles: current.linkedProfiles || {},
        updatedAt: nowIso,
      };
      data.profiles[id] = next;
      await persist();
      const streaks = computeStreaks(activity);
      return { ...next, streak: streaks.current, longestStreak: streaks.longest };
    },
    async restoreWorkspace(profileId = defaultProfileId, payload = {}, validSlugs, owner = null) {
      const data = await load();
      const id = safeProfileId(profileId);
      const current = { ...DEFAULT_PROFILE, ...(data.profiles[id] || {}) };
      if (
        typeof payload.expectedUpdatedAt === 'string' &&
        payload.expectedUpdatedAt &&
        current.updatedAt &&
        current.updatedAt !== payload.expectedUpdatedAt
      ) {
        const conflict = new Error('Conflict: remote progress has a newer revision');
        conflict.statusCode = 409;
        conflict.current = await this.getProgress(id);
        throw conflict;
      }

      const patch = payload.progressPatch && typeof payload.progressPatch === 'object' ? payload.progressPatch : {};
      const prevUpdatedMs = current.updatedAt ? Date.parse(current.updatedAt) : 0;
      const nowIso = new Date(Math.max(Date.now(), Number.isFinite(prevUpdatedMs) ? prevUpdatedMs + 1 : 0)).toISOString();

      // Pre-validate custom sheet ownership before mutating any section
      const incomingSheets = Array.isArray(payload.customSheets) ? payload.customSheets : null;
      const normalizedOwnerId = owner ?? null;
      if (incomingSheets && normalizedOwnerId) {
        for (const sheet of incomingSheets) {
          const existing = data.customSheets.find((s) => s.id === sheet.id);
          if (existing && existing.ownerId && existing.ownerId !== normalizedOwnerId) {
            const err = new Error('Forbidden: sheet belongs to another user');
            err.statusCode = 403;
            throw err;
          }
        }
      }

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

      const notesUpdatedAt = { ...(current.notesUpdatedAt || {}) };
      if (patch.notesUpdatedAt && typeof patch.notesUpdatedAt === 'object') {
        for (const [slug, ts] of Object.entries(patch.notesUpdatedAt)) {
          if (typeof ts === 'string' && ts) notesUpdatedAt[slug] = ts;
        }
      }
      for (const slug of Object.keys(notesUpdatedAt)) {
        if (!notes[slug]) delete notesUpdatedAt[slug];
      }

      const activity = patch.activity && typeof patch.activity === 'object'
        ? Object.fromEntries(
            Object.entries(patch.activity)
              .filter(([day, count]) => /^\d{4}-\d{2}-\d{2}$/.test(day) && Number(count) > 0)
              .map(([day, count]) => [day, Math.floor(Number(count))]),
          )
        : current.activity;

      const linkedProfiles = payload.linkedProfiles && typeof payload.linkedProfiles === 'object'
        ? normalizeLinkedProfiles(payload.linkedProfiles)
        : current.linkedProfiles;

      data.profiles[id] = {
        ...current,
        locale,
        completed,
        bookmarked,
        notes,
        notesUpdatedAt,
        activity,
        linkedProfiles,
        updatedAt: nowIso,
      };

      if (incomingSheets) {
        for (const sheet of incomingSheets) {
          const entry = { ...sheet, ownerId: normalizedOwnerId };
          data.customSheets = [entry, ...data.customSheets.filter((s) => s.id !== entry.id || (s.ownerId ?? null) !== normalizedOwnerId)];
        }
      }

      await persist();
      return {
        ok: true,
        progress: await this.getProgress(id),
        profiles: linkedProfiles,
        customSheets: await this.listCustomSheets(normalizedOwnerId),
      };
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
    async getPublicPortfolio(handle) {
      const clean = String(handle || '').trim().toLowerCase();
      if (!clean) return null;
      const data = await load();
      for (const [id, raw] of Object.entries(data.profiles)) {
        if (!raw?.isPublicProfile) continue;
        const h = String(raw.handle || '').trim().toLowerCase();
        if (h === clean || id.toLowerCase() === clean) {
          const streaks = computeStreaks(raw.activity);
          return {
            handle: raw.handle || id,
            displayName: raw.displayName || '',
            progress: {
              completed: Array.isArray(raw.completed) ? [...raw.completed] : [],
              activity: raw.activity && typeof raw.activity === 'object' ? { ...raw.activity } : {},
              streak: streaks.current,
              longestStreak: streaks.longest,
              updatedAt: raw.updatedAt || null,
            },
            profiles: normalizeLinkedProfiles(raw.linkedProfiles || {}),
          };
        }
      }
      return null;
    },
    async listCustomSheets(ownerId = null) {
      const data = await load();
      return data.customSheets.filter((sheet) => (sheet.ownerId ?? null) === ownerId)
        .map(({ ownerId: _, ...sheet }) => sheet);
    },
    async addCustomSheet(sheet, ownerId = null) {
      const data = await load();
      data.customSheets = [{ ...sheet, ownerId }, ...data.customSheets.filter((s) => s.id !== sheet.id || (s.ownerId ?? null) !== ownerId)];
      await persist();
      return sheet;
    },
    async deleteCustomSheet(id, ownerId = null) {
      const data = await load();
      const before = data.customSheets.length;
      data.customSheets = data.customSheets.filter((s) => s.id !== id || (s.ownerId ?? null) !== ownerId);
      if (data.customSheets.length !== before) await persist();
      return data.customSheets.length !== before;
    },
  };
}
