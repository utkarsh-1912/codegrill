import React, { useMemo, useState } from 'react';
import { Badge, Button, Card } from '@utkristi/ui';
import { BookOpen, ChevronDown, FileCode2, Play, Plus, Search, Star, StickyNote, Trash2, X } from 'lucide-react';
import { buildWeeklyPlan, resolveSheetProblems } from './sheets.mjs';
import { resourcesFor } from './catalog.mjs';
import { getMessages } from './i18n.mjs';
import { formatViewerTitle } from './ContentViewer.jsx';
import { SelectDropdown } from './SelectDropdown.jsx';

export function SheetsPage({
  sheets,
  problems,
  categories,
  languages,
  plannerConfig,
  locale,
  defaultLocale,
  completed,
  bookmarked,
  notes,
  toggleComplete,
  toggleBookmark,
  saveNote,
  onOpenViewer,
  onCreateSheet,
  onDeleteSheet,
  onNavigate,
}) {
  const t = getMessages(locale);
  const [selectedId, setSelectedId] = useState(sheets[0]?.id || '');
  const [viewMode, setViewMode] = useState('topic'); // 'topic' | 'weekly'
  const [weeks, setWeeks] = useState(plannerConfig.defaultWeeks);
  const [hoursPerWeek, setHoursPerWeek] = useState(plannerConfig.defaultHours);
  const [difficulty, setDifficulty] = useState('');
  const [onlyRevision, setOnlyRevision] = useState(false);
  const [openNoteSlug, setOpenNoteSlug] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [builderOpen, setBuilderOpen] = useState(false);

  const activeSheet = sheets.find((s) => s.id === selectedId) || sheets[0];
  const sheetProblems = useMemo(
    () => resolveSheetProblems(activeSheet, problems),
    [activeSheet, problems],
  );

  const filteredProblems = useMemo(
    () => sheetProblems.filter((p) => (
      (!difficulty || p.difficulty === difficulty) &&
      (!onlyRevision || bookmarked.has(p.slug))
    )),
    [sheetProblems, difficulty, onlyRevision, bookmarked],
  );

  const solvedInSheet = sheetProblems.filter((p) => completed.has(p.slug)).length;
  const pct = sheetProblems.length ? Math.round((solvedInSheet / sheetProblems.length) * 100) : 0;

  const groupedByTopic = useMemo(() => {
    const byCat = new Map();
    for (const p of filteredProblems) {
      if (!byCat.has(p.category_id)) byCat.set(p.category_id, []);
      byCat.get(p.category_id).push(p);
    }
    return categories
      .filter((c) => byCat.has(c.id))
      .map((c) => ({ category: c, items: byCat.get(c.id) }));
  }, [filteredProblems, categories]);

  const weeklyPlan = useMemo(
    () => buildWeeklyPlan(filteredProblems, weeks, hoursPerWeek, plannerConfig.difficultyMinutes),
    [filteredProblems, weeks, hoursPerWeek, plannerConfig.difficultyMinutes],
  );

  const pickLabel = (labels) => labels?.[locale] ?? labels?.[defaultLocale] ?? '';

  function openFirstVideo(problem) {
    const links = resourcesFor(problem.resources, locale, defaultLocale);
    const video = links.find((l) => l.kind === 'video');
    if (!video) return;
    const title = problem.translations[locale]?.title || problem.translations[defaultLocale].title;
    onOpenViewer({ url: video.url, title: formatViewerTitle(title, video.title), kind: 'video', problemTitle: title, problemSlug: problem.slug });
  }

  function openFirstArticle(problem) {
    const links = resourcesFor(problem.resources, locale, defaultLocale);
    const article = links.find((l) => l.kind === 'article');
    if (!article) return;
    const title = problem.translations[locale]?.title || problem.translations[defaultLocale].title;
    onOpenViewer({ url: article.url, title: formatViewerTitle(title, article.title), kind: 'article', problemTitle: title, problemSlug: problem.slug });
  }

  function openCode(problem) {
    const preferredOrder = ['python', 'cpp', 'java', 'javascript', 'typescript', 'go'];
    const langId = preferredOrder.find((id) => problem.solutions?.[id]) || Object.keys(problem.solutions || {})[0];
    if (!langId) return;
    const title = problem.translations[locale]?.title || problem.translations[defaultLocale].title;
    onOpenViewer({
      url: problem.solutions[langId],
      title: `${title} — ${languages[langId] || langId}`,
      kind: 'code',
      solutionLang: langId,
      solutions: problem.solutions,
      problemTitle: title,
      problemSlug: problem.slug,
    });
  }

  function renderProblemRow(problem) {
    const titleLocale = problem.translations[locale] ? locale : defaultLocale;
    const name = problem.translations[titleLocale].title;
    const isSolved = completed.has(problem.slug);
    const isStarred = bookmarked.has(problem.slug);
    const hasNote = Boolean(notes[problem.slug]);
    const links = resourcesFor(problem.resources, locale, defaultLocale);
    const hasVideo = links.some((l) => l.kind === 'video');
    const hasArticle = links.some((l) => l.kind === 'article');
    const hasCode = Object.keys(problem.solutions || {}).length > 0;
    const isNoteOpen = openNoteSlug === problem.slug;

    return (
      <div key={problem.slug} className={`sheet-problem-row ${isSolved ? 'is-solved' : ''}`}>
        <div className="sheet-problem-main">
          <label className="completion">
            <input
              type="checkbox"
              checked={isSolved}
              onChange={() => toggleComplete(problem.slug)}
              aria-label={`${t.problems.markSolved}: ${name}`}
            />
          </label>
          <span className="problem-number">#{problem.leetcode_id}</span>
          <a
            className="sheet-problem-title"
            href={`/problems?${new URLSearchParams({ problem: problem.slug })}`}
            lang={titleLocale}
            onClick={(e) => {
              if (!onNavigate || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              e.preventDefault();
              onNavigate(`/problems?${new URLSearchParams({ problem: problem.slug })}`);
            }}
          >
            {name}
          </a>
          <Badge tone={{ Easy: 'ok', Medium: 'warn', Hard: 'bad' }[problem.difficulty]}>
            {t.sheets[problem.difficulty.toLowerCase()] || problem.difficulty}
          </Badge>
          <div className="row-icon-actions">
            {hasVideo && (
              <button type="button" className="icon-btn" onClick={() => openFirstVideo(problem)}
                aria-label={t.problems.watchVideo} title={t.problems.watchVideo}>
                <Play size={16} aria-hidden="true" />
              </button>
            )}
            {hasCode && (
              <button type="button" className="icon-btn" onClick={() => openCode(problem)}
                aria-label={t.problems.readSolution} title={t.problems.readSolution}>
                <FileCode2 size={16} aria-hidden="true" />
              </button>
            )}
            {hasArticle && (
              <button type="button" className="icon-btn" onClick={() => openFirstArticle(problem)}
                aria-label={t.problems.readArticle} title={t.problems.readArticle}>
                <BookOpen size={16} aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              className={`icon-btn ${isStarred ? 'is-active' : ''}`}
              onClick={() => toggleBookmark(problem.slug)}
              aria-pressed={isStarred}
              aria-label={isStarred ? t.problems.unbookmark : t.problems.bookmark}
              title={isStarred ? t.problems.unbookmark : t.problems.bookmark}
            >
              <Star size={16} fill={isStarred ? 'currentColor' : 'none'} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`icon-btn ${hasNote || isNoteOpen ? 'is-active' : ''}`}
              onClick={() => {
                if (isNoteOpen) {
                  setOpenNoteSlug('');
                } else {
                  setOpenNoteSlug(problem.slug);
                  setNoteDraft(notes[problem.slug] || '');
                }
              }}
              aria-expanded={isNoteOpen}
              aria-label={t.problems.notes}
              title={t.problems.notes}
            >
              <StickyNote size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
        {isNoteOpen && (
          <div className="inline-note-box">
            <textarea
              rows={3}
              value={noteDraft}
              placeholder={t.problems.notesPlaceholder}
              onChange={(e) => setNoteDraft(e.target.value)}
            />
            <div className="inline-note-actions">
              <Button variant="solid" size="sm" onClick={() => {
                saveNote(problem.slug, noteDraft);
                setOpenNoteSlug('');
              }}>{t.problems.saveNote}</Button>
              <Button variant="quiet" size="sm" onClick={() => setOpenNoteSlug('')}>{t.sheets.cancel}</Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="page-section sheets-page">
      <div className="section-heading">
        <div>
          <h1 lang={locale}>{t.sheets.title}</h1>
          <p>{t.sheets.subtitle}</p>
        </div>
        <Button variant="solid" onClick={() => setBuilderOpen(true)}>
          <Plus size={16} aria-hidden="true" /> {t.sheets.createSeries}
        </Button>
      </div>

      <div className="sheet-cards-grid" role="tablist" aria-label={t.sheets.title}>
        {sheets.map((sheet) => {
          const list = resolveSheetProblems(sheet, problems);
          const done = list.filter((p) => completed.has(p.slug)).length;
          const active = sheet.id === activeSheet?.id;
          return (
            <button
              key={sheet.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`sheet-selector-card ${active ? 'is-selected' : ''}`}
              onClick={() => setSelectedId(sheet.id)}
            >
              <div className="sheet-card-top">
                <span className="sheet-source">{sheet.source}</span>
                <span className="sheet-count">{done}/{list.length}</span>
              </div>
              <strong lang={locale}>{pickLabel(sheet.names)}</strong>
              <progress value={done} max={Math.max(1, list.length)} />
            </button>
          );
        })}
      </div>

      {activeSheet && (
        <Card variant="outlined" className="active-sheet-header">
          <div className="active-sheet-meta">
            <div>
              <span className="sheet-source">{activeSheet.source}</span>
              <h2 lang={locale}>{pickLabel(activeSheet.names)}</h2>
              <p>{pickLabel(activeSheet.descriptions)}</p>
            </div>
            <div className="active-sheet-stats">
              <strong>{solvedInSheet}<small> / {sheetProblems.length}</small></strong>
              <span>{pct}%</span>
              {activeSheet.custom && (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={t.sheets.deleteSeries}
                  title={t.sheets.deleteSeries}
                  onClick={() => {
                    onDeleteSheet(activeSheet.id);
                    setSelectedId(sheets.find((s) => s.id !== activeSheet.id)?.id || '');
                  }}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
          <progress value={solvedInSheet} max={Math.max(1, sheetProblems.length)} />

          <div className="sheet-toolbar">
            <div className="segmented-tabs" role="group">
              <button type="button" aria-pressed={viewMode === 'topic'} onClick={() => setViewMode('topic')}>
                {t.sheets.viewByTopic}
              </button>
              <button type="button" aria-pressed={viewMode === 'weekly'} onClick={() => setViewMode('weekly')}>
                {t.sheets.viewByWeek}
              </button>
            </div>

            <div className="sheet-filters">
              <SelectDropdown
                compact
                ariaLabel={t.problems.allDifficulties}
                value={difficulty}
                onChange={setDifficulty}
                options={[
                  { value: '', label: t.problems.allDifficulties },
                  { value: 'Easy', label: t.sheets.easy },
                  { value: 'Medium', label: t.sheets.medium },
                  { value: 'Hard', label: t.sheets.hard },
                ]}
              />
              <button
                type="button"
                className={`pill-toggle ${onlyRevision ? 'is-active' : ''}`}
                aria-pressed={onlyRevision}
                onClick={() => setOnlyRevision((v) => !v)}
              >
                {t.sheets.revisionOnly}
              </button>
            </div>
          </div>

          {viewMode === 'weekly' && (
            <div className="planner-controls">
              <label>
                <span>{t.sheets.weeksLabel}: <strong>{weeks}</strong></span>
                <input type="range" min={plannerConfig.minWeeks} max={plannerConfig.maxWeeks} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} />
              </label>
              <label>
                <span>{t.sheets.hoursLabel}: <strong>{hoursPerWeek}h</strong></span>
                <input type="range" min={plannerConfig.minHours} max={plannerConfig.maxHours} value={hoursPerWeek} onChange={(e) => setHoursPerWeek(Number(e.target.value))} />
              </label>
            </div>
          )}
        </Card>
      )}

      {viewMode === 'topic' ? (
        <div className="sheet-accordions">
          {groupedByTopic.map(({ category, items }, idx) => {
            const done = items.filter((p) => completed.has(p.slug)).length;
            return (
              <details key={category.id} className="sheet-module" open={idx < 2}>
                <summary className="sheet-module-summary">
                  <span className="sheet-module-title" lang={locale}>{pickLabel(category.labels)}</span>
                  <span className="sheet-module-progress">{done}/{items.length}</span>
                  <ChevronDown size={16} aria-hidden="true" />
                </summary>
                <div className="sheet-module-list">
                  {items.map(renderProblemRow)}
                </div>
              </details>
            );
          })}
          {!groupedByTopic.length && <p className="library-empty">{t.problems.empty}</p>}
        </div>
      ) : (
        <div className="sheet-accordions">
          {weeklyPlan.map((bucket, idx) => {
            const done = bucket.problems.filter((p) => completed.has(p.slug)).length;
            const hrs = (bucket.estimatedMinutes / 60).toFixed(1);
            return (
              <details key={bucket.week} className="sheet-module" open={idx === 0}>
                <summary className="sheet-module-summary">
                  <span className="sheet-module-title">{t.sheets.weekHeading} {bucket.week}</span>
                  <span className="sheet-module-progress">~{hrs}h · {done}/{bucket.problems.length}</span>
                  <ChevronDown size={16} aria-hidden="true" />
                </summary>
                <div className="sheet-module-list">
                  {bucket.problems.map(renderProblemRow)}
                </div>
              </details>
            );
          })}
          {!weeklyPlan.length && <p className="library-empty">{t.problems.empty}</p>}
        </div>
      )}

      {builderOpen && (
        <CustomSeriesModal
          problems={problems}
          categories={categories}
          locale={locale}
          defaultLocale={defaultLocale}
          onClose={() => setBuilderOpen(false)}
          onSave={async (payload) => {
            const created = await onCreateSheet(payload);
            if (created?.id) setSelectedId(created.id);
            setBuilderOpen(false);
          }}
        />
      )}
    </section>
  );
}

function CustomSeriesModal({ problems, categories, locale, defaultLocale, onClose, onSave }) {
  const t = getMessages(locale);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [search, setSearch] = useState('');
  const [topicFilter, setTopicFilter] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [error, setError] = useState('');

  const filtered = problems.filter((p) => {
    if (topicFilter && p.category_id !== topicFilter) return false;
    if (!search.trim()) return true;
    const needle = search.trim().toLowerCase();
    return (
      String(p.leetcode_id).includes(needle) ||
      p.slug.includes(needle) ||
      Object.values(p.translations).some((tr) => tr.title.toLowerCase().includes(needle))
    );
  });

  function toggleSlug(slug) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!name.trim() || selected.size === 0) {
      setError(`${t.sheets.seriesName} & ${t.sheets.selectProblems}`);
      return;
    }
    await onSave({ name: name.trim(), description: description.trim(), slugs: [...selected] });
  }

  return (
    <div className="viewer-backdrop" role="dialog" aria-modal="true" aria-label={t.sheets.builderTitle}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="viewer-panel builder-panel" onSubmit={handleSubmit}>
        <div className="viewer-header">
          <h2>{t.sheets.builderTitle}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t.viewer.close}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="builder-body">
          <label className="builder-field">
            <span>{t.sheets.seriesName}</span>
            <input type="text" required value={name} placeholder={t.sheets.seriesNamePlaceholder}
              onChange={(e) => { setName(e.target.value); setError(''); }} />
          </label>
          <label className="builder-field">
            <span>{t.sheets.seriesDesc}</span>
            <input type="text" value={description} placeholder={t.sheets.seriesDescPlaceholder}
              onChange={(e) => setDescription(e.target.value)} />
          </label>

          <div className="builder-picker-bar">
            <label className="search-field">
              <Search size={16} aria-hidden="true" />
              <input type="search" value={search} placeholder={t.problems.searchPlaceholder}
                onChange={(e) => setSearch(e.target.value)} />
            </label>
            <SelectDropdown
              ariaLabel={t.problems.allTopics}
              value={topicFilter}
              onChange={setTopicFilter}
              options={[
                { value: '', label: t.problems.allTopics },
                ...categories.map((c) => ({ value: c.id, label: c.labels[locale] ?? c.labels[defaultLocale], lang: locale })),
              ]}
            />
          </div>

          <p className="result-count">{selected.size} {t.sheets.selectedCount}</p>

          <div className="builder-problem-list">
            {filtered.map((p) => {
              const title = p.translations[locale]?.title || p.translations[defaultLocale].title;
              return (
                <label key={p.slug} className="builder-problem-item">
                  <input type="checkbox" checked={selected.has(p.slug)} onChange={() => toggleSlug(p.slug)} />
                  <span className="problem-number">#{p.leetcode_id}</span>
                  <span>{title}</span>
                  <Badge tone={{ Easy: 'ok', Medium: 'warn', Hard: 'bad' }[p.difficulty]}>{p.difficulty}</Badge>
                </label>
              );
            })}
          </div>
          {error && <p className="builder-error" role="alert">{error}</p>}
        </div>

        <div className="viewer-footer builder-footer">
          <Button variant="quiet" type="button" onClick={onClose}>{t.sheets.cancel}</Button>
          <Button variant="solid" type="submit">{t.sheets.saveSeries}</Button>
        </div>
      </form>
    </div>
  );
}
