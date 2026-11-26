import React, { useEffect, useState } from 'react';
import { Button } from '@utkristi/ui';
import { Check, ChevronLeft, ChevronRight, Copy, Download, RotateCw, Shuffle } from 'lucide-react';
import { RichTextInterpreter, decodeHtmlEntities } from './RichTextInterpreter.jsx';

function formatOutputText(val) {
  if (Array.isArray(val)) return val.join('');
  return String(val ?? '');
}

function NotebookCodeCell({ cell, language }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(cell.source || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="nb-cell nb-code-cell">
      <div className="code-viewer">
        <div className="code-toolbar">
          <span>In [{cell.execution_count ?? ' '}] · {language}</span>
          <button type="button" className="icon-btn" onClick={copy} aria-label="Copy cell" title="Copy cell">
            {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          </button>
        </div>
        <pre><code>{cell.source}</code></pre>
      </div>

      {cell.outputs?.length > 0 && (
        <div className="nb-outputs">
          {cell.outputs.map((out, idx) => {
            const imgPng = out.data?.['image/png'];
            const imgJpg = out.data?.['image/jpeg'];
            if (imgPng || imgJpg) {
              const mime = imgPng ? 'image/png' : 'image/jpeg';
              const b64 = formatOutputText(imgPng || imgJpg).replace(/\s+/g, '');
              return (
                <div key={idx} className="nb-output-img">
                  <img src={`data:${mime};base64,${b64}`} alt="Notebook cell output" loading="lazy" />
                </div>
              );
            }
            if (out.output_type === 'error') {
              const errText = `${out.ename || 'Error'}: ${out.evalue || ''}`;
              return <pre key={idx} className="nb-output-error"><code>{errText}</code></pre>;
            }
            const text = out.text
              ? formatOutputText(out.text)
              : out.data?.['text/plain']
                ? formatOutputText(out.data['text/plain'])
                : '';
            if (!text.trim()) return null;
            return <pre key={idx} className="nb-output-text"><code>{text}</code></pre>;
          })}
        </div>
      )}
    </div>
  );
}

export function NotebookViewer({ cells = [], language = 'python', sourceUrl, onOpenLink }) {
  return (
    <div className="nb-viewer">
      {cells.map((cell, idx) => {
        if (cell.cell_type === 'markdown') {
          return (
            <div key={idx} className="nb-cell nb-md-cell">
              <RichTextInterpreter
                content={cell.source}
                format="markdown"
                sourceUrl={sourceUrl}
                onOpenLink={onOpenLink}
              />
            </div>
          );
        }
        if (cell.cell_type === 'raw') {
          return (
            <div key={idx} className="nb-cell nb-raw-cell">
              <pre><code>{cell.source}</code></pre>
            </div>
          );
        }
        return <NotebookCodeCell key={idx} cell={cell} language={language} />;
      })}
    </div>
  );
}

function cleanAnkiField(html) {
  return decodeHtmlEntities(
    String(html || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:div|p|li|tr|h[1-6])>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  );
}

let ankiDepsPromise = null;
function loadAnkiDeps() {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (!ankiDepsPromise) {
    ankiDepsPromise = Promise.all([
      import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm').then((m) => m.default || m),
      import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/sql.js@1.10.3/+esm').then(async (m) => {
        const initSqlJs = m.default || m;
        return initSqlJs({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/${file}`,
        });
      }),
    ]);
  }
  return ankiDepsPromise;
}

export function AnkiDeckViewer({ title, downloadUrl }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (!downloadUrl) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    setCards([]);
    setIndex(0);
    setFlipped(false);

    (async () => {
      try {
        const [JSZip, SQL] = await loadAnkiDeps();
        const res = await fetch(downloadUrl, { signal: AbortSignal.timeout(15000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        const zip = await JSZip.loadAsync(buf);
        const dbEntry = zip.file('collection.anki21') || zip.file('collection.anki2');
        if (!dbEntry) {
          throw new Error('This .apkg uses an Anki format that requires opening in the Anki desktop/mobile app.');
        }
        const dbBytes = await dbEntry.async('uint8array');
        const db = new SQL.Database(dbBytes);
        const queryRes = db.exec('SELECT flds FROM notes LIMIT 300');
        db.close();

        const rows = queryRes?.[0]?.values || [];
        const parsed = rows
          .map(([flds]) => {
            const parts = String(flds || '').split('\x1f');
            const front = cleanAnkiField(parts[0] || '');
            const back = cleanAnkiField(parts.slice(1).join('\n\n') || '');
            return front ? { front, back: back || front } : null;
          })
          .filter(Boolean);

        if (!cancelled) {
          if (!parsed.length) setError('No readable flashcards found in this deck.');
          else setCards(parsed);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Could not parse .apkg deck in browser.');
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [downloadUrl]);

  function shuffleDeck() {
    setCards((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    });
    setIndex(0);
    setFlipped(false);
  }

  if (loading) {
    return (
      <div className="apkg-shell">
        <p className="rt-mermaid-loading">Unpacking Anki deck ({title})...</p>
      </div>
    );
  }

  if (error || !cards.length) {
    return (
      <div className="apkg-shell apkg-fallback">
        <p>{error || 'Download this Anki deck to study in Anki.'}</p>
        {downloadUrl && (
          <Button variant="solid" size="sm" href={downloadUrl} target="_blank" rel="noopener noreferrer">
            <Download size={14} aria-hidden="true" /> Download {title || '.apkg'}
          </Button>
        )}
      </div>
    );
  }

  const card = cards[index];

  return (
    <div className="apkg-shell">
      <div className="apkg-toolbar">
        <span className="apkg-counter">
          Card {index + 1} / {cards.length} · {flipped ? 'Answer' : 'Question'}
        </span>
        <div className="apkg-toolbar-actions">
          <button type="button" className="icon-btn" onClick={shuffleDeck} aria-label="Shuffle deck" title="Shuffle deck">
            <Shuffle size={15} aria-hidden="true" />
          </button>
          {downloadUrl && (
            <Button variant="outlined" size="sm" href={downloadUrl} target="_blank" rel="noopener noreferrer">
              <Download size={14} aria-hidden="true" /> .apkg
            </Button>
          )}
        </div>
      </div>

      <button
        type="button"
        className={`apkg-card ${flipped ? 'is-flipped' : ''}`}
        onClick={() => setFlipped((f) => !f)}
      >
        <span className="apkg-card-side">{flipped ? 'BACK' : 'FRONT'}</span>
        <div className="apkg-card-body">{flipped ? card.back : card.front}</div>
        <span className="apkg-flip-hint">
          <RotateCw size={12} aria-hidden="true" /> Click card to flip
        </span>
      </button>

      <div className="apkg-nav">
        <Button
          variant="outlined"
          size="sm"
          disabled={index === 0}
          onClick={() => { setIndex((i) => Math.max(0, i - 1)); setFlipped(false); }}
        >
          <ChevronLeft size={15} aria-hidden="true" /> Previous
        </Button>
        <Button variant="quiet" size="sm" onClick={() => setFlipped((f) => !f)}>
          <RotateCw size={14} aria-hidden="true" /> Flip
        </Button>
        <Button
          variant="solid"
          size="sm"
          disabled={index >= cards.length - 1}
          onClick={() => { setIndex((i) => Math.min(cards.length - 1, i + 1)); setFlipped(false); }}
        >
          Next <ChevronRight size={15} aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
