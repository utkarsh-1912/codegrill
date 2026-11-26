import React, { useEffect, useId, useMemo, useState } from 'react';
import { Check, Code2, Copy, Workflow } from 'lucide-react';

let mermaidPromise = null;
function loadMermaid() {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (!mermaidPromise) {
    const cdnUrl = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
    mermaidPromise = import(/* @vite-ignore */ cdnUrl).then((mod) => mod.default || mod);
  }
  return mermaidPromise;
}

let katexPromise = null;
function loadKatex() {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (typeof document !== 'undefined' && !document.getElementById('codegrill-katex-css')) {
    const link = document.createElement('link');
    link.id = 'codegrill-katex-css';
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }
  if (!katexPromise) {
    const cdnUrl = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.mjs';
    katexPromise = import(/* @vite-ignore */ cdnUrl).then((mod) => mod.default || mod);
  }
  return katexPromise;
}

function MathView({ tex, display = false }) {
  const [html, setHtml] = useState('');
  const cleanTex = useMemo(() => decodeHtmlEntities(String(tex || '')).trim(), [tex]);

  useEffect(() => {
    if (!cleanTex) return undefined;
    let cancelled = false;
    loadKatex()
      .then((katex) => {
        if (cancelled) return;
        const rendered = katex.renderToString(cleanTex, {
          displayMode: display,
          throwOnError: false,
          strict: 'ignore',
          trust: false,
        });
        setHtml(rendered);
      })
      .catch(() => {
        if (!cancelled) setHtml('');
      });
    return () => { cancelled = true; };
  }, [cleanTex, display]);

  if (display) {
    return html ? (
      <div className="rt-math-block" dangerouslySetInnerHTML={{ __html: html }} />
    ) : (
      <div className="rt-math-block rt-math-fallback"><code>{cleanTex}</code></div>
    );
  }

  return html ? (
    <span className="rt-math-inline" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <code className="rt-inline-code rt-math-fallback">{cleanTex}</code>
  );
}

function resolveResourceUrl(href, sourceUrl, forRawImage = false) {
  const clean = String(href || '').trim();
  if (!clean || clean.startsWith('#')) return null;

  try {
    const abs = new URL(clean);
    if (abs.protocol !== 'https:' && abs.protocol !== 'http:') return null;
    if (forRawImage && (abs.hostname === 'github.com' || abs.hostname === 'www.github.com')) {
      const parts = abs.pathname.split('/').filter(Boolean);
      if (parts.length >= 5 && parts[2] === 'blob') {
        const [owner, repo, , ref, ...rest] = parts;
        return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${rest.join('/')}`;
      }
    }
    return abs.href;
  } catch {
    if (!sourceUrl) return null;
    try {
      const base = new URL(sourceUrl);
      if (base.hostname === 'github.com' || base.hostname === 'www.github.com') {
        const parts = base.pathname.split('/').filter(Boolean);
        if (parts.length >= 4 && (parts[2] === 'blob' || parts[2] === 'tree')) {
          const [owner, repo, , ref, ...rest] = parts;
          const dirParts = parts[2] === 'blob' ? rest.slice(0, -1) : rest;
          const baseOrigin = forRawImage
            ? `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/`
            : `https://github.com/${owner}/${repo}/blob/${ref}/`;
          const baseDir = clean.startsWith('/')
            ? baseOrigin
            : `${baseOrigin}${dirParts.length ? `${dirParts.join('/')}/` : ''}`;
          return new URL(clean.replace(/^\/+/, ''), baseDir).href;
        }
      }
      return new URL(clean, base).href;
    } catch {
      return null;
    }
  }
}

function isInAppLink(url) {
  try {
    const u = new URL(url);
    return (
      u.hostname === 'github.com' ||
      u.hostname === 'www.github.com' ||
      u.hostname === 'raw.githubusercontent.com' ||
      u.hostname.endsWith('youtube.com') ||
      u.hostname === 'youtu.be'
    );
  } catch {
    return false;
  }
}

const HTML_ENTITIES = {
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  amp: '&',
  nbsp: ' ',
  ensp: ' ',
  emsp: ' ',
  thinsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  laquo: '«',
  raquo: '»',
  bull: '•',
  middot: '·',
  rarr: '→',
  larr: '←',
  uarr: '↑',
  darr: '↓',
  harr: '↔',
  times: '×',
  divide: '÷',
  plusmn: '±',
  le: '≤',
  ge: '≥',
  ne: '≠',
  approx: '≈',
  infin: '∞',
  deg: '°',
  copy: '©',
  reg: '®',
  trade: '™',
  sect: '§',
};

export function decodeHtmlEntities(text) {
  if (!text || !String(text).includes('&')) return text;
  return String(text).replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]+);/g, (full, entity) => {
    if (entity[0] === '#') {
      const code = entity[1] === 'x' || entity[1] === 'X'
        ? parseInt(entity.slice(2), 16)
        : parseInt(entity.slice(1), 10);
      if (Number.isFinite(code) && code >= 0 && code <= 0x10ffff) {
        try {
          return String.fromCodePoint(code);
        } catch {
          return full;
        }
      }
      return full;
    }
    const named = HTML_ENTITIES[entity] ?? HTML_ENTITIES[entity.toLowerCase()];
    return named !== undefined ? named : full;
  });
}

function convertHtmlTableToMarkdown(tableHtml) {
  const rows = [];
  const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    const cells = [];
    const cellRegex = /<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
      const cellText = preprocessHtmlToMarkdown(cellMatch[2])
        .replace(/\n+/g, ' ')
        .replace(/\|/g, '\\|')
        .trim();
      cells.push(cellText);
    }
    if (cells.length) rows.push(cells);
  }
  if (!rows.length) return '';
  const colCount = Math.max(...rows.map((r) => r.length));
  const pad = (r) => Array.from({ length: colCount }, (_, idx) => r[idx] || '');
  const header = pad(rows[0]);
  const sep = Array.from({ length: colCount }, () => '---');
  const body = rows.slice(1).map(pad);
  return `\n\n| ${header.join(' | ')} |\n| ${sep.join(' | ')} |\n${body.map((r) => `| ${r.join(' | ')} |`).join('\n')}\n\n`;
}

function convertHtmlListToMarkdown(listHtml, ordered = false, depth = 0) {
  const indent = '  '.repeat(depth);
  // Process nested lists inside list items recursively first
  let inner = listHtml;
  inner = inner.replace(/<ul\b[^>]*>([\s\S]*?)<\/ul>/gi, (_, sub) => `\n${convertHtmlListToMarkdown(sub, false, depth + 1)}`);
  inner = inner.replace(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi, (_, sub) => `\n${convertHtmlListToMarkdown(sub, true, depth + 1)}`);

  const items = [];
  const liRegex = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let match;
  let num = 1;
  while ((match = liRegex.exec(inner)) !== null) {
    const raw = match[1].trim();
    const lines = raw.split('\n');
    const firstParts = [];
    const nestedLines = [];
    for (const ln of lines) {
      if (/^\s{2,}[-*+]\s+|^\s{2,}\d+\.\s+/.test(ln)) {
        nestedLines.push(ln);
      } else {
        const cleaned = preprocessHtmlToMarkdown(ln).trim();
        if (cleaned) firstParts.push(cleaned);
      }
    }
    const marker = ordered ? `${num++}. ` : '- ';
    const head = `${indent}${marker}${firstParts.join(' ')}`;
    items.push(nestedLines.length ? `${head}\n${nestedLines.join('\n')}` : head);
  }
  return items.join('\n');
}

function normalizeHtmlBlocks(rawText) {
  const normalized = String(rawText || '').replace(/\r\n?/g, '\n');
  if (!normalized.includes('<')) return normalized;

  // Protect existing fenced code blocks so we never mutate code examples
  const fencedSlots = [];
  let text = normalized.replace(/(^|\n)([ \t]*(?:```|~~~)[^\n]*\n[\s\S]*?\n[ \t]*(?:```|~~~)[ \t]*)(?=\n|$)/g, (_, lead, block) => {
    const id = fencedSlots.length;
    fencedSlots.push(block);
    return `${lead}@@CG_FENCE_${id}@@`;
  });

  // Strip HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, '');

  // Convert <pre><code class="language-x">...</code></pre> and <pre>...</pre> into fenced code blocks
  text = text.replace(/<pre\b([^>]*)>\s*(?:<code\b([^>]*)>)?([\s\S]*?)(?:<\/code>)?\s*<\/pre>/gi, (_, preAttrs, codeAttrs = '', body) => {
    const combinedAttrs = `${preAttrs || ''} ${codeAttrs || ''}`;
    const langMatch = /(?:language-|lang\s*=\s*["']?)([a-zA-Z0-9_+#.-]+)/i.exec(combinedAttrs);
    const lang = langMatch ? langMatch[1] : 'text';
    const cleanBody = decodeHtmlEntities(body.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?span\b[^>]*>/gi, '')).replace(/^\n+|\n+$/g, '');
    const id = fencedSlots.length;
    fencedSlots.push(`\`\`\`${lang}\n${cleanBody}\n\`\`\``);
    return `\n\n@@CG_FENCE_${id}@@\n\n`;
  });

  // Convert HTML tables
  text = text.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, (tbl) => convertHtmlTableToMarkdown(tbl));

  // Convert HTML headings <h1>..<h6>
  text = text.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, inner) => {
    const headingText = preprocessHtmlToMarkdown(inner).replace(/\n+/g, ' ').trim();
    return headingText ? `\n\n${'#'.repeat(Number(level))} ${headingText}\n\n` : '\n\n';
  });

  // Convert HTML horizontal rules
  text = text.replace(/<hr\b[^>]*\/?>/gi, '\n\n---\n\n');

  // Convert HTML blockquotes
  text = text.replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, inner) => {
    const cleaned = preprocessHtmlToMarkdown(inner).trim();
    if (!cleaned) return '\n\n';
    return `\n\n${cleaned.split('\n').map((l) => `> ${l.trim()}`).join('\n')}\n\n`;
  });

  // Convert HTML lists (outermost first; inner lists handled recursively)
  for (let pass = 0; pass < 3; pass += 1) {
    const before = text;
    text = text.replace(/<ul\b[^>]*>([\s\S]*?)<\/ul>/gi, (_, inner) => `\n\n${convertHtmlListToMarkdown(inner, false, 0)}\n\n`);
    text = text.replace(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi, (_, inner) => `\n\n${convertHtmlListToMarkdown(inner, true, 0)}\n\n`);
    if (text === before) break;
  }

  // Convert <details>/<summary>
  text = text.replace(/<summary\b[^>]*>([\s\S]*?)<\/summary>/gi, (_, inner) => {
    const title = preprocessHtmlToMarkdown(inner).replace(/\n+/g, ' ').trim();
    return title ? `\n\n**${title}**\n\n` : '\n\n';
  });
  text = text.replace(/<\/?(?:details|section|article|header|footer|main|aside|figure|figcaption|center)\b[^>]*>/gi, '\n\n');

  // Convert standalone <p> and <div> boundaries into paragraph breaks
  text = text
    .replace(/<(?:p|div)\b[^>]*>/gi, '\n\n')
    .replace(/<\/(?:p|div)>/gi, '\n\n');

  // Restore fenced code blocks
  text = text.replace(/@@CG_FENCE_(\d+)@@/g, (_, idx) => fencedSlots[Number(idx)] || '');
  return text;
}

function preprocessHtmlToMarkdown(text) {
  if (!text || !text.includes('<')) return text;
  let out = String(text);
  // Convert <img ... src="..." ... /> (any attribute order) into Markdown ![alt](src)
  out = out.replace(/<img\b([^>]*?)\/?>/gi, (_, attrs) => {
    const srcMatch = /\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'>]+))/i.exec(attrs);
    const src = decodeHtmlEntities(srcMatch ? (srcMatch[1] || srcMatch[2] || srcMatch[3] || '').trim() : '');
    if (!src) return '';
    const altMatch = /\balt\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs);
    const alt = decodeHtmlEntities(altMatch ? (altMatch[1] || altMatch[2] || '').trim() : '');
    return `![${alt}](${src})`;
  });
  // Convert <a ... href="...">inner</a> into Markdown [inner](href)
  out = out.replace(/<a\b[^>]*\bhref\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/a>/gi, (_, h1, h2, inner) => {
    const href = decodeHtmlEntities((h1 || h2 || '').trim());
    const innerMd = preprocessHtmlToMarkdown(inner).trim();
    const label = decodeHtmlEntities(innerMd || href);
    return `[${label}](${href})`;
  });
  // Convert simple inline formatting HTML tags
  out = out
    .replace(/<(?:strong|b)\b[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**')
    .replace(/<(?:em|i)\b[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*')
    .replace(/<(?:del|s|strike)\b[^>]*>([\s\S]*?)<\/(?:del|s|strike)>/gi, '~~$1~~')
    .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<\/?(?:p|div|span|center|details|summary|small|font|picture|source|u|ins)\b[^>]*>/gi, '');
  return out;
}

// Parse inline markdown: `code`, $math$, \(math\), [![alt](img)](url), ![alt](img), [label](url), <https://...>, <kbd>/<sup>/<sub>/<mark>/<br>, **bold**, *italic*, ~~strike~~
function renderInline(text, { sourceUrl, onOpenLink, keyPrefix = 'in' } = {}) {
  const prepared = preprocessHtmlToMarkdown(text);
  if (!prepared) return null;
  const tokens = [];
  const pattern = /(``[^`]+``|`[^`\n]+`|\$\$[^$\n]+\$\$|\\\([^)\n]+\\\)|\$(?!\s)(?:\\\$|[^$\n])+?(?<!\s)\$(?!\d)|\[!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|<(https?:\/\/[^\s>]+)>|<br\s*\/?>|<(kbd|sup|sub|mark)\b[^>]*>([\s\S]*?)<\/\10>|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|\*(?!\s)[^*\n]+?(?<!\s)\*|(?<![a-zA-Z0-9])_(?!\s)[^_\n]+?(?<!\s)_(?![a-zA-Z0-9]))/gi;
  let lastIndex = 0;
  let match;
  let idx = 0;

  while ((match = pattern.exec(prepared)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(decodeHtmlEntities(prepared.slice(lastIndex, match.index)));
    }
    const token = match[0];
    const key = `${keyPrefix}-${idx++}`;

    if (token.startsWith('``') && token.endsWith('``')) {
      tokens.push(<code key={key} className="rt-inline-code">{decodeHtmlEntities(token.slice(2, -2).trim())}</code>);
    } else if (token.startsWith('`')) {
      tokens.push(<code key={key} className="rt-inline-code">{decodeHtmlEntities(token.slice(1, -1))}</code>);
    } else if (token.startsWith('$$') && token.endsWith('$$')) {
      tokens.push(<MathView key={key} tex={token.slice(2, -2)} display={false} />);
    } else if (token.startsWith('\\(') && token.endsWith('\\)')) {
      tokens.push(<MathView key={key} tex={token.slice(2, -2)} display={false} />);
    } else if (token.startsWith('$') && token.endsWith('$')) {
      tokens.push(<MathView key={key} tex={token.slice(1, -1)} display={false} />);
    } else if (token.startsWith('[![')) {
      const alt = decodeHtmlEntities(match[2] || '');
      const imgSrc = resolveResourceUrl(decodeHtmlEntities(match[3]), sourceUrl, true);
      const href = resolveResourceUrl(decodeHtmlEntities(match[4]), sourceUrl, false);
      const imgEl = imgSrc ? <img src={imgSrc} alt={alt} className="rt-image rt-badge-img" loading="lazy" /> : alt;
      if (href) {
        tokens.push(
          <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="rt-link">
            {imgEl}
          </a>,
        );
      } else {
        tokens.push(<React.Fragment key={key}>{imgEl}</React.Fragment>);
      }
    } else if (token.startsWith('![')) {
      const alt = decodeHtmlEntities(match[5] || '');
      const src = resolveResourceUrl(decodeHtmlEntities(match[6]), sourceUrl, true);
      if (src) {
        tokens.push(
          <img
            key={key}
            src={src}
            alt={alt}
            className="rt-image"
            loading="lazy"
          />,
        );
      }
    } else if (token.startsWith('[')) {
      const rawLabel = match[7];
      const labelText = decodeHtmlEntities(rawLabel);
      const labelNode = renderInline(rawLabel, { sourceUrl, onOpenLink, keyPrefix: `${key}-lbl` });
      const resolved = resolveResourceUrl(decodeHtmlEntities(match[8]), sourceUrl, false);
      if (resolved && onOpenLink && isInAppLink(resolved)) {
        tokens.push(
          <a
            key={key}
            href={resolved}
            className="rt-link"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              e.preventDefault();
              onOpenLink(resolved, labelText);
            }}
          >
            {labelNode}
          </a>,
        );
      } else if (resolved) {
        tokens.push(
          <a key={key} href={resolved} target="_blank" rel="noopener noreferrer" className="rt-link">
            {labelNode}
          </a>,
        );
      } else {
        tokens.push(<span key={key} className="rt-link-muted">{labelNode}</span>);
      }
    } else if (token.startsWith('<http')) {
      const resolved = resolveResourceUrl(decodeHtmlEntities(match[9]), sourceUrl, false);
      if (resolved && onOpenLink && isInAppLink(resolved)) {
        tokens.push(
          <a
            key={key}
            href={resolved}
            className="rt-link"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              e.preventDefault();
              onOpenLink(resolved, resolved);
            }}
          >
            {resolved}
          </a>,
        );
      } else if (resolved) {
        tokens.push(
          <a key={key} href={resolved} target="_blank" rel="noopener noreferrer" className="rt-link">
            {resolved}
          </a>,
        );
      }
    } else if (/^<br\s*\/?>$/i.test(token)) {
      tokens.push(<br key={key} />);
    } else if (match[10]) {
      const tag = match[10].toLowerCase();
      const inner = renderInline(match[11], { sourceUrl, onOpenLink, keyPrefix: key });
      if (tag === 'kbd') tokens.push(<kbd key={key} className="rt-kbd">{inner}</kbd>);
      else if (tag === 'sup') tokens.push(<sup key={key}>{inner}</sup>);
      else if (tag === 'sub') tokens.push(<sub key={key}>{inner}</sub>);
      else if (tag === 'mark') tokens.push(<mark key={key} className="rt-mark">{inner}</mark>);
    } else if (token.startsWith('**') || token.startsWith('__')) {
      tokens.push(<strong key={key}>{renderInline(token.slice(2, -2), { sourceUrl, onOpenLink, keyPrefix: key })}</strong>);
    } else if (token.startsWith('~~')) {
      tokens.push(<del key={key}>{renderInline(token.slice(2, -2), { sourceUrl, onOpenLink, keyPrefix: key })}</del>);
    } else if (token.startsWith('*') || token.startsWith('_')) {
      tokens.push(<em key={key}>{renderInline(token.slice(1, -1), { sourceUrl, onOpenLink, keyPrefix: key })}</em>);
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < prepared.length) {
    tokens.push(decodeHtmlEntities(prepared.slice(lastIndex)));
  }
  return tokens;
}

function getIndentWidth(line) {
  let width = 0;
  for (let idx = 0; idx < line.length; idx += 1) {
    if (line[idx] === ' ') width += 1;
    else if (line[idx] === '\t') width += 2;
    else break;
  }
  return width;
}

function parseListBlock(lines, startIndex) {
  const flat = [];
  let i = startIndex;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      // Allow a single blank line between list items if the next non-blank line continues the list
      let lookahead = i + 1;
      while (lookahead < lines.length && !lines[lookahead].trim()) lookahead += 1;
      if (lookahead < lines.length && /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(lines[lookahead])) {
        i = lookahead;
        continue;
      }
      break;
    }

    const ulMatch = /^(\s*)[-*+]\s+(.*)$/.exec(line);
    const olMatch = /^(\s*)\d+[.)]\s+(.*)$/.exec(line);

    if (ulMatch || olMatch) {
      const indent = getIndentWidth(ulMatch ? ulMatch[1] : olMatch[1]);
      let text = (ulMatch ? ulMatch[2] : olMatch[2]).trim();
      let checked = null;
      const taskMatch = /^\[([ xX])\]\s+(.*)$/.exec(text);
      if (taskMatch) {
        checked = taskMatch[1].toLowerCase() === 'x';
        text = taskMatch[2];
      }
      flat.push({
        indent,
        ordered: Boolean(olMatch),
        text,
        checked,
        children: [],
      });
      i += 1;
      continue;
    }

    // Continuation line indented under the previous list item
    if (flat.length && /^\s{2,}/.test(line) && !/^\s*(?:```|~~~|#{1,6}\s|>|\$\$)/.test(line)) {
      flat[flat.length - 1].text = `${flat[flat.length - 1].text} ${trimmed}`.trim();
      i += 1;
      continue;
    }

    break;
  }

  // Build nested list tree from flat items
  const root = { ordered: flat[0]?.ordered || false, items: [] };
  const stack = [{ indent: -1, list: root }];

  for (const item of flat) {
    while (stack.length > 1 && item.indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];
    if (item.indent > parent.indent && parent.list.items.length > 0 && parent.indent >= 0) {
      const prevItem = parent.list.items[parent.list.items.length - 1];
      let subList = prevItem.subList;
      if (!subList) {
        subList = { ordered: item.ordered, items: [] };
        prevItem.subList = subList;
      }
      subList.items.push(item);
      stack.push({ indent: item.indent, list: subList });
    } else {
      parent.list.items.push(item);
      if (stack.length === 1) {
        stack[0].indent = item.indent;
      }
    }
  }

  return { block: { type: root.ordered ? 'ol' : 'ul', items: root.items }, nextIndex: i };
}

function parseRichBlocks(rawText, isPlainText = false) {
  const normalized = isPlainText
    ? String(rawText || '').replace(/\r\n?/g, '\n')
    : normalizeHtmlBlocks(rawText);
  const lines = normalized.split('\n');
  const blocks = [];
  let i = 0;

  if (isPlainText) {
    let para = [];
    const flushPara = () => {
      if (!para.length) return;
      const joined = para.join('\n').trim();
      if (joined) blocks.push({ type: 'paragraph', text: joined });
      para = [];
    };
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        flushPara();
      } else if (/^[-=*_]{3,}$/.test(trimmed)) {
        flushPara();
        blocks.push({ type: 'hr' });
      } else if (/^[A-Z][A-Z0-9\s/-]{3,60}:?$/.test(trimmed)) {
        flushPara();
        blocks.push({ type: 'heading', level: 3, text: trimmed.replace(/:$/, '') });
      } else if (/^[-*•]\s+/.test(trimmed)) {
        flushPara();
        const last = blocks[blocks.length - 1];
        const item = { text: trimmed.replace(/^[-*•]\s+/, ''), checked: null };
        if (last?.type === 'ul') last.items.push(item);
        else blocks.push({ type: 'ul', items: [item] });
      } else {
        para.push(line);
      }
    }
    flushPara();
    return blocks;
  }

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Fenced code block ```lang or ~~~lang
    const fenceMatch = /^(`{3,}|~{3,})([a-zA-Z0-9_+#.-]*)\s*$/.exec(trimmed);
    if (fenceMatch) {
      const fenceChar = fenceMatch[1][0];
      const fenceLen = fenceMatch[1].length;
      const lang = fenceMatch[2] || 'text';
      const codeLines = [];
      i += 1;
      const closeRe = new RegExp(`^${fenceChar}{${fenceLen},}\\s*$`);
      while (i < lines.length && !closeRe.test(lines[i].trim())) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({ type: 'code', language: lang, content: codeLines.join('\n') });
      continue;
    }

    // Display math block: $$...$$ (single-line or multi-line)
    if (trimmed.startsWith('$$')) {
      if (trimmed.length > 4 && trimmed.endsWith('$$')) {
        blocks.push({ type: 'math', content: trimmed.slice(2, -2).trim() });
        i += 1;
        continue;
      }
      const mathLines = [];
      const afterOpen = trimmed.slice(2).trim();
      if (afterOpen) mathLines.push(afterOpen);
      i += 1;
      while (i < lines.length) {
        const cur = lines[i].trim();
        if (cur.endsWith('$$')) {
          const beforeClose = cur.slice(0, -2).trim();
          if (beforeClose) mathLines.push(beforeClose);
          i += 1;
          break;
        }
        mathLines.push(lines[i]);
        i += 1;
      }
      blocks.push({ type: 'math', content: mathLines.join('\n').trim() });
      continue;
    }

    // Display math block: \[ ... \]
    if (trimmed.startsWith('\\[')) {
      if (trimmed.length > 4 && trimmed.endsWith('\\]')) {
        blocks.push({ type: 'math', content: trimmed.slice(2, -2).trim() });
        i += 1;
        continue;
      }
      const mathLines = [];
      const afterOpen = trimmed.slice(2).trim();
      if (afterOpen) mathLines.push(afterOpen);
      i += 1;
      while (i < lines.length) {
        const cur = lines[i].trim();
        if (cur.endsWith('\\]')) {
          const beforeClose = cur.slice(0, -2).trim();
          if (beforeClose) mathLines.push(beforeClose);
          i += 1;
          break;
        }
        mathLines.push(lines[i]);
        i += 1;
      }
      blocks.push({ type: 'math', content: mathLines.join('\n').trim() });
      continue;
    }

    // Indented code block (4 spaces or tab, not a list item)
    if (/^(?: {4}|\t)/.test(line) && !/^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(line)) {
      const codeLines = [];
      while (i < lines.length && (/^(?: {4}|\t)/.test(lines[i]) || lines[i].trim() === '')) {
        codeLines.push(lines[i].replace(/^(?: {4}|\t)/, ''));
        i += 1;
      }
      while (codeLines.length && !codeLines[codeLines.length - 1].trim()) codeLines.pop();
      if (codeLines.length) {
        blocks.push({ type: 'code', language: 'text', content: codeLines.join('\n') });
        continue;
      }
    }

    // Skip raw HTML comment blocks <!-- ... -->
    if (trimmed.startsWith('<!--')) {
      while (i < lines.length && !lines[i].includes('-->')) i += 1;
      i += 1;
      continue;
    }

    // Standalone HTML <img src="..." alt="...">
    const htmlImgMatch = /<img[^>]+src=["']([^"']+)["'][^>]*>/i.exec(trimmed);
    if (htmlImgMatch && trimmed.startsWith('<')) {
      const altMatch = /alt=["']([^"']*)["']/i.exec(trimmed);
      blocks.push({ type: 'image', src: htmlImgMatch[1], alt: altMatch?.[1] || '' });
      i += 1;
      continue;
    }

    // Headings # ... ######
    const headingMatch = /^(#{1,6})\s+(.+?)\s*#*$/.exec(trimmed);
    if (headingMatch) {
      blocks.push({ type: 'heading', level: headingMatch[1].length, text: headingMatch[2] });
      i += 1;
      continue;
    }

    // Setext headings (underline === or ---)
    if (i + 1 < lines.length && /^(?:={3,}|-{3,})\s*$/.test(lines[i + 1].trim()) && !/^[-*+]\s|^\d+[.)]\s|^>/.test(trimmed)) {
      const level = lines[i + 1].trim().startsWith('=') ? 1 : 2;
      blocks.push({ type: 'heading', level, text: trimmed });
      i += 2;
      continue;
    }

    // Horizontal rule
    if (/^(?:---|\*\*\*|___)\s*$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    // Markdown table
    if (trimmed.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(lines[i + 1])) {
      const splitRow = (row) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
      const headers = splitRow(trimmed);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().includes('|') && lines[i].trim() !== '') {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      const quoteLines = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push({ type: 'quote', text: quoteLines.join(' ') });
      continue;
    }

    // Unordered or ordered list (with nesting & task checkboxes)
    if (/^[-*+]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed)) {
      const { block, nextIndex } = parseListBlock(lines, i);
      blocks.push(block);
      i = nextIndex;
      continue;
    }

    // Paragraph
    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,6}\s|```|~~~|\$\$|\\\[|>|[-*+]\s|\d+[.)]\s|---|\*\*\*|___)/i.test(lines[i].trim())
    ) {
      if (i + 1 < lines.length && /^(?:={3,}|-{3,})\s*$/.test(lines[i + 1].trim()) && paraLines.length > 0) {
        break;
      }
      const cleaned = preprocessHtmlToMarkdown(lines[i]).trim();
      if (cleaned) paraLines.push(cleaned);
      i += 1;
    }
    if (paraLines.length) {
      blocks.push({ type: 'paragraph', text: paraLines.join(' ') });
    } else {
      i += 1;
    }
  }

  return blocks;
}

function renderListNode(list, { sourceUrl, onOpenLink, keyPrefix }) {
  const Tag = list.ordered ? 'ol' : 'ul';
  return (
    <Tag className={`rt-list ${list.ordered ? 'rt-ol' : 'rt-ul'}`}>
      {list.items.map((item, j) => {
        const itemKey = `${keyPrefix}-${j}`;
        const isTask = item.checked !== null && item.checked !== undefined;
        return (
          <li key={itemKey} className={isTask ? 'rt-task-item' : undefined}>
            {isTask && (
              <span className={`rt-task-box ${item.checked ? 'is-checked' : ''}`} aria-hidden="true">
                {item.checked ? '✓' : ''}
              </span>
            )}
            <span>{renderInline(item.text, { sourceUrl, onOpenLink, keyPrefix: itemKey })}</span>
            {item.subList && renderListNode(item.subList, { sourceUrl, onOpenLink, keyPrefix: `${itemKey}-sub` })}
          </li>
        );
      })}
    </Tag>
  );
}

function MermaidBlock({ content }) {
  const reactId = useId();
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [copied, setCopied] = useState(false);
  const [themeKey, setThemeKey] = useState(() => (
    typeof document !== 'undefined' ? (document.documentElement.getAttribute('data-theme') || 'light') : 'light'
  ));

  const code = useMemo(() => decodeHtmlEntities(content || '').trim(), [content]);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return undefined;
    const observer = new MutationObserver(() => {
      setThemeKey(document.documentElement.getAttribute('data-theme') || 'light');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!code || showSource) return undefined;
    let cancelled = false;
    setError(false);

    const isDark = themeKey === 'dark';
    const renderId = `mmd-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}-${Date.now()}`;

    loadMermaid()
      .then(async (mermaid) => {
        if (cancelled) return;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: isDark ? 'dark' : 'base',
          themeVariables: isDark
            ? {
                primaryColor: '#2e1d13',
                primaryTextColor: '#faf4ef',
                primaryBorderColor: '#ff8547',
                lineColor: '#c7b8ab',
                secondaryColor: '#241e1a',
                tertiaryColor: '#1e1916',
                fontFamily: 'Inter, system-ui, sans-serif',
              }
            : {
                primaryColor: '#fff1e8',
                primaryTextColor: '#1f1916',
                primaryBorderColor: '#d94e1f',
                lineColor: '#66574d',
                secondaryColor: '#f5ece4',
                tertiaryColor: '#ffffff',
                fontFamily: 'Inter, system-ui, sans-serif',
              },
        });
        const { svg: renderedSvg } = await mermaid.render(renderId, code);
        if (!cancelled) setSvg(renderedSvg);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setSvg('');
        }
      });

    return () => { cancelled = true; };
  }, [code, themeKey, showSource, reactId]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="code-viewer rt-code-block rt-mermaid-block">
      <div className="code-toolbar">
        <span>mermaid</span>
        <div className="rt-mermaid-actions">
          <button
            type="button"
            className={`icon-btn ${showSource ? 'is-active' : ''}`}
            onClick={() => setShowSource((v) => !v)}
            aria-label={showSource ? 'Show diagram' : 'Show Mermaid source'}
            title={showSource ? 'Show diagram' : 'Show Mermaid source'}
          >
            {showSource ? <Workflow size={15} aria-hidden="true" /> : <Code2 size={15} aria-hidden="true" />}
          </button>
          <button type="button" className="icon-btn" onClick={copy} aria-label="Copy code" title="Copy code">
            {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {showSource || error ? (
        <pre><code>{code}</code></pre>
      ) : svg ? (
        <div className="rt-mermaid-canvas" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="rt-mermaid-loading">Rendering diagram...</div>
      )}
    </div>
  );
}

function CodeBlock({ language, content }) {
  const [copied, setCopied] = useState(false);
  const displayContent = /^(html|xml|svg)$/i.test(language || '')
    ? content
    : decodeHtmlEntities(content);

  async function copy() {
    try {
      await navigator.clipboard.writeText(displayContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="code-viewer rt-code-block">
      <div className="code-toolbar">
        <span>{language}</span>
        <button type="button" className="icon-btn" onClick={copy} aria-label="Copy code" title="Copy code">
          {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
        </button>
      </div>
      <pre><code>{displayContent}</code></pre>
    </div>
  );
}

export function RichTextInterpreter({ content, format = 'markdown', sourceUrl, onOpenLink }) {
  const [rawMode, setRawMode] = useState(false);
  const blocks = useMemo(
    () => parseRichBlocks(content, format === 'text'),
    [content, format],
  );
  const inlineOpts = { sourceUrl, onOpenLink };

  return (
    <div className="rich-text-shell">
      <div className="rt-mode-bar">
        <span className="rt-format-tag">{format.toUpperCase()}</span>
        <div className="segmented-tabs" role="group" aria-label="Document view mode">
          <button type="button" aria-pressed={!rawMode} onClick={() => setRawMode(false)}>Formatted</button>
          <button type="button" aria-pressed={rawMode} onClick={() => setRawMode(true)}>Raw</button>
        </div>
      </div>

      {rawMode ? (
        <div className="code-viewer">
          <pre><code>{content}</code></pre>
        </div>
      ) : (
        <article className="rt-document">
          {blocks.map((block, index) => {
            const key = `b-${index}`;
            if (block.type === 'heading') {
              const Tag = `h${Math.min(6, Math.max(2, block.level + 1))}`;
              return <Tag key={key} className={`rt-h rt-h${block.level}`}>{renderInline(block.text, { ...inlineOpts, keyPrefix: key })}</Tag>;
            }
            if (block.type === 'image') {
              const resolved = resolveResourceUrl(decodeHtmlEntities(block.src), sourceUrl, true);
              return resolved ? <img key={key} src={resolved} alt={decodeHtmlEntities(block.alt)} className="rt-image" loading="lazy" /> : null;
            }
            if (block.type === 'code') {
              if (/^mermaid$/i.test(block.language || '')) {
                return <MermaidBlock key={key} content={block.content} />;
              }
              return <CodeBlock key={key} language={block.language} content={block.content} />;
            }
            if (block.type === 'math') {
              return <MathView key={key} tex={block.content} display />;
            }
            if (block.type === 'quote') {
              return <blockquote key={key} className="rt-quote">{renderInline(block.text, { ...inlineOpts, keyPrefix: key })}</blockquote>;
            }
            if (block.type === 'hr') {
              return <hr key={key} className="rt-hr" />;
            }
            if (block.type === 'ul' || block.type === 'ol') {
              return (
                <React.Fragment key={key}>
                  {renderListNode(
                    { ordered: block.type === 'ol', items: block.items },
                    { ...inlineOpts, keyPrefix: key },
                  )}
                </React.Fragment>
              );
            }
            if (block.type === 'table') {
              return (
                <div key={key} className="rt-table-wrap">
                  <table className="rt-table">
                    <thead>
                      <tr>{block.headers.map((h, j) => <th key={j}>{renderInline(h, { ...inlineOpts, keyPrefix: `${key}-h-${j}` })}</th>)}</tr>
                    </thead>
                    <tbody>
                      {block.rows.map((row, r) => (
                        <tr key={r}>{row.map((cell, c) => <td key={c}>{renderInline(cell, { ...inlineOpts, keyPrefix: `${key}-${r}-${c}` })}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            }
            return <p key={key} className="rt-p">{renderInline(block.text, { ...inlineOpts, keyPrefix: key })}</p>;
          })}
        </article>
      )}
    </div>
  );
}
