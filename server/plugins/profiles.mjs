import { PLATFORM_MAP, buildProfileUrl, sanitizeHandle } from '../../src/profiles.mjs';

const DEFAULT_HEADERS = {
  'User-Agent': 'Codegrill/1.0 (+https://codegrill.vercel.app)',
  Accept: 'application/json, text/html;q=0.9',
};

async function fetchJson(url, options = {}, timeoutMs = 8000) {
  const res = await fetch(url, {
    ...options,
    headers: { ...DEFAULT_HEADERS, ...(options.headers || {}) },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchText(url, timeoutMs = 8000) {
  const res = await fetch(url, {
    headers: DEFAULT_HEADERS,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function syncLeetCode(handle, timeoutMs) {
  const query = `
    query userProfileStats($username: String!) {
      matchedUser(username: $username) {
        username
        profile { ranking reputation }
        submitStatsGlobal {
          acSubmissionNum { difficulty count }
        }
      }
      userContestRanking(username: $username) {
        rating
        globalRanking
        topPercentage
      }
    }
  `;
  const data = await fetchJson(
    'https://leetcode.com/graphql',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Referer: `https://leetcode.com/u/${encodeURIComponent(handle)}/`,
      },
      body: JSON.stringify({ query, variables: { username: handle } }),
    },
    timeoutMs,
  );

  const user = data?.data?.matchedUser;
  if (!user) throw new Error('LeetCode user not found');
  const acList = user.submitStatsGlobal?.acSubmissionNum || [];
  const byDiff = Object.fromEntries(acList.map((row) => [row.difficulty, Number(row.count) || 0]));
  const contest = data?.data?.userContestRanking;
  const topPct = contest?.topPercentage ? `Top ${Number(contest.topPercentage).toFixed(1)}%` : '';

  return {
    solved: byDiff.All ?? ((byDiff.Easy || 0) + (byDiff.Medium || 0) + (byDiff.Hard || 0)),
    easy: byDiff.Easy ?? null,
    medium: byDiff.Medium ?? null,
    hard: byDiff.Hard ?? null,
    rating: contest?.rating ? Math.round(Number(contest.rating)) : null,
    maxRating: null,
    rank: topPct,
    globalRank: user.profile?.ranking ? Number(user.profile.ranking) : (contest?.globalRanking ? Number(contest.globalRanking) : null),
    source: 'live',
  };
}

async function syncCodeforces(handle, timeoutMs) {
  const info = await fetchJson(
    `https://codeforces.com/api/user.info?handles=${encodeURIComponent(handle)}`,
    {},
    timeoutMs,
  );
  if (info?.status !== 'OK' || !Array.isArray(info.result) || !info.result[0]) {
    throw new Error('Codeforces user not found');
  }
  const user = info.result[0];

  let solved = null;
  try {
    const status = await fetchJson(
      `https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=1&count=2500`,
      {},
      timeoutMs,
    );
    if (status?.status === 'OK' && Array.isArray(status.result)) {
      const unique = new Set();
      for (const sub of status.result) {
        if (sub?.verdict === 'OK' && sub.problem) {
          unique.add(`${sub.problem.contestId || 'gym'}:${sub.problem.index || sub.problem.name}`);
        }
      }
      solved = unique.size;
    }
  } catch {
    // Keep user rating/rank even if submissions endpoint is rate-limited
  }

  return {
    solved,
    rating: Number.isFinite(user.rating) ? Math.round(user.rating) : null,
    maxRating: Number.isFinite(user.maxRating) ? Math.round(user.maxRating) : null,
    rank: user.rank || user.maxRank || '',
    globalRank: null,
    source: 'live',
  };
}

async function syncAtCoder(handle, timeoutMs) {
  const ac = await fetchJson(
    `https://kenkoooo.com/atcoder/atcoder-api/v3/user/ac_rank?user=${encodeURIComponent(handle)}`,
    {},
    timeoutMs,
  );
  return {
    solved: Number.isFinite(ac?.count) ? ac.count : null,
    rating: null,
    maxRating: null,
    rank: Number.isFinite(ac?.rank) ? `AC #${ac.rank + 1}` : '',
    globalRank: Number.isFinite(ac?.rank) ? ac.rank + 1 : null,
    source: 'live',
  };
}

async function syncGitHub(handle, timeoutMs) {
  const user = await fetchJson(
    `https://api.github.com/users/${encodeURIComponent(handle)}`,
    { headers: { Accept: 'application/vnd.github+json' } },
    timeoutMs,
  );
  if (!user?.login) throw new Error('GitHub user not found');
  return {
    solved: null,
    rating: null,
    maxRating: null,
    rank: user.followers ? `${user.followers} followers` : '',
    globalRank: null,
    extraCount: Number.isFinite(user.public_repos) ? user.public_repos : null,
    extraLabel: 'repos',
    source: 'live',
  };
}

async function syncCodeChef(handle, timeoutMs) {
  const html = await fetchText(`https://www.codechef.com/users/${encodeURIComponent(handle)}`, timeoutMs);
  const ratingMatch = /class="rating-number"[^>]*>\s*(\d+)/i.exec(html);
  const starsMatch = /class="rating-star"[^>]*>([\s\S]*?)<\/div>/i.exec(html);
  const starCount = starsMatch ? (starsMatch[1].match(/&#9733;|★/g) || []).length : 0;
  const solvedMatch = /Total Problems Solved:\s*(\d+)/i.exec(html) || /Problems Solved[^0-9]{0,40}(\d+)/i.exec(html);
  const globalRankMatch = /Global Rank[\s\S]{0,120}?<strong>\s*(\d+)\s*<\/strong>/i.exec(html);

  if (!ratingMatch && !solvedMatch) {
    throw new Error('Could not parse CodeChef profile stats');
  }

  return {
    solved: solvedMatch ? Number(solvedMatch[1]) : null,
    rating: ratingMatch ? Number(ratingMatch[1]) : null,
    maxRating: null,
    rank: starCount > 0 ? `${starCount}★` : '',
    globalRank: globalRankMatch ? Number(globalRankMatch[1]) : null,
    source: 'live',
  };
}

async function syncGfg(handle, timeoutMs) {
  const html = await fetchText(`https://www.geeksforgeeks.org/user/${encodeURIComponent(handle)}/`, timeoutMs);
  const solvedMatch = /total_problems_solved["']?\s*:\s*(\d+)/i.exec(html) || /Problems Solved[\s\S]{0,80}?(\d+)/i.exec(html);
  const scoreMatch = /coding_score["']?\s*:\s*(\d+)/i.exec(html) || /Coding Score[\s\S]{0,80}?(\d+)/i.exec(html);
  const rankMatch = /institute_rank["']?\s*:\s*(\d+)/i.exec(html);

  if (!solvedMatch && !scoreMatch) {
    throw new Error('Could not parse GeeksforGeeks profile stats');
  }

  return {
    solved: solvedMatch ? Number(solvedMatch[1]) : null,
    rating: scoreMatch ? Number(scoreMatch[1]) : null,
    maxRating: null,
    rank: scoreMatch ? `Score ${scoreMatch[1]}` : '',
    globalRank: rankMatch ? Number(rankMatch[1]) : null,
    source: 'live',
  };
}

export async function fetchPlatformProfile(platformId, rawHandle, timeoutMs = 8000) {
  const platform = PLATFORM_MAP.get(platformId);
  if (!platform) throw new Error(`Unsupported platform: ${platformId}`);
  const handle = sanitizeHandle(platformId, rawHandle);
  if (!handle) throw new Error('Invalid handle');
  const profileUrl = buildProfileUrl(platformId, handle);

  try {
    let stats = null;
    if (platformId === 'leetcode') stats = await syncLeetCode(handle, timeoutMs);
    else if (platformId === 'codeforces') stats = await syncCodeforces(handle, timeoutMs);
    else if (platformId === 'atcoder') stats = await syncAtCoder(handle, timeoutMs);
    else if (platformId === 'github') stats = await syncGitHub(handle, timeoutMs);
    else if (platformId === 'codechef') stats = await syncCodeChef(handle, timeoutMs);
    else if (platformId === 'gfg') stats = await syncGfg(handle, timeoutMs);
    else {
      return {
        ok: false,
        platform: platformId,
        handle,
        profileUrl,
        stats: null,
        syncedAt: null,
        note: 'Profile linked. Enter solved count or rank manually for this platform.',
      };
    }

    return {
      ok: true,
      platform: platformId,
      handle,
      profileUrl,
      stats: { ...stats, platform: platformId, handle, profileUrl },
      syncedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      ok: false,
      platform: platformId,
      handle,
      profileUrl,
      stats: null,
      syncedAt: null,
      note: error?.message || 'Live stats unavailable; profile link saved.',
    };
  }
}
