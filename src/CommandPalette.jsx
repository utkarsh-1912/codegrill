import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@utkristi/ui';
import { Search, X } from 'lucide-react';
import { getMessages } from './i18n.mjs';

export function CommandPalette({ open, onClose, problems, categories, sheets, locale, defaultLocale, onSelect }) {
  const t = getMessages(locale);
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matchedSheets = sheets
      .filter((s) => !needle || Object.values(s.names || {}).some((n) => n.toLowerCase().includes(needle)))
      .slice(0, 4)
      .map((s) => ({
        kind: 'sheet',
        id: s.id,
        label: s.names[locale] ?? s.names[defaultLocale],
        meta: s.source,
      }));

    const matchedTopics = categories
      .filter((c) => !needle || Object.values(c.labels || {}).some((l) => l.toLowerCase().includes(needle)))
      .slice(0, 4)
      .map((c) => ({
        kind: 'topic',
        id: c.id,
        label: c.labels[locale] ?? c.labels[defaultLocale],
        meta: t.nav.roadmap,
      }));

    const matchedProblems = problems
      .filter((p) => !needle || (
        String(p.leetcode_id).includes(needle) ||
        p.slug.includes(needle) ||
        Object.values(p.translations).some((tr) => tr.title.toLowerCase().includes(needle))
      ))
      .slice(0, 10)
      .map((p) => ({
        kind: 'problem',
        id: p.slug,
        label: `#${p.leetcode_id} ${p.translations[locale]?.title || p.translations[defaultLocale].title}`,
        meta: p.difficulty,
      }));

    return [...matchedProblems, ...matchedTopics, ...matchedSheets];
  }, [query, problems, categories, sheets, locale, defaultLocale, t]);

  if (!open) return null;

  return (
    <div className="viewer-backdrop" role="dialog" aria-modal="true" aria-label={t.palette.placeholder}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="viewer-panel palette-panel">
        <div className="palette-input-row">
          <Search size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            placeholder={t.palette.placeholder}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t.viewer.close}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="palette-results">
          {results.map((item) => (
            <button
              key={`${item.kind}:${item.id}`}
              type="button"
              className="palette-item"
              onClick={() => { onSelect(item); onClose(); }}
            >
              <span>{item.label}</span>
              <Badge variant="outlined">{item.meta}</Badge>
            </button>
          ))}
          {!results.length && <p className="viewer-loading">{t.problems.empty}</p>}
        </div>
      </div>
    </div>
  );
}
