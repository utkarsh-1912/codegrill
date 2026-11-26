function decodeXml(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatTimestamp(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function parseTimedTextXml(xml) {
  const cues = [];
  const regex = /<text\s+start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/gi;
  let match;
  while ((match = regex.exec(xml)) !== null && cues.length < 400) {
    const start = Number.parseFloat(match[1]);
    const text = decodeXml(match[3].replace(/<[^>]+>/g, ' '));
    if (!text) continue;
    cues.push({
      start: Math.floor(start),
      time: formatTimestamp(start),
      text,
    });
  }
  return cues;
}

export async function fetchYouTubeTranscript(videoId, locale = 'en', { signal } = {}) {
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return { videoId, locale, cues: [], source: 'none' };
  }

  const langsToTry = locale && locale !== 'en' ? [locale, 'en'] : ['en'];

  for (const lang of langsToTry) {
    for (const kind of ['', '&kind=asr']) {
      try {
        const url = `https://video.google.com/timedtext?v=${encodeURIComponent(videoId)}&lang=${encodeURIComponent(lang)}${kind}`;
        const res = await fetch(url, {
          signal,
          headers: { 'User-Agent': 'Codegrill-Transcript/1.0' },
        });
        if (!res.ok) continue;
        const xml = await res.text();
        const cues = parseTimedTextXml(xml);
        if (cues.length > 0) {
          return { videoId, locale: lang, cues, source: kind ? 'auto-captions' : 'captions' };
        }
      } catch {
        // Try next candidate
      }
    }
  }

  return { videoId, locale, cues: [], source: 'none' };
}
