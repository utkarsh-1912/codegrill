import { BUILTIN_SHEETS } from './sheets.mjs';
import { DEFAULT_APP_CONFIG, mergeAppConfig } from './config.mjs';
import { buildProfileUrl, normalizeLinkedProfiles, sanitizeHandle } from './profiles.mjs';

const CUSTOM_SHEETS_KEY = 'codegrill:custom-sheets:v1';
const LINKED_PROFILES_KEY = 'codegrill:linked-profiles:v1';

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
    if (url.hostname === 'raw.githubusercontent.com') {
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length < 4) return null;
      return {
        rawUrl: url.href,
        filename: parts[parts.length - 1] || 'solution',
        repo: `${parts[0]}/${parts[1]}`,
        filePath: parts.slice(3).join('/'),
      };
    }
    if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') return null;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 5 || parts[2] !== 'blob') return null;
    const [owner, repo, , ref, ...rest] = parts;
    return {
      rawUrl: `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${rest.join('/')}`,
      filename: rest[rest.length - 1] || 'solution',
      repo: `${owner}/${repo}`,
      filePath: rest.join('/'),
    };
  } catch {
    return null;
  }
}

function parseGitHubTreeClient(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') return null;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length === 2) {
      return { owner: parts[0], repo: parts[1], ref: '', dirPath: '' };
    }
    if (parts.length >= 4 && parts[2] === 'tree') {
      const [owner, repo, , ref, ...rest] = parts;
      return { owner, repo, ref, dirPath: rest.join('/') };
    }
    return null;
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

export async function resetRemoteProgress(profile = DEFAULT_APP_CONFIG.defaultProfile, baseUrl) {
  try {
    const res = await fetch(apiUrl(`/api/progress?profile=${encodeURIComponent(profile)}`, baseUrl), {
      method: 'DELETE',
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

export async function fetchVideoTranscript(videoId, locale = 'en', baseUrl) {
  if (!videoId) return { videoId: '', locale, cues: [], source: 'none' };
  try {
    const res = await fetch(
      apiUrl(`/api/plugins/transcript?videoId=${encodeURIComponent(videoId)}&locale=${encodeURIComponent(locale)}`, baseUrl),
      { signal: AbortSignal.timeout(7000) },
    );
    if (res.ok) return await res.json();
  } catch {
    // Graceful fallback handled by player
  }
  return { videoId, locale, cues: [], source: 'none' };
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

  const ghTree = parseGitHubTreeClient(url);
  if (ghTree) {
    try {
      const apiPath = ghTree.dirPath ? `/${ghTree.dirPath}` : '';
      const refQuery = ghTree.ref ? `?ref=${encodeURIComponent(ghTree.ref)}` : '';
      const res = await fetch(
        `https://api.github.com/repos/${ghTree.owner}/${ghTree.repo}/contents${apiPath}${refQuery}`,
        {
          signal: AbortSignal.timeout(8000),
          headers: { Accept: 'application/vnd.github+json' },
        },
      );
      if (res.ok) {
        const list = await res.json();
        const entries = (Array.isArray(list) ? list : [])
          .slice(0, 150)
          .map((entry) => ({
            name: entry.name,
            type: entry.type,
            path: entry.path,
            url: entry.html_url || url,
          }));
        return {
          plugin: 'github-content-client',
          kind: 'directory',
          title: ghTree.dirPath || `${ghTree.owner}/${ghTree.repo}`,
          repo: `${ghTree.owner}/${ghTree.repo}`,
          entries,
          sourceUrl: url,
        };
      }
    } catch {
      // Ignore fallback error
    }
  }

function htmlFragmentToMarkdownClient(html) {
  if (!html) return '';
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<figure[^>]*>([\s\S]*?)<\/figure>/gi, '\n$1\n')
    .replace(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/gi, '\n*$1*\n')
    .replace(/<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi, (_, code) => `\n\`\`\`\n${code.replace(/<[^>]+>/g, '')}\n\`\`\`\n`)
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, code) => `\n\`\`\`\n${code.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')}\n\`\`\`\n`)
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, t) => `\n# ${t.replace(/<[^>]+>/g, '').trim()}\n`)
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, t) => `\n## ${t.replace(/<[^>]+>/g, '').trim()}\n`)
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, t) => `\n### ${t.replace(/<[^>]+>/g, '').trim()}\n`)
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_, t) => `\n#### ${t.replace(/<[^>]+>/g, '').trim()}\n`)
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, t) => `\n> ${t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}\n`)
    .replace(/<img\b([^>]*?)\/?>/gi, (_, attrs) => {
      const srcM = /\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)')/i.exec(attrs);
      const src = srcM ? (srcM[1] || srcM[2] || '').trim() : '';
      if (!src || /\/_\/stat\?event=post\.clientViewed/i.test(src)) return '';
      const altM = /\balt\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs);
      const alt = altM ? (altM[1] || altM[2] || '').trim() : '';
      return `\n![${alt}](${src})\n`;
    })
    .replace(/<a\b[^>]*\bhref\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/a>/gi, (_, h1, h2, inner) => {
      const href = (h1 || h2 || '').trim();
      const label = inner.replace(/<[^>]+>/g, '').trim() || href;
      return `[${label}](${href})`;
    })
    .replace(/<(?:strong|b)\b[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**')
    .replace(/<(?:em|i)\b[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*')
    .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_, c) => `\`${c.replace(/<[^>]+>/g, '')}\``)
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `\n- ${t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`)
    .replace(/<hr\s*\/?>/gi, '\n---\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseMediumUrlClient(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.toLowerCase();
    const parts = u.pathname.split('/').filter(Boolean);
    if ((host === 'medium.com' || host === 'www.medium.com') && parts.length >= 2) {
      const slug = parts[parts.length - 1];
      const idMatch = /([a-f0-9]{8,16})$/i.exec(slug);
      return {
        feedUrl: `https://medium.com/feed/${encodeURIComponent(parts[0])}`,
        postId: idMatch ? idMatch[1].toLowerCase() : '',
        slug: slug.toLowerCase(),
      };
    }
    if (host.endsWith('.medium.com') && parts.length >= 1) {
      const slug = parts[parts.length - 1];
      const idMatch = /([a-f0-9]{8,16})$/i.exec(slug);
      return {
        feedUrl: `https://${host}/feed`,
        postId: idMatch ? idMatch[1].toLowerCase() : '',
        slug: slug.toLowerCase(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

  const gh = toGitHubRawClient(url);
  if (gh) {
    const lower = gh.filename.toLowerCase();
    if (/\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/.test(lower)) {
      return {
        plugin: 'github-content-client',
        kind: 'image',
        title: gh.filename,
        repo: gh.repo,
        filePath: gh.filePath,
        imageUrl: gh.rawUrl,
        sourceUrl: url,
      };
    }
    if (lower.endsWith('.apkg')) {
      return {
        plugin: 'github-content-client',
        kind: 'apkg',
        title: gh.filename,
        repo: gh.repo,
        filePath: gh.filePath,
        downloadUrl: gh.rawUrl,
        sourceUrl: url,
      };
    }
    const ext = lower.includes('.') ? lower.split('.').pop() : '';
    if (/^(graffle|pdf|zip|tar|gz|tgz|bz2|xz|7z|rar|doc|docx|ppt|pptx|xls|xlsx|key|pages|numbers|sketch|fig|psd|ai|eps|mp4|mov|m4v|webm|avi|mkv|mp3|wav|ogg|flac|ttf|otf|woff|woff2|eot|wasm|bin|exe|dll|so|dylib|class|jar|pyc|o|a|sqlite|sqlite3|db|parquet|pickle|pkl|pt|pth|onnx|pb|h5|hdf5|dmg|iso)$/.test(ext)) {
      return {
        plugin: 'github-content-client',
        kind: 'binary',
        title: gh.filename,
        extension: ext,
        repo: gh.repo,
        filePath: gh.filePath,
        downloadUrl: gh.rawUrl,
        sourceUrl: url,
      };
    }
    try {
      const res = await fetch(gh.rawUrl, { signal: AbortSignal.timeout(7000) });
      if (res.ok) {
        const content = await res.text();
        if (!lower.endsWith('.ipynb')) {
          const sample = content.slice(0, 2000);
          let bad = 0;
          for (let i = 0; i < sample.length; i += 1) {
            const c = sample.charCodeAt(i);
            if (c === 0 || c === 0xfffd || (c < 32 && c !== 9 && c !== 10 && c !== 13)) bad += 1;
          }
          if (sample.includes('\u0000') || (sample.length > 0 && bad / sample.length > 0.06)) {
            return {
              plugin: 'github-content-client',
              kind: 'binary',
              title: gh.filename,
              extension: ext || 'bin',
              repo: gh.repo,
              filePath: gh.filePath,
              downloadUrl: gh.rawUrl,
              sourceUrl: url,
            };
          }
        }
        if (lower.endsWith('.ipynb')) {
          try {
            const nb = JSON.parse(content);
            const lang = nb?.metadata?.kernelspec?.language || nb?.metadata?.language_info?.name || 'python';
            const cells = (Array.isArray(nb?.cells) ? nb.cells : []).slice(0, 120).map((cell) => ({
              cell_type: cell.cell_type || 'code',
              source: Array.isArray(cell.source) ? cell.source.join('') : String(cell.source || ''),
              execution_count: cell.execution_count ?? null,
              outputs: Array.isArray(cell.outputs) ? cell.outputs.slice(0, 8) : [],
            }));
            return {
              plugin: 'github-content-client',
              kind: 'notebook',
              title: gh.filename,
              repo: gh.repo,
              filePath: gh.filePath,
              language: lang,
              cells,
              sourceUrl: url,
            };
          } catch {
            // Fall through to raw code view if malformed
          }
        }
        const kind = lower.endsWith('.md') || lower.endsWith('.markdown')
          ? 'markdown'
          : lower.endsWith('.txt')
            ? 'text'
            : 'code';
        return {
          plugin: 'github-content-client',
          kind,
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

  // Medium public RSS fallback (works on static deployments without backend)
  const medium = parseMediumUrlClient(url);
  if (medium) {
    try {
      const rssRes = await fetch(
        `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(medium.feedUrl)}`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (rssRes.ok) {
        const rssData = await rssRes.json();
        const items = Array.isArray(rssData?.items) ? rssData.items : [];
        const matched = items.find((item) => {
          const link = String(item?.link || item?.guid || '').toLowerCase();
          return (medium.postId && link.includes(medium.postId)) || (medium.slug && link.includes(medium.slug));
        });
        if (matched) {
          const md = htmlFragmentToMarkdownClient(matched.content || matched.description || '');
          if (md.length >= 40) {
            return {
              plugin: 'medium-rss-client',
              kind: 'markdown',
              title: matched.title || 'Medium Article',
              author: matched.author || '',
              siteName: 'Medium',
              content: md,
              sourceUrl: url,
            };
          }
        }
      }
    } catch {
      // Ignore fallback error
    }
  }

  // Qiita official public API v2 fallback
  try {
    const u = new URL(url);
    if (u.hostname === 'qiita.com' || u.hostname === 'www.qiita.com') {
      const m = /^\/[^/]+\/items\/([a-zA-Z0-9]+)/.exec(u.pathname);
      if (m?.[1]) {
        const qRes = await fetch(`https://qiita.com/api/v2/items/${encodeURIComponent(m[1])}`, {
          signal: AbortSignal.timeout(7000),
        });
        if (qRes.ok) {
          const item = await qRes.json();
          if (item?.body) {
            return {
              plugin: 'qiita-api-client',
              kind: 'markdown',
              title: item.title || 'Qiita Article',
              author: item.user?.name || item.user?.id || '',
              siteName: 'Qiita',
              content: item.body,
              sourceUrl: url,
            };
          }
        }
      }
    }
    // DEV.to official public API fallback
    if (u.hostname === 'dev.to' || u.hostname === 'www.dev.to') {
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        const dRes = await fetch(
          `https://dev.to/api/articles/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}`,
          { signal: AbortSignal.timeout(7000) },
        );
        if (dRes.ok) {
          const item = await dRes.json();
          if (item?.body_markdown) {
            return {
              plugin: 'devto-api-client',
              kind: 'markdown',
              title: item.title || 'DEV Article',
              author: item.user?.name || '',
              siteName: 'DEV Community',
              content: item.body_markdown,
              sourceUrl: url,
            };
          }
        }
      }
    }
    // Known paid course gates (redirect to login/pricing) — offer open-access in-app alternatives
    if (
      (u.hostname.endsWith('bytebytego.com') && u.pathname.toLowerCase().startsWith('/courses')) ||
      (u.hostname.endsWith('educative.io') && u.pathname.toLowerCase().startsWith('/courses'))
    ) {
      const host = u.hostname.replace(/^www\./, '');
      return {
        plugin: 'web-article-client',
        kind: 'markdown',
        title: `${host} — Subscription Required`,
        siteName: host,
        sourceUrl: url,
        content: [
          `## Subscription or Sign-In Required on ${host}`,
          '',
          `This course page on **${host}** redirects to a paid or sign-in gate and cannot be extracted in-app.`,
          '',
          '### Open-Access Guides You Can Read Right Here',
          '- [ByteByteGoHq / system-design-101 (Official Free Repo)](https://github.com/ByteByteGoHq/system-design-101)',
          '- [donnemartin / system-design-primer](https://github.com/donnemartin/system-design-primer)',
          '- [ashishps1 / awesome-system-design-resources](https://github.com/ashishps1/awesome-system-design-resources)',
          '- [ashishps1 / awesome-low-level-design](https://github.com/ashishps1/awesome-low-level-design)',
          '',
          '> If you have an active subscription on this site, use **Open original source** below to open it directly.',
        ].join('\n'),
      };
    }
  } catch {
    // Ignore fallback error
  }

  return {
    plugin: 'fallback',
    kind: 'error',
    title: url,
    sourceUrl: url,
  };
}

export function readLocalProfiles() {
  try {
    const raw = JSON.parse(localStorage.getItem(LINKED_PROFILES_KEY) || '{}');
    return normalizeLinkedProfiles(raw);
  } catch {
    return {};
  }
}

export function writeLocalProfiles(profiles) {
  const clean = normalizeLinkedProfiles(profiles);
  try {
    localStorage.setItem(LINKED_PROFILES_KEY, JSON.stringify(clean));
  } catch {
    // Ignore storage quota errors
  }
  return clean;
}

export async function fetchRemoteProfiles(profile = DEFAULT_APP_CONFIG.defaultProfile, baseUrl) {
  try {
    const res = await fetch(apiUrl(`/api/profiles?profile=${encodeURIComponent(profile)}`, baseUrl), {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return normalizeLinkedProfiles(data?.profiles || {});
  } catch {
    return null;
  }
}

export async function saveRemoteProfiles(profiles, profile = DEFAULT_APP_CONFIG.defaultProfile, baseUrl) {
  const clean = writeLocalProfiles(profiles);
  try {
    const res = await fetch(apiUrl(`/api/profiles?profile=${encodeURIComponent(profile)}`, baseUrl), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profiles: clean }),
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      return normalizeLinkedProfiles(data?.profiles || clean);
    }
  } catch {
    // Offline fallback already saved locally
  }
  return clean;
}

async function syncPlatformProfileBrowser(platformId, handle) {
  const profileUrl = buildProfileUrl(platformId, handle);
  if (platformId === 'leetcode') {
    const endpoints = [
      `https://leetcode-api-faisalshohag.vercel.app/${encodeURIComponent(handle)}`,
      `https://leetcode-stats-api.herokuapp.com/${encodeURIComponent(handle)}`,
    ];
    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, { signal: AbortSignal.timeout(7000) });
        if (!res.ok) continue;
        const data = await res.json();
        if (data?.status === 'error' || data?.errors) continue;
        const total = Number(data.totalSolved);
        if (!Number.isFinite(total)) continue;
        return {
          ok: true,
          platform: platformId,
          handle,
          profileUrl,
          syncedAt: new Date().toISOString(),
          stats: {
            platform: platformId,
            handle,
            profileUrl,
            solved: total,
            easy: Number.isFinite(Number(data.easySolved)) ? Number(data.easySolved) : null,
            medium: Number.isFinite(Number(data.mediumSolved)) ? Number(data.mediumSolved) : null,
            hard: Number.isFinite(Number(data.hardSolved)) ? Number(data.hardSolved) : null,
            rating: Number.isFinite(Number(data.contestRating)) ? Math.round(Number(data.contestRating)) : null,
            rank: Number.isFinite(Number(data.ranking)) && Number(data.ranking) > 0
              ? `#${Number(data.ranking).toLocaleString()}`
              : '',
            globalRank: Number.isFinite(Number(data.ranking)) && Number(data.ranking) > 0
              ? Number(data.ranking)
              : null,
            source: 'live',
          },
        };
      } catch {
        // Try next public endpoint
      }
    }
  }

  if (platformId === 'codeforces') {
    const res = await fetch(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(handle)}`, {
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const info = await res.json();
    if (info?.status !== 'OK' || !info.result?.[0]) throw new Error('User not found');
    const user = info.result[0];
    let solved = null;
    try {
      const stRes = await fetch(
        `https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=1&count=2000`,
        { signal: AbortSignal.timeout(7000) },
      );
      if (stRes.ok) {
        const st = await stRes.json();
        if (st?.status === 'OK' && Array.isArray(st.result)) {
          const unique = new Set();
          for (const sub of st.result) {
            if (sub?.verdict === 'OK' && sub.problem) {
              unique.add(`${sub.problem.contestId || 'gym'}:${sub.problem.index || sub.problem.name}`);
            }
          }
          solved = unique.size;
        }
      }
    } catch {
      // Keep rating/rank if status is rate-limited
    }
    return {
      ok: true,
      platform: platformId,
      handle,
      profileUrl,
      syncedAt: new Date().toISOString(),
      stats: {
        platform: platformId,
        handle,
        profileUrl,
        solved,
        rating: Number.isFinite(user.rating) ? Math.round(user.rating) : null,
        maxRating: Number.isFinite(user.maxRating) ? Math.round(user.maxRating) : null,
        rank: user.rank || user.maxRank || '',
        source: 'live',
      },
    };
  }

  if (platformId === 'atcoder') {
    const res = await fetch(
      `https://kenkoooo.com/atcoder/atcoder-api/v3/user/ac_rank?user=${encodeURIComponent(handle)}`,
      { signal: AbortSignal.timeout(7000) },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ac = await res.json();
    return {
      ok: true,
      platform: platformId,
      handle,
      profileUrl,
      syncedAt: new Date().toISOString(),
      stats: {
        platform: platformId,
        handle,
        profileUrl,
        solved: Number.isFinite(ac?.count) ? ac.count : null,
        rank: Number.isFinite(ac?.rank) ? `AC #${ac.rank + 1}` : '',
        globalRank: Number.isFinite(ac?.rank) ? ac.rank + 1 : null,
        source: 'live',
      },
    };
  }

  if (platformId === 'github') {
    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(handle)}`, {
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const user = await res.json();
    return {
      ok: true,
      platform: platformId,
      handle,
      profileUrl,
      syncedAt: new Date().toISOString(),
      stats: {
        platform: platformId,
        handle,
        profileUrl,
        rank: user.followers ? `${user.followers} followers` : '',
        extraCount: Number.isFinite(user.public_repos) ? user.public_repos : null,
        extraLabel: 'repos',
        source: 'live',
      },
    };
  }

  return {
    ok: false,
    platform: platformId,
    handle,
    profileUrl,
    syncedAt: null,
    stats: null,
    note: 'Live browser sync is restricted by this platform; enter solved count or rating manually.',
  };
}

export async function syncPlatformProfile(platformId, rawHandle, baseUrl) {
  const handle = sanitizeHandle(platformId, rawHandle);
  const profileUrl = buildProfileUrl(platformId, handle);
  if (!handle) return { ok: false, platform: platformId, handle: '', profileUrl: '', note: 'Invalid handle' };

  try {
    const res = await fetch(
      apiUrl(`/api/profiles/sync?platform=${encodeURIComponent(platformId)}&handle=${encodeURIComponent(handle)}`, baseUrl),
      { signal: AbortSignal.timeout(9000) },
    );
    const ct = res.headers.get('content-type') || '';
    if (res.ok && ct.includes('application/json')) {
      const json = await res.json();
      if (json?.ok && json?.stats) return json;
    }
  } catch {
    // Fall through to browser-side CORS-friendly sync
  }

  try {
    return await syncPlatformProfileBrowser(platformId, handle);
  } catch (error) {
    return {
      ok: false,
      platform: platformId,
      handle,
      profileUrl,
      syncedAt: null,
      stats: null,
      note: error?.message || 'Could not sync live stats; profile link saved.',
    };
  }
}
