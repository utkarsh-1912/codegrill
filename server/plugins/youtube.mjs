const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtube-nocookie.com',
]);

export function extractYouTubeId(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (!YOUTUBE_HOSTS.has(url.hostname)) return null;
    if (url.hostname === 'youtu.be') {
      const id = url.pathname.replace(/^\/+/, '').split('/')[0];
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    const v = url.searchParams.get('v');
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
    const match = /^\/(?:embed|shorts|live)\/([a-zA-Z0-9_-]{11})/.exec(url.pathname);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export function buildYouTubeEmbedUrl(videoId, locale = 'en') {
  const embed = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);
  embed.searchParams.set('rel', '0');
  embed.searchParams.set('modestbranding', '1');
  embed.searchParams.set('enablejsapi', '0');
  if (locale && /^[a-z]{2}(-[A-Z]{2})?$/.test(locale)) {
    embed.searchParams.set('cc_lang_pref', locale);
    embed.searchParams.set('hl', locale);
    if (locale !== 'en') embed.searchParams.set('cc_load_policy', '1');
  }
  return embed.href;
}

export const youtubePlugin = {
  id: 'youtube-video',
  name: 'YouTube Video Fetcher',
  kind: 'video',
  canHandle(url) {
    return Boolean(extractYouTubeId(url));
  },
  async fetch(rawUrl, { locale = 'en', signal } = {}) {
    const videoId = extractYouTubeId(rawUrl);
    if (!videoId) throw new Error('Invalid YouTube URL');

    const embedUrl = buildYouTubeEmbedUrl(videoId, locale);
    const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    let title = 'Video walkthrough';
    let author = 'YouTube';

    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`;
      const response = await fetch(oembedUrl, {
        signal,
        headers: { 'User-Agent': 'Codegrill-Plugin/1.0' },
      });
      if (response.ok) {
        const meta = await response.json();
        if (meta?.title) title = meta.title;
        if (meta?.author_name) author = meta.author_name;
      }
    } catch {
      // Metadata lookup is best-effort; embedded playback works even offline/rate-limited.
    }

    return {
      plugin: 'youtube-video',
      kind: 'video',
      videoId,
      title,
      author,
      thumbnailUrl,
      embedUrl,
      sourceUrl: rawUrl,
      locale,
    };
  },
};
