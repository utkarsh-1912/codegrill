const CACHE_TTL_MS = 15 * 60 * 1000;
let contestCache = { items: null, expiresAt: 0 };

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

async function fetchLeetCodeContests(timeoutMs) {
  const query = `
    query topTwoContests {
      topTwoContests {
        title
        titleSlug
        startTime
        duration
      }
    }
  `;
  const res = await fetch('https://leetcode.com/graphql', {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': BROWSER_UA,
      Referer: 'https://leetcode.com/contest/',
      Origin: 'https://leetcode.com',
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  const list = data?.data?.topTwoContests;
  if (!Array.isArray(list)) return [];
  const nowSec = Math.floor(Date.now() / 1000);
  return list
    .filter((c) => c?.title && Number(c?.startTime) + Number(c?.duration || 5400) > nowSec)
    .map((c) => ({
      id: `lc-${c.titleSlug || c.startTime}`,
      platform: 'leetcode',
      platformLabel: 'LeetCode',
      name: c.title,
      startTimeMs: Number(c.startTime) * 1000,
      durationSec: Number(c.duration) || 5400,
      url: c.titleSlug ? `https://leetcode.com/contest/${c.titleSlug}/` : 'https://leetcode.com/contest/',
      live: true,
    }));
}

async function fetchCodeforcesContests(timeoutMs) {
  const res = await fetch('https://codeforces.com/api/contest.list?gym=false', {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'User-Agent': BROWSER_UA },
  });
  if (!res.ok) return [];
  const data = await res.json();
  if (data?.status !== 'OK' || !Array.isArray(data.result)) return [];
  return data.result
    .filter((c) => (c.phase === 'BEFORE' || c.phase === 'CODING') && c.startTimeSeconds)
    .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds)
    .slice(0, 10)
    .map((c) => ({
      id: `cf-${c.id}`,
      platform: 'codeforces',
      platformLabel: 'Codeforces',
      name: c.name,
      startTimeMs: c.startTimeSeconds * 1000,
      durationSec: c.durationSeconds || 7200,
      // Use /contests/<id> (official landing/registration page for upcoming CF rounds; /contest/<id> redirects away before start)
      url: c.phase === 'CODING'
        ? `https://codeforces.com/contest/${c.id}`
        : `https://codeforces.com/contests/${c.id}`,
      live: true,
    }));
}

async function fetchAtCoderContests(timeoutMs) {
  const res = await fetch('https://atcoder.jp/contests/?lang=en', {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
  });
  if (!res.ok) return [];
  const html = await res.text();
  const upcomingMatch = /id="contest-table-upcoming"[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i.exec(html);
  if (!upcomingMatch) return [];

  const rows = upcomingMatch[1].match(/<tr[\s\S]*?<\/tr>/gi) || [];
  const contests = [];
  for (const row of rows.slice(0, 8)) {
    const timeMatch = /iso=([0-9]{8}T[0-9]{4})/i.exec(row) || /<time[^>]*>([^<]+)<\/time>/i.exec(row);
    const linkMatch = /href="(\/contests\/([a-z0-9_-]+))"[^>]*>([^<]+)<\/a>/i.exec(row);
    const durMatch = /<td[^>]*>\s*(\d{1,3}):(\d{2})\s*<\/td>/i.exec(row);
    if (!timeMatch || !linkMatch) continue;

    let startMs = NaN;
    if (/^[0-9]{8}T[0-9]{4}$/.test(timeMatch[1])) {
      const s = timeMatch[1];
      // AtCoder iso param is JST (+09:00): YYYYMMDDTHHMM
      startMs = Date.parse(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:00+09:00`);
    } else {
      startMs = Date.parse(timeMatch[1].trim());
    }
    if (!Number.isFinite(startMs)) continue;

    const durationSec = durMatch ? (Number(durMatch[1]) * 60 + Number(durMatch[2])) * 60 : 6000;
    contests.push({
      id: `ac-${linkMatch[2]}`,
      platform: 'atcoder',
      platformLabel: 'AtCoder',
      name: linkMatch[3].trim(),
      startTimeMs: startMs,
      durationSec,
      url: `https://atcoder.jp${linkMatch[1]}`,
      live: true,
    });
  }
  return contests;
}

async function fetchCodeChefContests(timeoutMs) {
  const res = await fetch(
    'https://www.codechef.com/api/list/contests/all?sort_by=START&sorting_order=asc&offset=0&mode=all',
    {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
    },
  );
  if (!res.ok) return [];
  const data = await res.json();
  const future = Array.isArray(data?.future_contests) ? data.future_contests : [];
  const present = Array.isArray(data?.present_contests) ? data.present_contests : [];
  return [...present, ...future]
    .slice(0, 8)
    .map((c) => {
      const startMs = Date.parse(c.contest_start_date_iso || c.contest_start_date || '');
      if (!Number.isFinite(startMs)) return null;
      const durationMin = Number(c.contest_duration) || 120;
      return {
        id: `cc-${c.contest_code}`,
        platform: 'codechef',
        platformLabel: 'CodeChef',
        name: c.contest_name || c.contest_code,
        startTimeMs: startMs,
        durationSec: durationMin * 60,
        url: `https://www.codechef.com/${encodeURIComponent(c.contest_code)}`,
        live: true,
      };
    })
    .filter(Boolean);
}

// Keep exported helper for offline/test fallback compatibility (only used if ALL 4 live APIs fail)
export function buildRecurringContests(now = new Date()) {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7 || 7));
  d.setUTCHours(2, 30, 0, 0);
  return [
    {
      id: `lc-weekly-${d.toISOString().slice(0, 10)}`,
      platform: 'leetcode',
      platformLabel: 'LeetCode',
      name: 'LeetCode Weekly Contest',
      startTimeMs: d.getTime(),
      durationSec: 5400,
      url: 'https://leetcode.com/contest/',
      live: false,
    },
  ];
}

export async function fetchUpcomingContests({ timeoutMs = 7000, forceRefresh = false } = {}) {
  if (!forceRefresh && contestCache.items && contestCache.expiresAt > Date.now()) {
    return contestCache.items;
  }

  const results = await Promise.allSettled([
    fetchLeetCodeContests(timeoutMs),
    fetchCodeforcesContests(timeoutMs),
    fetchAtCoderContests(timeoutMs),
    fetchCodeChefContests(timeoutMs),
  ]);

  const liveItems = results
    .filter((r) => r.status === 'fulfilled' && Array.isArray(r.value))
    .flatMap((r) => r.value);

  const nowMs = Date.now();
  const merged = (liveItems.length > 0 ? liveItems : buildRecurringContests())
    .filter((c) => c.startTimeMs + (c.durationSec || 5400) * 1000 > nowMs)
    .sort((a, b) => a.startTimeMs - b.startTimeMs)
    .slice(0, 24);

  contestCache = { items: merged, expiresAt: Date.now() + CACHE_TTL_MS };
  return merged;
}
