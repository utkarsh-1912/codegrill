import React, { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';

function isSafeHref(href) {
  try {
    const url = new URL(href);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

// Parse inline markdown: `code`, **bold**, *italic*, ~~strike~~, [label](url)
function renderInline(text, keyPrefix = 'in') {
  if (!text) return null;
  const tokens = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*\n]+\*|_[^_\n]+_|\[([^\]]+)\]\(([^)\s]+)\))/g;
  let lastIndex = 0;
  let match;
  let idx = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    const key = `${keyPrefix}-${idx++}`;

    if (token.startsWith('`')) {
      tokens.push(<code key={key} className="rt-inline-code">{token.slice(1, -1)}</code>);
    } else if (token.startsWith('**') || token.startsWith('__')) {
      tokens.push(<strong key={key}>{renderInline(token.slice(2, -2), key)}</strong>);
    } else if (token.startsWith('~~')) {
      tokens.push(<del key={key}>{renderInline(token.slice(2, -2), key)}</del>);
    } else if (token.startsWith('*') || token.startsWith('_')) {
      tokens.push(<em key={key}>{renderInline(token.slice(1, -1), key)}</em>);
    } else if (token.startsWith('[')) {
      const label = match[2];
      const href = match[3];
      if (isSafeHref(href)) {
        tokens.push(
          <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="rt-link">
            {label}
          </a>,
        );
      } else {
        tokens.push(<span key={key} className="rt-link-muted">{label}</span>);
      }
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
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

    // Paragraph (strip simple inline HTML tags safely if present in GitHub READMEs)
    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,6}\s|```|>|[-*+]\s|\d+\.\s|---|\*\*\*|___)/.test(lines[i].trim())
    ) {
      const cleaned = lines[i].replace(/<[^>]+>/g, '').trim();
      if (cleaned) paraLines.push(cleaned);
      i += 1;
    }
    if (paraLines.length) {
      blocks.push({ type: 'paragraph', text: paraLines.join(' ') });
    }
  }

  return blocks;
}

function CodeBlock({ language, content }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
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
      <pre><code>{content}</code></pre>
    </div>
  );
}

export function RichTextInterpreter({ content, format = 'markdown' }) {
  const [rawMode, setRawMode] = useState(false);
  const blocks = useMemo(
    () => parseRichBlocks(content, format === 'text'),
    [content, format],
  );

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
              return <Tag key={key} className={`rt-h rt-h${block.level}`}>{renderInline(block.text, key)}</Tag>;
            }
            if (block.type === 'code') {
              return <CodeBlock key={key} language={block.language} content={block.content} />;
            }
            if (block.type === 'quote') {
              return <blockquote key={key} className="rt-quote">{renderInline(block.text, key)}</blockquote>;
            }
            if (block.type === 'hr') {
              return <hr key={key} className="rt-hr" />;
            }
            if (block.type === 'ul') {
              return (
                <ul key={key} className="rt-list">
                  {block.items.map((item, j) => <li key={`${key}-${j}`}>{renderInline(item, `${key}-${j}`)}</li>)}
                </ul>
              );
            }
            if (block.type === 'ol') {
              return (
                <ol key={key} className="rt-list">
                  {block.items.map((item, j) => <li key={`${key}-${j}`}>{renderInline(item, `${key}-${j}`)}</li>)}
                </ol>
              );
            }
            if (block.type === 'table') {
              return (
                <div key={key} className="rt-table-wrap">
                  <table className="rt-table">
                    <thead>
                      <tr>{block.headers.map((h, j) => <th key={j}>{renderInline(h, `${key}-h-${j}`)}</th>)}</tr>
                    </thead>
                    <tbody>
                      {block.rows.map((row, r) => (
                        <tr key={r}>{row.map((cell, c) => <td key={c}>{renderInline(cell, `${key}-${r}-${c}`)}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            }
            return <p key={key} className="rt-p">{renderInline(block.text, key)}</p>;
          })}
        </article>
      )}
    </div>
  );
}
