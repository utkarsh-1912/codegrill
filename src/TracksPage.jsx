import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card } from '@utkristi/ui';
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Code2,
  ExternalLink,
  FileText,
  HelpCircle,
  Play,
  Star,
  Users,
} from 'lucide-react';
import { resourcesFor } from './catalog.mjs';
import { buildViewerPath, formatViewerTitle } from './ContentViewer.jsx';
import { RichTextInterpreter } from './RichTextInterpreter.jsx';
import { SelectDropdown } from './SelectDropdown.jsx';
import { isContentFavorited, toggleFavoriteContent } from './favorites.mjs';
import { createDefaultRoomState, newRoomId, upsertSavedRoom, writeRoomState } from './rooms.mjs';
import { getMessages } from './i18n.mjs';

const ALLOCATION_COLORS = ['#ff693d', '#f59e0b', '#ea580c', '#fb923c', '#d97706', '#c2410c'];
const DONE_MODULES_KEY = 'codegrill:modules:v1';
const DONE_QUESTIONS_KEY = 'codegrill:track-questions:v1';

function readSet(key) {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || '[]'));
  } catch {
    return new Set();
  }
}

function writeSet(key, set) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    // Ignore storage quota errors
  }
}

export function TracksPage({
  locale,
  defaultLocale = 'en',
  title,
  roles = [],
  levels = [],
  modules = [],
  problems = [],
  onOpenViewer,
  onOpenProblem,
  onNavigate,
}) {
  const t = getMessages(locale);
  const pickLabel = (labels) => labels?.[locale] ?? labels?.[defaultLocale] ?? '';

  const [roleId, setRoleId] = useState(roles[0]?.id || '');
  const [levelId, setLevelId] = useState(levels[1]?.id || levels[0]?.id || '');
  const [trackFilter, setTrackFilter] = useState('');
  const [activeModuleIndex, setActiveModuleIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('guide'); // 'guide' | 'questions' | 'videos' | 'docs'
  const [doneModules, setDoneModules] = useState(() => readSet(DONE_MODULES_KEY));
  const [doneQuestions, setDoneQuestions] = useState(() => readSet(DONE_QUESTIONS_KEY));
  const [favVersion, setFavVersion] = useState(0);

  const role = roles.find(({ id }) => id === roleId) || roles[0];

  const roleModules = useMemo(
    () => modules.filter((item) => item.roles.includes(roleId) && item.levels.includes(levelId)),
    [modules, roleId, levelId],
  );

  const visible = useMemo(
    () => (trackFilter ? roleModules.filter((m) => m.track === trackFilter) : roleModules),
    [roleModules, trackFilter],
  );

  useEffect(() => {
    setTrackFilter('');
    setActiveModuleIndex(0);
  }, [roleId, levelId]);

  useEffect(() => {
    setActiveModuleIndex(0);
  }, [trackFilter]);

  const safeIndex = Math.min(activeModuleIndex, Math.max(0, visible.length - 1));
  const activeMod = visible[safeIndex] || null;
  const activeTitle = activeMod ? pickLabel(activeMod.titles) : '';
  const activeLinks = activeMod ? resourcesFor(activeMod.resources, locale, defaultLocale) : [];
  const activeVideos = activeLinks.filter((l) => l.kind === 'video');
  const activeDocs = activeLinks.filter((l) => l.kind !== 'video');
  const activeQuestions = activeMod?.questions || [];
  const relatedProblemObjs = useMemo(() => {
    if (!activeMod?.relatedProblems?.length) return [];
    const bySlug = new Map(problems.map((p) => [p.slug, p]));
    return activeMod.relatedProblems.map((slug) => bySlug.get(slug)).filter(Boolean);
  }, [activeMod, problems]);

  const prevMod = safeIndex > 0 ? visible[safeIndex - 1] : null;
  const nextMod = safeIndex < visible.length - 1 ? visible[safeIndex + 1] : null;
  const completedInTrack = roleModules.filter((m) => doneModules.has(m.id)).length;

  const trackLabel = (id) => t.tracks.labels[id] ?? id.replaceAll('_', ' ');
  const weightEntries = Object.entries(role?.module_weights_by_level?.[levelId] || {})
    .sort((a, b) => b[1] - a[1]);

  const guideUrl = activeMod ? `codegrill://track/${activeMod.id}` : '';
  const isGuideFav = useMemo(
    () => (guideUrl ? isContentFavorited({ url: guideUrl, title: activeTitle }) : false),
    [guideUrl, activeTitle, favVersion],
  );

  function toggleModuleDone(id) {
    setDoneModules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeSet(DONE_MODULES_KEY, next);
      return next;
    });
  }

  function toggleQuestionDone(qKey) {
    setDoneQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(qKey)) next.delete(qKey);
      else next.add(qKey);
      writeSet(DONE_QUESTIONS_KEY, next);
      return next;
    });
  }

  function toggleGuideFavorite() {
    if (!activeMod) return;
    toggleFavoriteContent({
      url: guideUrl,
      title: activeTitle,
      kind: 'markdown',
      inlineContent: activeMod.studyGuide,
      siteName: 'Codegrill Track Guide',
    });
    setFavVersion((v) => v + 1);
  }

  function launchMockRoomForModule(promptOverride = '') {
    if (!activeMod) return;
    const id = newRoomId();
    const mode = activeMod.roomMode || 'hld';
    const promptTitle = promptOverride || activeTitle;
    const initial = createDefaultRoomState(mode, {
      problemSlug: activeMod.relatedProblems?.[0] || '',
      promptTitle,
    });
    writeRoomState(id, initial);
    upsertSavedRoom({
      roomId: id,
      mode,
      title: promptTitle,
      problemSlug: activeMod.relatedProblems?.[0] || '',
    });
    onNavigate?.(`/rooms?room=${encodeURIComponent(id)}&mode=${encodeURIComponent(mode)}`);
  }

  return (
    <section className="page-section tracks-page">
      <div className="section-heading">
        <div>
          <h1 lang={locale}>{title}</h1>
          <p>{t.tracks.subtitle}</p>
        </div>
      </div>

      <div className="filters track-filters">
        <div className="track-filter-field">
          <span>{t.tracks.targetRole}</span>
          <SelectDropdown
            ariaLabel={t.tracks.targetRole}
            value={roleId}
            onChange={setRoleId}
            options={roles.map(({ id, labels }) => ({ value: id, label: pickLabel(labels), lang: locale }))}
          />
        </div>
        <div className="track-filter-field">
          <span>{t.tracks.experienceLevel}</span>
          <SelectDropdown
            ariaLabel={t.tracks.experienceLevel}
            value={levelId}
            onChange={setLevelId}
            options={levels.map(({ id, labels }) => ({ value: id, label: pickLabel(labels), lang: locale }))}
          />
        </div>
      </div>

      {role && (
        <Card variant="outlined" className="study-allocation-card">
          <div className="study-allocation-head">
            <div>
              <h2>{t.tracks.suggestedTime}</h2>
              <p className="study-allocation-sub">
                {pickLabel(role.labels)} · {pickLabel(levels.find(({ id }) => id === levelId)?.labels || {})}
                {trackFilter && ` · Filtered: ${trackLabel(trackFilter)}`}
              </p>
            </div>
            {trackFilter ? (
              <Button variant="quiet" size="sm" onClick={() => setTrackFilter('')}>
                Show all tracks
              </Button>
            ) : (
              <span className="study-allocation-total">100%</span>
            )}
          </div>

          <div className="allocation-stacked-bar" role="img" aria-label={t.tracks.suggestedTime}>
            {weightEntries.map(([id, weight], index) => (
              <span
                key={id}
                className="allocation-segment"
                style={{
                  width: `${Math.max(4, Math.round(weight * 100))}%`,
                  background: ALLOCATION_COLORS[index % ALLOCATION_COLORS.length],
                }}
                title={`${trackLabel(id)}: ${Math.round(weight * 100)}%`}
              />
            ))}
          </div>

          <div className="allocation-grid">
            {weightEntries.map(([id, weight], index) => {
              const pct = Math.round(weight * 100);
              const color = ALLOCATION_COLORS[index % ALLOCATION_COLORS.length];
              const isSelected = trackFilter === id;
              const matchCount = roleModules.filter((m) => m.track === id).length;
              return (
                <button
                  key={id}
                  type="button"
                  className={`allocation-item allocation-filter-btn ${isSelected ? 'is-active' : ''}`}
                  aria-pressed={isSelected}
                  onClick={() => setTrackFilter((prev) => (prev === id ? '' : id))}
                >
                  <div className="allocation-item-top">
                    <span className="allocation-label">
                      <span className="allocation-swatch" style={{ background: color }} aria-hidden="true" />
                      <span>{trackLabel(id)}</span>
                    </span>
                    <strong className="allocation-pct">{pct}%</strong>
                  </div>
                  <div className="allocation-track" aria-hidden="true">
                    <span className="allocation-fill" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <small className="allocation-mod-count">
                    {matchCount} {matchCount === 1 ? t.studio.tracks.module : t.studio.tracks.modules}
                  </small>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      <div className="module-studio-header">
        <div>
          <h2 className="module-title">{t.tracks.learningModules}</h2>
          <p className="result-count" role="status">
            {completedInTrack}/{roleModules.length} {t.progress.solvedOf}
          </p>
        </div>
        {roleModules.length > 0 && (
          <div className="module-studio-progress">
            <progress value={completedInTrack} max={Math.max(1, roleModules.length)} aria-label={t.tracks.learningModules} />
          </div>
        )}
      </div>

      {!visible.length && <p className="library-empty">{t.tracks.empty}</p>}

      {activeMod && (
        <div className="module-studio">
          <aside className="module-syllabus" aria-label={t.tracks.learningModules}>
            {visible.map((item, idx) => {
              const isSelected = idx === safeIndex;
              const isDone = doneModules.has(item.id);
              const itemLinks = resourcesFor(item.resources, locale, defaultLocale);
              const qCount = item.questions?.length || 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`syllabus-item ${isSelected ? 'is-selected' : ''} ${isDone ? 'is-done' : ''}`}
                  aria-current={isSelected ? 'step' : undefined}
                  onClick={() => setActiveModuleIndex(idx)}
                >
                  <span className="syllabus-num">
                    {isDone ? <Check size={14} aria-hidden="true" /> : String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="syllabus-copy">
                    <span className="syllabus-track-tag">{trackLabel(item.track)}</span>
                    <strong lang={item.titles[locale] ? locale : defaultLocale}>
                      {pickLabel(item.titles)}
                    </strong>
                    <small>
                      Guide · {qCount} Qs · {itemLinks.length} links
                    </small>
                  </span>
                </button>
              );
            })}
          </aside>

          <Card variant="outlined" className="module-stage">
            <div className="module-stage-top">
              <div className="module-stage-meta">
                <div className="module-stage-badges">
                  <span className="viewer-seq-badge">
                    {String(safeIndex + 1).padStart(2, '0')} / {String(visible.length).padStart(2, '0')}
                  </span>
                  <span className="room-format-pill">{trackLabel(activeMod.track)}</span>
                </div>
                <div className="module-stage-toggles">
                  <button
                    type="button"
                    className={`icon-btn ${isGuideFav ? 'is-active' : ''}`}
                    onClick={toggleGuideFavorite}
                    aria-pressed={isGuideFav}
                    aria-label={isGuideFav ? 'Remove from favorites' : 'Save module to favorites'}
                    title={isGuideFav ? 'Saved to favorites' : 'Save module to favorites'}
                  >
                    <Star size={16} fill={isGuideFav ? 'currentColor' : 'none'} aria-hidden="true" />
                  </button>
                  <label className="module-done-toggle">
                    <input
                      type="checkbox"
                      checked={doneModules.has(activeMod.id)}
                      onChange={() => toggleModuleDone(activeMod.id)}
                    />
                    <span>{doneModules.has(activeMod.id) ? t.roadmap.statusComplete : t.problems.markSolved}</span>
                  </label>
                </div>
              </div>

              <h3 lang={activeMod.titles[locale] ? locale : defaultLocale}>
                {activeTitle}
              </h3>

              <div className="module-stage-cta">
                {activeLinks[0] && (
                  <Button
                    variant="solid"
                    size="sm"
                    onClick={() => {
                      const primary = activeVideos[0] || activeLinks[0];
                      onNavigate?.(buildViewerPath({
                        url: primary.url,
                        title: formatViewerTitle(activeTitle, primary.title),
                        kind: primary.kind === 'video' ? 'video' : 'article',
                        moduleId: activeMod.id,
                      }));
                    }}
                  >
                    <Play size={14} aria-hidden="true" /> {activeVideos.length > 0 ? t.problems.watchVideo : t.problems.readArticle}
                  </Button>
                )}
                <Button variant="outlined" size="sm" onClick={() => launchMockRoomForModule()}>
                  <Users size={14} aria-hidden="true" /> {t.studio.tracks.practiceInRoom}
                </Button>
              </div>

              <div className="track-stage-tabs" role="tablist" aria-label={t.tracks.learningModules}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'guide'}
                  className={activeTab === 'guide' ? 'is-active' : ''}
                  onClick={() => setActiveTab('guide')}
                >
                  <BookOpen size={14} aria-hidden="true" /> {t.studio.tracks.studyMaterial}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'questions'}
                  className={activeTab === 'questions' ? 'is-active' : ''}
                  onClick={() => setActiveTab('questions')}
                >
                  <HelpCircle size={14} aria-hidden="true" /> {t.studio.tracks.questions} ({activeQuestions.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'videos'}
                  className={activeTab === 'videos' ? 'is-active' : ''}
                  onClick={() => setActiveTab('videos')}
                >
                  <Play size={14} aria-hidden="true" /> {t.studio.tracks.videos} ({activeVideos.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'docs'}
                  className={activeTab === 'docs' ? 'is-active' : ''}
                  onClick={() => setActiveTab('docs')}
                >
                  <FileText size={14} aria-hidden="true" /> {t.studio.tracks.docsRepos} ({activeDocs.length})
                </button>
              </div>
            </div>

            <div className="track-stage-body">
              {activeTab === 'guide' && (
                <div className="track-guide-pane">
                  {activeMod.studyGuide ? (
                    <RichTextInterpreter content={activeMod.studyGuide} format="markdown" />
                  ) : (
                    <p className="library-empty">{t.studio.tracks.guideSoon}</p>
                  )}
                </div>
              )}

              {activeTab === 'questions' && (
                <div className="track-questions-pane">
                  <div className="track-question-list">
                    {activeQuestions.map((item, idx) => {
                      const qKey = `${activeMod.id}:${idx}`;
                      const checked = doneQuestions.has(qKey);
                      return (
                        <div key={qKey} className={`track-question-card ${checked ? 'is-done' : ''}`}>
                          <div className="track-question-head">
                            <label className="track-q-check">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleQuestionDone(qKey)}
                              />
                              <span className="room-format-pill">{item.tag}</span>
                            </label>
                            <Button
                              variant="quiet"
                              size="sm"
                              onClick={() => launchMockRoomForModule(item.q)}
                            >
                              {t.studio.tracks.mockRoom} <ArrowRight size={13} aria-hidden="true" />
                            </Button>
                          </div>
                          <h4>{item.q}</h4>
                          <details className="track-q-answer">
                            <summary>{t.studio.tracks.keyPointsAnswer}</summary>
                            <RichTextInterpreter content={item.answer} format="markdown" />
                          </details>
                        </div>
                      );
                    })}
                  </div>

                  {relatedProblemObjs.length > 0 && (
                    <div className="track-related-problems">
                      <h4><Code2 size={15} aria-hidden="true" /> {t.studio.tracks.relatedProblems}</h4>
                      <div className="track-related-grid">
                        {relatedProblemObjs.map((prob) => (
                          <button
                            key={prob.slug}
                            type="button"
                            className="track-related-pill"
                            onClick={() => (onOpenProblem ? onOpenProblem(prob.slug) : onNavigate?.(`/problems?problem=${prob.slug}`))}
                          >
                            <span>{prob.leetcode_id}. {prob.translations?.[locale]?.title || prob.translations?.en?.title || prob.slug}</span>
                            <small>{t.sheets[prob.difficulty?.toLowerCase()] || prob.difficulty}</small>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'videos' && (
                <div className="track-media-grid">
                  {activeVideos.length === 0 ? (
                    <p className="library-empty">{t.studio.tracks.noVideos}</p>
                  ) : (
                    activeVideos.map((vid) => (
                      <div key={vid.url} className="track-resource-card">
                        <div className="track-resource-copy">
                          <span className="room-format-pill">{t.viewer.videoTab.toUpperCase()}</span>
                          <h4>{vid.title}</h4>
                          {vid.platform && <small>{vid.platform}</small>}
                        </div>
                        <div className="track-resource-actions">
                          <Button
                            variant="solid"
                            size="sm"
                            onClick={() => onOpenViewer?.({
                              url: vid.url,
                              title: formatViewerTitle(activeTitle, vid.title),
                              kind: 'video',
                              moduleId: activeMod.id,
                            })}
                          >
                            <Play size={14} aria-hidden="true" /> {t.studio.tracks.watchInApp}
                          </Button>
                          <Button
                            variant="quiet"
                            size="sm"
                            href={vid.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink size={14} aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'docs' && (
                <div className="track-media-grid">
                  {activeDocs.length === 0 ? (
                    <p className="library-empty">{t.studio.tracks.noDocs}</p>
                  ) : (
                    activeDocs.map((doc) => (
                      <div key={doc.url} className="track-resource-card">
                        <div className="track-resource-copy">
                          <span className="room-format-pill">{(doc.platform || 'DOC').toUpperCase()}</span>
                          <h4>{doc.title}</h4>
                          <small>{doc.url.replace(/^https?:\/\//, '').slice(0, 64)}</small>
                        </div>
                        <div className="track-resource-actions">
                          <Button
                            variant="outlined"
                            size="sm"
                            onClick={() => onOpenViewer?.({
                              url: doc.url,
                              title: formatViewerTitle(activeTitle, doc.title),
                              kind: 'article',
                              moduleId: activeMod.id,
                            })}
                          >
                            <BookOpen size={14} aria-hidden="true" /> {t.studio.tracks.readInApp}
                          </Button>
                          <Button
                            variant="quiet"
                            size="sm"
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink size={14} aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {(prevMod || nextMod) && (
              <div className="module-stage-footer">
                {prevMod ? (
                  <Button variant="outlined" size="sm" onClick={() => setActiveModuleIndex(safeIndex - 1)}>
                    <ChevronLeft size={15} aria-hidden="true" /> {pickLabel(prevMod.titles)}
                  </Button>
                ) : <span />}
                {nextMod ? (
                  <Button variant="solid" size="sm" onClick={() => setActiveModuleIndex(safeIndex + 1)}>
                    {pickLabel(nextMod.titles)} <ChevronRight size={15} aria-hidden="true" />
                  </Button>
                ) : <span />}
              </div>
            )}
          </Card>
        </div>
      )}
    </section>
  );
}
