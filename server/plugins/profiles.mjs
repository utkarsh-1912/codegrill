import { PLATFORM_MAP, buildProfileUrl, sanitizeHandle } from '../../src/profiles.mjs';

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'application/json, text/html;q=0.9, */*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function fetchJson(url, options = {}, timeoutMs = 8000) {
  const res = await fetch(url, {
    ...options,
    headers: { ...BROWSER_HEADERS, ...(options.headers || {}) },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchText(url, timeoutMs = 8000) {
  const res = await fetch(url, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function syncLeetCode(handle, timeoutMs) {
  try {
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
          Origin: 'https://leetcode.com',
        },
        body: JSON.stringify({ query, variables: { username: handle } }),
      },
      timeoutMs,
    );

    const user = data?.data?.matchedUser;
    if (user) {
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
  } catch {
    // Fall back to public LeetCode REST mirror (leetcode-api-pied)
  }

  const pied = await fetchJson(
    `https://leetcode-api-pied.vercel.app/user/${encodeURIComponent(handle)}`,
    {},
    timeoutMs,
  );
  const acList = pied?.submitStats?.acSubmissionNum || [];
  const byDiff = Object.fromEntries(acList.map((row) => [row.difficulty, Number(row.count) || 0]));
  const total = byDiff.All ?? ((byDiff.Easy || 0) + (byDiff.Medium || 0) + (byDiff.Hard || 0));
  if (!pied?.username && !Number.isFinite(total)) throw new Error('LeetCode user not found');
  return {
    solved: total,
    easy: byDiff.Easy ?? null,
    medium: byDiff.Medium ?? null,
    hard: byDiff.Hard ?? null,
    rating: pied?.contestRating ? Math.round(Number(pied.contestRating)) : null,
    maxRating: null,
    rank: pied?.profile?.ranking ? `#${Number(pied.profile.ranking).toLocaleString()}` : '',
    globalRank: pied?.profile?.ranking ? Number(pied.profile.ranking) : null,
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

function atCoderColorTitle(rating) {
  if (!Number.isFinite(rating) || rating <= 0) return '';
  if (rating >= 2800) return 'Red';
  if (rating >= 2400) return 'Orange';
  if (rating >= 2000) return 'Yellow';
  if (rating >= 1600) return 'Blue';
  if (rating >= 1200) return 'Cyan';
  if (rating >= 800) return 'Green';
  if (rating >= 400) return 'Brown';
  return 'Gray';
}

async function syncAtCoder(handle, timeoutMs) {
  const [acRes, historyRes] = await Promise.allSettled([
    fetchJson(`https://kenkoooo.com/atcoder/atcoder-api/v3/user/ac_rank?user=${encodeURIComponent(handle)}`, {}, timeoutMs),
    fetchJson(`https://atcoder.jp/users/${encodeURIComponent(handle)}/history/json`, {}, timeoutMs),
  ]);

  const ac = acRes.status === 'fulfilled' ? acRes.value : null;
  const history = historyRes.status === 'fulfilled' && Array.isArray(historyRes.value) ? historyRes.value : [];
  const rated = history.filter((item) => item?.IsRated && Number.isFinite(Number(item.NewRating)));
  const currentRating = rated.length ? Number(rated[rated.length - 1].NewRating) : null;
  const maxRating = rated.length ? Math.max(...rated.map((r) => Number(r.NewRating))) : null;

  if (!ac && !rated.length) {
    throw new Error('AtCoder user not found');
  }

  const color = atCoderColorTitle(currentRating);
  const rankParts = [];
  if (color) rankParts.push(color);
  if (Number.isFinite(ac?.rank)) rankParts.push(`AC #${ac.rank + 1}`);

  return {
    solved: Number.isFinite(ac?.count) ? ac.count : null,
    rating: currentRating,
    maxRating,
    rank: rankParts.join(' · '),
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
  try {
    const html = await fetchText(`https://www.codechef.com/users/${encodeURIComponent(handle)}`, timeoutMs);
    const ratingMatch = /class="rating-number"[^>]*>\s*(\d+)/i.exec(html);
    const maxRatingMatch = /Highest Rating\s*(\d+)/i.exec(html);
    const starsMatch = /class="rating-star"[^>]*>([\s\S]*?)<\/div>/i.exec(html);
    const starCount = starsMatch ? (starsMatch[1].match(/&#9733;|★/g) || []).length : 0;
    const solvedMatch =
      /Total Problems Solved:\s*(\d+)/i.exec(html) ||
      /Fully Solved\s*\((\d+)\)/i.exec(html) ||
      /Problems Solved[^0-9]{0,60}(\d+)/i.exec(html);
    const globalRankMatch = /Global Rank[\s\S]{0,160}?<strong>\s*(\d+)\s*<\/strong>/i.exec(html);

    if (ratingMatch || solvedMatch) {
      return {
        solved: solvedMatch ? Number(solvedMatch[1]) : null,
        rating: ratingMatch ? Number(ratingMatch[1]) : null,
        maxRating: maxRatingMatch ? Number(maxRatingMatch[1]) : null,
        rank: starCount > 0 ? `${starCount}★` : '',
        globalRank: globalRankMatch ? Number(globalRankMatch[1]) : null,
        source: 'live',
      };
    }
  } catch {
    // Fall back to public CodeChef REST mirror
  }

  const mirror = await fetchJson(
    `https://codechef-api.vercel.app/handle/${encodeURIComponent(handle)}`,
    {},
    timeoutMs,
  );
  if (mirror?.success === false && !mirror?.currentRating) {
    throw new Error('CodeChef user not found');
  }
  return {
    solved: Number.isFinite(Number(mirror?.totalSolved)) ? Number(mirror.totalSolved) : null,
    rating: Number.isFinite(Number(mirror?.currentRating)) ? Number(mirror.currentRating) : null,
    maxRating: Number.isFinite(Number(mirror?.highestRating)) ? Number(mirror.highestRating) : null,
    rank: mirror?.stars || '',
    globalRank: Number.isFinite(Number(mirror?.globalRank)) ? Number(mirror.globalRank) : null,
    source: 'live',
  };
}

async function syncGfg(handle, timeoutMs) {
  // 1. Official GeeksforGeeks public profile JSON API
  try {
    const api = await fetchJson(
      `https://authapi.geeksforgeeks.org/api-get/user-profile-info/?handle=${encodeURIComponent(handle)}`,
      {},
      timeoutMs,
    );
    const info = api?.data || api;
    const solved = Number(info?.total_problems_solved ?? info?.solved_problems_count);
    const score = Number(info?.score ?? info?.coding_score);
    const rank = Number(info?.institute_rank ?? info?.overall_rank);
    if (info?.name || Number.isFinite(solved) || Number.isFinite(score)) {
      return {
        solved: Number.isFinite(solved) ? solved : 0,
        rating: Number.isFinite(score) ? score : null,
        maxRating: null,
        rank: Number.isFinite(score) && score > 0 ? `Score ${score}` : (Number.isFinite(rank) && rank > 0 ? `Inst #${rank}` : ''),
        globalRank: Number.isFinite(rank) && rank > 0 ? rank : null,
        source: 'live',
      };
    }
  } catch {
    // Fall through to HTML parsing
  }

  // 2. HTML profile page (__NEXT_DATA__ or server-rendered stats)
  const html = await fetchText(`https://www.geeksforgeeks.org/user/${encodeURIComponent(handle)}/`, timeoutMs);
  const solvedMatch =
    /"total_problems_solved"\s*:\s*(\d+)/i.exec(html) ||
    /total_problems_solved["']?\s*:\s*(\d+)/i.exec(html) ||
    /Problems Solved[\s\S]{0,120}?>(\d+)</i.exec(html);
  const scoreMatch =
    /"score"\s*:\s*(\d+)/i.exec(html) ||
    /"coding_score"\s*:\s*(\d+)/i.exec(html) ||
    /Coding Score[\s\S]{0,120}?>(\d+)</i.exec(html);
  const rankMatch = /"institute_rank"\s*:\s*(\d+)/i.exec(html);

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
