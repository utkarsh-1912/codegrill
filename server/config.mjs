import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function envInt(name, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

export function loadServerConfig() {
  const storePath = process.env.DATA_STORE_PATH
    ? resolve(process.env.DATA_STORE_PATH)
    : join(__dirname, 'data/store.json');

  return {
    port: envInt('PORT', 4000, 1, 65535),
    host: process.env.HOST || '127.0.0.1',
    corsOrigin: process.env.CORS_ORIGIN || '',
    storePath,
    defaultProfile: (process.env.DEFAULT_PROFILE_ID || 'default').replace(/[^a-zA-Z0-9_-]/g, '') || 'default',
    pluginCacheTtlMs: envInt('PLUGIN_CACHE_TTL_MS', 10 * 60 * 1000, 1000, 24 * 60 * 60 * 1000),
    pluginFetchTimeoutMs: envInt('PLUGIN_FETCH_TIMEOUT_MS', 9000, 1000, 60000),
    brand: {
      name: process.env.BRAND_NAME || 'codegrill',
      ecosystem: process.env.BRAND_ECOSYSTEM || 'Utkristi',
      collabRoomsUrl: process.env.VITE_COLLAB_ROOMS_URL || process.env.COLLAB_ROOMS_URL || 'https://utkristi-colabs.vercel.app/',
    },
    planner: {
      minWeeks: envInt('PLANNER_MIN_WEEKS', 2, 1, 52),
      maxWeeks: envInt('PLANNER_MAX_WEEKS', 16, 2, 52),
      defaultWeeks: envInt('PLANNER_DEFAULT_WEEKS', 8, 1, 52),
      minHours: envInt('PLANNER_MIN_HOURS', 2, 1, 60),
      maxHours: envInt('PLANNER_MAX_HOURS', 24, 2, 60),
      defaultHours: envInt('PLANNER_DEFAULT_HOURS', 8, 1, 60),
      difficultyMinutes: {
        Easy: envInt('DIFFICULTY_MINUTES_EASY', 20, 5, 180),
        Medium: envInt('DIFFICULTY_MINUTES_MEDIUM', 35, 5, 180),
        Hard: envInt('DIFFICULTY_MINUTES_HARD', 50, 5, 180),
      },
    },
    interview: {
      defaultTimerMinutes: envInt('INTERVIEW_TIMER_MINUTES', 35, 5, 120),
      activityDays: envInt('ACTIVITY_LEDGER_DAYS', 28, 7, 90),
    },
    pagination: {
      problemsPerPage: envInt('PROBLEMS_PER_PAGE', 20, 5, 100),
      resourcesPerPage: envInt('RESOURCES_PER_PAGE', 12, 4, 50),
    },
    player: {
      customPlayerTemplate: process.env.CUSTOM_PLAYER_URL || process.env.VITE_CUSTOM_PLAYER_URL || '',
    },
    sources: [
      { label: 'LeetCode', url: process.env.SOURCE_LEETCODE_URL || 'https://leetcode.com/' },
      { label: 'Codeforces', url: process.env.SOURCE_CODEFORCES_URL || 'https://codeforces.com/' },
      { label: 'HackerRank', url: process.env.SOURCE_HACKERRANK_URL || 'https://www.hackerrank.com/' },
      { label: 'System Design Primer', url: 'https://github.com/donnemartin/system-design-primer' },
      { label: 'Awesome LLD', url: 'https://github.com/ashishps1/awesome-low-level-design' },
      { label: 'Doocs Solutions', url: process.env.SOURCE_GITHUB_URL || 'https://github.com/doocs/leetcode/tree/main/solution' },
      { label: 'Utkristi Colabs', url: process.env.VITE_COLLAB_ROOMS_URL || process.env.COLLAB_ROOMS_URL || 'https://utkristi-colabs.vercel.app/' },
    ],
  };
}

export function getPublicConfig(serverConfig, pluginList = []) {
  return {
    brand: serverConfig.brand,
    defaultProfile: serverConfig.defaultProfile,
    planner: serverConfig.planner,
    interview: serverConfig.interview,
    pagination: serverConfig.pagination,
    player: serverConfig.player,
    sources: serverConfig.sources,
    plugins: pluginList,
  };
}
