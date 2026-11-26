import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Badge, Button, Card, ThemeProvider, themes, useTheme } from '@utkristi/ui';
import {
  BookOpen, Check, ChevronRight, Circle, ExternalLink, FileCode2,
  Play, Search, Star, StickyNote, Video,
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
import { ContentViewer, buildViewerPath, formatViewerTitle } from './ContentViewer.jsx';
import { ViewerPage } from './ViewerPage.jsx';
import { LedgerDashboard } from './LedgerDashboard.jsx';
import { CommandPalette } from './CommandPalette.jsx';
import { ProblemPracticeBar } from './ProblemPracticeBar.jsx';
import { AppHeader } from './AppHeader.jsx';
import { ForgeAtlas } from './ForgeAtlas.jsx';
import { ErrorBoundary, ErrorPage, NotFoundPage } from './StatusPages.jsx';
import { SelectDropdown } from './SelectDropdown.jsx';
import { Pagination } from './Pagination.jsx';
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
  resetRemoteProgress,
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

const validPages = new Set([...pathIds, ...sitePages, 'viewer', 'error']);

function currentPage() {
  // Support legacy hash URLs seamlessly by reading them if present
  if (window.location.hash && window.location.hash.length > 1) {
    const legacy = studyLocation(window.location.hash, problemSlugs);
    const legacyQuery = window.location.hash.split('?')[1] || '';
    const cleanPath = legacy.page === 'home' || !legacy.page ? '/' : `/${legacy.page}${legacyQuery ? '?' + legacyQuery : ''}`;
    window.history.replaceState({}, '', cleanPath);
  }

  const rawPath = window.location.pathname.replace(/\/+$/, '') || '/';
  const segment = rawPath === '/' ? 'home' : rawPath.slice(1);
  const params = new URLSearchParams(window.location.search);
  const problemParam = params.get('problem') || '';
  const topicParam = params.get('topic') || '';
  const isKnown = validPages.has(segment);
  const page = isKnown ? segment : 'not-found';

  return {
    page,
    pathname: window.location.pathname,
    problem: (page === 'problems' || page === 'rooms' || page === 'viewer') && problemSlugs.has(problemParam) ? problemParam : '',
    topic: page === 'problems' && !problemParam && categories.some(({ id }) => id === topicParam) ? topicParam : '',
    viewerUrl: page === 'viewer' ? (params.get('url') || '') : '',
    viewerTitle: page === 'viewer' ? (params.get('title') || '') : '',
    viewerKind: page === 'viewer' ? (params.get('kind') || '') : '',
    viewerLang: page === 'viewer' ? (params.get('lang') || '') : '',
  };
}

function App() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [preferences, setPreferences] = useState(readPreferences);
  const { locale, completed, bookmarked, notes, activity, streak, longestStreak } = preferences;
  const [{ page, pathname, problem: sharedProblem, topic, viewerUrl, viewerTitle, viewerKind, viewerLang }, setLocation] = useState(currentPage);
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
    window.addEventListener('popstate', syncPage);
    window.addEventListener('hashchange', syncPage);
    return () => {
      window.removeEventListener('popstate', syncPage);
      window.removeEventListener('hashchange', syncPage);
    };
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

  function navigate(path) {
    const target = path === '/home' ? '/' : path;
    if (window.location.pathname + window.location.search !== target) {
      window.history.pushState({}, '', target);
    }
    setLocation(currentPage());
  }

  function openProblems(category = '') {
    navigate(category ? '/problems?' + new URLSearchParams({ topic: category }) : '/problems');
  }

  function openProblemBySlug(slug) {
    navigate('/problems?' + new URLSearchParams({ problem: slug }));
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

  async function resetProgress() {
    setPreferences((current) => ({
      locale: current.locale,
      completed: new Set(),
      bookmarked: new Set(),
      notes: {},
      activity: {},
      streak: 0,
      longestStreak: 0,
    }));
    try {
      localStorage.setItem(preferenceKey, JSON.stringify({
        locale,
        completed: [],
        bookmarked: [],
        notes: {},
        activity: {},
        streak: 0,
        longestStreak: 0,
      }));
    } catch {
      // Ignore storage errors
    }
    if (backendOnline) {
      await resetRemoteProgress(appConfig.defaultProfile);
    }
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
    <div className={`app-shell ${zenMode ? 'zen-mode' : ''}`}>
      <a className="skip-link" href="#main-content" onClick={(event) => {
        event.preventDefault();
        document.querySelector('main').focus();
      }}>{t.skipToContent}</a>

      <AppHeader
        brandName={appConfig.brand.name}
        page={page}
        pathIds={pathIds}
        navLabels={navLabels}
        locale={locale}
        defaultLocale={defaultLocale}
        locales={locales}
        isDark={isDark}
        zenMode={zenMode}
        backendOnline={backendOnline}
        problems={problems}
        categories={categories}
        sheets={allSheets}
        onLocaleChange={(nextLocale) => setPreferences((current) => ({ ...current, locale: nextLocale }))}
        onToggleTheme={() => setTheme(isDark ? 'light' : 'dark')}
        onToggleZen={() => setZenMode((v) => !v)}
        onResetProgress={resetProgress}
        onOpenPalette={() => setPaletteOpen(true)}
        onNavigate={navigate}
        onSelectSearchItem={(item) => {
          if (item.kind === 'problem') openProblemBySlug(item.id);
          else if (item.kind === 'topic') openProblems(item.id);
          else if (item.kind === 'sheet') navigate('/sheets');
        }}
      />

      <main id="main-content" key={page} className="shell page-enter" tabIndex={-1}>
        {page === 'not-found' && <NotFoundPage locale={locale} pathname={pathname} onNavigate={navigate} />}
        {page === 'error' && <ErrorPage locale={locale} onReset={() => navigate('/')} onNavigate={navigate} />}
        {sitePages.includes(page) && (
          <SitePages
            page={page}
            locale={locale}
            topicCount={categories.length}
            problemCount={problems.length}
            sheetCount={allSheets.length}
            config={appConfig}
            onNavigate={navigate}
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
                  <Button variant="outlined" href="/sheets" onClick={(e) => { e.preventDefault(); navigate('/sheets'); }}>
                    {t.hero.exploreSheets}
                  </Button>
                </div>
              </div>
              <ForgeAtlas variant="hero" className="atlas-art" />
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
              <Workflow locale={locale} onNavigate={navigate} />
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
            onNavigate={navigate}
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
            pageSize={appConfig.pagination.problemsPerPage}
            onOpenViewer={setViewerItem}
            onNavigate={navigate}
          />
        )}

        {page === 'tracks' && <InterviewTracks locale={locale} title={t.nav.tracks} onOpenViewer={setViewerItem} />}
        {page === 'resources' && (
          <ResourceDirectory
            locale={locale}
            title={t.nav.resources}
            pageSize={appConfig.pagination.resourcesPerPage}
            onOpenViewer={setViewerItem}
          />
        )}
        {page === 'viewer' && (
          <ViewerPage
            url={viewerUrl}
            title={viewerTitle}
            kind={viewerKind}
            problem={sharedProblem ? problems.find((p) => p.slug === sharedProblem) : null}
            allProblems={problems}
            directories={directories}
            initialLang={viewerLang}
            languages={languages}
            locale={locale}
            defaultLocale={defaultLocale}
            customPlayerTemplate={appConfig.player.customPlayerTemplate}
            onNavigate={navigate}
          />
        )}
        {page === 'rooms' && (
          <StudyRooms locale={locale} title={t.nav.rooms}>
            {sharedProblem && <ProblemLink slug={sharedProblem} locale={locale} />}
          </StudyRooms>
        )}
      </main>

      {!zenMode && <SiteFooter locale={locale} config={appConfig} onNavigate={navigate} />}

      <ContentViewer
        item={viewerItem}
        locale={locale}
        languages={languages}
        customPlayerTemplate={appConfig.player.customPlayerTemplate}
        onClose={() => setViewerItem(null)}
        onExpand={(expandedItem) => {
          setViewerItem(null);
          navigate(buildViewerPath(expandedItem));
        }}
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
          else if (item.kind === 'sheet') navigate('/sheets');
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
  toggleComplete, toggleBookmark, saveNote, sharedProblem, timerMinutes, pageSize = 20, onOpenViewer, onNavigate,
}) {
  const t = getMessages(locale);
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [progressFilter, setProgressFilter] = useState('');
  const [openSlug, setOpenSlug] = useState(sharedProblem);
  const [pageNum, setPageNum] = useState(1);
  const [noteDrafts, setNoteDrafts] = useState({});
  const [savedNotice, setSavedNotice] = useState('');

  useEffect(() => {
    if (sharedProblem) {
      setOpenSlug(sharedProblem);
      setQuery('');
      setDifficulty('');
      setProgressFilter('');
      setPageNum(1);
    }
  }, [sharedProblem]);

  useEffect(() => {
    setPageNum(1);
  }, [query, difficulty, topic, progressFilter]);

  const matches = matchingProblems(problems, categories, { query, difficulty, topic, locale })
    .filter(({ slug }) => {
      if (!progressFilter) return true;
      if (progressFilter === 'revision') return bookmarked.has(slug);
      return completed.has(slug) === (progressFilter === 'solved');
    });

  const sharedIndex = matches.findIndex(({ slug }) => slug === sharedProblem);
  const ordered = sharedIndex > 0
    ? [matches[sharedIndex], ...matches.slice(0, sharedIndex), ...matches.slice(sharedIndex + 1)]
    : matches;

  const totalPages = Math.max(1, Math.ceil(ordered.length / pageSize));
  const currentPageNum = Math.min(pageNum, totalPages);
  const visible = ordered.slice((currentPageNum - 1) * pageSize, currentPageNum * pageSize);

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
        <SelectDropdown
          ariaLabel={t.problems.allTopics}
          value={topic}
          onChange={setTopic}
          options={[
            { value: '', label: t.problems.allTopics },
            ...categories.map(({ id, labels }) => ({ value: id, label: pickLabel(labels, locale), lang: locale })),
          ]}
        />
        <SelectDropdown
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
        <SelectDropdown
          ariaLabel={t.problems.anyProgress}
          value={progressFilter}
          onChange={setProgressFilter}
          options={[
            { value: '', label: t.problems.anyProgress },
            { value: 'unsolved', label: t.problems.unsolved },
            { value: 'solved', label: t.problems.solved },
            { value: 'revision', label: t.problems.revision },
          ]}
        />
      </div>

      <div className="library-summary">
        <p className="result-count" role="status">
          {ordered.length} {t.sheets.problemsCount} · {ordered.filter(({ slug }) => completed.has(slug)).length} {t.sheets.solvedCount}
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
                    <Button
                      variant="outlined"
                      href={'/rooms?' + new URLSearchParams({ problem: problem.slug })}
                      onClick={(e) => {
                        if (!onNavigate || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                        e.preventDefault();
                        onNavigate('/rooms?' + new URLSearchParams({ problem: problem.slug }));
                      }}
                    >
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
                    problemSlug={problem.slug}
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
                  <RelatedProblems
                    current={problem}
                    allProblems={problems}
                    completed={completed}
                    locale={locale}
                    onSelect={(slug) => {
                      setOpenSlug(slug);
                      onNavigate(`/problems?${new URLSearchParams({ problem: slug })}`);
                    }}
                  />
                </>}
              </div>
            </Card>
          );
        })}
      </div>

      <Pagination
        page={currentPageNum}
        totalItems={ordered.length}
        pageSize={pageSize}
        locale={locale}
        onPageChange={(nextPage) => {
          setPageNum(nextPage);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </section>
  );
}

function RelatedProblems({ current, allProblems, completed, locale, onSelect }) {
  const t = getMessages(locale);
  const related = allProblems
    .filter((p) => p.category_id === current.category_id && p.slug !== current.slug)
    .slice(0, 4);
  if (!related.length) return null;

  return (
    <div className="related-section">
      <h4>{t.related.problemsTitle} <span>{t.related.sameTopic}</span></h4>
      <div className="related-grid">
        {related.map((item) => {
          const itemLocale = item.translations[locale] ? locale : defaultLocale;
          return (
            <button
              key={item.slug}
              type="button"
              className={`related-card ${completed.has(item.slug) ? 'is-solved' : ''}`}
              onClick={() => onSelect(item.slug)}
            >
              <span className="problem-number">#{item.leetcode_id}</span>
              <strong lang={itemLocale}>{item.translations[itemLocale].title}</strong>
              <Badge tone={{ Easy: 'ok', Medium: 'warn', Hard: 'bad' }[item.difficulty]}>
                {t.sheets[item.difficulty.toLowerCase()] || item.difficulty}
              </Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SolutionFiles({ solutions, problemTitle, problemSlug, locale, onOpenViewer }) {
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
              problemSlug,
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

function ResourceDirectory({ locale, title, pageSize = 12, onOpenViewer }) {
  const t = getMessages(locale);
  const [language, setLanguage] = useState(locale);
  const [pageNum, setPageNum] = useState(1);
  useEffect(() => { setLanguage(locale); setPageNum(1); }, [locale]);
  const allVisible = directories.filter((entry) => !language || entry.locale === language);
  const totalPages = Math.max(1, Math.ceil(allVisible.length / pageSize));
  const currentPageNum = Math.min(pageNum, totalPages);
  const visible = allVisible.slice((currentPageNum - 1) * pageSize, currentPageNum * pageSize);

  return (
    <section className="page-section">
      <div className="section-heading">
        <div>
          <h1 lang={locale}>{title}</h1>
          <p>{t.resources.subtitle}</p>
        </div>
      </div>
      <div className="filters">
        <SelectDropdown
          ariaLabel={t.resources.allLanguages}
          value={language}
          onChange={(val) => { setLanguage(val); setPageNum(1); }}
          prefix={language || undefined}
          options={[
            { value: '', label: t.resources.allLanguages },
            ...locales.map(({ code, native_name }) => ({ value: code, label: native_name, badge: code, lang: code })),
          ]}
        />
      </div>
      <p className="result-count" role="status">{allVisible.length} {t.resources.directoriesUnit}</p>
      <ul className="directory-list">
        {visible.map((entry) => {
          const platform = sourcePlatform(entry.url);
          const isVideo = platform === 'YouTube';
          return (
            <li key={entry.url}>
              <Card variant="outlined">
                <button
                  type="button"
                  className="directory-open-btn"
                  onClick={() => onOpenViewer({
                    url: entry.url,
                    title: entry.name,
                    kind: isVideo ? 'video' : 'article',
                  })}
                >
                  <span>
                    <strong>{entry.name}</strong>
                    <small>{platform}</small>
                    {entry.description && <small>{entry.description}</small>}
                  </span>
                  {isVideo ? <Play size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
                </button>
              </Card>
            </li>
          );
        })}
      </ul>
      <Pagination
        page={currentPageNum}
        totalItems={allVisible.length}
        pageSize={pageSize}
        locale={locale}
        onPageChange={(nextPage) => {
          setPageNum(nextPage);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
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
                title: formatViewerTitle(problemTitle, cleanTitle),
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

const ALLOCATION_COLORS = ['#ff693d', '#f59e0b', '#ea580c', '#fb923c', '#d97706', '#c2410c'];

function InterviewTracks({ locale, title, onOpenViewer }) {
  const t = getMessages(locale);
  const [roleId, setRoleId] = useState(roles[0]?.id || '');
  const [levelId, setLevelId] = useState(levels[1]?.id || levels[0]?.id || '');
  const role = roles.find(({ id }) => id === roleId);
  const visible = modules.filter((item) => item.roles.includes(roleId) && item.levels.includes(levelId));
  const trackLabel = (id) => t.tracks.labels[id] ?? id.replaceAll('_', ' ');
  const weightEntries = Object.entries(role.module_weights_by_level[levelId] || {})
    .sort((a, b) => b[1] - a[1]);

  return (
    <section className="page-section">
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
            options={roles.map(({ id, labels }) => ({ value: id, label: pickLabel(labels, locale), lang: locale }))}
          />
        </div>
        <div className="track-filter-field">
          <span>{t.tracks.experienceLevel}</span>
          <SelectDropdown
            ariaLabel={t.tracks.experienceLevel}
            value={levelId}
            onChange={setLevelId}
            options={levels.map(({ id, labels }) => ({ value: id, label: pickLabel(labels, locale), lang: locale }))}
          />
        </div>
      </div>

      <Card variant="outlined" className="study-allocation-card">
        <div className="study-allocation-head">
          <div>
            <h2>{t.tracks.suggestedTime}</h2>
            <p className="study-allocation-sub">
              {pickLabel(role.labels, locale)} · {pickLabel(levels.find(({ id }) => id === levelId)?.labels || {}, locale)}
            </p>
          </div>
          <span className="study-allocation-total">100%</span>
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
            return (
              <div key={id} className="allocation-item">
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
              </div>
            );
          })}
        </div>
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
  <ThemeProvider defaultTheme="light" storageKey="codegrill:theme">
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </ThemeProvider>,
);
