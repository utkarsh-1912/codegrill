function decodeEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function extractMeta(html, attr, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `<meta[^>]+${attr}=["']${escaped}["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${escaped}["']`,
    'i',
  );
  const match = pattern.exec(html);
  return match ? decodeEntities((match[1] || match[2] || '').trim()) : '';
}

function extractReadableBlocks(html) {
  const articleMatch = /<article[\s\S]*?<\/article>/i.exec(html) || /<main[\s\S]*?<\/main>/i.exec(html);
  const scope = (articleMatch ? articleMatch[0] : html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<(nav|footer|aside|header)[\s\S]*?<\/\1>/gi, ' ');

  const blocks = [];
  const blockRegex = /<(h1|h2|h3|p|pre|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = blockRegex.exec(scope)) !== null && blocks.length < 80) {
    const tag = match[1].toLowerCase();
    const rawText = decodeEntities(match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    if (!rawText || rawText.length < (tag === 'p' ? 24 : 4)) continue;
    blocks.push({ tag, text: rawText });
  }
  return blocks;
}

function isSafePublicUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:' || url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      host === '::1'
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export const articlePlugin = {
  id: 'web-article',
  name: 'Web Article & Editorial Reader',
  kind: 'article',
  canHandle(url) {
    return isSafePublicUrl(url);
  },
  async fetch(rawUrl, { signal } = {}) {
    if (!isSafePublicUrl(rawUrl)) throw new Error('Blocked or invalid article URL');

    const response = await fetch(rawUrl, {
      signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CodegrillReader/1.0)',
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9',
      },
    });
    if (!response.ok) {
      throw new Error(`Source returned HTTP ${response.status}`);
    }
    const contentType = response.headers.get('content-type') || '';
    const body = (await response.text()).slice(0, 350000);

    if (contentType.includes('text/plain') || contentType.includes('text/markdown')) {
      return {
        plugin: 'web-article',
        kind: 'markdown',
        title: new URL(rawUrl).pathname.split('/').pop() || 'Article',
        description: '',
        blocks: [],
        content: body.slice(0, 80000),
        siteName: new URL(rawUrl).hostname.replace(/^www\./, ''),
        sourceUrl: rawUrl,
      };
    }

    const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(body);
    const title = extractMeta(body, 'property', 'og:title')
      || (titleMatch ? decodeEntities(titleMatch[1].replace(/\s+/g, ' ').trim()) : '')
      || new URL(rawUrl).hostname;
    const description = extractMeta(body, 'property', 'og:description')
      || extractMeta(body, 'name', 'description');
    const siteName = extractMeta(body, 'property', 'og:site_name')
      || new URL(rawUrl).hostname.replace(/^www\./, '');
    const blocks = extractReadableBlocks(body);

    return {
      plugin: 'web-article',
      kind: 'article',
      title,
      description,
      siteName,
      blocks,
      sourceUrl: rawUrl,
    };
  },
};
