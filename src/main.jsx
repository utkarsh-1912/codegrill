import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Badge, Button, Card, ThemeProvider, themes, useTheme } from '@utkristi/ui';
import {
  BookOpen, Check, ChevronLeft, ChevronRight, Circle, ExternalLink, FileCode2,
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
import { TracksPage } from './TracksPage.jsx';
import { getAllTrackModules } from './trackContent.mjs';
import { SiteFooter, SitePages, Workflow, sitePages } from './SitePages.jsx';
import { SheetsPage } from './SheetsPage.jsx';
import { ContentViewer, buildViewerPath, formatViewerTitle } from './ContentViewer.jsx';
import { ViewerPage } from './ViewerPage.jsx';
import { ProfilePage } from './ProfilePage.jsx';
import { AuthPage } from './AuthPage.jsx';
import { PublicPortfolioPage } from './PublicPortfolioPage.jsx';
import { ContestsPage } from './ContestsPage.jsx';
import { LanguageIcon } from './LanguageIcon.jsx';
import { CommandPalette } from './CommandPalette.jsx';
import { ProblemPracticeBar } from './ProblemPracticeBar.jsx';
import { AppHeader } from './AppHeader.jsx';
import { ForgeAtlas } from './ForgeAtlas.jsx';
import { ErrorBoundary, ErrorPage, NotFoundPage } from './StatusPages.jsx';
import { SelectDropdown } from './SelectDropdown.jsx';
import { BUILTIN_SHEETS, normalizeCustomSheet } from './sheets.mjs';
import { ROADMAP_DOMAINS, buildDomainRoadmap } from './domainRoadmaps.mjs';
import { getChecklistStudyGuide } from './studyMaterial.mjs';
import { mergeCatalogProblems, problemPlatformBadge, problemPlatformLabel } from './externalProblems.mjs';
import { DEFAULT_APP_CONFIG } from './config.mjs';
import { getMessages } from './i18n.mjs';
import { createCloudApiAdapter, importLocalWorkspaceBackup, mergeNotesByTimestamp, scopedStorageKey } from './storageAdapter.mjs';
import { getValidIdToken, isFirebaseConfigured, readAuthSession, signOutAuth } from './firebaseAuth.mjs';
import {
  checkBackendHealth,
  createCustomSheetApi,
  deleteCustomSheetApi,
  fetchAllSheets,
  fetchAppConfig,
  fetchDailyChallenge,
  fetchRemoteProfiles,
  fetchRemoteProgress,
  readLocalCustomSheets,
  readLocalProfiles,
  resetRemoteProgress,
  saveRemoteProfiles,
  saveRemoteProgress,
  writeLocalCustomSheets,
  writeLocalProfiles,
} from './api.mjs';

const { roadmap_categories: categories, languages } = curriculum;
const problems = mergeCatalogProblems(curriculum.problems);
const EXTRA_ENGINEERING_DIRECTORIES = [
  {
    name: 'System Design Primer (HLD)',
    url: 'https://github.com/donnemartin/system-design-primer',
    description: 'Scalability, caching, sharding, CAP theorem, and distributed system design blueprints.',
    locale: 'en',
  },
  {
    name: 'Awesome Low-Level Design (LLD & OOD)',
    url: 'https://github.com/ashishps1/awesome-low-level-design',
    description: 'SOLID principles, design patterns, and machine coding solutions (Parking Lot, Splitwise, BookMyShow).',
    locale: 'en',
  },
  {
    name: 'System Design Architecture Guide',
    url: 'https://github.com/karanpratapsingh/system-design',
    description: 'Databases, replication, message queues, load balancing, and real-world system architectures.',
    locale: 'en',
  },
  {
    name: 'Tech Interview Handbook (Behavioral, SQL & CS)',
    url: 'https://github.com/yangshun/tech-interview-handbook',
    description: 'Curated interview guides covering behavioral STAR prep, CS fundamentals, and study plans.',
    locale: 'en',
  },
];

const directories = [
  ...EXTRA_ENGINEERING_DIRECTORIES,
  ...curriculum.directories
    .filter(({ url }) => safeUrl(url)?.hostname !== 'neetcode.io')
    .map((entry) => {
      if (!/neetcode/i.test(entry.name)) return /neetcode/i.test(entry.description ?? '') ? { ...entry, description: undefined } : entry;
      const name = entry.name === 'NeetCode' ? 'Coding walkthroughs'
        : entry.name.includes('freeCodeCamp') ? 'freeCodeCamp coding interview course' : 'Coding solutions repository';
      return { ...entry, name, description: undefined };
    }),
];

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
const modules = getAllTrackModules(seed);
const problemSlugs = new Set(problems.map(({ slug }) => slug));

const pathIds = ['roadmap', 'sheets', 'problems', 'tracks', 'resources', 'rooms'];
const preferenceKey = 'codegrill:study:v1';
const pickLabel = (labels, locale) => labels[locale] ?? labels[defaultLocale];

function computeStreakStats(activity = {}, previousLongest = 0) {
  const activeDates = Object.entries(activity || {})
    .filter(([day, count]) => /^\d{4}-\d{2}-\d{2}$/.test(day) && Number(count) > 0)
    .map(([day]) => day)
    .sort();

  if (!activeDates.length) {
    return { streak: 0, longestStreak: Math.max(0, Number(previousLongest) || 0) };
  }

  const activeSet = new Set(activeDates);
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setUTCDate(today.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  let streak = 0;
  let cursor = null;
  if (activeSet.has(todayStr)) cursor = new Date(`${todayStr}T00:00:00Z`);
  else if (activeSet.has(yesterdayStr)) cursor = new Date(`${yesterdayStr}T00:00:00Z`);

  while (cursor) {
    const key = cursor.toISOString().slice(0, 10);
    if (!activeSet.has(key)) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  let bestRun = 0;
  let run = 0;
  let prevMs = null;
  for (const day of activeDates) {
    const ms = Date.parse(`${day}T00:00:00Z`);
    if (prevMs !== null && ms - prevMs === 86400000) run += 1;
    else run = 1;
    if (run > bestRun) bestRun = run;
    prevMs = ms;
  }

  return {
    streak,
    longestStreak: Math.max(bestRun, streak, Number(previousLongest) || 0),
  };
}

function readPreferences(uid = '') {
  try {
    const saved = JSON.parse(localStorage.getItem(scopedStorageKey(preferenceKey, uid)));
    const activity = saved?.activity && typeof saved.activity === 'object' ? saved.activity : {};
    const stats = computeStreakStats(activity, Number(saved?.longestStreak || 0));
    return {
      locale: locales.some(({ code }) => code === saved?.locale) ? saved.locale : defaultLocale,
      completed: new Set(Array.isArray(saved?.completed)
        ? saved.completed.filter((slug) => problemSlugs.has(slug))
        : []),
      bookmarked: new Set(Array.isArray(saved?.bookmarked)
        ? saved.bookmarked.filter((slug) => problemSlugs.has(slug))
        : []),
      notes: saved?.notes && typeof saved.notes === 'object' ? saved.notes : {},
      notesUpdatedAt: saved?.notesUpdatedAt && typeof saved.notesUpdatedAt === 'object' ? saved.notesUpdatedAt : {},
      activity,
      streak: stats.streak,
      longestStreak: stats.longestStreak,
    };
  } catch {
    return { locale: defaultLocale, completed: new Set(), bookmarked: new Set(), notes: {}, notesUpdatedAt: {}, activity: {}, streak: 0, longestStreak: 0 };
  }
}

const validPages = new Set([...pathIds, ...sitePages, 'profile', 'login', 'signup', 'viewer', 'contests', 'error']);

function currentPage() {
  // Support legacy hash URLs seamlessly by reading them if present
  if (window.location.hash && window.location.hash.length > 1) {
    const legacy = studyLocation(window.location.hash, problemSlugs);
    const legacyQuery = window.location.hash.split('?')[1] || '';
    const legacyPath = validPages.has(legacy.page) && legacy.page !== 'home' ? '/' + legacy.page : '/';
    const cleanPath = legacyPath + (legacyQuery ? '?' + legacyQuery : '');
    window.history.replaceState({}, '', cleanPath);
  }

  const rawPath = window.location.pathname.replace(/\/+$/, '') || '/';
  const portfolioMatch = /^\/u\/([a-zA-Z0-9._-]{1,40})$/.exec(rawPath);
  const segment = rawPath === '/' ? 'home' : rawPath.slice(1);
  const params = new URLSearchParams(window.location.search);
  const problemParam = params.get('problem') || '';
  const topicParam = params.get('topic') || '';
  const isKnown = validPages.has(segment);
  const page = portfolioMatch ? 'portfolio' : (isKnown ? segment : 'not-found');
  const portfolioHandle = portfolioMatch?.[1] ?? '';

  const domainParam = params.get('domain') || '';
  const validDomain = ROADMAP_DOMAINS.some((d) => d.id === domainParam) ? domainParam : '';

  return {
    page,
    portfolioHandle,
    pathname: window.location.pathname,
    problem: (page === 'problems' || page === 'rooms' || page === 'viewer') && problemSlugs.has(problemParam) ? problemParam : '',
    topic: page === 'problems' && !problemParam && categories.some(({ id }) => id === topicParam) ? topicParam : '',
    roadmapDomain: page === 'roadmap' ? validDomain : '',
    roadmapTopic: page === 'roadmap' ? topicParam : '',
    roomId: page === 'rooms' ? (params.get('room') || '') : '',
    roomMode: page === 'rooms' ? (params.get('mode') || '') : '',
    viewerUrl: page === 'viewer' ? (params.get('url') || '') : '',
    viewerTitle: page === 'viewer' ? (params.get('title') || '') : '',
    viewerKind: page === 'viewer' ? (params.get('kind') || '') : '',
    viewerLang: page === 'viewer' ? (params.get('lang') || '') : '',
    viewerModuleId: page === 'viewer' ? (params.get('module') || '') : '',
  };
}

function App() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [authSession, setAuthSession] = useState(readAuthSession);
  const [preferences, setPreferences] = useState(() => readPreferences(readAuthSession()?.uid || ''));
  const { locale, completed, bookmarked, notes, notesUpdatedAt, activity, streak, longestStreak } = preferences;
  const [{ page, portfolioHandle, pathname, problem: sharedProblem, topic, roadmapDomain, roadmapTopic, roomId, roomMode, viewerUrl, viewerTitle, viewerKind, viewerLang, viewerModuleId }, setLocation] = useState(currentPage);
  const [zenMode, setZenMode] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [appConfig, setAppConfig] = useState(DEFAULT_APP_CONFIG);
  const [dailyChallenge, setDailyChallenge] = useState(null);
  const [backendOnline, setBackendOnline] = useState(false);
  const [authEnforced, setAuthEnforced] = useState(false);
  const [customSheets, setCustomSheets] = useState(() => readLocalCustomSheets(readAuthSession()?.uid || ''));
  const [linkedProfiles, setLinkedProfiles] = useState(() => readLocalProfiles(readAuthSession()?.uid || ''));
  const [portfolioSettings, setPortfolioSettings] = useState({ handle: '', isPublicProfile: false });
  const [viewerItem, setViewerItem] = useState(null);
  const hydratedRef = useRef(false);
  const migratingRef = useRef(false);
  const cloudRevisionRef = useRef('');

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
      const [health, remoteConfig, daily] = await Promise.all([
        checkBackendHealth(),
        fetchAppConfig(),
        fetchDailyChallenge(problems),
      ]);
      if (!active) return;
      setBackendOnline(health.workspaceAvailable);
      setAuthEnforced(Boolean(health.authEnforced));
      setAppConfig(remoteConfig);
      setDailyChallenge(daily);
      const startupSession = readAuthSession();
      const startupUid = startupSession?.uid || '';
      const canSyncNow = health.workspaceAvailable && (!health.authEnforced || Boolean(startupSession));
      if (canSyncNow) {
        const cloud = createCloudApiAdapter({ apiBaseUrl: remoteConfig.apiBaseUrl, getIdToken: getValidIdToken });
        const [remote, remoteProfilesObj, remoteSheetsObj] = await Promise.all([
          health.authEnforced ? cloud.getProgress().catch(() => null) : fetchRemoteProgress(remoteConfig.defaultProfile),
          health.authEnforced ? cloud.getLinkedProfiles().catch(() => null) : fetchRemoteProfiles(remoteConfig.defaultProfile),
          (health.authEnforced || startupSession)
            ? cloud.getCustomSheets().catch(() => null)
            : fetchAllSheets(remoteConfig.apiBaseUrl, startupUid),
        ]);
        const remoteProfiles = remoteProfilesObj?.profiles || remoteProfilesObj;
        if (active && remote) {
          cloudRevisionRef.current = remote.updatedAt || '';
          setPortfolioSettings({
            handle: remote.handle || '',
            isPublicProfile: Boolean(remote.isPublicProfile),
          });
          setPreferences((prev) => {
            const mergedActivity = { ...(remote.activity || {}), ...prev.activity };
            const mergedNoteState = mergeNotesByTimestamp(
              remote.notes,
              remote.notesUpdatedAt,
              prev.notes,
              prev.notesUpdatedAt,
              remote.updatedAt,
              { preferRemoteDeletions: true },
            );
            const stats = computeStreakStats(
              mergedActivity,
              Math.max(Number(remote.longestStreak || 0), Number(prev.longestStreak || 0)),
            );
            return {
              locale: locales.some(({ code }) => code === remote.locale) ? remote.locale : prev.locale,
              completed: new Set((remote.completed || []).filter((s) => problemSlugs.has(s))),
              bookmarked: new Set((remote.bookmarked || []).filter((s) => problemSlugs.has(s))),
              notes: mergedNoteState.notes,
              notesUpdatedAt: mergedNoteState.notesUpdatedAt,
              activity: mergedActivity,
              streak: stats.streak,
              longestStreak: stats.longestStreak,
            };
          });
          if (remoteProfiles && Object.keys(remoteProfiles).length > 0) {
            setLinkedProfiles((prev) => {
              const next = { ...remoteProfiles, ...prev };
              writeLocalProfiles(next, startupUid);
              return next;
            });
          }
          if (Array.isArray(remoteSheetsObj?.custom)) {
            setCustomSheets(remoteSheetsObj.custom);
            writeLocalCustomSheets(remoteSheetsObj.custom, startupUid);
          }
          hydratedRef.current = true;
        }
        // If remote progress read failed (remote === null), keep hydratedRef.current = false
        // so subsequent local edits never overwrite unhydrated cloud state.
      } else {
        hydratedRef.current = true;
      }
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

  // Persist to account-scoped localStorage & sync to backend with optimistic concurrency (expectedUpdatedAt)
  useEffect(() => {
    const payload = {
      locale,
      completed: [...completed],
      bookmarked: [...bookmarked],
      notes,
      notesUpdatedAt,
      activity,
      streak,
      longestStreak,
    };
    const activePrefKey = scopedStorageKey(preferenceKey, authSession?.uid || '');
    try {
      localStorage.setItem(activePrefKey, JSON.stringify(payload));
    } catch {
      // Ignore storage errors
    }
    if (backendOnline && hydratedRef.current && !migratingRef.current && (!authEnforced || authSession)) {
      const requestPayload = cloudRevisionRef.current
        ? { ...payload, expectedUpdatedAt: cloudRevisionRef.current }
        : payload;
      const savePromise = authSession
        ? createCloudApiAdapter({ apiBaseUrl: appConfig.apiBaseUrl, getIdToken: getValidIdToken })
            .upsertProgress(requestPayload)
            .catch((err) => {
              if (err?.status === 409 && err?.progress) {
                return { __conflict: true, progress: err.progress };
              }
              return null;
            })
        : saveRemoteProgress(requestPayload, appConfig.defaultProfile);
      savePromise.then((saved) => {
        if (!saved) return;
        if (saved.__conflict && saved.progress) {
          // Another device wrote a newer revision: adopt authoritative remote sets so deletions are never resurrected
          const remote = saved.progress;
          cloudRevisionRef.current = remote.updatedAt || '';
          setPreferences((curr) => {
            const mergedActivity = { ...(remote.activity || {}), ...curr.activity };
            const mergedNoteState = mergeNotesByTimestamp(
              remote.notes,
              remote.notesUpdatedAt,
              curr.notes,
              curr.notesUpdatedAt,
              remote.updatedAt,
              { preferRemoteDeletions: true },
            );
            const stats = computeStreakStats(
              mergedActivity,
              Math.max(Number(remote.longestStreak || 0), Number(curr.longestStreak || 0)),
            );
            return {
              ...curr,
              locale: locales.some(({ code }) => code === remote.locale) ? remote.locale : curr.locale,
              completed: new Set((remote.completed || []).filter((s) => problemSlugs.has(s))),
              bookmarked: new Set((remote.bookmarked || []).filter((s) => problemSlugs.has(s))),
              notes: mergedNoteState.notes,
              notesUpdatedAt: mergedNoteState.notesUpdatedAt,
              activity: mergedActivity,
              streak: stats.streak,
              longestStreak: stats.longestStreak,
            };
          });
          return;
        }
        if (saved.updatedAt) {
          cloudRevisionRef.current = saved.updatedAt;
        }
        if (saved.streak !== streak || saved.longestStreak !== longestStreak) {
          setPreferences((curr) => ({
            ...curr,
            streak: Number(saved.streak || curr.streak || 0),
            longestStreak: Number(saved.longestStreak || curr.longestStreak || 0),
          }));
        }
      });
    }
  }, [locale, completed, bookmarked, notes, activity, backendOnline, authEnforced, authSession, appConfig.defaultProfile, appConfig.apiBaseUrl]);

  async function handleAuthSignIn(session) {
    migratingRef.current = true;
    try {
      const prevUid = authSession?.uid || '';
      const isDifferentAccount = Boolean(prevUid && session?.uid && prevUid !== session.uid);

      if (backendOnline) {
        const cloud = createCloudApiAdapter({ apiBaseUrl: appConfig.apiBaseUrl, getIdToken: async () => session.idToken || getValidIdToken() });
        if (isDifferentAccount) {
          // Never import a previous account's workspace into a different signed-in account
          const [remote, remoteProfilesObj, remoteSheetsObj] = await Promise.all([
            cloud.getProgress(),
            cloud.getLinkedProfiles().catch(() => null),
            cloud.getCustomSheets().catch(() => null),
          ]);
          if (!remote || typeof remote !== 'object') {
            throw new Error('Could not load cloud progress for the new account');
          }
          cloudRevisionRef.current = remote.updatedAt || '';
          const remoteActivity = remote.activity || {};
          const stats = computeStreakStats(remoteActivity, Number(remote.longestStreak || 0));
          setPreferences({
            locale: locales.some(({ code }) => code === remote.locale) ? remote.locale : locale,
            completed: new Set((remote.completed || []).filter((s) => problemSlugs.has(s))),
            bookmarked: new Set((remote.bookmarked || []).filter((s) => problemSlugs.has(s))),
            notes: remote.notes || {},
            notesUpdatedAt: remote.notesUpdatedAt || {},
            activity: remoteActivity,
            streak: stats.streak,
            longestStreak: stats.longestStreak,
          });
          setLinkedProfiles(remoteProfilesObj?.profiles || {});
          setCustomSheets(Array.isArray(remoteSheetsObj?.custom) ? remoteSheetsObj.custom : []);
        } else {
          const res = await cloud.importGuestProgress({
            locale,
            completed: [...completed],
            bookmarked: [...bookmarked],
            notes,
            notesUpdatedAt,
            activity,
            linkedProfiles,
            customSheets,
          });
          if (!res?.ok || !res?.progress) {
            throw new Error('Cloud migration did not return merged progress');
          }
          cloudRevisionRef.current = res.progress.updatedAt || '';
          const mergedActivity = { ...activity, ...(res.progress.activity || {}) };
          const stats = computeStreakStats(mergedActivity, Math.max(longestStreak, Number(res.progress.longestStreak || 0)));
          setPreferences((curr) => {
            const mergedNoteState = mergeNotesByTimestamp(
              res.progress.notes,
              res.progress.notesUpdatedAt,
              curr.notes,
              curr.notesUpdatedAt,
              res.progress.updatedAt,
            );
            return {
              ...curr,
              completed: new Set([...curr.completed, ...(res.progress.completed || []).filter((s) => problemSlugs.has(s))]),
              bookmarked: new Set([...curr.bookmarked, ...(res.progress.bookmarked || []).filter((s) => problemSlugs.has(s))]),
              notes: mergedNoteState.notes,
              notesUpdatedAt: mergedNoteState.notesUpdatedAt,
              activity: mergedActivity,
              streak: stats.streak,
              longestStreak: stats.longestStreak,
            };
          });
          // Clear guest storage once imported so another tab signing into a different account won't re-import it
          try {
            localStorage.removeItem(preferenceKey);
            localStorage.removeItem('codegrill:linked-profiles:v1');
            localStorage.removeItem('codegrill:custom-sheets:v1');
          } catch {}
        }
      } else if (isDifferentAccount) {
        setPreferences(readPreferences(session?.uid || ''));
        setLinkedProfiles({});
        setCustomSheets([]);
      }
      hydratedRef.current = true;
      setAuthSession(session);
    } catch (err) {
      // Do NOT activate cloud saves if guest import or account load fails — prevents unmerged local snapshot from overwriting cloud state
      signOutAuth();
      setAuthSession(null);
      throw new Error(err?.message || 'Cloud sync migration failed. Your local progress is safe; please retry.');
    } finally {
      migratingRef.current = false;
    }
  }

  function handleAuthSignOut() {
    const prevUid = authSession?.uid || '';
    signOutAuth();
    setAuthSession(null);
    cloudRevisionRef.current = '';
    // Clear account-scoped private progress so a subsequent sign-in on this browser never inherits the previous user's notes/progress
    setPreferences((curr) => ({
      locale: curr.locale,
      completed: new Set(),
      bookmarked: new Set(),
      notes: {},
      notesUpdatedAt: {},
      activity: {},
      streak: 0,
      longestStreak: 0,
    }));
    setLinkedProfiles({});
    setCustomSheets([]);
    try {
      if (prevUid) {
        localStorage.removeItem(scopedStorageKey(preferenceKey, prevUid));
        localStorage.removeItem(scopedStorageKey('codegrill:custom-sheets:v1', prevUid));
        localStorage.removeItem(scopedStorageKey('codegrill:linked-profiles:v1', prevUid));
      }
      localStorage.removeItem(preferenceKey);
      localStorage.removeItem('codegrill:linked-profiles:v1');
      localStorage.removeItem('codegrill:custom-sheets:v1');
    } catch {
      // Ignore storage errors
    }
  }

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
      const today = new Date().toISOString().slice(0, 10);
      if (updated.has(slug)) {
        updated.delete(slug);
        if (nextActivity[today] > 1) {
          nextActivity[today] -= 1;
        } else {
          delete nextActivity[today];
        }
      } else {
        updated.add(slug);
        nextActivity[today] = (nextActivity[today] || 0) + 1;
      }
      const stats = computeStreakStats(nextActivity, current.longestStreak);
      return {
        ...current,
        completed: updated,
        activity: nextActivity,
        streak: stats.streak,
        longestStreak: stats.longestStreak,
      };
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
      const nextNotesUpdatedAt = { ...(current.notesUpdatedAt || {}) };
      if (text.trim()) {
        nextNotes[slug] = text.trim();
        nextNotesUpdatedAt[slug] = new Date().toISOString();
      } else {
        delete nextNotes[slug];
        delete nextNotesUpdatedAt[slug];
      }
      return { ...current, notes: nextNotes, notesUpdatedAt: nextNotesUpdatedAt };
    });
  }

  async function handleSaveProfiles(nextProfiles) {
    setLinkedProfiles(nextProfiles);
    if (authSession) {
      const uid = authSession.uid || '';
      writeLocalProfiles(nextProfiles, uid);
      if (backendOnline) {
        try {
          const cloud = createCloudApiAdapter({ apiBaseUrl: appConfig.apiBaseUrl, getIdToken: getValidIdToken });
          const saved = await cloud.saveLinkedProfiles(nextProfiles);
          if (saved?.profiles) {
            setLinkedProfiles(saved.profiles);
            writeLocalProfiles(saved.profiles, uid);
          }
        } catch {
          // Keep account-scoped local cache only; never fall back to shared guest storage
        }
      }
      return;
    }
    if (!authEnforced && backendOnline) {
      const saved = await saveRemoteProfiles(nextProfiles, appConfig.defaultProfile, appConfig.apiBaseUrl, '');
      if (saved) setLinkedProfiles(saved);
    } else {
      writeLocalProfiles(nextProfiles, '');
    }
  }

  async function handleRestoreBackup(rawText) {
    const parsed = typeof rawText === 'string' ? JSON.parse(rawText) : rawText;
    if (!parsed || typeof parsed !== 'object' || !parsed.data || typeof parsed.data !== 'object') {
      throw new Error('Invalid Codegrill backup file format');
    }
    const study = parsed.data['codegrill:study:v1'] || parsed.data['codegrill-preferences-v2'] || null;
    const hasStudy = Boolean(study && typeof study === 'object');
    const restoredProfiles = parsed.data['codegrill:linked-profiles:v1'];
    const hasProfiles = Boolean(restoredProfiles && typeof restoredProfiles === 'object' && !Array.isArray(restoredProfiles));
    const restoredSheets = Array.isArray(parsed.data['codegrill:custom-sheets:v1'])
      ? parsed.data['codegrill:custom-sheets:v1'].map((s) => normalizeCustomSheet(s, problemSlugs))
      : null;
    const hasSheets = Boolean(restoredSheets && restoredSheets.length > 0);

    if (!hasStudy && !hasProfiles && !hasSheets) {
      throw new Error('Backup file does not contain any Codegrill progress, profiles, or sheets to restore.');
    }

    const progressPatch = {};
    if (hasStudy) {
      if (locales.some(({ code }) => code === study.locale)) progressPatch.locale = study.locale;
      if (Array.isArray(study.completed)) progressPatch.completed = study.completed.filter((s) => problemSlugs.has(s));
      if (Array.isArray(study.bookmarked)) progressPatch.bookmarked = study.bookmarked.filter((s) => problemSlugs.has(s));
      if (study.notes && typeof study.notes === 'object' && !Array.isArray(study.notes)) progressPatch.notes = study.notes;
      if (study.notesUpdatedAt && typeof study.notesUpdatedAt === 'object' && !Array.isArray(study.notesUpdatedAt)) {
        progressPatch.notesUpdatedAt = study.notesUpdatedAt;
      }
      if (study.activity && typeof study.activity === 'object' && !Array.isArray(study.activity)) {
        progressPatch.activity = study.activity;
      }
    }
    const hasProgressPatch = Object.keys(progressPatch).length > 0;

    if (authSession && backendOnline) {
      if (!hydratedRef.current || !cloudRevisionRef.current) {
        throw new Error('Cannot restore while cloud state is unhydrated. Refresh once online and retry.');
      }
      migratingRef.current = true;
      try {
        const cloud = createCloudApiAdapter({ apiBaseUrl: appConfig.apiBaseUrl, getIdToken: getValidIdToken });
        const result = await cloud.restoreWorkspace({
          progressPatch: hasProgressPatch ? progressPatch : null,
          linkedProfiles: hasProfiles ? restoredProfiles : null,
          customSheets: hasSheets ? restoredSheets : null,
          expectedUpdatedAt: cloudRevisionRef.current,
        });
        if (!result?.ok || !result?.progress) {
          throw new Error('Atomic cloud restore did not return saved workspace');
        }
        const saved = result.progress;
        cloudRevisionRef.current = saved.updatedAt || cloudRevisionRef.current;
        importLocalWorkspaceBackup(parsed, authSession.uid || '');
        const nextActivity = saved.activity || {};
        const stats = computeStreakStats(nextActivity, Number(saved.longestStreak || 0));
        setPreferences({
          locale: locales.some(({ code }) => code === saved.locale) ? saved.locale : locale,
          completed: new Set((saved.completed || []).filter((s) => problemSlugs.has(s))),
          bookmarked: new Set((saved.bookmarked || []).filter((s) => problemSlugs.has(s))),
          notes: saved.notes || {},
          notesUpdatedAt: saved.notesUpdatedAt || {},
          activity: nextActivity,
          streak: stats.streak,
          longestStreak: stats.longestStreak,
        });
        if (result.profiles && typeof result.profiles === 'object') {
          setLinkedProfiles(result.profiles);
          writeLocalProfiles(result.profiles, authSession.uid || '');
        }
        if (Array.isArray(result.customSheets)) {
          const normalized = result.customSheets.map((s) => normalizeCustomSheet(s, problemSlugs));
          setCustomSheets(normalized);
          writeLocalCustomSheets(normalized, authSession.uid || '');
        }
        return { ok: true, cloudSynced: true };
      } finally {
        migratingRef.current = false;
      }
    }

    const res = importLocalWorkspaceBackup(parsed, authSession?.uid || '');
    if (hasProgressPatch) {
      setPreferences((curr) => {
        const nextActivity = progressPatch.activity ?? curr.activity;
        const stats = computeStreakStats(nextActivity, Number(study?.longestStreak || curr.longestStreak || 0));
        return {
          locale: progressPatch.locale ?? curr.locale,
          completed: progressPatch.completed ? new Set(progressPatch.completed) : curr.completed,
          bookmarked: progressPatch.bookmarked ? new Set(progressPatch.bookmarked) : curr.bookmarked,
          notes: progressPatch.notes ?? curr.notes,
          notesUpdatedAt: progressPatch.notesUpdatedAt ?? curr.notesUpdatedAt,
          activity: nextActivity,
          streak: stats.streak,
          longestStreak: stats.longestStreak,
        };
      });
    }
    if (hasProfiles) setLinkedProfiles(restoredProfiles);
    if (hasSheets) setCustomSheets(restoredSheets);
    return { ok: true, cloudSynced: false, restoredKeys: res.restoredKeys };
  }

  async function handleUpdatePortfolioSettings({ handle, isPublicProfile }) {
    const cleanHandle = String(handle || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 40);
    if (isPublicProfile && !cleanHandle) {
      throw new Error('Choose a public handle (letters, numbers, ".", "_", "-") before publishing.');
    }
    if (authSession && backendOnline) {
      const cloud = createCloudApiAdapter({ apiBaseUrl: appConfig.apiBaseUrl, getIdToken: getValidIdToken });
      const saved = await cloud.upsertProgress({
        handle: cleanHandle,
        isPublicProfile: Boolean(isPublicProfile),
        expectedUpdatedAt: cloudRevisionRef.current || undefined,
      });
      if (saved?.updatedAt) cloudRevisionRef.current = saved.updatedAt;
      const next = { handle: saved?.handle || cleanHandle, isPublicProfile: Boolean(saved?.isPublicProfile) };
      setPortfolioSettings(next);
      return next;
    }
    if (!authEnforced && backendOnline) {
      const saved = await saveRemoteProgress({ handle: cleanHandle, isPublicProfile: Boolean(isPublicProfile) }, appConfig.defaultProfile);
      const next = { handle: saved?.handle || cleanHandle, isPublicProfile: Boolean(saved?.isPublicProfile) };
      setPortfolioSettings(next);
      return next;
    }
    const next = { handle: cleanHandle, isPublicProfile: Boolean(isPublicProfile) };
    setPortfolioSettings(next);
    return next;
  }

  async function resetProgress() {
    migratingRef.current = true;
    try {
      if (backendOnline) {
        if (authSession) {
          // Fail closed: do not clear local state if cloud reset fails
          const fresh = await createCloudApiAdapter({ apiBaseUrl: appConfig.apiBaseUrl, getIdToken: getValidIdToken })
            .resetProgress();
          if (!fresh || typeof fresh !== 'object') {
            throw new Error('Cloud reset did not confirm cleared progress');
          }
          if (fresh.updatedAt) cloudRevisionRef.current = fresh.updatedAt;
        } else if (!authEnforced) {
          const fresh = await resetRemoteProgress(appConfig.defaultProfile);
          if (!fresh) {
            throw new Error('Could not reset workspace on server');
          }
        }
      }
      setPreferences((current) => ({
        locale: current.locale,
        completed: new Set(),
        bookmarked: new Set(),
        notes: {},
        notesUpdatedAt: {},
        activity: {},
        streak: 0,
        longestStreak: 0,
      }));
      try {
        localStorage.setItem(scopedStorageKey(preferenceKey, authSession?.uid || ''), JSON.stringify({
          locale,
          completed: [],
          bookmarked: [],
          notes: {},
          notesUpdatedAt: {},
          activity: {},
          streak: 0,
          longestStreak: 0,
        }));
      } catch {
        // Ignore storage errors
      }
    } finally {
      migratingRef.current = false;
    }
  }

  async function handleCreateSheet(payload) {
    let createdRemote = null;
    if (authSession && backendOnline) {
      createdRemote = await createCloudApiAdapter({ apiBaseUrl: appConfig.apiBaseUrl, getIdToken: getValidIdToken })
        .saveCustomSheet(payload)
        .catch(() => null);
    } else if (!authEnforced) {
      createdRemote = await createCustomSheetApi(payload);
    }
    const sheet = createdRemote || normalizeCustomSheet(payload, problemSlugs);
    const activeUid = authSession?.uid || '';
    setCustomSheets((prev) => {
      const next = [sheet, ...prev.filter((s) => s.id !== sheet.id)];
      writeLocalCustomSheets(next, activeUid);
      return next;
    });
    return sheet;
  }

  async function handleDeleteSheet(id) {
    if (authSession && backendOnline) {
      await createCloudApiAdapter({ apiBaseUrl: appConfig.apiBaseUrl, getIdToken: getValidIdToken })
        .deleteCustomSheet(id)
        .catch(() => null);
    } else if (!authEnforced) {
      await deleteCustomSheetApi(id);
    }
    const activeUid = authSession?.uid || '';
    setCustomSheets((prev) => {
      const next = prev.filter((s) => s.id !== id);
      writeLocalCustomSheets(next, activeUid);
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
        authSession={authSession}
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
            solvedCount={completed.size}
            streak={streak}
            dailyChallenge={dailyChallenge ? problems.find((p) => p.slug === dailyChallenge.slug) || dailyChallenge : null}
            config={appConfig}
            onNavigate={navigate}
            onOpenDaily={openProblemBySlug}
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
              {' · '}
              <a
                href="/profile"
                className="progress-profile-link"
                onClick={(e) => { e.preventDefault(); navigate('/profile'); }}
              >
                {t.ui.viewProfile}
              </a>
            </p>
          </Card>
          <Roadmap
            roadmap={roadmap}
            next={next}
            locale={locale}
            title={t.nav.roadmap}
            initialDomain={roadmapDomain}
            initialTopicId={roadmapTopic}
            onOpen={openProblems}
            onOpenViewer={setViewerItem}
            onNavigate={navigate}
          />
          {!zenMode && (
            <section className="marketing-section">
              <h2>{t.roadmap.howToUse}</h2>
              <Workflow locale={locale} onNavigate={navigate} />
            </section>
          )}
        </>}

        {(page === 'login' || page === 'signup') && (
          <AuthPage
            mode={page}
            locale={locale}
            brandName={appConfig.brand.name}
            authSession={authSession}
            onAuthSignIn={handleAuthSignIn}
            onNavigate={navigate}
          />
        )}

        {page === 'profile' && (
          <ProfilePage
            problems={problems}
            categories={categories}
            completed={completed}
            bookmarked={bookmarked}
            activity={activity}
            dailyChallenge={dailyChallenge}
            streak={streak}
            longestStreak={longestStreak}
            activityDays={appConfig.interview.activityDays}
            linkedProfiles={linkedProfiles}
            apiBaseUrl={appConfig.apiBaseUrl}
            backendOnline={backendOnline}
            authSession={authSession}
            firebaseEnabled={isFirebaseConfigured()}
            onAuthSignIn={handleAuthSignIn}
            onAuthSignOut={handleAuthSignOut}
            onRestoreBackup={handleRestoreBackup}
            portfolioSettings={portfolioSettings}
            onUpdatePortfolioSettings={handleUpdatePortfolioSettings}
            locale={locale}
            defaultLocale={defaultLocale}
            onSaveProfiles={handleSaveProfiles}
            onOpenProblem={openProblemBySlug}
            onOpenViewer={setViewerItem}
            onNavigate={navigate}
          />
        )}

        {page === 'portfolio' && (
          <PublicPortfolioPage
            handle={portfolioHandle}
            problems={problems}
            completed={completed}
            activity={activity}
            streak={streak}
            longestStreak={longestStreak}
            linkedProfiles={linkedProfiles}
            apiBaseUrl={appConfig.apiBaseUrl}
            locale={locale}
            onNavigate={navigate}
          />
        )}

        {page === 'contests' && (
          <ContestsPage
            apiBaseUrl={appConfig.apiBaseUrl}
            locale={locale}
          />
        )}

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

        {page === 'tracks' && (
          <TracksPage
            locale={locale}
            defaultLocale={defaultLocale}
            title={t.nav.tracks}
            roles={roles}
            levels={levels}
            modules={modules}
            problems={problems}
            onOpenViewer={setViewerItem}
            onOpenProblem={openProblemBySlug}
            onNavigate={navigate}
          />
        )}
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
            moduleId={viewerModuleId}
            allModules={modules}
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
          <StudyRooms
            locale={locale}
            defaultLocale={defaultLocale}
            title={t.nav.rooms}
            problems={problems}
            categories={categories}
            languages={languages}
            activeRoomId={roomId}
            activeMode={roomMode}
            sharedProblem={sharedProblem}
            onNavigate={navigate}
            onOpenProblem={openProblemBySlug}
            onOpenViewer={setViewerItem}
          >
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
          try {
            if (Array.isArray(expandedItem?.history) && expandedItem.history.length > 0) {
              sessionStorage.setItem('codegrill:viewer-history:v1', JSON.stringify({
                url: expandedItem.url || '',
                history: expandedItem.history,
                historyIndex: Number(expandedItem.historyIndex) || 0,
              }));
            }
          } catch {
            // Ignore sessionStorage errors
          }
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
        modules={modules}
        locale={locale}
        defaultLocale={defaultLocale}
        onSelect={(item) => {
          if (item.kind === 'problem') openProblemBySlug(item.id);
          else if (item.kind === 'topic') openProblems(item.id);
          else if (item.kind === 'sheet') navigate('/sheets');
          else if (item.kind === 'domain-topic') {
            navigate(`/roadmap?${new URLSearchParams({ domain: item.domainId, topic: item.id })}`);
          } else if (item.kind === 'module') {
            const mod = modules.find((m) => m.id === item.id);
            const primary = mod ? resourcesFor(mod.resources, locale, defaultLocale)[0] : null;
            if (primary) {
              navigate(buildViewerPath({
                url: primary.url,
                title: item.label,
                kind: primary.kind === 'video' ? 'video' : 'article',
                moduleId: mod.id,
              }));
            } else {
              navigate('/tracks');
            }
          }
        }}
      />
    </div>
  );
}

const DOMAIN_CHECKS_KEY = 'codegrill:domain-roadmap:v1';
const DOMAIN_FAVS_KEY = 'codegrill:domain-favorites:v1';

function Roadmap({ roadmap, next, locale, title, initialDomain = '', initialTopicId = '', onOpen, onOpenViewer, onNavigate }) {
  const t = getMessages(locale);
  const [domain, setDomain] = useState(initialDomain || 'dsa');
  const [stage, setStage] = useState('all');
  const [selectedId, setSelectedId] = useState(initialTopicId || next?.id || roadmap[0].id);

  useEffect(() => {
    if (initialDomain) {
      setDomain(initialDomain);
      setStage('all');
      if (initialTopicId) {
        setSelectedId(initialTopicId);
      } else if (initialDomain === 'dsa') {
        setSelectedId(next?.id ?? roadmap[0].id);
      } else {
        const list = buildDomainRoadmap(initialDomain, domainChecks);
        if (list[0]) setSelectedId(list[0].id);
      }
    }
  }, [initialDomain, initialTopicId]);
  const [domainChecks, setDomainChecks] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(DOMAIN_CHECKS_KEY) || '{}') || {};
    } catch {
      return {};
    }
  });
  const [domainFavs, setDomainFavs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(DOMAIN_FAVS_KEY) || '{}') || {};
    } catch {
      return {};
    }
  });

  function toggleDomainCheck(topicId, idx) {
    setDomainChecks((prev) => {
      const key = `${topicId}:${idx}`;
      const nextChecks = { ...prev, [key]: !prev[key] };
      if (!nextChecks[key]) delete nextChecks[key];
      try {
        localStorage.setItem(DOMAIN_CHECKS_KEY, JSON.stringify(nextChecks));
      } catch {
        // Ignore storage errors
      }
      return nextChecks;
    });
  }

  function toggleDomainFav(topic, idx, domainId) {
    setDomainFavs((prev) => {
      const key = `${topic.id}:${idx}`;
      const nextFavs = { ...prev };
      if (nextFavs[key]) {
        delete nextFavs[key];
      } else {
        nextFavs[key] = {
          key,
          domainId,
          topicId: topic.id,
          topicTitle: topic.title,
          itemIndex: idx,
          itemText: topic.checklist?.[idx] || topic.title,
          sourceUrl: topic.resources?.[0]?.url || '',
        };
      }
      try {
        localStorage.setItem(DOMAIN_FAVS_KEY, JSON.stringify(nextFavs));
      } catch {
        // Ignore storage errors
      }
      return nextFavs;
    });
  }

  const isDsa = domain === 'dsa';
  const activeTopics = isDsa ? roadmap : buildDomainRoadmap(domain, domainChecks);
  const stages = [...new Set(activeTopics.map(({ depth }) => depth))].sort((a, b) => a - b);
  const selected = activeTopics.find(({ id }) => id === selectedId) || activeTopics[0];
  const visible = stage === 'all' ? stages : stages.filter((d) => d === stage);
  const status = (topic) => (
    topic.complete ? t.roadmap.statusComplete : topic.ready ? t.roadmap.statusReady : t.roadmap.statusPrerequisites
  );

  function changeDomain(nextDomain) {
    setDomain(nextDomain);
    setStage('all');
    if (nextDomain === 'dsa') {
      setSelectedId(next?.id ?? roadmap[0].id);
    } else {
      const nextList = buildDomainRoadmap(nextDomain, domainChecks);
      const firstReady = nextList.find((item) => item.ready && !item.complete) || nextList[0];
      if (firstReady) setSelectedId(firstReady.id);
    }
  }

  function changeStage(depth) {
    setStage(depth);
    if (depth !== 'all' && selected && selected.depth !== depth) {
      const target = activeTopics.find((topic) => topic.depth === depth && topic.ready && !topic.complete)
        ?? activeTopics.find((topic) => topic.depth === depth);
      if (target) setSelectedId(target.id);
    }
  }

  return (
    <section className="roadmap" aria-labelledby="roadmap-title">
      <div className="section-heading">
        <div>
          <h2 id="roadmap-title" lang={locale}>{title}</h2>
          <p>{t.roadmap.subtitle}</p>
        </div>
        <Badge variant="outlined">{activeTopics.length} {t.roadmap.topicsUnit}</Badge>
      </div>

      <div className="roadmap-domain-tabs" role="tablist" aria-label="Roadmap domains">
        {ROADMAP_DOMAINS.map((d) => (
          <button
            key={d.id}
            type="button"
            role="tab"
            aria-selected={domain === d.id}
            className={`roadmap-domain-tab ${domain === d.id ? 'is-active' : ''}`}
            onClick={() => changeDomain(d.id)}
          >
            {d.labels[locale] || d.labels.en}
          </button>
        ))}
      </div>

      <div className="stage-selector" role="group" aria-label={t.roadmap.allStages}>
        <button type="button" aria-pressed={stage === 'all'} onClick={() => changeStage('all')}>
          {t.roadmap.allStages}
        </button>
        {stages.map((depth) => {
          const topics = activeTopics.filter((topic) => topic.depth === depth);
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
                {activeTopics.filter((topic) => topic.depth === depth).map((topic) => (
                  <button
                    key={topic.id}
                    type="button"
                    className="map-topic map-topic-text-only"
                    aria-pressed={selected?.id === topic.id}
                    onClick={() => {
                      setSelectedId(topic.id);
                      if (window.matchMedia('(max-width: 740px)').matches) {
                        requestAnimationFrame(() => document.getElementById('topic-details')?.focus());
                      }
                    }}
                  >
                    <span>
                      <strong lang={isDsa ? locale : 'en'}>
                        {isDsa ? pickLabel(topic.labels, locale) : topic.title}
                      </strong>
                      <small>{topic.done}/{topic.total} {t.progress.solvedOf} · {status(topic)}</small>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>

        {selected && (
          <Card variant="outlined" className="topic-inspector" id="topic-details" tabIndex={-1}>
            <div aria-live="polite">
              <p className="inspector-label">{status(selected)}</p>
              <h3 lang={isDsa ? locale : 'en'}>
                {isDsa ? pickLabel(selected.labels, locale) : selected.title}
              </h3>
              {!isDsa && selected.summary && (
                <p className="domain-inspector-summary">{selected.summary}</p>
              )}
              <p>{selected.done} / {selected.total} {t.progress.solvedOf}</p>
              <progress value={selected.done} max={Math.max(1, selected.total)} aria-label={t.progress.title} />

              {!isDsa && selected.checklist?.length > 0 && (
                <div className="domain-checklist">
                  {selected.checklist.map((itemText, idx) => {
                    const checked = Boolean(domainChecks[`${selected.id}:${idx}`]);
                    const isFav = Boolean(domainFavs[`${selected.id}:${idx}`]);
                    return (
                      <div key={idx} className={`domain-check-row ${checked ? 'is-checked' : ''}`}>
                        <label className="domain-check-label">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleDomainCheck(selected.id, idx)}
                          />
                          <span>{itemText}</span>
                        </label>
                        <div className="domain-check-actions">
                          <button
                            type="button"
                            className={`icon-btn domain-check-fav-btn ${isFav ? 'is-active' : ''}`}
                            aria-pressed={isFav}
                            aria-label={isFav ? 'Remove from favorites / read again' : 'Mark favorite / read again'}
                            title={isFav ? 'Saved to read again' : 'Mark favorite / read again'}
                            onClick={() => toggleDomainFav(selected, idx, domain)}
                          >
                            <Star size={14} fill={isFav ? 'currentColor' : 'none'} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="icon-btn domain-check-read-btn"
                            aria-label={`Read guide: ${itemText}`}
                            title="Read Codegrill guide"
                            onClick={() => onOpenViewer({
                              title: itemText,
                              kind: 'markdown',
                              content: getChecklistStudyGuide(selected, idx),
                              sourceUrl: selected.resources?.[0]?.url || '',
                            })}
                          >
                            <BookOpen size={14} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {!isDsa && selected.interviewPrompts?.length > 0 && (
                <div className="domain-prompts">
                  <h4>{t.ui.interviewPrompts}</h4>
                  <ul>
                    {selected.interviewPrompts.map((promptText, idx) => (
                      <li key={idx}>{promptText}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!!selected.prerequisites?.length && (
                <div className="topic-related">
                  <h4>{t.roadmap.prerequisites}</h4>
                  {selected.prerequisites.map((id) => {
                    const prerequisite = activeTopics.find((topic) => topic.id === id);
                    if (!prerequisite) return null;
                    return (
                      <button key={id} type="button" onClick={() => {
                        if (stage !== 'all') setStage(prerequisite.depth);
                        setSelectedId(id);
                      }}>
                        {prerequisite.complete ? <Check size={15} aria-hidden="true" /> : <Circle size={15} aria-hidden="true" />}
                        <span lang={isDsa ? locale : 'en'}>
                          {isDsa ? pickLabel(prerequisite.labels, locale) : prerequisite.title}
                        </span>
                        <small>{prerequisite.done}/{prerequisite.total}</small>
                      </button>
                    );
                  })}
                </div>
              )}

              {!isDsa && selected.resources?.length > 0 && (
                <div className="domain-resources">
                  <h4>{t.ui.studyGuides}</h4>
                  {selected.resources.map((res) => (
                    <button
                      key={res.url}
                      type="button"
                      className="resource-open-btn"
                      onClick={() => onOpenViewer({
                        url: res.url,
                        title: res.title,
                        kind: 'article',
                      })}
                    >
                      <BookOpen size={15} aria-hidden="true" />
                      <span>
                        <strong>{res.title}</strong>
                        <small>{res.platform}</small>
                      </span>
                      <ChevronRight size={14} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {isDsa ? (
              <Button variant="solid" onClick={() => onOpen(selected.id)}>{t.roadmap.openTopic}</Button>
            ) : (
              <Button variant="outlined" onClick={() => onNavigate('/tracks')}>
                {t.nav.tracks} <ChevronRight size={15} aria-hidden="true" />
              </Button>
            )}
          </Card>
        )}
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
  const [platformFilter, setPlatformFilter] = useState('');
  const [progressFilter, setProgressFilter] = useState('');
  const [openSlug, setOpenSlug] = useState(sharedProblem);
  const [noteDrafts, setNoteDrafts] = useState({});
  const [savedNotice, setSavedNotice] = useState('');

  useEffect(() => {
    if (sharedProblem) {
      setOpenSlug(sharedProblem);
      setQuery('');
      setDifficulty('');
      setPlatformFilter('');
      setProgressFilter('');
    }
  }, [sharedProblem]);

  const matches = matchingProblems(problems, categories, { query, difficulty, topic, locale })
    .filter((p) => {
      if (platformFilter && (p.platform || 'leetcode') !== platformFilter) return false;
      if (!progressFilter) return true;
      if (progressFilter === 'revision') return bookmarked.has(p.slug);
      return completed.has(p.slug) === (progressFilter === 'solved');
    });

  const sharedIndex = matches.findIndex(({ slug }) => slug === sharedProblem);
  const ordered = sharedIndex > 0
    ? [matches[sharedIndex], ...matches.slice(0, sharedIndex), ...matches.slice(sharedIndex + 1)]
    : matches;

  const visible = ordered;

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
          ariaLabel={t.ui.platformLabel}
          value={platformFilter}
          onChange={setPlatformFilter}
          options={[
            { value: '', label: t.ui.allPlatforms },
            { value: 'leetcode', label: 'LeetCode', badge: 'LC' },
            { value: 'codeforces', label: 'Codeforces', badge: 'CF' },
            { value: 'hackerrank', label: 'HackerRank', badge: 'HR' },
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
        {(query || topic || difficulty || platformFilter || progressFilter) && (
          <Button variant="quiet" size="sm" onClick={() => {
            setQuery(''); setDifficulty(''); setPlatformFilter(''); setProgressFilter(''); setTopic('');
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
                  <span className="problem-number">{problem.display_id || `#${problem.leetcode_id}`}</span>
                  <strong lang={titleLocale} className="problem-row-title-wrap">
                    <span>{name}</span>
                    {problem.platform && problem.platform !== 'leetcode' && (
                      <span className="problem-platform-chip">
                        {problemPlatformBadge(problem.platform)}{problem.rating ? ` · ${problem.rating}` : ''}
                      </span>
                    )}
                  </strong>
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
                    {safeUrl(problem.problem_url || problem.leetcode_url) && (
                      <Button variant="solid" href={problem.problem_url || problem.leetcode_url} target="_blank" rel="noopener noreferrer">
                        {problem.platform && problem.platform !== 'leetcode'
                          ? `${t.ui.practiceOn} ${problemPlatformLabel(problem.platform)}`
                          : t.problems.practiceLeetCode}
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
            <LanguageIcon lang={id} size={14} /> {name}
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

function ResourceDirectory({ locale, title, onOpenViewer }) {
  const t = getMessages(locale);
  const [language, setLanguage] = useState(locale);
  useEffect(() => { setLanguage(locale); }, [locale]);
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
        <SelectDropdown
          ariaLabel={t.resources.allLanguages}
          value={language}
          onChange={setLanguage}
          prefix={language || undefined}
          options={[
            { value: '', label: t.resources.allLanguages },
            ...locales.map(({ code, native_name }) => ({ value: code, label: native_name, badge: code, lang: code })),
          ]}
        />
      </div>
      <p className="result-count" role="status">{visible.length} {t.resources.directoriesUnit}</p>
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
    </section>
  );
}

function Resources({ resources, locale, problemTitle, moduleId, onOpenViewer }) {
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
      <ResourceLinks links={links} problemTitle={problemTitle} moduleId={moduleId} onOpenViewer={onOpenViewer} />
      {!!englishLinks.length && (
        <details className="solution-files">
          <summary>{t.problems.englishResources}</summary>
          <ResourceLinks links={englishLinks} problemTitle={problemTitle} moduleId={moduleId} onOpenViewer={onOpenViewer} />
        </details>
      )}
    </div>
  );
}

function ResourceLinks({ links, problemTitle, moduleId, onOpenViewer }) {
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
                moduleId,
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

function InterviewTracks({ locale, title, onOpenViewer, onNavigate }) {
  const t = getMessages(locale);
  const [roleId, setRoleId] = useState(roles[0]?.id || '');
  const [levelId, setLevelId] = useState(levels[1]?.id || levels[0]?.id || '');
  const [activeModuleIndex, setActiveModuleIndex] = useState(0);
  const [doneModules, setDoneModules] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('codegrill:modules:v1') || '[]'));
    } catch {
      return new Set();
    }
  });
  const role = roles.find(({ id }) => id === roleId);
  const visible = modules.filter((item) => item.roles.includes(roleId) && item.levels.includes(levelId));
  useEffect(() => { setActiveModuleIndex(0); }, [roleId, levelId]);

  function toggleModuleDone(id) {
    setDoneModules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem('codegrill:modules:v1', JSON.stringify([...next]));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }

  const trackLabel = (id) => t.tracks.labels[id] ?? id.replaceAll('_', ' ');
  const weightEntries = Object.entries(role.module_weights_by_level[levelId] || {})
    .sort((a, b) => b[1] - a[1]);

  const safeIndex = Math.min(activeModuleIndex, Math.max(0, visible.length - 1));
  const activeMod = visible[safeIndex] || null;
  const activeLinks = activeMod ? resourcesFor(activeMod.resources, locale, defaultLocale) : [];
  const prevMod = safeIndex > 0 ? visible[safeIndex - 1] : null;
  const nextMod = safeIndex < visible.length - 1 ? visible[safeIndex + 1] : null;
  const completedInTrack = visible.filter((m) => doneModules.has(m.id)).length;

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
      <div className="module-studio-header">
        <div>
          <h2 className="module-title">{t.tracks.learningModules}</h2>
          <p className="result-count" role="status">
            {completedInTrack}/{visible.length} {t.progress.solvedOf}
          </p>
        </div>
        {visible.length > 0 && (
          <div className="module-studio-progress">
            <progress value={completedInTrack} max={Math.max(1, visible.length)} aria-label={t.tracks.learningModules} />
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
                    <strong lang={item.titles[locale] ? locale : defaultLocale}>
                      {pickLabel(item.titles, locale)}
                    </strong>
                    <small>{itemLinks.length} {t.problems.resourcesTitle.toLowerCase()}</small>
                  </span>
                </button>
              );
            })}
          </aside>

          <Card variant="outlined" className="module-stage">
            <div className="module-stage-top">
              <div className="module-stage-meta">
                <span className="viewer-seq-badge">
                  {String(safeIndex + 1).padStart(2, '0')} / {String(visible.length).padStart(2, '0')}
                </span>
                <label className="module-done-toggle">
                  <input
                    type="checkbox"
                    checked={doneModules.has(activeMod.id)}
                    onChange={() => toggleModuleDone(activeMod.id)}
                  />
                  <span>{doneModules.has(activeMod.id) ? t.roadmap.statusComplete : t.problems.markSolved}</span>
                </label>
              </div>
              <h3 lang={activeMod.titles[locale] ? locale : defaultLocale}>
                {pickLabel(activeMod.titles, locale)}
              </h3>
              {activeLinks[0] && (
                <div className="module-stage-cta">
                  <Button
                    variant="solid"
                    size="sm"
                    onClick={() => {
                      const primary = activeLinks.find((l) => l.kind === 'video') || activeLinks[0];
                      onNavigate(buildViewerPath({
                        url: primary.url,
                        title: formatViewerTitle(pickLabel(activeMod.titles, locale), primary.title),
                        kind: primary.kind === 'video' ? 'video' : 'article',
                        moduleId: activeMod.id,
                      }));
                    }}
                  >
                    <Play size={14} aria-hidden="true" /> {activeLinks.some((l) => l.kind === 'video') ? t.problems.watchVideo : t.problems.readArticle}
                  </Button>
                </div>
              )}
            </div>

            <div className="module-stage-resources">
              <Resources
                resources={activeMod.resources}
                locale={locale}
                problemTitle={pickLabel(activeMod.titles, locale)}
                moduleId={activeMod.id}
                onOpenViewer={onOpenViewer}
              />
            </div>

            {(prevMod || nextMod) && (
              <div className="module-stage-footer">
                {prevMod ? (
                  <Button variant="outlined" size="sm" onClick={() => setActiveModuleIndex(safeIndex - 1)}>
                    <ChevronLeft size={15} aria-hidden="true" /> {pickLabel(prevMod.titles, locale)}
                  </Button>
                ) : <span />}
                {nextMod ? (
                  <Button variant="solid" size="sm" onClick={() => setActiveModuleIndex(safeIndex + 1)}>
                    {pickLabel(nextMod.titles, locale)} <ChevronRight size={15} aria-hidden="true" />
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

createRoot(document.getElementById('root')).render(
  <ThemeProvider defaultTheme="light" storageKey="codegrill:theme">
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </ThemeProvider>,
);
