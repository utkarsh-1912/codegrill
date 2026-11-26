import { BUILTIN_SHEETS } from './sheets.mjs';
import { DEFAULT_APP_CONFIG, mergeAppConfig } from './config.mjs';

const CUSTOM_SHEETS_KEY = 'codegrill:custom-sheets:v1';

function apiUrl(path, baseUrl = DEFAULT_APP_CONFIG.apiBaseUrl) {
  return `${String(baseUrl || '').replace(/\/+$/, '')}${path}`;
}

function extractYouTubeIdClient(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.hostname === 'youtu.be') {
      const id = url.pathname.replace(/^\/+/, '').split('/')[0];
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (url.hostname.endsWith('youtube.com')) {
      const v = url.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      const m = /^\/(?:embed|shorts|live)\/([a-zA-Z0-9_-]{11})/.exec(url.pathname);
      return m ? m[1] : null;
    }
    return null;
  } catch {
    return null;
  }
}

function toGitHubRawClient(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') return null;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 5 || parts[2] !== 'blob') return null;
    const [owner, repo, , ref, ...rest] = parts;
    return {
      rawUrl: `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${rest.join('/')}`,
      filename: rest[rest.length - 1] || 'solution',
      repo: `${owner}/${repo}`,
    };
  } catch {
    return null;
  }
}

export async function checkBackendHealth(baseUrl) {
  try {
    const res = await fetch(apiUrl('/api/health', baseUrl), { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return { online: false, plugins: [] };
    const data = await res.json();
    return { online: Boolean(data?.ok), plugins: data?.plugins || [] };
  } catch {
    return { online: false, plugins: [] };
  }
}

export async function fetchAppConfig(baseUrl) {
  try {
    const res = await fetch(apiUrl('/api/config', baseUrl), { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return DEFAULT_APP_CONFIG;
    return mergeAppConfig(await res.json());
  } catch {
    return DEFAULT_APP_CONFIG;
  }
}

export async function fetchDailyChallenge(problems, baseUrl) {
  try {
    const res = await fetch(apiUrl('/api/daily', baseUrl), { signal: AbortSignal.timeout(2500) });
    if (res.ok) return await res.json();
  } catch {
    // Deterministic client fallback using UTC date
  }
  const dayKey = new Date().toISOString().slice(0, 10);
  let hash = 0;
  for (let i = 0; i < dayKey.length; i += 1) hash = (hash * 31 + dayKey.charCodeAt(i)) >>> 0;
  const pick = problems[hash % problems.length];
  return pick ? { date: dayKey, slug: pick.slug, leetcode_id: pick.leetcode_id, difficulty: pick.difficulty, category_id: pick.category_id } : null;
}

export async function fetchAnalytics(profile = DEFAULT_APP_CONFIG.defaultProfile, baseUrl) {
  try {
    const res = await fetch(apiUrl(`/api/analytics?profile=${encodeURIComponent(profile)}`, baseUrl), {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) return await res.json();
  } catch {
    // Computed locally by caller when offline
  }
  return null;
}

export async function fetchRemoteProgress(profile = DEFAULT_APP_CONFIG.defaultProfile, baseUrl) {
  try {
    const res = await fetch(apiUrl(`/api/progress?profile=${encodeURIComponent(profile)}`, baseUrl), {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function saveRemoteProgress(payload, profile = DEFAULT_APP_CONFIG.defaultProfile, baseUrl) {
  try {
    const res = await fetch(apiUrl(`/api/progress?profile=${encodeURIComponent(profile)}`, baseUrl), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function readLocalCustomSheets() {
  try {
    const raw = JSON.parse(localStorage.getItem(CUSTOM_SHEETS_KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function writeLocalCustomSheets(sheets) {
  try {
    localStorage.setItem(CUSTOM_SHEETS_KEY, JSON.stringify(sheets));
  } catch {
    // Ignore storage quota errors
  }
}

export async function fetchAllSheets(baseUrl) {
  try {
    const res = await fetch(apiUrl('/api/sheets', baseUrl), { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      const custom = Array.isArray(data.custom) ? data.custom : [];
      writeLocalCustomSheets(custom);
      return { builtin: data.builtin || BUILTIN_SHEETS, custom, online: true };
    }
  } catch {
    // Fall back to local storage
  }
  return { builtin: BUILTIN_SHEETS, custom: readLocalCustomSheets(), online: false };
}

export async function createCustomSheetApi(payload, baseUrl) {
  try {
    const res = await fetch(apiUrl('/api/sheets', baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3500),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback handled by caller
  }
  return null;
}

export async function deleteCustomSheetApi(id, baseUrl) {
  try {
    const res = await fetch(apiUrl(`/api/sheets/${encodeURIComponent(id)}`, baseUrl), {
      method: 'DELETE',
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function extractYouTubeChannelIdClient(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (!url.hostname.endsWith('youtube.com')) return null;
    const m = /^\/channel\/(UC[a-zA-Z0-9_-]{20,})/.exec(url.pathname);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export async function fetchPluginContent(url, locale = 'en', baseUrl) {
  try {
    const res = await fetch(
      apiUrl(`/api/plugins/fetch?url=${encodeURIComponent(url)}&locale=${encodeURIComponent(locale)}`, baseUrl),
      { signal: AbortSignal.timeout(10000) },
    );
    if (res.ok) return await res.json();
  } catch {
    // Fall back to client-side plugin handling when static/offline
  }

  const channelId = extractYouTubeChannelIdClient(url);
  if (channelId) {
    const uploadsId = `UU${channelId.slice(2)}`;
    const embed = new URL('https://www.youtube-nocookie.com/embed/videoseries');
    embed.searchParams.set('list', uploadsId);
    embed.searchParams.set('rel', '0');
    return {
      plugin: 'youtube-channel-client',
      kind: 'channel',
      channelId,
      title: 'YouTube Channel',
      author: 'YouTube',
      embedUrl: embed.href,
      playlistEmbedUrl: embed.href,
      videos: [],
      sourceUrl: url,
    };
  }

  const videoId = extractYouTubeIdClient(url);
  if (videoId) {
    const embed = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);
    embed.searchParams.set('rel', '0');
    embed.searchParams.set('modestbranding', '1');
    embed.searchParams.set('cc_lang_pref', locale);
    if (locale !== 'en') embed.searchParams.set('cc_load_policy', '1');
    return {
      plugin: 'youtube-video-client',
      kind: 'video',
      videoId,
      title: 'Video walkthrough',
      author: 'YouTube',
      embedUrl: embed.href,
      sourceUrl: url,
    };
  }

  const gh = toGitHubRawClient(url);
  if (gh) {
    try {
      const res = await fetch(gh.rawUrl, { signal: AbortSignal.timeout(7000) });
      if (res.ok) {
        const content = await res.text();
        return {
          plugin: 'github-content-client',
          kind: gh.filename.endsWith('.md') ? 'markdown' : 'code',
          title: gh.filename,
          repo: gh.repo,
          language: gh.filename.split('.').pop() || 'text',
          content,
          sourceUrl: url,
        };
      }
    } catch {
      // Ignore fallback error
    }
  }

  return {
    plugin: 'fallback',
    kind: 'error',
    title: url,
    sourceUrl: url,
  };
}
