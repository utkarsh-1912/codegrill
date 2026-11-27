import { isSafePublicUrl, safeFetchText } from '../security/ssrf.mjs';

function decodeEntities(text) {
  if (!text) return '';
  return String(text)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos|nbsp|mdash|ndash|hellip|lsquo|rsquo|ldquo|rdquo);/gi, (full, ent) => {
      if (ent[0] === '#') {
        const code = ent[1] === 'x' || ent[1] === 'X' ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
        if (Number.isFinite(code) && code >= 0 && code <= 0x10ffff) {
          try { return String.fromCodePoint(code); } catch { return full; }
        }
        return full;
      }
      const map = {
        amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
        mdash: '—', ndash: '–', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
      };
      return map[ent.toLowerCase()] ?? full;
    });
}

function htmlFragmentToMarkdown(html) {
  if (!html) return '';
  let out = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<figure[^>]*>([\s\S]*?)<\/figure>/gi, '\n$1\n')
    .replace(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/gi, '\n*$1*\n')
    .replace(/<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi, (_, code) => `\n\`\`\`\n${decodeEntities(code.replace(/<[^>]+>/g, ''))}\n\`\`\`\n`)
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, code) => `\n\`\`\`\n${decodeEntities(code.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))}\n\`\`\`\n`)
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
    .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_, c) => `\`${decodeEntities(c.replace(/<[^>]+>/g, ''))}\``)
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `\n- ${t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`)
    .replace(/<hr\s*\/?>/gi, '\n---\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '');

  out = decodeEntities(out).replace(/\n{3,}/g, '\n\n').trim();
  return out;
}

function parseMediumUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split('/').filter(Boolean);
    if (host === 'medium.com' || host === 'www.medium.com') {
      if (parts.length >= 2) {
        const scope = parts[0]; // @author or publication
        const slug = parts[parts.length - 1];
        const idMatch = /([a-f0-9]{8,16})$/i.exec(slug);
        return {
          feedUrl: `https://medium.com/feed/${encodeURIComponent(scope)}`,
          postId: idMatch ? idMatch[1].toLowerCase() : '',
          slug: slug.toLowerCase(),
        };
      }
    } else if (host.endsWith('.medium.com') && parts.length >= 1) {
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

async function fetchMediumViaRss(rawUrl, signal) {
  const parsed = parseMediumUrl(rawUrl);
  if (!parsed) return null;

  const res = await safeFetchText(parsed.feedUrl, {
    signal,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CodegrillReader/1.0)',
      Accept: 'application/rss+xml, application/xml, text/xml;q=0.9',
    },
    allowedContentTypes: ['application/rss+xml', 'application/xml', 'text/xml', 'text/plain'],
  });
  if (!res.ok) return null;
  const xml = res.text;
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  let best = null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const linkMatch = /<link>([\s\S]*?)<\/link>/i.exec(itemXml) || /<guid[^>]*>([\s\S]*?)<\/guid>/i.exec(itemXml);
    const itemLink = decodeEntities(linkMatch?.[1] || '').toLowerCase();
    const idHit = parsed.postId && itemLink.includes(parsed.postId);
    const slugHit = parsed.slug && itemLink.includes(parsed.slug);
    if (idHit || slugHit) {
      best = itemXml;
      break;
    }
  }
  if (!best) return null;

  const titleMatch = /<title>([\s\S]*?)<\/title>/i.exec(best);
  const authorMatch = /<dc:creator>([\s\S]*?)<\/dc:creator>/i.exec(best);
  const contentMatch = /<content:encoded>([\s\S]*?)<\/content:encoded>/i.exec(best)
    || /<description>([\s\S]*?)<\/description>/i.exec(best);
  const rawHtml = decodeEntities(contentMatch?.[1] || '');
  const markdown = htmlFragmentToMarkdown(rawHtml);
  if (!markdown || markdown.length < 40) return null;

  return {
    plugin: 'web-article',
    kind: 'markdown',
    title: decodeEntities(titleMatch?.[1] || '').trim() || 'Medium Article',
    author: decodeEntities(authorMatch?.[1] || '').trim(),
    siteName: 'Medium',
    content: markdown.slice(0, 80000),
    sourceUrl: rawUrl,
  };
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

function extractJsonLdBody(html) {
  const scriptRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (typeof item?.articleBody === 'string' && item.articleBody.trim().length > 80) {
          return item.articleBody.trim();
        }
      }
    } catch {
      // Ignore malformed JSON-LD
    }
  }
  return '';
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

function isPaywalledRedirect(rawUrl, finalUrl, blocks) {
  try {
    const orig = new URL(rawUrl);
    const fin = finalUrl ? new URL(finalUrl) : orig;
    const finPath = fin.pathname.toLowerCase();
    const origHost = orig.hostname.toLowerCase();
    const origPath = orig.pathname.toLowerCase();
    const redirectedToGate = /(?:^|\/)(?:login|signin|sign-in|pricing|subscribe|checkout|plans|auth|upgrade)(?:\/|$)/.test(finPath)
      && finPath !== origPath;
    const knownPaidCourse = (
      (origHost.endsWith('bytebytego.com') && origPath.startsWith('/courses')) ||
      (origHost.endsWith('educative.io') && origPath.startsWith('/courses'))
    );
    return redirectedToGate || (knownPaidCourse && blocks.length < 4);
  } catch {
    return false;
  }
}

function buildSubscriptionNotice(rawUrl, title, siteName) {
  const host = (() => {
    try { return new URL(rawUrl).hostname.replace(/^www\./, ''); } catch { return siteName || 'external site'; }
  })();
  return {
    plugin: 'web-article',
    kind: 'markdown',
    title: title || host,
    siteName: siteName || host,
    sourceUrl: rawUrl,
    content: [
      `## Subscription or Sign-In Required on ${host}`,
      '',
      `This URL redirects to a paid course or sign-in page on **${host}**, so Codegrill cannot extract its full text in-app.`,
      '',
      '### Open-Access Guides You Can Read Right Here',
      '- [ByteByteGoHq / system-design-101 (README)](https://github.com/ByteByteGoHq/system-design-101/blob/main/README.md)',
      '- [ByteByteGoHq / system-design-101 (Data & Diagrams)](https://github.com/ByteByteGoHq/system-design-101/tree/main/data)',
      '- [donnemartin / system-design-primer](https://github.com/donnemartin/system-design-primer)',
      '- [ashishps1 / awesome-system-design-resources](https://github.com/ashishps1/awesome-system-design-resources)',
      '- [ashishps1 / awesome-low-level-design](https://github.com/ashishps1/awesome-low-level-design)',
      '',
      '> If you have an active subscription on this site, use **Open original source** below to read it directly.',
    ].join('\n'),
  };
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

    // Official Medium RSS feed extraction first for medium.com URLs
    const mediumRss = await fetchMediumViaRss(rawUrl, signal).catch(() => null);
    if (mediumRss) return mediumRss;

    const response = await safeFetchText(rawUrl, {
      signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CodegrillReader/1.0)',
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9',
      },
      allowedContentTypes: ['text/html', 'application/xhtml+xml', 'text/plain', 'text/markdown'],
    });
    if (!response.ok) {
      throw new Error(`Source returned HTTP ${response.status}`);
    }
    const contentType = response.contentType || '';
    const body = response.text.slice(0, 350000);

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
    let blocks = extractReadableBlocks(body);

    if (!blocks.length) {
      const ldBody = extractJsonLdBody(body);
      if (ldBody) {
        blocks = ldBody
          .split(/\n{2,}/)
          .map((p) => p.trim())
          .filter(Boolean)
          .slice(0, 60)
          .map((text) => ({ tag: 'p', text }));
      }
    }

    if (isPaywalledRedirect(rawUrl, response.finalUrl, blocks)) {
      return buildSubscriptionNotice(rawUrl, title, siteName);
    }

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
