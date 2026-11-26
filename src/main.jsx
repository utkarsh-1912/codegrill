import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Badge, Button, Card, ThemeProvider, themes, useTheme } from '@utkristi/ui';
import {
  BookOpen, Braces, Check, ChevronRight, Circle, ExternalLink, FileCode2,
  GitBranch, Globe2, Layers3, ListChecks, Maximize2, Minimize2, Moon,
  Play, Search, Star, StickyNote, Sun, Users, Video,
} from 'lucide-react';
import '@utkristi/ui/css';
import './styles.css';
import './identity.css';
import seed from './multilingual_leetcode_dataset.json';
import curriculum from './roadmap.generated.json';
import { matchingProblems, resourcesFor, roadmapFor, safeUrl } from './catalog.mjs';
import { problemShareUrl, studyLocation } from './rooms.mjs';
import { StudyRooms } from './StudyRooms.jsx';
import { SiteFooter, SitePages, Workflow, sitePages } from './SitePages.jsx';
import { SheetsPage } from './SheetsPage.jsx';
import { ContentViewer } from './ContentViewer.jsx';
import { LedgerDashboard } from './LedgerDashboard.jsx';
import { CommandPalette } from './CommandPalette.jsx';
import { ProblemPracticeBar } from './ProblemPracticeBar.jsx';
import { BrandLogo } from './BrandLogo.jsx';
import { BUILTIN_SHEETS, normalizeCustomSheet } from './sheets.mjs';
import { DEFAULT_APP_CONFIG } from './config.mjs';
import { getMessages } from './i18n.mjs';
import {
  checkBackendHealth,
  createCustomSheetApi,
  deleteCustomSheetApi,
  fetchAllSheets,
  fetchAppConfig,
  fetchDailyChallenge,
  fetchRemoteProgress,
  readLocalCustomSheets,
  saveRemoteProgress,
  writeLocalCustomSheets,
} from './api.mjs';

const { problems, roadmap_categories: categories, languages } = curriculum;
const directories = curriculum.directories
  .filter(({ url }) => safeUrl(url)?.hostname !== 'neetcode.io')
  .map((entry) => {
    if (!/neetcode/i.test(entry.name)) return /neetcode/i.test(entry.description ?? '') ? { ...entry, description: undefined } : entry;
    const name = entry.name === 'NeetCode' ? 'Coding walkthroughs'
      : entry.name.includes('freeCodeCamp') ? 'freeCodeCamp coding interview course' : 'Coding solutions repository';
    return { ...entry, name, description: undefined };
  });

function sourcePlatform(url, fallback) {
  const host = safeUrl(url)?.hostname.replace(/^www\./, '');
  if (host === 'youtube.com' || host === 'youtu.be') return 'YouTube';
  if (host === 'medium.com' || host?.endsWith('.medium.com')) return 'Medium';
  if (host === 'github.com') return 'GitHub';
  return fallback || host;
}

const metadata = seed.platform_metadata;
const { roles, experience_levels: levels } = seed.roles_and_experience_matrix;
const locales = metadata.supported_locales;
const defaultLocale = metadata.default_locale;
const modules = [...seed.system_design_modules, ...seed.ai_engineer_modules, ...seed.fde_modules];
const problemSlugs = new Set(problems.map(({ slug }) => slug));

const pathIds = ['roadmap', 'sheets', 'problems', 'tracks', 'resources', 'rooms'];
const navIcons = [GitBranch, ListChecks, Braces, Layers3, BookOpen, Users];
const preferenceKey = 'codegrill:study:v1';
const pickLabel = (labels, locale) => labels[locale] ?? labels[defaultLocale];

function readPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(preferenceKey));
    return {
      locale: locales.some(({ code }) => code === saved?.locale) ? saved.locale : defaultLocale,
      completed: new Set(Array.isArray(saved?.completed)
        ? saved.completed.filter((slug) => problemSlugs.has(slug))
        : []),
      bookmarked: new Set(Array.isArray(saved?.bookmarked)
        ? saved.bookmarked.filter((slug) => problemSlugs.has(slug))
        : []),
      notes: saved?.notes && typeof saved.notes === 'object' ? saved.notes : {},
      activity: saved?.activity && typeof saved.activity === 'object' ? saved.activity : {},
      streak: Number(saved?.streak || 0),
      longestStreak: Number(saved?.longestStreak || 0),
    };
  } catch {
    return { locale: defaultLocale, completed: new Set(), bookmarked: new Set(), notes: {}, activity: {}, streak: 0, longestStreak: 0 };
  }
}

function currentPage() {
  const location = studyLocation(window.location.hash, problemSlugs);
  const topic = new URLSearchParams(window.location.hash.split('?')[1]).get('topic');
  return {
    ...location,
    page: [...pathIds, ...sitePages].includes(location.page) ? location.page : 'home',
    topic: location.page === 'problems' && !location.problem && categories.some(({ id }) => id === topic) ? topic : '',
  };
}

function App() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [preferences, setPreferences] = useState(readPreferences);
  const { locale, completed, bookmarked, notes, activity, streak, longestStreak } = preferences;
  const [{ page, problem: sharedProblem, topic }, setLocation] = useState(currentPage);
  const [zenMode, setZenMode] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [appConfig, setAppConfig] = useState(DEFAULT_APP_CONFIG);
  const [dailyChallenge, setDailyChallenge] = useState(null);
  const [backendOnline, setBackendOnline] = useState(false);
  const [customSheets, setCustomSheets] = useState(readLocalCustomSheets);
  const [viewerItem, setViewerItem] = useState(null);
  const hydratedRef = useRef(false);

  const t = getMessages(locale);
  const navLabels = [t.nav.roadmap, t.nav.sheets, t.nav.problems, t.nav.tracks, t.nav.resources, t.nav.rooms];
  const allSheets = [...BUILTIN_SHEETS, ...customSheets];
  const roadmap = roadmapFor(categories, problems, completed);
  const next = roadmap.find((category) => category.ready && !category.complete && category.total);
  const percentage = Math.round(completed.size / problems.length * 100);
  const scheme = themes.find(({ id }) => id === resolvedTheme)?.scheme;
  const isDark = scheme === 'dark';

  // Global Ctrl+K / Cmd+K Command Palette shortcut
  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Hydrate runtime config, daily challenge, sheets, and progress from backend
  useEffect(() => {
    let active = true;
    (async () => {
      const [health, remoteConfig, daily, sheetData] = await Promise.all([
        checkBackendHealth(),
        fetchAppConfig(),
        fetchDailyChallenge(problems),
        fetchAllSheets(),
      ]);
      if (!active) return;
      setBackendOnline(health.online);
      setAppConfig(remoteConfig);
      setDailyChallenge(daily);
      if (sheetData.custom) setCustomSheets(sheetData.custom);
      if (health.online) {
        const remote = await fetchRemoteProgress(remoteConfig.defaultProfile);
        if (active && remote) {
          setPreferences((prev) => ({
            locale: locales.some(({ code }) => code === remote.locale) ? remote.locale : prev.locale,
            completed: new Set([...prev.completed, ...(remote.completed || []).filter((s) => problemSlugs.has(s))]),
            bookmarked: new Set([...prev.bookmarked, ...(remote.bookmarked || []).filter((s) => problemSlugs.has(s))]),
            notes: { ...(remote.notes || {}), ...prev.notes },
            activity: { ...(remote.activity || {}), ...prev.activity },
            streak: Number(remote.streak || prev.streak || 0),
            longestStreak: Number(remote.longestStreak || prev.longestStreak || 0),
          }));
        }
      }
      hydratedRef.current = true;
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const syncPage = () => setLocation(currentPage());
    window.addEventListener('hashchange', syncPage);
    return () => window.removeEventListener('hashchange', syncPage);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    const activeLink = document.querySelector('.app-header nav [aria-current="page"]');
    const navigation = activeLink?.parentElement;
    if (navigation && navigation.scrollWidth > navigation.clientWidth) {
      activeLink.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [page]);

  useEffect(() => {
    document.documentElement.style.colorScheme = scheme;
    if (theme !== 'light' && theme !== 'dark') setTheme(isDark ? 'dark' : 'light');
  }, [scheme, theme, isDark, setTheme]);

  // Apply locale lang attribute and font stack
  useEffect(() => {
    const localeInfo = locales.find(({ code }) => code === locale);
    document.documentElement.lang = localeInfo?.bcp47 || locale;
    if (localeInfo?.font_stack) {
      document.documentElement.style.setProperty('--locale-font', localeInfo.font_stack);
    }
  }, [locale]);

  // Persist to localStorage & sync to backend
  useEffect(() => {
    const payload = {
      locale,
      completed: [...completed],
      bookmarked: [...bookmarked],
      notes,
      activity,
      streak,
      longestStreak,
    };
    try {
      localStorage.setItem(preferenceKey, JSON.stringify(payload));
    } catch {
      // Ignore storage errors
    }
    if (backendOnline && hydratedRef.current) {
      saveRemoteProgress(payload, appConfig.defaultProfile).then((saved) => {
        if (saved && (saved.streak !== streak || saved.longestStreak !== longestStreak)) {
          setPreferences((curr) => ({
            ...curr,
            streak: Number(saved.streak || curr.streak || 0),
            longestStreak: Number(saved.longestStreak || curr.longestStreak || 0),
          }));
        }
      });
    }
  }, [locale, completed, bookmarked, notes, activity, backendOnline, appConfig.defaultProfile]);

  function openProblems(category = '') {
    window.location.hash = category ? 'problems?' + new URLSearchParams({ topic: category }) : 'problems';
  }

  function openProblemBySlug(slug) {
    window.location.hash = 'problems?' + new URLSearchParams({ problem: slug });
  }

  function toggleComplete(slug) {
    setPreferences((current) => {
      const updated = new Set(current.completed);
      const nextActivity = { ...(current.activity || {}) };
      if (updated.has(slug)) {
        updated.delete(slug);
      } else {
        updated.add(slug);
        const today = new Date().toISOString().slice(0, 10);
        nextActivity[today] = (nextActivity[today] || 0) + 1;
      }
      return { ...current, completed: updated, activity: nextActivity };
    });
  }

  function toggleBookmark(slug) {
    setPreferences((current) => {
      const updated = new Set(current.bookmarked);
      if (updated.has(slug)) updated.delete(slug);
      else updated.add(slug);
      return { ...current, bookmarked: updated };
    });
  }

  function saveNote(slug, text) {
    setPreferences((current) => {
      const nextNotes = { ...current.notes };
      if (text.trim()) nextNotes[slug] = text.trim();
      else delete nextNotes[slug];
      return { ...current, notes: nextNotes };
    });
  }

  async function handleCreateSheet(payload) {
    const createdRemote = await createCustomSheetApi(payload);
    const sheet = createdRemote || normalizeCustomSheet(payload, problemSlugs);
    setCustomSheets((prev) => {
      const next = [sheet, ...prev.filter((s) => s.id !== sheet.id)];
      writeLocalCustomSheets(next);
      return next;
    });
    return sheet;
  }

  async function handleDeleteSheet(id) {
    await deleteCustomSheetApi(id);
    setCustomSheets((prev) => {
      const next = prev.filter((s) => s.id !== id);
      writeLocalCustomSheets(next);
      return next;
    });
  }

  return (
    <div className={zenMode ? 'zen-mode' : ''}>
      <a className="skip-link" href="#main-content" onClick={(event) => {
        event.preventDefault();
        document.querySelector('main').focus();
      }}>{t.skipToContent}</a>

      <header className="app-header">
        <div className="header-inner">
          <a className="brand" href="#home" aria-label={appConfig.brand.name}>
            <BrandLogo name={appConfig.brand.name} size={32} />
          </a>
          <nav aria-label="Study navigation">
            {pathIds.map((id, index) => {
              const Icon = navIcons[index];
              return (
                <a key={id} href={'#' + id} lang={locale} aria-label={navLabels[index]} title={navLabels[index]}
                  aria-current={page === id ? 'page' : undefined}>
                  <Icon size={19} aria-hidden="true" />
                </a>
              );
            })}
          </nav>
          <div className="header-settings">
            <span
              className={`sync-dot ${backendOnline ? 'is-online' : ''}`}
              title={backendOnline ? t.controls.backendOnline : t.controls.backendLocal}
              aria-label={backendOnline ? t.controls.backendOnline : t.controls.backendLocal}
            />
            <button
              type="button"
              className="locale-field icon-only-control"
              onClick={() => setPaletteOpen(true)}
              aria-label={t.palette.open}
              title={t.palette.open}
            >
              <Search size={18} aria-hidden="true" />
            </button>
            <label className="locale-field language-field" title={t.controls.language}>
              <Globe2 size={18} aria-hidden="true" />
              <select aria-label={t.controls.language} value={locale}
                onChange={(event) => setPreferences((current) => ({ ...current, locale: event.target.value }))}>
                {locales.map(({ code, native_name }) => <option key={code} value={code} lang={code}>{native_name}</option>)}
              </select>
            </label>
            <button
              type="button"
              className="locale-field icon-only-control"
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              aria-label={isDark ? t.controls.switchToLight : t.controls.switchToDark}
              title={isDark ? t.controls.switchToLight : t.controls.switchToDark}
            >
              {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
            </button>
            <button
              type="button"
              className={`locale-field icon-only-control ${zenMode ? 'is-active' : ''}`}
              onClick={() => setZenMode((v) => !v)}
              aria-pressed={zenMode}
              aria-label={zenMode ? t.controls.zenExit : t.controls.zenEnter}
              title={zenMode ? t.controls.zenExit : t.controls.zenEnter}
            >
              {zenMode ? <Minimize2 size={18} aria-hidden="true" /> : <Maximize2 size={18} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      <main id="main-content" className="shell" tabIndex={-1}>
        {sitePages.includes(page) && (
          <SitePages
            page={page}
            locale={locale}
            topicCount={categories.length}
            problemCount={problems.length}
            sheetCount={allSheets.length}
          />
        )}

        {page === 'roadmap' && <>
          {!zenMode && (
            <section className="hero" aria-labelledby="main-title">
              <div className="hero-copy">
                <p className="eyebrow">{t.hero.eyebrow}</p>
                <h1 id="main-title" lang={locale}>{t.hero.title}<span>.</span></h1>
                <p>{t.hero.subtitle}</p>
                <div className="rooms-actions">
                  <Button variant="solid" onClick={() => openProblems(next?.id)}>
                    {completed.size ? t.hero.continueCta : t.hero.startCta}
                  </Button>
                  <Button variant="outlined" href="#sheets">{t.hero.exploreSheets}</Button>
                </div>
              </div>
              <img className="atlas-art" src="/atlas.svg" alt="" />
            </section>
          )}
          <Card variant="outlined" className="progress-card">
            <div className="progress-top">{t.progress.title}</div>
            <div className="progress-numbers">
              <strong>{completed.size}<small> / {problems.length}</small></strong>
              <span>{percentage}%</span>
            </div>
            <progress value={completed.size} max={problems.length} aria-label={t.progress.title} />
            <p className="progress-meta">
              {next ? <>{t.progress.nextLabel} <span lang={locale}>{pickLabel(next.labels, locale)}</span></> : t.progress.allDone}
              {streak > 0 && <> · <strong>{streak}</strong> {t.progress.streak}</>}
              {bookmarked.size > 0 && <> · <strong>{bookmarked.size}</strong> {t.progress.bookmarked}</>}
            </p>
          </Card>
          <LedgerDashboard
            problems={problems}
            categories={categories}
            completed={completed}
            bookmarked={bookmarked}
            activity={activity}
            dailyChallenge={dailyChallenge}
            streak={streak}
            longestStreak={longestStreak}
            activityDays={appConfig.interview.activityDays}
            locale={locale}
            defaultLocale={defaultLocale}
            onOpenProblem={openProblemBySlug}
          />
          <Roadmap roadmap={roadmap} next={next} locale={locale} title={t.nav.roadmap} onOpen={openProblems} />
          {!zenMode && (
            <section className="marketing-section">
              <h2>{t.roadmap.howToUse}</h2>
              <Workflow locale={locale} />
            </section>
          )}
        </>}

        {page === 'sheets' && (
          <SheetsPage
            sheets={allSheets}
            problems={problems}
            categories={categories}
            languages={languages}
            plannerConfig={appConfig.planner}
            locale={locale}
            defaultLocale={defaultLocale}
            completed={completed}
            bookmarked={bookmarked}
            notes={notes}
            toggleComplete={toggleComplete}
            toggleBookmark={toggleBookmark}
            saveNote={saveNote}
            onOpenViewer={setViewerItem}
            onCreateSheet={handleCreateSheet}
            onDeleteSheet={handleDeleteSheet}
          />
        )}

        {page === 'problems' && (
          <ProblemLibrary
            locale={locale}
            topic={topic}
            completed={completed}
            bookmarked={bookmarked}
            notes={notes}
            toggleComplete={toggleComplete}
            toggleBookmark={toggleBookmark}
            saveNote={saveNote}
            sharedProblem={sharedProblem}
            setTopic={openProblems}
            title={t.nav.problems}
            timerMinutes={appConfig.interview.defaultTimerMinutes}
            onOpenViewer={setViewerItem}
          />
        )}

        {page === 'tracks' && <InterviewTracks locale={locale} title={t.nav.tracks} onOpenViewer={setViewerItem} />}
        {page === 'resources' && <ResourceDirectory locale={locale} title={t.nav.resources} />}
        {page === 'rooms' && (
          <StudyRooms locale={locale} title={t.nav.rooms}>
            {sharedProblem && <ProblemLink slug={sharedProblem} locale={locale} />}
          </StudyRooms>
        )}
      </main>

      {!zenMode && <SiteFooter locale={locale} config={appConfig} />}

      <ContentViewer
        item={viewerItem}
        locale={locale}
        languages={languages}
        onClose={() => setViewerItem(null)}
      />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        problems={problems}
        categories={categories}
        sheets={allSheets}
        locale={locale}
        defaultLocale={defaultLocale}
        onSelect={(item) => {
          if (item.kind === 'problem') openProblemBySlug(item.id);
          else if (item.kind === 'topic') openProblems(item.id);
          else if (item.kind === 'sheet') window.location.hash = 'sheets';
        }}
      />
    </div>
  );
}

function Roadmap({ roadmap, next, locale, title, onOpen }) {
  const t = getMessages(locale);
  const [stage, setStage] = useState('all');
  const [selectedId, setSelectedId] = useState(next?.id ?? roadmap[0].id);
  const stages = [...new Set(roadmap.map(({ depth }) => depth))].sort((a, b) => a - b);
  const selected = roadmap.find(({ id }) => id === selectedId);
  const visible = stage === 'all' ? stages : [stage];
  const status = (topic) => (
    topic.complete ? t.roadmap.statusComplete : topic.ready ? t.roadmap.statusReady : t.roadmap.statusPrerequisites
  );

  function changeStage(depth) {
    setStage(depth);
    if (depth !== 'all' && selected.depth !== depth) {
      setSelectedId((roadmap.find((topic) => topic.depth === depth && topic.ready && !topic.complete) ??
        roadmap.find((topic) => topic.depth === depth)).id);
    }
  }

  return (
    <section className="roadmap" aria-labelledby="roadmap-title">
      <div className="section-heading">
        <div>
          <h2 id="roadmap-title" lang={locale}>{title}</h2>
          <p>{t.roadmap.subtitle}</p>
        </div>
        <Badge variant="outlined">{roadmap.length} {t.roadmap.topicsUnit}</Badge>
      </div>
      <div className="stage-selector" role="group" aria-label={t.roadmap.allStages}>
        <button type="button" aria-pressed={stage === 'all'} onClick={() => changeStage('all')}>
          {t.roadmap.allStages}
        </button>
        {stages.map((depth) => {
          const topics = roadmap.filter((topic) => topic.depth === depth);
          return (
            <button type="button" key={depth} aria-pressed={stage === depth} onClick={() => changeStage(depth)}>
              {t.roadmap.stages[depth] ?? `Stage ${depth + 1}`} <span>{topics.filter((topic) => topic.complete).length}/{topics.length}</span>
            </button>
          );
        })}
      </div>
      <div className="roadmap-layout">
        <div className="map-stages">
          {visible.map((depth) => (
            <section key={depth} className="map-stage">
              <h3>{t.roadmap.stages[depth] ?? `Stage ${depth + 1}`}</h3>
              <div className="map-topic-grid">
                {roadmap.filter((topic) => topic.depth === depth).map((topic) => (
                  <button
                    key={topic.id}
                    type="button"
                    className="map-topic map-topic-text-only"
                    aria-pressed={selectedId === topic.id}
                    onClick={() => {
                      setSelectedId(topic.id);
                      if (window.matchMedia('(max-width: 740px)').matches) {
                        requestAnimationFrame(() => document.getElementById('topic-details')?.focus());
                      }
                    }}
                  >
                    <span>
                      <strong lang={locale}>{pickLabel(topic.labels, locale)}</strong>
                      <small>{topic.done}/{topic.total} {t.progress.solvedOf} · {status(topic)}</small>
                    </span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
        <Card variant="outlined" className="topic-inspector" id="topic-details" tabIndex={-1}>
          <div aria-live="polite">
            <p className="inspector-label">{status(selected)}</p>
            <h3 lang={locale}>{pickLabel(selected.labels, locale)}</h3>
            <p>{selected.done} / {selected.total} {t.progress.solvedOf}</p>
            <progress value={selected.done} max={selected.total} aria-label={t.progress.title} />
            {!!selected.prerequisites.length && (
              <div className="topic-related">
                <h4>{t.roadmap.prerequisites}</h4>
                {selected.prerequisites.map((id) => {
                  const prerequisite = roadmap.find((topic) => topic.id === id);
                  return (
                    <button key={id} type="button" onClick={() => {
                      if (stage !== 'all') setStage(prerequisite.depth);
                      setSelectedId(id);
                    }}>
                      {prerequisite.complete ? <Check size={15} aria-hidden="true" /> : <Circle size={15} aria-hidden="true" />}
                      <span lang={locale}>{pickLabel(prerequisite.labels, locale)}</span>
                      <small>{prerequisite.done}/{prerequisite.total}</small>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <Button variant="solid" onClick={() => onOpen(selected.id)}>{t.roadmap.openTopic}</Button>
        </Card>
      </div>
    </section>
  );
}

function ProblemLibrary({
  locale, title, topic, setTopic, completed, bookmarked, notes,
  toggleComplete, toggleBookmark, saveNote, sharedProblem, timerMinutes, onOpenViewer,
}) {
  const t = getMessages(locale);
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [progressFilter, setProgressFilter] = useState('');
  const [openSlug, setOpenSlug] = useState(sharedProblem);
  const [noteDrafts, setNoteDrafts] = useState({});
  const [savedNotice, setSavedNotice] = useState('');

  useEffect(() => {
    if (sharedProblem) {
      setOpenSlug(sharedProblem);
      setQuery('');
      setDifficulty('');
      setProgressFilter('');
    }
  }, [sharedProblem]);

  const matches = matchingProblems(problems, categories, { query, difficulty, topic, locale })
    .filter(({ slug }) => {
      if (!progressFilter) return true;
      if (progressFilter === 'revision') return bookmarked.has(slug);
      return completed.has(slug) === (progressFilter === 'solved');
    });

  const sharedIndex = matches.findIndex(({ slug }) => slug === sharedProblem);
  const visible = sharedIndex > 0
    ? [matches[sharedIndex], ...matches.slice(0, sharedIndex), ...matches.slice(sharedIndex + 1)]
    : matches;

  return (
    <section className="library page-section">
      <div className="section-heading">
        <div>
          <h1 lang={locale}>{title}</h1>
          <p>{t.problems.subtitle}</p>
        </div>
      </div>

      <div className="filters">
        <label className="search-field">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            placeholder={t.problems.searchPlaceholder}
            aria-label={t.problems.searchPlaceholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select aria-label={t.problems.allTopics} value={topic} onChange={(event) => setTopic(event.target.value)}>
          <option value="">{t.problems.allTopics}</option>
          {categories.map(({ id, labels }) => <option key={id} value={id}>{pickLabel(labels, locale)}</option>)}
        </select>
        <select aria-label={t.problems.allDifficulties} value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
          <option value="">{t.problems.allDifficulties}</option>
          <option value="Easy">{t.sheets.easy}</option>
          <option value="Medium">{t.sheets.medium}</option>
          <option value="Hard">{t.sheets.hard}</option>
        </select>
        <select aria-label={t.problems.anyProgress} value={progressFilter} onChange={(event) => setProgressFilter(event.target.value)}>
          <option value="">{t.problems.anyProgress}</option>
          <option value="unsolved">{t.problems.unsolved}</option>
          <option value="solved">{t.problems.solved}</option>
          <option value="revision">{t.problems.revision}</option>
        </select>
      </div>

      <div className="library-summary">
        <p className="result-count" role="status">
          {visible.length} {t.sheets.problemsCount} · {visible.filter(({ slug }) => completed.has(slug)).length} {t.sheets.solvedCount}
        </p>
        {(query || topic || difficulty || progressFilter) && (
          <Button variant="quiet" size="sm" onClick={() => {
            setQuery(''); setDifficulty(''); setProgressFilter(''); setTopic('');
          }}>{t.problems.clearFilters}</Button>
        )}
      </div>

      {!visible.length && <p className="library-empty">{t.problems.empty}</p>}

      <div className="problem-list">
        {visible.map((problem) => {
          const expanded = openSlug === problem.slug;
          const titleLocale = problem.translations[locale] ? locale : defaultLocale;
          const name = problem.translations[titleLocale].title;
          const isStarred = bookmarked.has(problem.slug);
          const noteValue = noteDrafts[problem.slug] ?? notes[problem.slug] ?? '';
          return (
            <Card variant="outlined" className="problem-card" key={problem.slug}>
              <div className="problem-row">
                <label className="completion">
                  <input
                    type="checkbox"
                    checked={completed.has(problem.slug)}
                    onChange={() => toggleComplete(problem.slug)}
                    aria-label={`${t.problems.markSolved}: ${name}`}
                  />
                </label>
                <button
                  type="button"
                  className="problem-toggle"
                  aria-expanded={expanded}
                  aria-controls={'details-' + problem.slug}
                  onClick={() => setOpenSlug(expanded ? '' : problem.slug)}
                >
                  <span className="problem-number">#{problem.leetcode_id}</span>
                  <strong lang={titleLocale}>{name}</strong>
                  <Badge tone={{ Easy: 'ok', Medium: 'warn', Hard: 'bad' }[problem.difficulty]}>
                    {t.sheets[problem.difficulty.toLowerCase()] || problem.difficulty}
                  </Badge>
                  <ChevronRight size={17} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={`icon-btn row-star-btn ${isStarred ? 'is-active' : ''}`}
                  onClick={() => toggleBookmark(problem.slug)}
                  aria-pressed={isStarred}
                  aria-label={isStarred ? t.problems.unbookmark : t.problems.bookmark}
                  title={isStarred ? t.problems.unbookmark : t.problems.bookmark}
                >
                  <Star size={16} fill={isStarred ? 'currentColor' : 'none'} aria-hidden="true" />
                </button>
              </div>
              <div className="problem-detail" hidden={!expanded} id={'details-' + problem.slug}>
                {expanded && <>
                  <ProblemPracticeBar problem={problem} locale={locale} defaultTimerMinutes={timerMinutes} />
                  <div className="rooms-actions">
                    {safeUrl(problem.leetcode_url) && (
                      <Button variant="solid" href={problem.leetcode_url} target="_blank" rel="noopener noreferrer">
                        {t.problems.practiceLeetCode}
                      </Button>
                    )}
                    <Button variant="outlined" href={'#rooms?' + new URLSearchParams({ problem: problem.slug })}>
                      {t.problems.studyColabs}
                    </Button>
                    <Button variant="quiet" onClick={() => toggleComplete(problem.slug)}>
                      {completed.has(problem.slug) ? t.problems.markUnsolved : t.problems.markSolved}
                    </Button>
                  </div>

                  <Resources
                    resources={problem.resources}
                    locale={locale}
                    problemTitle={name}
                    onOpenViewer={onOpenViewer}
                  />

                  <SolutionFiles
                    solutions={problem.solutions}
                    problemTitle={name}
                    locale={locale}
                    onOpenViewer={onOpenViewer}
                  />

                  <div className="solution-files personal-notes">
                    <label htmlFor={`note-${problem.slug}`}>
                      <StickyNote size={15} aria-hidden="true" /> {t.problems.notes}
                    </label>
                    <textarea
                      id={`note-${problem.slug}`}
                      rows={2}
                      value={noteValue}
                      placeholder={t.problems.notesPlaceholder}
                      onChange={(e) => setNoteDrafts((d) => ({ ...d, [problem.slug]: e.target.value }))}
                    />
                    <div className="inline-note-actions">
                      <Button variant="outlined" size="sm" onClick={() => {
                        saveNote(problem.slug, noteValue);
                        setSavedNotice(problem.slug);
                        setTimeout(() => setSavedNotice(''), 1800);
                      }}>{t.problems.saveNote}</Button>
                      {savedNotice === problem.slug && <span className="note-saved-msg">{t.problems.noteSaved}</span>}
                    </div>
                  </div>

                  <ProblemLink slug={problem.slug} locale={locale} />
                </>}
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function SolutionFiles({ solutions, problemTitle, locale, onOpenViewer }) {
  const t = getMessages(locale);
  const entries = Object.entries(languages).filter(([id]) => solutions[id]);
  if (!entries.length) return null;
  return (
    <details className="solution-files" open>
      <summary>{t.problems.solutionCode}</summary>
      <div className="solution-lang-pills">
        {entries.map(([id, name]) => (
          <button
            key={id}
            type="button"
            className="lang-pill-btn"
            onClick={() => onOpenViewer({
              url: solutions[id],
              title: `${problemTitle} — ${name}`,
              kind: 'code',
              solutionLang: id,
              solutions,
              problemTitle,
            })}
          >
            <FileCode2 size={14} aria-hidden="true" /> {name}
          </button>
        ))}
      </div>
    </details>
  );
}

function ProblemLink({ slug, locale = 'en' }) {
  const t = getMessages(locale);
  const [feedback, setFeedback] = useState('');
  const link = problemShareUrl(window.location.href, slug);
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setFeedback(t.problems.copied);
    } catch {
      setFeedback(t.problems.copyFallback);
    }
  }
  const problem = problems.find((p) => p.slug === slug);
  const title = problem?.translations[locale]?.title || problem?.translations.en.title;
  return (
    <details className="solution-files">
      <summary>{t.problems.share} {title}</summary>
      <div className="share-field">
        <input aria-label={t.problems.share} readOnly value={link} onFocus={(event) => event.target.select()} />
        <Button variant="outlined" type="button" onClick={copy}>{t.problems.copyLink}</Button>
      </div>
      <p role="status">{feedback}</p>
    </details>
  );
}

function ResourceDirectory({ locale, title }) {
  const t = getMessages(locale);
  const [language, setLanguage] = useState(locale);
  useEffect(() => setLanguage(locale), [locale]);
  const visible = directories.filter((entry) => !language || entry.locale === language);
  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <h1 lang={locale}>{title}</h1>
          <p>{t.resources.subtitle}</p>
        </div>
      </div>
      <div className="filters">
        <select aria-label={t.resources.allLanguages} value={language} onChange={(event) => setLanguage(event.target.value)}>
          <option value="">{t.resources.allLanguages}</option>
          {locales.map(({ code, native_name }) => <option key={code} lang={code} value={code}>{native_name}</option>)}
        </select>
      </div>
      <p className="result-count" role="status">{visible.length} {t.resources.directoriesUnit}</p>
      <ul className="directory-list">
        {visible.map((entry) => (
          <li key={entry.url}>
            <Card variant="outlined">
              <a href={entry.url} target="_blank" rel="noopener noreferrer">
                <span>
                  <strong>{entry.name}</strong>
                  <small>{sourcePlatform(entry.url)}</small>
                  {entry.description && <small>{entry.description}</small>}
                </span>
                <ExternalLink size={16} aria-hidden="true" />
              </a>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Resources({ resources, locale, problemTitle, onOpenViewer }) {
  const t = getMessages(locale);
  const links = resourcesFor(resources, locale, defaultLocale);
  if (!links.length) return <p className="resource-note">{t.problems.noResources}</p>;
  const englishLinks = locale !== defaultLocale && links[0].locale === locale
    ? resourcesFor({ [defaultLocale]: resources[defaultLocale] }, locale, defaultLocale)
    : [];
  return (
    <div className="resources">
      <h3>{t.problems.resourcesTitle}</h3>
      {links[0].locale !== locale && <p className="resource-note">{t.problems.showingEnglish}</p>}
      <ResourceLinks links={links} problemTitle={problemTitle} onOpenViewer={onOpenViewer} />
      {!!englishLinks.length && (
        <details className="solution-files">
          <summary>{t.problems.englishResources}</summary>
          <ResourceLinks links={englishLinks} problemTitle={problemTitle} onOpenViewer={onOpenViewer} />
        </details>
      )}
    </div>
  );
}

function ResourceLinks({ links, problemTitle, onOpenViewer }) {
  return (
    <ul className="resource-links">
      {links.map(({ url, title, kind, platform, locale: linkLocale }) => {
        const cleanTitle = /neetcode/i.test(title) ? (kind === 'video' ? 'Video walkthrough' : 'Written solution') : title;
        return (
          <li key={kind + url}>
            <button
              type="button"
              className="resource-open-btn"
              onClick={() => onOpenViewer({
                url,
                title: problemTitle ? `${problemTitle} — ${cleanTitle}` : cleanTitle,
                kind: kind === 'video' ? 'video' : 'article',
                problemTitle,
              })}
            >
              {kind === 'video' ? <Play size={16} aria-hidden="true" /> : <BookOpen size={16} aria-hidden="true" />}
              <span>
                <strong lang={linkLocale}>{cleanTitle}</strong>
                <small>{sourcePlatform(url, platform)}</small>
              </span>
              {kind === 'video' ? <Video size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function InterviewTracks({ locale, title, onOpenViewer }) {
  const t = getMessages(locale);
  const [roleId, setRoleId] = useState(roles[0]?.id || '');
  const [levelId, setLevelId] = useState(levels[1]?.id || levels[0]?.id || '');
  const role = roles.find(({ id }) => id === roleId);
  const visible = modules.filter((item) => item.roles.includes(roleId) && item.levels.includes(levelId));
  const trackLabel = (id) => t.tracks.labels[id] ?? id.replaceAll('_', ' ');

  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <h1 lang={locale}>{title}</h1>
          <p>{t.tracks.subtitle}</p>
        </div>
      </div>
      <div className="filters track-filters">
        <label>
          {t.tracks.targetRole}
          <select value={roleId} onChange={(event) => setRoleId(event.target.value)}>
            {roles.map(({ id, labels }) => <option key={id} value={id}>{pickLabel(labels, locale)}</option>)}
          </select>
        </label>
        <label>
          {t.tracks.experienceLevel}
          <select value={levelId} onChange={(event) => setLevelId(event.target.value)}>
            {levels.map(({ id, labels }) => <option key={id} value={id}>{pickLabel(labels, locale)}</option>)}
          </select>
        </label>
      </div>
      <Card variant="outlined" className="study-weights">
        <h2>{t.tracks.suggestedTime}</h2>
        <ul>
          {Object.entries(role.module_weights_by_level[levelId]).map(([id, weight]) => (
            <li key={id}>
              <span>{trackLabel(id)}</span>
              <strong>{Math.round(weight * 100)}%</strong>
              <progress value={weight} max={1} aria-label={trackLabel(id)} />
            </li>
          ))}
        </ul>
      </Card>
      <h2 className="module-title">{t.tracks.learningModules}</h2>
      <p className="result-count" role="status">{visible.length}</p>
      {!visible.length && <p className="library-empty">{t.tracks.empty}</p>}
      <div className="module-list">
        {visible.map((item) => (
          <Card variant="outlined" key={item.id}>
            <details>
              <summary>
                <span lang={item.titles[locale] ? locale : defaultLocale}>{pickLabel(item.titles, locale)}</span>
              </summary>
              <Resources
                resources={item.resources}
                locale={locale}
                problemTitle={pickLabel(item.titles, locale)}
                onOpenViewer={onOpenViewer}
              />
            </details>
          </Card>
        ))}
      </div>
    </section>
  );
}

createRoot(document.getElementById('root')).render(
  <ThemeProvider defaultTheme="light" storageKey="codegrill:theme"><App /></ThemeProvider>,
);
