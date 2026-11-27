const CACHE_TTL_MS = 30 * 60 * 1000;
let contestCache = { items: null, expiresAt: 0 };

function nextWeekdayUtc(targetDayOfWeek, hourUtc, minuteUtc = 0, from = new Date()) {
  const d = new Date(from);
  const diff = (targetDayOfWeek - d.getUTCDay() + 7) % 7;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(hourUtc, minuteUtc, 0, 0);
  if (d.getTime() <= from.getTime()) {
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return d;
}

export function buildRecurringContests(now = new Date()) {
  const lcWeekly = nextWeekdayUtc(0, 2, 30, now); // Sunday 02:30 UTC
  const lcBiweekly = nextWeekdayUtc(6, 14, 30, now); // Saturday 14:30 UTC
  const atcoderAbc = nextWeekdayUtc(6, 12, 0, now); // Saturday 12:00 UTC
  const codechefStarters = nextWeekdayUtc(3, 14, 30, now); // Wednesday 14:30 UTC

  return [
    {
      id: `lc-weekly-${lcWeekly.toISOString().slice(0, 10)}`,
      platform: 'leetcode',
      platformLabel: 'LeetCode',
      name: 'LeetCode Weekly Contest',
      startTimeMs: lcWeekly.getTime(),
      durationSec: 5400,
      url: 'https://leetcode.com/contest/',
    },
    {
      id: `lc-biweekly-${lcBiweekly.toISOString().slice(0, 10)}`,
      platform: 'leetcode',
      platformLabel: 'LeetCode',
      name: 'LeetCode Biweekly Contest',
      startTimeMs: lcBiweekly.getTime(),
      durationSec: 5400,
      url: 'https://leetcode.com/contest/',
    },
    {
      id: `atcoder-abc-${atcoderAbc.toISOString().slice(0, 10)}`,
      platform: 'atcoder',
      platformLabel: 'AtCoder',
      name: 'AtCoder Beginner Contest (ABC)',
      startTimeMs: atcoderAbc.getTime(),
      durationSec: 6000,
      url: 'https://atcoder.jp/contests/',
    },
    {
      id: `codechef-starters-${codechefStarters.toISOString().slice(0, 10)}`,
      platform: 'codechef',
      platformLabel: 'CodeChef',
      name: 'CodeChef Starters',
      startTimeMs: codechefStarters.getTime(),
      durationSec: 7200,
      url: 'https://www.codechef.com/contests',
    },
  ];
}

export async function fetchUpcomingContests({ timeoutMs = 6000 } = {}) {
  if (contestCache.items && contestCache.expiresAt > Date.now()) {
    return contestCache.items;
  }

  const recurring = buildRecurringContests();
  let codeforces = [];
  try {
    const res = await fetch('https://codeforces.com/api/contest.list?gym=false', {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': 'Codegrill-ContestCalendar/1.0' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.status === 'OK' && Array.isArray(data.result)) {
        codeforces = data.result
          .filter((c) => c.phase === 'BEFORE' && c.startTimeSeconds)
          .slice(0, 10)
          .map((c) => ({
            id: `cf-${c.id}`,
            platform: 'codeforces',
            platformLabel: 'Codeforces',
            name: c.name,
            startTimeMs: c.startTimeSeconds * 1000,
            durationSec: c.durationSeconds || 7200,
            url: `https://codeforces.com/contest/${c.id}`,
          }));
      }
    }
  } catch {
    // Fallback to recurring schedule if Codeforces API is unavailable
  }

  const merged = [...codeforces, ...recurring]
    .sort((a, b) => a.startTimeMs - b.startTimeMs)
    .slice(0, 16);

  contestCache = { items: merged, expiresAt: Date.now() + CACHE_TTL_MS };
  return merged;
}
