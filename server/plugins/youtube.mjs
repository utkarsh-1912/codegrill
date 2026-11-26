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

export function extractYouTubeChannelId(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (!YOUTUBE_HOSTS.has(url.hostname)) return null;
    const match = /^\/channel\/(UC[a-zA-Z0-9_-]{20,})/.exec(url.pathname);
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

export function buildYouTubeChannelPlaylistEmbed(channelId, locale = 'en') {
  const uploadsPlaylistId = `UU${channelId.slice(2)}`;
  const embed = new URL('https://www.youtube-nocookie.com/embed/videoseries');
  embed.searchParams.set('list', uploadsPlaylistId);
  embed.searchParams.set('rel', '0');
  if (locale && /^[a-z]{2}(-[A-Z]{2})?$/.test(locale)) {
    embed.searchParams.set('hl', locale);
  }
  return embed.href;
}

function parseChannelRss(xml) {
  const videos = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
  let match;
  while ((match = entryRegex.exec(xml)) !== null && videos.length < 15) {
    const chunk = match[1];
    const idMatch = /<yt:videoId>([^<]+)<\/yt:videoId>/i.exec(chunk);
    const titleMatch = /<title>([^<]+)<\/title>/i.exec(chunk);
    const pubMatch = /<published>([^<]+)<\/published>/i.exec(chunk);
    if (idMatch?.[1]) {
      const videoId = idMatch[1].trim();
      videos.push({
        videoId,
        title: (titleMatch?.[1] || 'Video').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'"),
        published: pubMatch?.[1]?.slice(0, 10) || '',
        thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${videoId}`,
      });
    }
  }
  const authorMatch = /<author>\s*<name>([^<]+)<\/name>/i.exec(xml);
  return {
    channelName: authorMatch?.[1]?.trim() || '',
    videos,
  };
}

export const youtubePlugin = {
  id: 'youtube-video',
  name: 'YouTube Video & Channel Fetcher',
  kind: 'video',
  canHandle(url) {
    return Boolean(extractYouTubeId(url) || extractYouTubeChannelId(url));
  },
  async fetch(rawUrl, { locale = 'en', signal } = {}) {
    const channelId = extractYouTubeChannelId(rawUrl);
    if (channelId) {
      let channelName = 'YouTube Channel';
      let videos = [];
      try {
        const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
        const res = await fetch(rssUrl, {
          signal,
          headers: { 'User-Agent': 'Codegrill-Plugin/1.0' },
        });
        if (res.ok) {
          const parsed = parseChannelRss(await res.text());
          if (parsed.channelName) channelName = parsed.channelName;
          videos = parsed.videos;
        }
      } catch {
        // Fallback to playlist embed when RSS is unreachable
      }

      const firstVideo = videos[0];
      return {
        plugin: 'youtube-video',
        kind: 'channel',
        channelId,
        title: channelName,
        author: channelName,
        embedUrl: firstVideo
          ? buildYouTubeEmbedUrl(firstVideo.videoId, locale)
          : buildYouTubeChannelPlaylistEmbed(channelId, locale),
        playlistEmbedUrl: buildYouTubeChannelPlaylistEmbed(channelId, locale),
        videos,
        sourceUrl: rawUrl,
        locale,
      };
    }

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
