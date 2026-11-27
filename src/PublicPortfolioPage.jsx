import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card } from '@utkristi/ui';
import { ArrowLeft, Check, Copy, ExternalLink, Flame, Trophy } from 'lucide-react';
import { ROADMAP_DOMAINS, buildDomainRoadmap } from './domainRoadmaps.mjs';
import { CODING_PLATFORMS, buildProfileUrl } from './profiles.mjs';
import { Mascot } from './Mascot.jsx';
import { getMessages } from './i18n.mjs';

const DOMAIN_CHECKS_KEY = 'codegrill:domain-roadmap:v1';

export function PublicPortfolioPage({
  handle,
  problems = [],
  completed = new Set(),
  activity = {},
  streak = 0,
  longestStreak = 0,
  linkedProfiles = {},
  apiBaseUrl = '',
  locale = 'en',
  onNavigate,
}) {
  const t = getMessages(locale);
  const [remoteResult, setRemoteResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const remoteData = remoteResult?.handle === handle ? remoteResult.data : null;

  useEffect(() => {
    if (!handle || handle === 'me') return undefined;
    let cancelled = false;
    const base = String(apiBaseUrl || '').replace(/\/+$/, '');
    fetch(`${base}/api/u/${encodeURIComponent(handle)}`, { signal: AbortSignal.timeout(4000) })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setRemoteResult({ handle, data });
      })
      .catch(() => {
        if (!cancelled) setRemoteResult({ handle, data: null });
      });
    return () => { cancelled = true; };
  }, [handle, apiBaseUrl]);

  const effectiveCompleted = useMemo(() => {
    if (remoteData?.progress?.completed) return new Set(remoteData.progress.completed);
    return completed;
  }, [remoteData, completed]);

  const effectiveActivity = remoteData?.progress?.activity || activity;
  const effectiveStreak = remoteData?.progress?.streak ?? streak;
  const effectiveLongest = remoteData?.progress?.longestStreak ?? longestStreak;
  const effectiveProfiles = remoteData?.profiles || linkedProfiles || {};

  const difficultyCounts = useMemo(() => {
    const counts = { Easy: { done: 0, total: 0 }, Medium: { done: 0, total: 0 }, Hard: { done: 0, total: 0 } };
    for (const p of problems) {
      if (counts[p.difficulty]) {
        counts[p.difficulty].total += 1;
        if (effectiveCompleted.has(p.slug)) counts[p.difficulty].done += 1;
      }
    }
    return counts;
  }, [problems, effectiveCompleted]);

  const domainBreakdown = useMemo(() => {
    let checks = {};
    try {
      checks = JSON.parse(localStorage.getItem(DOMAIN_CHECKS_KEY) || '{}') || {};
    } catch {
      checks = {};
    }
    return ROADMAP_DOMAINS.map((dom) => {
      if (dom.id === 'dsa') {
        return { id: dom.id, label: dom.labels[locale] || dom.labels.en, done: effectiveCompleted.size, total: problems.length };
      }
      const topics = buildDomainRoadmap(dom.id, handle === 'me' ? checks : {});
      return {
        id: dom.id,
        label: dom.labels[locale] || dom.labels.en,
        done: topics.reduce((s, x) => s + x.done, 0),
        total: topics.reduce((s, x) => s + x.total, 0),
      };
    });
  }, [locale, handle, effectiveCompleted, problems.length]);

  const ledgerDays = useMemo(() => {
    const days = [];
    const today = new Date();
    for (let offset = 27; offset >= 0; offset -= 1) {
      const d = new Date(today);
      d.setUTCDate(today.getUTCDate() - offset);
      const date = d.toISOString().slice(0, 10);
      days.push({ date, count: Number(effectiveActivity?.[date] || 0) });
    }
    return days;
  }, [effectiveActivity]);

  const activeLinked = Object.entries(effectiveProfiles)
    .filter(([, entry]) => entry?.handle)
    .map(([id, entry]) => {
      const meta = CODING_PLATFORMS.find((p) => p.id === id);
      return {
        id,
        label: meta?.label || id,
        handle: entry.handle,
        url: entry.url || buildProfileUrl(id, entry.handle),
        stats: entry.stats || {},
      };
    });

  async function copyPortfolioUrl() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard errors
    }
  }

  const displayHandle = handle === 'me'
    ? (activeLinked[0]?.handle || 'codegrill-engineer')
    : handle;

  if (handle !== 'me' && !remoteData) {
    return <section className="page-section">
      <h1>{remoteResult?.handle === handle ? 'Portfolio unavailable' : 'Loading portfolio'}</h1>
      <Button variant="outlined" onClick={() => onNavigate('/profile')}>{t.nav.profile}</Button>
    </section>;
  }

  return (
    <section className="page-section public-portfolio-page">
      <div className="viewer-page-bar">
        <Button variant="quiet" size="sm" onClick={() => onNavigate('/profile')}>
          <ArrowLeft size={15} aria-hidden="true" /> {t.nav.profile}
        </Button>
        {handle !== 'me' && <Button variant="outlined" size="sm" onClick={copyPortfolioUrl}>
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {copied ? t.studio.rooms.copied : t.studio.portfolio.copyLink}
        </Button>}
      </div>

      <div className="profile-hero-banner">
        <div className="profile-hero-copy">
          <span className="room-exercise-eyebrow">{t.studio.backup.publicPortfolio}</span>
          <h1>@{displayHandle}<span>.</span></h1>

          <div className="profile-hero-kpis">
            <div className="profile-kpi-pill">
              <strong>{effectiveCompleted.size}<span>/{problems.length}</span></strong>
              <small>{t.studio.profile.solved}</small>
            </div>
            <div className="profile-kpi-pill">
              <strong><Flame size={15} aria-hidden="true" /> {effectiveStreak}d</strong>
              <small>{t.studio.profile.best} {effectiveLongest}d</small>
            </div>
            <div className="profile-kpi-pill">
              <strong>{activeLinked.length}</strong>
              <small>{t.studio.profile.platforms}</small>
            </div>
          </div>
        </div>

        <div className="marketing-hero-stage" aria-hidden="true">
          <div className="legal-orbit-ring ring-1" />
          <div className="legal-orbit-ring ring-2" />
          <Mascot mood={effectiveStreak >= 3 ? 'happy' : 'idle'} size={126} label="Portfolio mascot" />
        </div>
      </div>

      <div className="profile-breakdown-grid">
        <Card variant="outlined" className="profile-breakdown-card">
          <h3><Trophy size={16} aria-hidden="true" /> {t.studio.portfolio.difficultyMastery}</h3>
          <div className="profile-progress-list">
            {['Easy', 'Medium', 'Hard'].map((diff) => {
              const item = difficultyCounts[diff];
              return (
                <div key={diff} className="profile-progress-row">
                  <div className="profile-progress-top">
                    <span className="profile-progress-name">{t.sheets[diff.toLowerCase()] || diff}</span>
                    <strong>{item.done}<span>/{item.total}</span></strong>
                  </div>
                  <progress value={item.done} max={Math.max(1, item.total)} />
                </div>
              );
            })}
          </div>
        </Card>

        <Card variant="outlined" className="profile-breakdown-card">
          <h3>{t.ui.domainProgressTitle}</h3>
          <div className="profile-progress-list">
            {domainBreakdown.map((item) => (
              <div key={item.id} className="profile-progress-row">
                <div className="profile-progress-top">
                  <span className="profile-progress-name">{item.label}</span>
                  <strong>{item.done}<span>/{item.total}</span></strong>
                </div>
                <progress value={item.done} max={Math.max(1, item.total)} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card variant="outlined" className="ledger-card ledger-activity">
        <div className="ledger-head">
          <span>{t.studio.portfolio.heatmapTitle}</span>
          <span>{effectiveStreak} {t.progress.streak}</span>
        </div>
        <div className="ledger-stamp-grid" role="img" aria-label={t.studio.portfolio.heatmapTitle}>
          {ledgerDays.map(({ date, count }) => (
            <span
              key={date}
              className={`ledger-stamp ${count === 0 ? 'lv-0' : count === 1 ? 'lv-1' : count <= 3 ? 'lv-2' : 'lv-3'}`}
              title={`${date}: ${count}`}
            />
          ))}
        </div>
      </Card>

      {activeLinked.length > 0 && (
        <Card variant="outlined" className="profile-breakdown-card">
          <h3>{t.studio.portfolio.linkedProfiles}</h3>
          <div className="portfolio-platform-grid">
            {activeLinked.map((p) => (
              <a
                key={p.id}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="portfolio-platform-card"
              >
                <div>
                  <strong>{p.label}</strong>
                  <small>@{p.handle}</small>
                </div>
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            ))}
          </div>
        </Card>
      )}
    </section>
  );
}
