import { computeStreaks } from './store.mjs';
import { normalizeLinkedProfiles } from '../src/profiles.mjs';

/**
 * Neon Serverless PostgreSQL runtime store matching the exact async contract of server/store.mjs.
 * Activated automatically when DATABASE_URL is configured and @neondatabase/serverless is installed.
 */
export async function createNeonStore(databaseUrl, defaultProfileId = 'default', { sqlClient } = {}) {
  let sql = sqlClient;
  if (!sql) {
    if (!/^postgres(?:ql)?:\/\/.+/i.test(String(databaseUrl || '').trim())) {
      throw new Error('Invalid DATABASE_URL: expected a postgres:// or postgresql:// connection string');
    }
    const { neon } = await import('@neondatabase/serverless');
    sql = neon(databaseUrl);
  }

  async function ensureUser(userId, { locale = 'en', handle = null, displayName = '' } = {}) {
    await sql`
      INSERT INTO users (id, firebase_uid, handle, display_name, preferred_locale, updated_at)
      VALUES (${userId}, ${userId}, ${handle}, ${displayName}, ${locale}, date_trunc('milliseconds', NOW()))
      ON CONFLICT (id) DO NOTHING
    `;
  }

  return {
    driver: 'neon-postgresql',

    async ping() {
      try {
        await sql`SELECT 1`;
        return true;
      } catch (err) {
        const wrapped = new Error(`Cloud database unreachable: ${err?.message || 'ping failed'}`);
        wrapped.statusCode = 503;
        throw wrapped;
      }
    },

    async getProgress(profileId = defaultProfileId) {
      const id = String(profileId || defaultProfileId);
      const userRows = await sql`
        SELECT id, handle, display_name, preferred_locale, is_public_profile, activity_json, updated_at
        FROM users WHERE id = ${id} LIMIT 1
      `;
      const progRows = await sql`
        SELECT problem_id, status, bookmarked, notes, updated_at
        FROM user_progress WHERE user_id = ${id}
      `;
      const profileRows = await sql`
        SELECT platform, username, stats_json, synced_at
        FROM linked_profiles WHERE user_id = ${id}
      `;

      const user = userRows[0] || {};
      const completed = [];
      const bookmarked = [];
      const notes = {};
      const notesUpdatedAt = {};
      const solvedAt = {};
      const activity = {};
      if (user.activity_json && typeof user.activity_json === 'object') {
        for (const [day, count] of Object.entries(user.activity_json)) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(day) && Number(count) > 0) {
            activity[day] = Math.floor(Number(count));
          }
        }
      }

      for (const row of progRows) {
        if (row.status === 'solved') {
          completed.push(row.problem_id);
          const iso = row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString();
          solvedAt[row.problem_id] = iso;
          const day = iso.slice(0, 10);
          activity[day] = Math.max(Number(activity[day] || 0), 1);
        }
        if (row.bookmarked) bookmarked.push(row.problem_id);
        if (row.notes && row.notes.trim()) {
          notes[row.problem_id] = row.notes;
          notesUpdatedAt[row.problem_id] = row.updated_at ? new Date(row.updated_at).toISOString() : '';
        }
      }

      const linkedProfiles = {};
      for (const row of profileRows) {
        linkedProfiles[row.platform] = {
          handle: row.username,
          stats: row.stats_json || {},
          syncedAt: row.synced_at ? new Date(row.synced_at).toISOString() : null,
        };
      }

      const streaks = computeStreaks(activity);
      return {
        locale: user.preferred_locale || 'en',
        handle: user.handle || '',
        displayName: user.display_name || '',
        isPublicProfile: Boolean(user.is_public_profile),
        completed,
        bookmarked,
        notes,
        notesUpdatedAt,
        solvedAt,
        activity,
        linkedProfiles,
        streak: streaks.current,
        longestStreak: streaks.longest,
        updatedAt: user.updated_at ? new Date(user.updated_at).toISOString() : null,
      };
    },

    async saveProgress(profileId = defaultProfileId, patch = {}, validSlugs) {
      const id = String(profileId || defaultProfileId);
      const locale = typeof patch.locale === 'string' ? patch.locale : 'en';
      await ensureUser(id, { locale });

      let expectedTs = null;
      if (patch.expectedUpdatedAt !== undefined && patch.expectedUpdatedAt !== null && patch.expectedUpdatedAt !== '') {
        if (typeof patch.expectedUpdatedAt !== 'string' || Number.isNaN(Date.parse(patch.expectedUpdatedAt))) {
          const bad = new Error('Invalid expectedUpdatedAt timestamp');
          bad.statusCode = 400;
          throw bad;
        }
        expectedTs = new Date(patch.expectedUpdatedAt).toISOString();
      }

      let nextActivityJson = null;
      if (patch.activity && typeof patch.activity === 'object') {
        const cleanActivity = {};
        for (const [day, count] of Object.entries(patch.activity)) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(day) && Number(count) > 0) {
            cleanActivity[day] = Math.floor(Number(count));
          }
        }
        nextActivityJson = JSON.stringify(cleanActivity);
      }

      const hasCompleted = Array.isArray(patch.completed);
      const hasBookmarked = Array.isArray(patch.bookmarked);
      const hasNotes = Boolean(patch.notes && typeof patch.notes === 'object' && !Array.isArray(patch.notes));
      const hasProblemFields = hasCompleted || hasBookmarked || hasNotes;

      if (!hasProblemFields) {
        if (typeof patch.locale === 'string' || typeof patch.isPublicProfile === 'boolean' || typeof patch.handle === 'string' || nextActivityJson !== null) {
          const updated = expectedTs
            ? await sql`
                UPDATE users
                SET preferred_locale = COALESCE(${patch.locale ?? null}, preferred_locale),
                    is_public_profile = COALESCE(${typeof patch.isPublicProfile === 'boolean' ? patch.isPublicProfile : null}, is_public_profile),
                    handle = COALESCE(${patch.handle ? String(patch.handle).slice(0, 40) : null}, handle),
                    activity_json = COALESCE(${nextActivityJson}::jsonb, activity_json),
                    updated_at = date_trunc('milliseconds', NOW())
                WHERE id = ${id} AND date_trunc('milliseconds', updated_at) = ${expectedTs}::timestamptz
                RETURNING updated_at
              `
            : await sql`
                UPDATE users
                SET preferred_locale = COALESCE(${patch.locale ?? null}, preferred_locale),
                    is_public_profile = COALESCE(${typeof patch.isPublicProfile === 'boolean' ? patch.isPublicProfile : null}, is_public_profile),
                    handle = COALESCE(${patch.handle ? String(patch.handle).slice(0, 40) : null}, handle),
                    activity_json = COALESCE(${nextActivityJson}::jsonb, activity_json),
                    updated_at = date_trunc('milliseconds', NOW())
                WHERE id = ${id}
                RETURNING updated_at
              `;
          if (expectedTs && (!updated || updated.length === 0)) {
            const conflict = new Error('Conflict: remote progress has a newer revision');
            conflict.statusCode = 409;
            conflict.current = await this.getProgress(id);
            throw conflict;
          }
        }
        return this.getProgress(id);
      }

      const completedArr = hasCompleted
        ? [...new Set(patch.completed.filter((s) => !validSlugs || validSlugs.has(s)))]
        : [];
      const bookmarkedArr = hasBookmarked
        ? [...new Set(patch.bookmarked.filter((s) => !validSlugs || validSlugs.has(s)))]
        : [];
      const notesEntries = hasNotes
        ? Object.entries(patch.notes).filter(([slug, text]) => (!validSlugs || validSlugs.has(slug)) && typeof text === 'string' && text.length > 0)
        : [];
      const noteSlugs = notesEntries.map(([slug]) => slug);
      const notesTsObj = patch.notesUpdatedAt && typeof patch.notesUpdatedAt === 'object' ? patch.notesUpdatedAt : {};

      // Lock-first RepeatableRead atomic transaction:
      // 1) Statement 1 acquires row lock on users & checks/advances millisecond-aligned updated_at.
      // 2) Statement 2 aborts immediately (SQLSTATE 22012) if Statement 1 updated 0 rows — rolling back BEFORE any user_progress write runs.
      // 3) Concurrent RepeatableRead writers abort automatically with SQLSTATE 40001.
      try {
        await sql.transaction((tx) => {
          const queries = [];

          queries.push(expectedTs
            ? tx`
                UPDATE users
                SET preferred_locale = COALESCE(${patch.locale ?? null}, preferred_locale),
                    is_public_profile = COALESCE(${typeof patch.isPublicProfile === 'boolean' ? patch.isPublicProfile : null}, is_public_profile),
                    handle = COALESCE(${patch.handle ? String(patch.handle).slice(0, 40) : null}, handle),
                    activity_json = COALESCE(${nextActivityJson}::jsonb, activity_json),
                    updated_at = date_trunc('milliseconds', NOW())
                WHERE id = ${id} AND date_trunc('milliseconds', updated_at) = ${expectedTs}::timestamptz
                RETURNING updated_at
              `
            : tx`
                UPDATE users
                SET preferred_locale = COALESCE(${patch.locale ?? null}, preferred_locale),
                    is_public_profile = COALESCE(${typeof patch.isPublicProfile === 'boolean' ? patch.isPublicProfile : null}, is_public_profile),
                    handle = COALESCE(${patch.handle ? String(patch.handle).slice(0, 40) : null}, handle),
                    activity_json = COALESCE(${nextActivityJson}::jsonb, activity_json),
                    updated_at = date_trunc('milliseconds', NOW())
                WHERE id = ${id}
                RETURNING updated_at
              `);

          if (expectedTs) {
            queries.push(tx`
              SELECT 1 / CASE
                WHEN (SELECT xmin::text::bigint FROM users WHERE id = ${id}) = (txid_current() % 4294967296)
                THEN 1 ELSE 0
              END AS revision_lock_ok
            `);
          }

          if (hasCompleted) {
            if (completedArr.length === 0) {
              queries.push(tx`UPDATE user_progress SET status = 'unsolved' WHERE user_id = ${id} AND status <> 'unsolved'`);
            } else {
              queries.push(tx`
                UPDATE user_progress
                SET status = 'unsolved'
                WHERE user_id = ${id} AND status <> 'unsolved' AND NOT (problem_id = ANY(${completedArr}))
              `);
            }
            for (const slug of completedArr) {
              queries.push(tx`
                INSERT INTO user_progress (user_id, problem_id, status, bookmarked, notes, updated_at)
                VALUES (${id}, ${slug}, 'solved', FALSE, '', date_trunc('milliseconds', NOW()))
                ON CONFLICT (user_id, problem_id) DO UPDATE SET status = 'solved'
              `);
            }
          }

          if (hasBookmarked) {
            if (bookmarkedArr.length === 0) {
              queries.push(tx`UPDATE user_progress SET bookmarked = FALSE WHERE user_id = ${id} AND bookmarked = TRUE`);
            } else {
              queries.push(tx`
                UPDATE user_progress
                SET bookmarked = FALSE
                WHERE user_id = ${id} AND bookmarked = TRUE AND NOT (problem_id = ANY(${bookmarkedArr}))
              `);
            }
            for (const slug of bookmarkedArr) {
              queries.push(tx`
                INSERT INTO user_progress (user_id, problem_id, status, bookmarked, notes, updated_at)
                VALUES (${id}, ${slug}, 'unsolved', TRUE, '', date_trunc('milliseconds', NOW()))
                ON CONFLICT (user_id, problem_id) DO UPDATE SET bookmarked = TRUE
              `);
            }
          }

          if (hasNotes) {
            if (noteSlugs.length === 0) {
              queries.push(tx`UPDATE user_progress SET notes = '' WHERE user_id = ${id} AND notes <> ''`);
            } else {
              queries.push(tx`
                UPDATE user_progress
                SET notes = ''
                WHERE user_id = ${id} AND notes <> '' AND NOT (problem_id = ANY(${noteSlugs}))
              `);
            }
            for (const [slug, text] of notesEntries) {
              const noteText = text.slice(0, 4000);
              const rawTs = typeof notesTsObj[slug] === 'string' && !Number.isNaN(Date.parse(notesTsObj[slug]))
                ? new Date(notesTsObj[slug]).toISOString()
                : new Date().toISOString();
              queries.push(tx`
                INSERT INTO user_progress (user_id, problem_id, status, bookmarked, notes, updated_at)
                VALUES (${id}, ${slug}, 'unsolved', FALSE, ${noteText}, ${rawTs}::timestamptz)
                ON CONFLICT (user_id, problem_id) DO UPDATE SET
                  notes = EXCLUDED.notes,
                  updated_at = EXCLUDED.updated_at
              `);
            }
          }

          queries.push(tx`
            DELETE FROM user_progress
            WHERE user_id = ${id}
              AND status = 'unsolved'
              AND bookmarked = FALSE
              AND notes = ''
          `);

          return queries;
        }, { isolationLevel: 'RepeatableRead' });
      } catch (err) {
        if (err?.code === '22012' || err?.code === '40001') {
          const conflict = new Error('Conflict: remote progress has a newer revision');
          conflict.statusCode = 409;
          conflict.current = await this.getProgress(id);
          throw conflict;
        }
        throw err;
      }

      return this.getProgress(id);
    },

    async restoreWorkspace(profileId = defaultProfileId, payload = {}, validSlugs, owner = null) {
      const id = String(profileId || defaultProfileId);
      const patch = payload.progressPatch && typeof payload.progressPatch === 'object' ? payload.progressPatch : {};
      const locale = typeof patch.locale === 'string' ? patch.locale : 'en';
      await ensureUser(id, { locale });

      if (typeof payload.expectedUpdatedAt !== 'string' || !payload.expectedUpdatedAt.trim() || Number.isNaN(Date.parse(payload.expectedUpdatedAt))) {
        const bad = new Error('Valid expectedUpdatedAt timestamp is required for atomic restore');
        bad.statusCode = 400;
        throw bad;
      }
      const expectedTs = new Date(payload.expectedUpdatedAt).toISOString();

      let nextActivityJson = null;
      if (patch.activity && typeof patch.activity === 'object') {
        const cleanActivity = {};
        for (const [day, count] of Object.entries(patch.activity)) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(day) && Number(count) > 0) {
            cleanActivity[day] = Math.floor(Number(count));
          }
        }
        nextActivityJson = JSON.stringify(cleanActivity);
      }

      const hasCompleted = Array.isArray(patch.completed);
      const hasBookmarked = Array.isArray(patch.bookmarked);
      const hasNotes = Boolean(patch.notes && typeof patch.notes === 'object' && !Array.isArray(patch.notes));
      const completedArr = hasCompleted ? [...new Set(patch.completed.filter((s) => !validSlugs || validSlugs.has(s)))] : [];
      const bookmarkedArr = hasBookmarked ? [...new Set(patch.bookmarked.filter((s) => !validSlugs || validSlugs.has(s)))] : [];
      const notesEntries = hasNotes
        ? Object.entries(patch.notes).filter(([slug, text]) => (!validSlugs || validSlugs.has(slug)) && typeof text === 'string' && text.length > 0)
        : [];
      const noteSlugs = notesEntries.map(([slug]) => slug);
      const notesTsObj = patch.notesUpdatedAt && typeof patch.notesUpdatedAt === 'object' ? patch.notesUpdatedAt : {};

      const cleanProfiles = payload.linkedProfiles && typeof payload.linkedProfiles === 'object'
        ? normalizeLinkedProfiles(payload.linkedProfiles)
        : null;
      const incomingSheets = Array.isArray(payload.customSheets) ? payload.customSheets : null;
      const uid = String(owner || id);

      try {
        await sql.transaction((tx) => {
          const queries = [];

          // Statement 1: lock users row & verify/advance millisecond-aligned updated_at
          queries.push(expectedTs
            ? tx`
                UPDATE users
                SET preferred_locale = COALESCE(${patch.locale ?? null}, preferred_locale),
                    activity_json = COALESCE(${nextActivityJson}::jsonb, activity_json),
                    updated_at = date_trunc('milliseconds', NOW())
                WHERE id = ${id} AND date_trunc('milliseconds', updated_at) = ${expectedTs}::timestamptz
                RETURNING updated_at
              `
            : tx`
                UPDATE users
                SET preferred_locale = COALESCE(${patch.locale ?? null}, preferred_locale),
                    activity_json = COALESCE(${nextActivityJson}::jsonb, activity_json),
                    updated_at = date_trunc('milliseconds', NOW())
                WHERE id = ${id}
                RETURNING updated_at
              `);

          // Statement 2: abort immediately before any progress/profile/sheet mutation if revision didn't match
          if (expectedTs) {
            queries.push(tx`
              SELECT 1 / CASE
                WHEN (SELECT xmin::text::bigint FROM users WHERE id = ${id}) = (txid_current() % 4294967296)
                THEN 1 ELSE 0
              END AS revision_lock_ok
            `);
          }

          if (hasCompleted) {
            if (completedArr.length === 0) {
              queries.push(tx`UPDATE user_progress SET status = 'unsolved' WHERE user_id = ${id} AND status <> 'unsolved'`);
            } else {
              queries.push(tx`UPDATE user_progress SET status = 'unsolved' WHERE user_id = ${id} AND status <> 'unsolved' AND NOT (problem_id = ANY(${completedArr}))`);
            }
            for (const slug of completedArr) {
              queries.push(tx`
                INSERT INTO user_progress (user_id, problem_id, status, bookmarked, notes, updated_at)
                VALUES (${id}, ${slug}, 'solved', FALSE, '', date_trunc('milliseconds', NOW()))
                ON CONFLICT (user_id, problem_id) DO UPDATE SET status = 'solved'
              `);
            }
          }

          if (hasBookmarked) {
            if (bookmarkedArr.length === 0) {
              queries.push(tx`UPDATE user_progress SET bookmarked = FALSE WHERE user_id = ${id} AND bookmarked = TRUE`);
            } else {
              queries.push(tx`UPDATE user_progress SET bookmarked = FALSE WHERE user_id = ${id} AND bookmarked = TRUE AND NOT (problem_id = ANY(${bookmarkedArr}))`);
            }
            for (const slug of bookmarkedArr) {
              queries.push(tx`
                INSERT INTO user_progress (user_id, problem_id, status, bookmarked, notes, updated_at)
                VALUES (${id}, ${slug}, 'unsolved', TRUE, '', date_trunc('milliseconds', NOW()))
                ON CONFLICT (user_id, problem_id) DO UPDATE SET bookmarked = TRUE
              `);
            }
          }

          if (hasNotes) {
            if (noteSlugs.length === 0) {
              queries.push(tx`UPDATE user_progress SET notes = '' WHERE user_id = ${id} AND notes <> ''`);
            } else {
              queries.push(tx`UPDATE user_progress SET notes = '' WHERE user_id = ${id} AND notes <> '' AND NOT (problem_id = ANY(${noteSlugs}))`);
            }
            for (const [slug, text] of notesEntries) {
              const noteText = text.slice(0, 4000);
              const rawTs = typeof notesTsObj[slug] === 'string' && !Number.isNaN(Date.parse(notesTsObj[slug]))
                ? new Date(notesTsObj[slug]).toISOString()
                : new Date().toISOString();
              queries.push(tx`
                INSERT INTO user_progress (user_id, problem_id, status, bookmarked, notes, updated_at)
                VALUES (${id}, ${slug}, 'unsolved', FALSE, ${noteText}, ${rawTs}::timestamptz)
                ON CONFLICT (user_id, problem_id) DO UPDATE SET
                  notes = EXCLUDED.notes,
                  updated_at = EXCLUDED.updated_at
              `);
            }
          }

          if (hasCompleted || hasBookmarked || hasNotes) {
            queries.push(tx`
              DELETE FROM user_progress
              WHERE user_id = ${id}
                AND status = 'unsolved'
                AND bookmarked = FALSE
                AND notes = ''
            `);
          }

          if (cleanProfiles) {
            queries.push(tx`DELETE FROM linked_profiles WHERE user_id = ${id}`);
            for (const [platform, entry] of Object.entries(cleanProfiles)) {
              queries.push(tx`
                INSERT INTO linked_profiles (user_id, platform, username, stats_json, synced_at)
                VALUES (${id}, ${platform}, ${entry.handle || ''}, ${JSON.stringify(entry.stats || {})}::jsonb, NOW())
                ON CONFLICT (user_id, platform) DO UPDATE SET
                  username = EXCLUDED.username,
                  stats_json = EXCLUDED.stats_json,
                  synced_at = NOW()
              `);
            }
          }

          if (incomingSheets && incomingSheets.length > 0) {
            const incomingSheetIds = incomingSheets.map((s) => String(s.id || '')).filter(Boolean);
            if (incomingSheetIds.length > 0) {
              // Cast the runtime CASE result (not a constant literal) to smallint so PostgreSQL
              // never constant-folds the overflow when EXISTS is FALSE; aborts with SQLSTATE 22003 only on collision.
              queries.push(tx`
                SELECT (CASE
                  WHEN EXISTS (
                    SELECT 1 FROM custom_sheets
                    WHERE id = ANY(${incomingSheetIds}) AND user_id <> ${uid}
                  )
                  THEN 999999
                  ELSE 1
                END)::smallint AS sheet_ownership_ok
              `);
            }
            for (const sheet of incomingSheets) {
              const sheetTitle = sheet.names?.en || sheet.title || sheet.name || 'Custom Sheet';
              const sheetDesc = sheet.descriptions?.en || sheet.description || '';
              const sheetProblemIds = Array.isArray(sheet.slugs)
                ? sheet.slugs
                : (Array.isArray(sheet.problems) ? sheet.problems : (Array.isArray(sheet.problemSlugs) ? sheet.problemSlugs : []));
              queries.push(tx`
                INSERT INTO custom_sheets (id, user_id, title, description, problem_ids, is_public, updated_at)
                VALUES (${sheet.id}, ${uid}, ${sheetTitle}, ${sheetDesc}, ${JSON.stringify(sheetProblemIds)}::jsonb, ${Boolean(sheet.isPublic)}, NOW())
                ON CONFLICT (id) DO UPDATE SET
                  title = EXCLUDED.title,
                  description = EXCLUDED.description,
                  problem_ids = EXCLUDED.problem_ids,
                  is_public = EXCLUDED.is_public,
                  updated_at = NOW()
                WHERE custom_sheets.user_id = ${uid}
              `);
            }
          }

          return queries;
        }, { isolationLevel: 'RepeatableRead' });
      } catch (err) {
        if (err?.code === '22003') {
          const forbidden = new Error('Forbidden: sheet belongs to another user');
          forbidden.statusCode = 403;
          throw forbidden;
        }
        if (err?.code === '22012' || err?.code === '40001') {
          const conflict = new Error('Conflict: remote progress has a newer revision');
          conflict.statusCode = 409;
          conflict.current = await this.getProgress(id);
          throw conflict;
        }
        throw err;
      }

      return {
        ok: true,
        progress: await this.getProgress(id),
        profiles: await this.getLinkedProfiles(id),
        customSheets: await this.listCustomSheets(uid),
      };
    },

    async resetProgress(profileId = defaultProfileId) {
      const id = String(profileId || defaultProfileId);
      // Acquire users row lock FIRST (same lock order as saveProgress & restoreWorkspace) to prevent deadlocks
      await sql.transaction((tx) => [
        tx`
          UPDATE users
          SET activity_json = '{}'::jsonb,
              updated_at = date_trunc('milliseconds', NOW())
          WHERE id = ${id}
        `,
        tx`DELETE FROM user_progress WHERE user_id = ${id}`,
      ]);
      return this.getProgress(id);
    },

    async getLinkedProfiles(profileId = defaultProfileId) {
      const id = String(profileId || defaultProfileId);
      const rows = await sql`
        SELECT platform, username, stats_json, synced_at
        FROM linked_profiles WHERE user_id = ${id}
      `;
      const result = {};
      for (const row of rows) {
        result[row.platform] = {
          handle: row.username,
          stats: row.stats_json || {},
          syncedAt: row.synced_at ? new Date(row.synced_at).toISOString() : null,
        };
      }
      return result;
    },

    async saveLinkedProfiles(profileId = defaultProfileId, rawProfiles = {}) {
      const id = String(profileId || defaultProfileId);
      await ensureUser(id);
      const normalized = normalizeLinkedProfiles(rawProfiles);
      await sql`DELETE FROM linked_profiles WHERE user_id = ${id}`;
      for (const [platform, entry] of Object.entries(normalized)) {
        if (!entry?.handle) continue;
        await sql`
          INSERT INTO linked_profiles (user_id, platform, username, stats_json, synced_at)
          VALUES (${id}, ${platform}, ${entry.handle}, ${JSON.stringify(entry.stats || {})}::jsonb, NOW())
          ON CONFLICT (user_id, platform) DO UPDATE SET
            username = EXCLUDED.username,
            stats_json = EXCLUDED.stats_json,
            synced_at = NOW()
        `;
      }
      return normalized;
    },

    async listCustomSheets(userId = defaultProfileId) {
      const rows = await sql`
        SELECT id, title, description, problem_ids, updated_at
        FROM custom_sheets WHERE user_id = ${String(userId)}
        ORDER BY updated_at DESC
      `;
      return rows.map((r) => {
        const slugs = Array.isArray(r.problem_ids) ? r.problem_ids : [];
        const title = r.title || 'Custom Sheet';
        const desc = r.description || `${slugs.length} curated problems.`;
        const ts = r.updated_at ? new Date(r.updated_at).toISOString() : null;
        return {
          id: r.id,
          custom: true,
          source: 'Custom Series',
          badge: 'Custom',
          plannerSupported: true,
          names: { en: title },
          descriptions: { en: desc },
          slugs,
          createdAt: ts,
          updatedAt: ts,
        };
      });
    },

    async addCustomSheet(sheet, userId = defaultProfileId) {
      const uid = String(userId || defaultProfileId);
      await ensureUser(uid);
      const sheetTitle = sheet.names?.en || sheet.title || sheet.name || 'Custom Sheet';
      const sheetDesc = sheet.descriptions?.en || sheet.description || '';
      const sheetSlugs = Array.isArray(sheet.slugs)
        ? sheet.slugs
        : (Array.isArray(sheet.problems) ? sheet.problems : (Array.isArray(sheet.problemSlugs) ? sheet.problemSlugs : []));
      const rows = await sql`
        INSERT INTO custom_sheets (id, user_id, title, description, problem_ids, updated_at)
        VALUES (${sheet.id}, ${uid}, ${sheetTitle}, ${sheetDesc}, ${JSON.stringify(sheetSlugs)}::jsonb, NOW())
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          problem_ids = EXCLUDED.problem_ids,
          updated_at = NOW()
        WHERE custom_sheets.user_id = ${uid}
        RETURNING id
      `;
      if (!rows.length) {
        const err = new Error('Forbidden: custom sheet belongs to another account');
        err.statusCode = 403;
        throw err;
      }
      return sheet;
    },

    async deleteCustomSheet(sheetId, userId = defaultProfileId) {
      const rows = await sql`
        DELETE FROM custom_sheets WHERE id = ${sheetId} AND user_id = ${String(userId)}
        RETURNING id
      `;
      return rows.length > 0;
    },

    async getPublicPortfolio(handle) {
      const clean = String(handle || '').trim();
      const rows = await sql`
        SELECT id, handle, display_name FROM users
        WHERE (LOWER(handle) = LOWER(${clean}) OR id = ${clean}) AND is_public_profile = TRUE
        LIMIT 1
      `;
      if (!rows[0]) return null;
      const fullProgress = await this.getProgress(rows[0].id);
      const profiles = await this.getLinkedProfiles(rows[0].id);
      return {
        handle: rows[0].handle || clean,
        displayName: rows[0].display_name || '',
        progress: {
          completed: fullProgress.completed,
          activity: fullProgress.activity,
          streak: fullProgress.streak,
          longestStreak: fullProgress.longestStreak,
          updatedAt: fullProgress.updatedAt,
        },
        profiles,
      };
    },
  };
}
