// Runtime frontend configuration — seeded from Vite env vars and hydrated from GET /api/config
export const DEFAULT_APP_CONFIG = {
  apiBaseUrl: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) || '',
  defaultProfile: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEFAULT_PROFILE) || 'default',
  brand: {
    name: 'codegrill',
    ecosystem: 'Utkristi',
    collabRoomsUrl: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_COLLAB_ROOMS_URL) || 'https://utkristi-colabs.vercel.app/',
  },
  planner: {
    minWeeks: 2,
    maxWeeks: 16,
    defaultWeeks: 8,
    minHours: 2,
    maxHours: 24,
    defaultHours: 8,
    difficultyMinutes: { Easy: 20, Medium: 35, Hard: 50 },
  },
  interview: {
    defaultTimerMinutes: 35,
    activityDays: 28,
  },
  pagination: {
    problemsPerPage: 20,
    resourcesPerPage: 12,
  },
  player: {
    customPlayerTemplate: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CUSTOM_PLAYER_URL) || '',
  },
  sources: [
    { label: 'LeetCode', url: 'https://leetcode.com/' },
    { label: 'GitHub', url: 'https://github.com/doocs/leetcode/tree/main/solution' },
  ],
  plugins: [],
};

export function mergeAppConfig(remote) {
  if (!remote || typeof remote !== 'object') return DEFAULT_APP_CONFIG;
  return {
    ...DEFAULT_APP_CONFIG,
    ...remote,
    brand: { ...DEFAULT_APP_CONFIG.brand, ...(remote.brand || {}) },
    planner: {
      ...DEFAULT_APP_CONFIG.planner,
      ...(remote.planner || {}),
      difficultyMinutes: {
        ...DEFAULT_APP_CONFIG.planner.difficultyMinutes,
        ...(remote.planner?.difficultyMinutes || {}),
      },
    },
    interview: { ...DEFAULT_APP_CONFIG.interview, ...(remote.interview || {}) },
    pagination: { ...DEFAULT_APP_CONFIG.pagination, ...(remote.pagination || {}) },
    player: { ...DEFAULT_APP_CONFIG.player, ...(remote.player || {}) },
    sources: Array.isArray(remote.sources) && remote.sources.length ? remote.sources : DEFAULT_APP_CONFIG.sources,
    plugins: Array.isArray(remote.plugins) ? remote.plugins : DEFAULT_APP_CONFIG.plugins,
  };
}
