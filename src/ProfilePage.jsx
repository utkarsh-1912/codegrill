import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card } from '@utkristi/ui';
import { ArrowRight, BookOpen, Calendar, Cloud, Download, ExternalLink, Flame, Globe, HardDrive, Star, Upload, Users } from 'lucide-react';
import { LedgerDashboard } from './LedgerDashboard.jsx';
import { PlatformProfiles } from './PlatformProfiles.jsx';
import { Mascot } from './Mascot.jsx';
import { DOMAIN_TOPICS, ROADMAP_DOMAINS, buildDomainRoadmap } from './domainRoadmaps.mjs';
import { getChecklistStudyGuide } from './studyMaterial.mjs';
import { readFavoriteContent, toggleFavoriteContent } from './favorites.mjs';
import { exportLocalWorkspaceBackup, importLocalWorkspaceBackup } from './storageAdapter.mjs';
import { isGoogleAuthConfigured, signInWithEmail, signInWithGoogle, signUpWithEmail } from './firebaseAuth.mjs';
import { getMessages } from './i18n.mjs';

const DOMAIN_CHECKS_KEY = 'codegrill:domain-roadmap:v1';
const DOMAIN_FAVS_KEY = 'codegrill:domain-favorites:v1';

export function ProfilePage({
  problems,
  categories,
  completed,
  bookmarked,
  activity,
  dailyChallenge,
  streak,
  longestStreak,
  activityDays,
  linkedProfiles,
  apiBaseUrl,
  backendOnline = false,
  authSession = null,
  firebaseEnabled = false,
  onAuthSignIn,
  onAuthSignOut,
  onRestoreBackup,
  portfolioSettings = { handle: '', isPublicProfile: false },
  onUpdatePortfolioSettings,
  locale,
  defaultLocale,
  onSaveProfiles,
  onOpenProblem,
  onOpenViewer,
  onNavigate,
}) {
  const t = getMessages(locale);
  const importInputRef = useRef(null);
  const [backupMsg, setBackupMsg] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [pubHandle, setPubHandle] = useState(portfolioSettings.handle || '');
  const [pubEnabled, setPubEnabled] = useState(Boolean(portfolioSettings.isPublicProfile));
  const [pubBusy, setPubBusy] = useState(false);
  const [pubMsg, setPubMsg] = useState('');

  useEffect(() => {
    setPubHandle(portfolioSettings.handle || '');
    setPubEnabled(Boolean(portfolioSettings.isPublicProfile));
  }, [portfolioSettings.handle, portfolioSettings.isPublicProfile]);
  const [savedGuides, setSavedGuides] = useState(() => {
    try {
      return Object.values(JSON.parse(localStorage.getItem(DOMAIN_FAVS_KEY) || '{}') || {});
    } catch {
      return [];
    }
  });
  const [savedContent, setSavedContent] = useState(() => Object.values(readFavoriteContent()));

  function removeSavedGuide(key) {
    try {
      const raw = JSON.parse(localStorage.getItem(DOMAIN_FAVS_KEY) || '{}') || {};
      delete raw[key];
      localStorage.setItem(DOMAIN_FAVS_KEY, JSON.stringify(raw));
      setSavedGuides(Object.values(raw));
    } catch {
      // ignore storage errors
    }
  }

  function removeSavedContent(item) {
    const res = toggleFavoriteContent(item);
    setSavedContent(Object.values(res.all));
  }

  function handleExportJson() {
    const backup = exportLocalWorkspaceBackup(authSession?.uid || '');
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `codegrill-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupMsg(t.studio.backup.backupExported);
    setTimeout(() => setBackupMsg(''), 2500);
  }

  function handleImportJson(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const raw = String(reader.result || '');
        if (onRestoreBackup) {
          await onRestoreBackup(raw);
        } else {
          importLocalWorkspaceBackup(raw, authSession?.uid || '');
        }
        setBackupMsg(t.studio.backup.backupRestored);
        setTimeout(() => setBackupMsg(''), 3000);
      } catch (err) {
        setBackupMsg(err?.message || t.studio.backup.invalidBackup);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  const platformBreakdown = useMemo(() => {
    const buckets = [
      { id: 'leetcode', label: 'LeetCode', badge: 'LC', done: 0, total: 0 },
      { id: 'codeforces', label: 'Codeforces', badge: 'CF', done: 0, total: 0 },
      { id: 'hackerrank', label: 'HackerRank', badge: 'HR', done: 0, total: 0 },
    ];
    const map = new Map(buckets.map((b) => [b.id, b]));
    for (const p of problems) {
      const bucket = map.get(p.platform || 'leetcode');
      if (bucket) {
        bucket.total += 1;
        if (completed.has(p.slug)) bucket.done += 1;
      }
    }
    return buckets;
  }, [problems, completed]);

  const domainBreakdown = useMemo(() => {
    let checks = {};
    try {
      checks = JSON.parse(localStorage.getItem(DOMAIN_CHECKS_KEY) || '{}') || {};
    } catch {
      checks = {};
    }
    return ROADMAP_DOMAINS.map((dom) => {
      if (dom.id === 'dsa') {
        return {
          id: dom.id,
          label: dom.labels[locale] || dom.labels.en,
          done: completed.size,
          total: problems.length,
        };
      }
      const topics = buildDomainRoadmap(dom.id, checks);
      const done = topics.reduce((sum, item) => sum + item.done, 0);
      const total = topics.reduce((sum, item) => sum + item.total, 0);
      return {
        id: dom.id,
        label: dom.labels[locale] || dom.labels.en,
        done,
        total,
      };
    });
  }, [locale, completed, problems.length]);

  const linkedCount = useMemo(
    () => Object.values(linkedProfiles || {}).filter((p) => p?.handle).length,
    [linkedProfiles],
  );
  const totalFavorites = savedGuides.length + savedContent.length;
  const mascotMood = streak >= 3 || completed.size >= 10
    ? 'happy'
    : completed.size > 0
      ? 'idle'
      : 'loading';
  const mascotCaption = streak >= 3
    ? `${t.studio.profile.onFire} · ${streak}d ${t.progress.streak}`
    : completed.size > 0
      ? `${completed.size} ${t.progress.solvedOf} · ${t.studio.profile.keepBuilding}`
      : t.studio.profile.readyFirstSolve;

  return (
    <section className="page-section profile-page">
      <div className="profile-hero-banner">
        <div className="profile-hero-copy">
          <h1 lang={locale}>{t.ui.profilePageTitle}<span>.</span></h1>
          <p>{t.ui.profilePageSubtitle}</p>

          <div className="profile-hero-kpis">
            <div className="profile-kpi-pill">
              <strong>{completed.size}<span>/{problems.length}</span></strong>
              <small>{t.studio.profile.solved}</small>
            </div>
            <div className="profile-kpi-pill">
              <strong><Flame size={15} aria-hidden="true" /> {streak}d</strong>
              <small>{t.studio.profile.best} {longestStreak}d</small>
            </div>
            <div className="profile-kpi-pill">
              <strong>{totalFavorites}</strong>
              <small>{t.studio.profile.favorites}</small>
            </div>
            <div className="profile-kpi-pill">
              <strong>{linkedCount}</strong>
              <small>{t.studio.profile.platforms}</small>
            </div>
          </div>

          <div className="marketing-hero-actions profile-hero-actions">
            <Button variant="solid" size="sm" onClick={() => onNavigate('/roadmap')}>
              {t.nav.roadmap} <ArrowRight size={14} aria-hidden="true" />
            </Button>
            <Button variant="outlined" size="sm" className="profile-hero-ghost-btn" onClick={() => onNavigate('/u/me')}>
              {t.studio.backup.publicPortfolio}
            </Button>
            <Button variant="outlined" size="sm" className="profile-hero-ghost-btn" onClick={() => onNavigate('/contests')}>
              <Calendar size={14} aria-hidden="true" /> {t.studio.backup.contests}
            </Button>
            <Button variant="outlined" size="sm" className="profile-hero-ghost-btn" onClick={() => onNavigate('/rooms')}>
              <Users size={14} aria-hidden="true" /> {t.nav.rooms}
            </Button>
          </div>
        </div>

        <div className="marketing-hero-stage" aria-hidden="true">
          <div className="legal-orbit-ring ring-1" />
          <div className="legal-orbit-ring ring-2" />
          <Mascot mood={mascotMood} size={136} label="Ember profile companion" />
          <span className="marketing-hero-caption">{mascotCaption}</span>
        </div>
      </div>

      <Card variant="outlined" className="storage-mode-banner">
        <div className="storage-mode-copy">
          <span className={`storage-mode-pill ${authSession || backendOnline ? 'is-cloud' : 'is-local'}`}>
            {authSession || backendOnline ? <Cloud size={13} aria-hidden="true" /> : <HardDrive size={13} aria-hidden="true" />}
            {authSession
              ? `${t.controls.backendOnline} · ${authSession.email}`
              : backendOnline
                ? t.controls.backendOnline
                : t.studio.backup.guestLocal}
          </span>
          <p>{backupMsg || authError || t.studio.backup.backupHint}</p>
        </div>
        <div className="storage-mode-actions">
          {firebaseEnabled && !authSession && (
            <Button variant="solid" size="sm" onClick={() => setAuthOpen((v) => !v)}>
              {authOpen ? t.sheets.cancel : t.studio.auth.signInToSync}
            </Button>
          )}
          {authSession && (
            <Button variant="outlined" size="sm" onClick={() => onAuthSignOut?.()}>
              {t.studio.auth.signOut}
            </Button>
          )}
          <Button variant="outlined" size="sm" onClick={handleExportJson}>
            <Download size={14} aria-hidden="true" /> {t.studio.backup.exportJson}
          </Button>
          <Button variant="outlined" size="sm" onClick={() => importInputRef.current?.click()}>
            <Upload size={14} aria-hidden="true" /> {t.studio.backup.importJson}
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={handleImportJson}
          />
        </div>
        {firebaseEnabled && !authSession && authOpen && (
          <form
            className="cloud-auth-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setAuthBusy(true);
              setAuthError('');
              try {
                const sess = await signInWithEmail(authEmail, authPassword);
                await onAuthSignIn?.(sess);
                setAuthOpen(false);
                setAuthPassword('');
              } catch (err) {
                setAuthError(err?.message || t.studio.auth.signInFailed);
              } finally {
                setAuthBusy(false);
              }
            }}
          >
            <input
              type="email"
              required
              placeholder={t.studio.auth.emailPlaceholder}
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
            />
            <input
              type="password"
              required
              minLength={6}
              placeholder={t.studio.auth.passwordPlaceholder}
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
            />
            <Button variant="solid" size="sm" type="submit" disabled={authBusy}>
              {authBusy ? '...' : t.studio.auth.signIn}
            </Button>
            <Button
              variant="outlined"
              size="sm"
              type="button"
              disabled={authBusy}
              onClick={async () => {
                setAuthBusy(true);
                setAuthError('');
                try {
                  const sess = await signUpWithEmail(authEmail, authPassword);
                  await onAuthSignIn?.(sess);
                  setAuthOpen(false);
                  setAuthPassword('');
                } catch (err) {
                  setAuthError(err?.message || t.studio.auth.signUpFailed);
                } finally {
                  setAuthBusy(false);
                }
              }}
            >
              {t.studio.auth.createAccount}
            </Button>
            {isGoogleAuthConfigured() && (
              <Button
                variant="outlined"
                size="sm"
                type="button"
                disabled={authBusy}
                onClick={async () => {
                  setAuthBusy(true);
                  setAuthError('');
                  try {
                    const sess = await signInWithGoogle();
                    await onAuthSignIn?.(sess);
                    setAuthOpen(false);
                    setAuthPassword('');
                  } catch (err) {
                    const msg = err?.code === 'auth/popup-closed-by-user'
                      ? t.studio.auth.googleCancelled
                      : (err?.message || t.studio.auth.googleFailed);
                    setAuthError(msg);
                  } finally {
                    setAuthBusy(false);
                  }
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style={{ marginRight: 6 }}>
                  <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.26-2.08 3.57-5.15 3.57-8.64z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.96H1.29v3.09A12 12 0 0 0 12 24z" />
                  <path fill="#FBBC05" d="M5.28 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.28V6.63H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.37l3.99-3.09z" />
                  <path fill="#EA4335" d="M12 4.76c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.63l3.99 3.09C6.23 6.87 8.88 4.76 12 4.76z" />
                </svg>
                {t.studio.auth.continueWithGoogle}
              </Button>
            )}
          </form>
        )}
        {(authSession || backendOnline) && onUpdatePortfolioSettings && (
          <form
            className="portfolio-publish-bar"
            onSubmit={async (e) => {
              e.preventDefault();
              setPubBusy(true);
              setPubMsg('');
              try {
                const updated = await onUpdatePortfolioSettings({ handle: pubHandle, isPublicProfile: pubEnabled });
                setPubHandle(updated.handle || '');
                setPubEnabled(Boolean(updated.isPublicProfile));
                setPubMsg(t.studio.auth.portfolioSaved);
                setTimeout(() => setPubMsg(''), 3000);
              } catch (err) {
                setPubMsg(err?.message || t.studio.auth.portfolioFailed);
              } finally {
                setPubBusy(false);
              }
            }}
          >
            <div className="portfolio-handle-field">
              <span className="portfolio-handle-prefix" aria-hidden="true">
                <Globe size={13} />
                <span>/u/</span>
              </span>
              <input
                type="text"
                placeholder={t.studio.auth.handlePlaceholder}
                value={pubHandle}
                onChange={(e) => setPubHandle(e.target.value)}
                aria-label={t.studio.auth.handlePlaceholder}
              />
            </div>

            <div className="portfolio-publish-controls">
              <label className="ember-switch">
                <input
                  type="checkbox"
                  checked={pubEnabled}
                  onChange={(e) => setPubEnabled(e.target.checked)}
                />
                <span className="ember-switch-track" aria-hidden="true">
                  <span className="ember-switch-thumb" />
                </span>
                <span className="ember-switch-label">{t.studio.auth.publishPortfolio}</span>
              </label>

              <Button variant="outlined" size="sm" type="submit" disabled={pubBusy}>
                {pubBusy ? '...' : t.studio.auth.savePortfolio}
              </Button>

              {pubEnabled && pubHandle && (
                <a
                  className="portfolio-live-pill"
                  href={`/u/${encodeURIComponent(pubHandle)}`}
                  onClick={(e) => { e.preventDefault(); onNavigate(`/u/${encodeURIComponent(pubHandle)}`); }}
                >
                  <span className="sync-dot is-online" aria-hidden="true" />
                  <span>/u/{pubHandle}</span>
                  <ExternalLink size={12} aria-hidden="true" />
                </a>
              )}

              {pubMsg && (
                <span className="portfolio-status-note" role="status">
                  {pubMsg}
                </span>
              )}
            </div>
          </form>
        )}
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
        activityDays={activityDays}
        locale={locale}
        defaultLocale={defaultLocale}
        onOpenProblem={onOpenProblem}
      />

      <div className="profile-breakdown-grid">
        <Card variant="outlined" className="profile-breakdown-card">
          <h3>{t.ui.platformProgressTitle}</h3>
          <div className="profile-progress-list">
            {platformBreakdown.map((item) => (
              <div key={item.id} className="profile-progress-row">
                <div className="profile-progress-top">
                  <span className="profile-progress-name">
                    <span className="problem-platform-chip">{item.badge}</span>
                    {item.label}
                  </span>
                  <strong>{item.done}<span>/{item.total}</span></strong>
                </div>
                <progress value={item.done} max={Math.max(1, item.total)} />
              </div>
            ))}
          </div>
        </Card>

        <Card variant="outlined" className="profile-breakdown-card">
          <h3>{t.ui.domainProgressTitle}</h3>
          <div className="profile-progress-list">
            {domainBreakdown.map((item) => (
              <button
                key={item.id}
                type="button"
                className="profile-progress-row profile-progress-btn"
                onClick={() => onNavigate(`/roadmap?domain=${encodeURIComponent(item.id)}`)}
              >
                <div className="profile-progress-top">
                  <span className="profile-progress-name">{item.label}</span>
                  <strong>{item.done}<span>/{item.total}</span></strong>
                </div>
                <progress value={item.done} max={Math.max(1, item.total)} />
              </button>
            ))}
          </div>
        </Card>
      </div>

      <Card variant="outlined" className="profile-saved-guides">
        <div className="profile-saved-head">
          <h3>
            <Star size={16} fill="currentColor" aria-hidden="true" /> {t.studio.profile.favoritesTitle}
          </h3>
          <span>{totalFavorites}</span>
        </div>

        {totalFavorites === 0 ? (
          <div className="profile-saved-empty">
            <Mascot mood="idle" size={76} label={t.studio.profile.queueClear} />
            <div>
              <strong>{t.studio.profile.queueClear}</strong>
              <p>{t.studio.profile.queueClearDesc}</p>
            </div>
          </div>
        ) : (
          <div className="profile-saved-list">
            {savedContent.map((fav) => (
              <div key={fav.id} className="profile-saved-row">
                <button
                  type="button"
                  className="profile-saved-open"
                  onClick={() => onOpenViewer?.({
                    url: fav.url,
                    title: fav.title,
                    kind: fav.kind,
                    content: fav.content || fav.inlineContent || '',
                    sourceUrl: fav.sourceUrl || fav.url || '',
                  })}
                >
                  <BookOpen size={15} aria-hidden="true" />
                  <span>
                    <strong>{fav.title}</strong>
                    <small>{fav.badge || fav.siteName || fav.kind}</small>
                  </span>
                </button>
                <button
                  type="button"
                  className="icon-btn is-active"
                  aria-label="Remove from favorites"
                  title="Remove from favorites"
                  onClick={() => removeSavedContent(fav)}
                >
                  <Star size={14} fill="currentColor" aria-hidden="true" />
                </button>
              </div>
            ))}
            {savedGuides.map((fav) => {
              const topicObj = (DOMAIN_TOPICS[fav.domainId] || []).find((x) => x.id === fav.topicId);
              return (
                <div key={fav.key} className="profile-saved-row">
                  <button
                    type="button"
                    className="profile-saved-open"
                    onClick={() => {
                      if (topicObj && onOpenViewer) {
                        onOpenViewer({
                          title: fav.itemText,
                          kind: 'markdown',
                          content: getChecklistStudyGuide(topicObj, fav.itemIndex),
                          sourceUrl: fav.sourceUrl || '',
                        });
                      } else {
                        onNavigate(`/roadmap?domain=${encodeURIComponent(fav.domainId)}&topic=${encodeURIComponent(fav.topicId)}`);
                      }
                    }}
                  >
                    <BookOpen size={15} aria-hidden="true" />
                    <span>
                      <strong>{fav.itemText}</strong>
                      <small>{fav.topicTitle}</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="icon-btn is-active"
                    aria-label="Remove from read again"
                    title="Remove from read again"
                    onClick={() => removeSavedGuide(fav.key)}
                  >
                    <Star size={14} fill="currentColor" aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <PlatformProfiles
        linkedProfiles={linkedProfiles}
        codegrillSolved={completed.size}
        apiBaseUrl={apiBaseUrl}
        locale={locale}
        onSaveProfiles={onSaveProfiles}
      />
    </section>
  );
}
