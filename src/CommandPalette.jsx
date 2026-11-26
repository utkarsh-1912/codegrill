import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Badge } from '@utkristi/ui';
import { Search, X } from 'lucide-react';
import { getMessages } from './i18n.mjs';

export function CommandPalette({ open, onClose, problems, categories, sheets, locale, defaultLocale, onSelect }) {
  const t = getMessages(locale);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

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
        String(p.display_id || p.leetcode_id).toLowerCase().includes(needle) ||
        String(p.platform || 'leetcode').toLowerCase().includes(needle) ||
        p.slug.includes(needle) ||
        Object.values(p.translations).some((tr) => tr.title.toLowerCase().includes(needle))
      ))
      .slice(0, 12)
      .map((p) => ({
        kind: 'problem',
        id: p.slug,
        label: `${p.display_id || `#${p.leetcode_id}`} ${p.translations[locale]?.title || p.translations[defaultLocale].title}`,
        meta: p.difficulty,
      }));

    return [...matchedProblems, ...matchedTopics, ...matchedSheets];
  }, [query, problems, categories, sheets, locale, defaultLocale, t]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown' && results.length > 0) {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % results.length);
      } else if (e.key === 'ArrowUp' && results.length > 0) {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + results.length) % results.length);
      } else if (e.key === 'Enter' && results[activeIndex]) {
        e.preventDefault();
        onSelect(results[activeIndex]);
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, onSelect, results, activeIndex]);

  if (!open) return null;

  return createPortal(
    <div
      className="viewer-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={t.palette.placeholder}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="viewer-panel palette-panel">
        <div className="palette-input-row">
          <Search size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            placeholder={t.palette.placeholder}
            aria-label={t.palette.placeholder}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t.viewer.close}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="palette-results" role="listbox">
          {results.map((item, idx) => (
            <button
              key={`${item.kind}:${item.id}`}
              type="button"
              role="option"
              aria-selected={idx === activeIndex}
              className={`palette-item ${idx === activeIndex ? 'is-focused' : ''}`}
              onMouseEnter={() => setActiveIndex(idx)}
              onClick={() => { onSelect(item); onClose(); }}
            >
              <span>{item.label}</span>
              <Badge variant="outlined">{item.meta}</Badge>
            </button>
          ))}
          {!results.length && <p className="viewer-loading">{t.problems.empty}</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
