export const CODING_PLATFORMS = [
  {
    id: 'leetcode',
    name: 'LeetCode',
    badge: 'LC',
    profileUrlTemplate: 'https://leetcode.com/u/{handle}/',
    placeholder: 'neal_wu',
    supportsBrowserSync: false,
    supportsBackendSync: true,
    metricKind: 'problems',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?leetcode\.com\/(?:u\/)?([^/?#]+)/i,
      /^https?:\/\/(?:www\.)?leetcode\.cn\/(?:u\/)?([^/?#]+)/i,
    ],
  },
  {
    id: 'codeforces',
    name: 'Codeforces',
    badge: 'CF',
    profileUrlTemplate: 'https://codeforces.com/profile/{handle}',
    placeholder: 'tourist',
    supportsBrowserSync: true,
    supportsBackendSync: true,
    metricKind: 'problems',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?codeforces\.com\/profile\/([^/?#]+)/i,
    ],
  },
  {
    id: 'atcoder',
    name: 'AtCoder',
    badge: 'AC',
    profileUrlTemplate: 'https://atcoder.jp/users/{handle}',
    placeholder: 'chokudai',
    supportsBrowserSync: true,
    supportsBackendSync: true,
    metricKind: 'problems',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?atcoder\.jp\/users\/([^/?#]+)/i,
    ],
  },
  {
    id: 'codechef',
    name: 'CodeChef',
    badge: 'CC',
    profileUrlTemplate: 'https://www.codechef.com/users/{handle}',
    placeholder: 'gennady.korotkevich',
    supportsBrowserSync: false,
    supportsBackendSync: true,
    metricKind: 'problems',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?codechef\.com\/users\/([^/?#]+)/i,
    ],
  },
  {
    id: 'gfg',
    name: 'GeeksforGeeks',
    badge: 'GFG',
    profileUrlTemplate: 'https://www.geeksforgeeks.org/user/{handle}/',
    placeholder: 'sandeep_jain',
    supportsBrowserSync: false,
    supportsBackendSync: true,
    metricKind: 'problems',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?geeksforgeeks\.org\/user\/([^/?#]+)/i,
      /^https?:\/\/auth\.geeksforgeeks\.org\/user\/([^/?#]+)/i,
    ],
  },
  {
    id: 'hackerrank',
    name: 'HackerRank',
    badge: 'HR',
    profileUrlTemplate: 'https://www.hackerrank.com/profile/{handle}',
    placeholder: 'username',
    supportsBrowserSync: false,
    supportsBackendSync: false,
    metricKind: 'problems',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?hackerrank\.com\/(?:profile\/)?([^/?#]+)/i,
    ],
  },
  {
    id: 'github',
    name: 'GitHub',
    badge: 'GH',
    profileUrlTemplate: 'https://github.com/{handle}',
    placeholder: 'torvalds',
    supportsBrowserSync: true,
    supportsBackendSync: true,
    metricKind: 'repos',
    urlPatterns: [
      /^https?:\/\/(?:www\.)?github\.com\/([^/?#]+)/i,
    ],
  },
];

export const PLATFORM_MAP = new Map(CODING_PLATFORMS.map((p) => [p.id, p]));

export function sanitizeHandle(platformId, rawInput) {
  let value = String(rawInput || '').trim();
  if (!value) return '';
  const platform = PLATFORM_MAP.get(platformId);
  if (platform?.urlPatterns) {
    for (const pattern of platform.urlPatterns) {
      const m = pattern.exec(value);
      if (m?.[1]) {
        value = decodeURIComponent(m[1]);
        break;
      }
    }
  }
  value = value.replace(/^@+/, '').replace(/\/+$/, '').trim();
  // Restrict to safe URL-segment characters
  value = value.replace(/[^\w.-]/g, '').slice(0, 64);
  return value;
}

export function buildProfileUrl(platformId, handle) {
  const platform = PLATFORM_MAP.get(platformId);
  const clean = sanitizeHandle(platformId, handle);
  if (!platform || !clean) return '';
  return platform.profileUrlTemplate.replace('{handle}', encodeURIComponent(clean));
}

function toFiniteInt(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

export function normalizeProfileEntry(platformId, raw) {
  if (!PLATFORM_MAP.has(platformId) || !raw || typeof raw !== 'object') return null;
  const handle = sanitizeHandle(platformId, raw.handle);
  if (!handle) return null;
  return {
    platform: platformId,
    handle,
    profileUrl: buildProfileUrl(platformId, handle),
    solved: toFiniteInt(raw.solved),
    easy: toFiniteInt(raw.easy),
    medium: toFiniteInt(raw.medium),
    hard: toFiniteInt(raw.hard),
    rating: toFiniteInt(raw.rating),
    maxRating: toFiniteInt(raw.maxRating),
    rank: typeof raw.rank === 'string' ? raw.rank.trim().slice(0, 48) : '',
    globalRank: toFiniteInt(raw.globalRank),
    extraCount: toFiniteInt(raw.extraCount),
    extraLabel: typeof raw.extraLabel === 'string' ? raw.extraLabel.trim().slice(0, 40) : '',
    syncedAt: typeof raw.syncedAt === 'string' ? raw.syncedAt : null,
    source: raw.source === 'live' ? 'live' : 'manual',
  };
}

export function normalizeLinkedProfiles(rawMap) {
  if (!rawMap || typeof rawMap !== 'object') return {};
  const result = {};
  for (const [platformId, entry] of Object.entries(rawMap)) {
    const clean = normalizeProfileEntry(platformId, entry);
    if (clean) result[platformId] = clean;
  }
  return result;
}

export function computeCombinedProfileStats(linkedProfiles = {}, codegrillSolved = 0) {
  const entries = Object.values(linkedProfiles || {}).filter(Boolean);
  let externalSolved = 0;
  let highestRating = null;
  let highestRatingPlatform = null;

  for (const entry of entries) {
    const meta = PLATFORM_MAP.get(entry.platform);
    if (meta?.metricKind === 'problems' && Number.isFinite(entry.solved)) {
      externalSolved += entry.solved;
    }
    if (Number.isFinite(entry.rating) && (highestRating === null || entry.rating > highestRating)) {
      highestRating = entry.rating;
      highestRatingPlatform = meta?.name || entry.platform;
    }
  }

  return {
    linkedCount: entries.length,
    codegrillSolved: Number(codegrillSolved) || 0,
    externalSolved,
    totalSolved: (Number(codegrillSolved) || 0) + externalSolved,
    highestRating,
    highestRatingPlatform,
  };
}
