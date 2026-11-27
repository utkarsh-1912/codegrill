/**
 * Universal parser for competitive programming & interview question/contest URLs.
 * Supports LeetCode, Codeforces, AtCoder, CodeChef, HackerRank, and GeeksforGeeks.
 */
function slugToTitle(slug) {
  return String(slug || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function parseExternalPracticeUrl(rawUrl) {
  const input = String(rawUrl || '').trim();
  if (!input) throw new Error('Enter a problem or contest URL.');
  let parsed;
  try {
    parsed = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    throw new Error('Enter a valid URL (e.g. LeetCode, Codeforces, AtCoder, CodeChef, HackerRank, or GFG).');
  }

  const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
  const path = parsed.pathname.replace(/\/+$/, '');

  // LeetCode problem or contest
  if (host === 'leetcode.com' || host === 'leetcode.cn') {
    const prob = /^\/problems\/([a-z0-9-]+)/i.exec(path);
    if (prob) {
      return {
        id: `lc-p-${prob[1].toLowerCase()}`,
        platform: 'leetcode',
        platformLabel: 'LeetCode',
        kind: 'problem',
        slug: prob[1].toLowerCase(),
        title: slugToTitle(prob[1]),
        url: `https://leetcode.com/problems/${prob[1].toLowerCase()}/`,
      };
    }
    const cont = /^\/contest\/([a-z0-9-]+)/i.exec(path);
    if (cont) {
      return {
        id: `lc-c-${cont[1].toLowerCase()}`,
        platform: 'leetcode',
        platformLabel: 'LeetCode',
        kind: 'contest',
        slug: cont[1].toLowerCase(),
        title: slugToTitle(cont[1]),
        url: `https://leetcode.com/contest/${cont[1].toLowerCase()}/`,
      };
    }
  }

  // Codeforces problem or contest
  if (host === 'codeforces.com') {
    const prob = /^\/(?:contest|gym)\/(\d+)\/problem\/([a-z0-9]+)/i.exec(path)
      || /^\/problemset\/problem\/(\d+)\/([a-z0-9]+)/i.exec(path);
    if (prob) {
      const cid = prob[1];
      const idx = prob[2].toUpperCase();
      return {
        id: `cf-p-${cid}${idx.toLowerCase()}`,
        platform: 'codeforces',
        platformLabel: 'Codeforces',
        kind: 'problem',
        contestId: cid,
        index: idx,
        slug: `cf-${cid}${idx.toLowerCase()}`,
        title: `Codeforces ${cid}${idx}`,
        url: `https://codeforces.com/contest/${cid}/problem/${idx}`,
      };
    }
    const cont = /^\/(?:contest|contests|contestRegistration)\/(\d+)/i.exec(path);
    if (cont) {
      return {
        id: `cf-c-${cont[1]}`,
        platform: 'codeforces',
        platformLabel: 'Codeforces',
        kind: 'contest',
        contestId: cont[1],
        slug: `cf-contest-${cont[1]}`,
        title: `Codeforces Round #${cont[1]}`,
        url: `https://codeforces.com/contests/${cont[1]}`,
      };
    }
  }

  // AtCoder task or contest
  if (host === 'atcoder.jp') {
    const task = /^\/contests\/([a-z0-9_-]+)\/tasks\/([a-z0-9_-]+)/i.exec(path);
    if (task) {
      return {
        id: `ac-p-${task[2].toLowerCase()}`,
        platform: 'atcoder',
        platformLabel: 'AtCoder',
        kind: 'problem',
        slug: `ac-${task[2].toLowerCase()}`,
        title: `${task[1].toUpperCase()} — ${task[2].toUpperCase()}`,
        url: `https://atcoder.jp/contests/${task[1]}/tasks/${task[2]}`,
      };
    }
    const cont = /^\/contests\/([a-z0-9_-]+)/i.exec(path);
    if (cont) {
      return {
        id: `ac-c-${cont[1].toLowerCase()}`,
        platform: 'atcoder',
        platformLabel: 'AtCoder',
        kind: 'contest',
        slug: `ac-${cont[1].toLowerCase()}`,
        title: `AtCoder ${cont[1].toUpperCase()}`,
        url: `https://atcoder.jp/contests/${cont[1]}`,
      };
    }
  }

  // CodeChef problem or contest
  if (host === 'codechef.com') {
    const prob = /^\/(?:problems|practice\/course\/[^/]+\/[^/]+\/problems)\/([a-z0-9_-]+)/i.exec(path);
    if (prob) {
      return {
        id: `cc-p-${prob[1].toLowerCase()}`,
        platform: 'codechef',
        platformLabel: 'CodeChef',
        kind: 'problem',
        slug: `cc-${prob[1].toLowerCase()}`,
        title: `CodeChef ${prob[1].toUpperCase()}`,
        url: `https://www.codechef.com/problems/${prob[1]}`,
      };
    }
    const cont = /^\/([A-Z0-9_-]{3,24})$/i.exec(path);
    if (cont && !['contests', 'practice', 'users', 'login'].includes(cont[1].toLowerCase())) {
      return {
        id: `cc-c-${cont[1].toLowerCase()}`,
        platform: 'codechef',
        platformLabel: 'CodeChef',
        kind: 'contest',
        slug: `cc-${cont[1].toLowerCase()}`,
        title: `CodeChef ${cont[1].toUpperCase()}`,
        url: `https://www.codechef.com/${cont[1]}`,
      };
    }
  }

  // HackerRank challenge
  if (host === 'hackerrank.com') {
    const prob = /^\/challenges\/([a-z0-9-]+)/i.exec(path);
    if (prob) {
      return {
        id: `hr-p-${prob[1].toLowerCase()}`,
        platform: 'hackerrank',
        platformLabel: 'HackerRank',
        kind: 'problem',
        slug: `hr-${prob[1].toLowerCase()}`,
        title: slugToTitle(prob[1]),
        url: `https://www.hackerrank.com/challenges/${prob[1]}/problem`,
      };
    }
  }

  // GeeksforGeeks problem
  if (host === 'geeksforgeeks.org' || host === 'practice.geeksforgeeks.org') {
    const prob = /^\/problems\/([a-z0-9-]+)/i.exec(path);
    if (prob) {
      return {
        id: `gfg-p-${prob[1].toLowerCase()}`,
        platform: 'gfg',
        platformLabel: 'GeeksforGeeks',
        kind: 'problem',
        slug: `gfg-${prob[1].toLowerCase()}`,
        title: slugToTitle(prob[1]),
        url: `https://www.geeksforgeeks.org/problems/${prob[1]}/1`,
      };
    }
  }

  throw new Error('Unsupported URL. Paste a LeetCode, Codeforces, AtCoder, CodeChef, HackerRank, or GeeksforGeeks problem/contest URL.');
}
