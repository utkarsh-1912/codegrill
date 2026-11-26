import React, { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';

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
    // Relative URL — resolve against sourceUrl (especially GitHub blob/raw URLs)
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
    const label = decodeHtmlEntities(inner.replace(/<[^>]+>/g, '').trim()) || href;
    return `[${label}](${href})`;
  });
  // Convert simple inline formatting HTML tags
  out = out
    .replace(/<(?:strong|b)\b[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**')
    .replace(/<(?:em|i)\b[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*')
    .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?(?:p|div|span|center|details|summary|sup|sub|small|font|picture|source)\b[^>]*>/gi, '');
  return out;
}

// Parse inline markdown: ![alt](img), `code`, **bold**, *italic*, ~~strike~~, [label](url)
function renderInline(text, { sourceUrl, onOpenLink, keyPrefix = 'in' } = {}) {
  const prepared = preprocessHtmlToMarkdown(text);
  if (!prepared) return null;
  const tokens = [];
  const pattern = /(!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*\n]+\*|_[^_\n]+_|\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\))/g;
  let lastIndex = 0;
  let match;
  let idx = 0;

  while ((match = pattern.exec(prepared)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(decodeHtmlEntities(prepared.slice(lastIndex, match.index)));
    }
    const token = match[0];
    const key = `${keyPrefix}-${idx++}`;

    if (token.startsWith('![')) {
      const alt = decodeHtmlEntities(match[2] || '');
      const src = resolveResourceUrl(decodeHtmlEntities(match[3]), sourceUrl, true);
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
    } else if (token.startsWith('`')) {
      tokens.push(<code key={key} className="rt-inline-code">{decodeHtmlEntities(token.slice(1, -1))}</code>);
    } else if (token.startsWith('**') || token.startsWith('__')) {
      tokens.push(<strong key={key}>{renderInline(token.slice(2, -2), { sourceUrl, onOpenLink, keyPrefix: key })}</strong>);
    } else if (token.startsWith('~~')) {
      tokens.push(<del key={key}>{renderInline(token.slice(2, -2), { sourceUrl, onOpenLink, keyPrefix: key })}</del>);
    } else if (token.startsWith('*') || token.startsWith('_')) {
      tokens.push(<em key={key}>{renderInline(token.slice(1, -1), { sourceUrl, onOpenLink, keyPrefix: key })}</em>);
    } else if (token.startsWith('[')) {
      const label = decodeHtmlEntities(match[4]);
      const resolved = resolveResourceUrl(decodeHtmlEntities(match[5]), sourceUrl, false);
      if (resolved && onOpenLink && isInAppLink(resolved)) {
        tokens.push(
          <a
            key={key}
            href={resolved}
            className="rt-link"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              e.preventDefault();
              onOpenLink(resolved, label);
            }}
          >
            {label}
          </a>,
        );
      } else if (resolved) {
        tokens.push(
          <a key={key} href={resolved} target="_blank" rel="noopener noreferrer" className="rt-link">
            {label}
          </a>,
        );
      } else {
        tokens.push(<span key={key} className="rt-link-muted">{label}</span>);
      }
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < prepared.length) {
    tokens.push(decodeHtmlEntities(prepared.slice(lastIndex)));
  }
  return tokens;
}

function parseRichBlocks(rawText, isPlainText = false) {
  const normalized = String(rawText || '').replace(/\r\n?/g, '\n');
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
        if (last?.type === 'ul') last.items.push(trimmed.replace(/^[-*•]\s+/, ''));
        else blocks.push({ type: 'ul', items: [trimmed.replace(/^[-*•]\s+/, '')] });
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

    // Fenced code block ```lang
    const fenceMatch = /^```([a-zA-Z0-9_+#.-]*)\s*$/.exec(trimmed);
    if (fenceMatch) {
      const lang = fenceMatch[1] || 'text';
      const codeLines = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i].trim())) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({ type: 'code', language: lang, content: codeLines.join('\n') });
      continue;
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

    // Unordered list
    if (/^[-*+]\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].trim().replace(/^[-*+]\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // Paragraph (preserve HTML <img> and <a> via preprocessHtmlToMarkdown)
    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,6}\s|```|>|[-*+]\s|\d+\.\s|---|\*\*\*|___)/i.test(lines[i].trim())
    ) {
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
              return <CodeBlock key={key} language={block.language} content={block.content} />;
            }
            if (block.type === 'quote') {
              return <blockquote key={key} className="rt-quote">{renderInline(block.text, { ...inlineOpts, keyPrefix: key })}</blockquote>;
            }
            if (block.type === 'hr') {
              return <hr key={key} className="rt-hr" />;
            }
            if (block.type === 'ul') {
              return (
                <ul key={key} className="rt-list">
                  {block.items.map((item, j) => <li key={`${key}-${j}`}>{renderInline(item, { ...inlineOpts, keyPrefix: `${key}-${j}` })}</li>)}
                </ul>
              );
            }
            if (block.type === 'ol') {
              return (
                <ol key={key} className="rt-list">
                  {block.items.map((item, j) => <li key={`${key}-${j}`}>{renderInline(item, { ...inlineOpts, keyPrefix: `${key}-${j}` })}</li>)}
                </ol>
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
