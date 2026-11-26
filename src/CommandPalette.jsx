import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Badge } from '@utkristi/ui';
import { Search, X } from 'lucide-react';
import { DOMAIN_TOPICS, ROADMAP_DOMAINS } from './domainRoadmaps.mjs';
import { getMessages } from './i18n.mjs';

const SEARCH_SCOPES = [
  { id: 'all', label: 'All' },
  { id: 'system-design', label: 'System Design' },
  { id: 'lld', label: 'LLD' },
  { id: 'databases', label: 'SQL & DB' },
  { id: 'concurrency', label: 'OS & Concurrency' },
  { id: 'ai-behavioral', label: 'AI & Behavioral' },
  { id: 'dsa', label: 'DSA & Sheets' },
];

export function CommandPalette({
  open,
  onClose,
  problems,
  categories,
  sheets,
  modules = [],
  locale,
  defaultLocale,
  onSelect,
}) {
  const t = getMessages(locale);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('all');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setScope('all');
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const domainMap = useMemo(
    () => new Map(ROADMAP_DOMAINS.map((d) => [d.id, d.labels[locale] || d.labels.en])),
    [locale],
  );

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();

    // 1. Non-DSA Domain Topics (System Design, LLD, SQL & Databases, Concurrency & OS, AI & Behavioral)
    const matchedDomainTopics = [];
    for (const [domainId, list] of Object.entries(DOMAIN_TOPICS)) {
      if (scope !== 'all' && scope !== domainId) continue;
      const domLabel = domainMap.get(domainId) || domainId;
      for (const topic of list) {
        const hay = [
          topic.title,
          topic.summary,
          domLabel,
          ...(topic.checklist || []),
          ...(topic.interviewPrompts || []),
        ].join(' ').toLowerCase();
        if (!needle || hay.includes(needle)) {
          matchedDomainTopics.push({
            kind: 'domain-topic',
            domainId,
            id: topic.id,
            label: topic.title,
            meta: domLabel,
          });
        }
      }
    }

    // 2. Interview Track Modules (System Design, AI Engineer, FDE)
    const matchedModules = (scope === 'all' || scope === 'system-design' || scope === 'ai-behavioral')
      ? modules
          .filter((m) => {
            const title = m.titles?.[locale] || m.titles?.[defaultLocale] || '';
            return !needle || title.toLowerCase().includes(needle) || String(m.id).toLowerCase().includes(needle);
          })
          .slice(0, needle ? 6 : 3)
          .map((m) => ({
            kind: 'module',
            id: m.id,
            label: m.titles?.[locale] || m.titles?.[defaultLocale] || m.id,
            meta: t.nav.tracks,
          }))
      : [];

    // 3. DSA Problems, Topics & Sheets
    const includeDsa = scope === 'all' || scope === 'dsa';
    const matchedSheets = includeDsa
      ? sheets
          .filter((s) => !needle || Object.values(s.names || {}).some((n) => n.toLowerCase().includes(needle)))
          .slice(0, 4)
          .map((s) => ({
            kind: 'sheet',
            id: s.id,
            label: s.names[locale] ?? s.names[defaultLocale],
            meta: s.source,
          }))
      : [];

    const matchedTopics = includeDsa
      ? categories
          .filter((c) => !needle || Object.values(c.labels || {}).some((l) => l.toLowerCase().includes(needle)))
          .slice(0, 4)
          .map((c) => ({
            kind: 'topic',
            id: c.id,
            label: c.labels[locale] ?? c.labels[defaultLocale],
            meta: t.nav.roadmap,
          }))
      : [];

    const matchedProblems = includeDsa
      ? problems
          .filter((p) => !needle || (
            String(p.display_id || p.leetcode_id).toLowerCase().includes(needle) ||
            String(p.platform || 'leetcode').toLowerCase().includes(needle) ||
            p.slug.includes(needle) ||
            Object.values(p.translations).some((tr) => tr.title.toLowerCase().includes(needle))
          ))
          .slice(0, needle ? 8 : 5)
          .map((p) => ({
            kind: 'problem',
            id: p.slug,
            label: `${p.display_id || `#${p.leetcode_id}`} ${p.translations[locale]?.title || p.translations[defaultLocale].title}`,
            meta: p.difficulty,
          }))
      : [];

    if (scope !== 'all' && scope !== 'dsa') {
      return [...matchedDomainTopics.slice(0, 12), ...matchedModules];
    }

    // Balanced mix across System Design / LLD / SQL / OS / AI + DSA so all domains are visible immediately
    return [
      ...matchedDomainTopics.slice(0, needle ? 8 : 5),
      ...matchedModules,
      ...matchedProblems,
      ...matchedTopics,
      ...matchedSheets,
    ];
  }, [query, scope, problems, categories, sheets, modules, domainMap, locale, defaultLocale, t]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, scope]);

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
            type="text"
            role="searchbox"
            autoComplete="off"
            value={query}
            placeholder={t.palette.placeholder}
            aria-label={t.palette.placeholder}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t.viewer.close}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="palette-scope-tabs" role="tablist" aria-label="Search domain">
          {SEARCH_SCOPES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={scope === item.id}
              className={`palette-scope-tab ${scope === item.id ? 'is-active' : ''}`}
              onClick={() => setScope(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="palette-results" role="listbox">
          {results.map((item, idx) => (
            <button
              key={`${item.kind}:${item.domainId || ''}:${item.id}`}
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
