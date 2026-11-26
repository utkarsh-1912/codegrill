import React, { useMemo, useState } from 'react';
import { Button, Card } from '@utkristi/ui';
import { ArrowRight, BookOpen, Flame, Star, Users } from 'lucide-react';
import { LedgerDashboard } from './LedgerDashboard.jsx';
import { PlatformProfiles } from './PlatformProfiles.jsx';
import { Mascot } from './Mascot.jsx';
import { DOMAIN_TOPICS, ROADMAP_DOMAINS, buildDomainRoadmap } from './domainRoadmaps.mjs';
import { getChecklistStudyGuide } from './studyMaterial.mjs';
import { readFavoriteContent, toggleFavoriteContent } from './favorites.mjs';
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
  locale,
  defaultLocale,
  onSaveProfiles,
  onOpenProblem,
  onOpenViewer,
  onNavigate,
}) {
  const t = getMessages(locale);
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
    ? `On fire · ${streak}d streak`
    : completed.size > 0
      ? `${completed.size} solved · Keep building`
      : 'Ready for your first solve';

  return (
    <section className="page-section profile-page">
      <div className="profile-hero-banner">
        <div className="profile-hero-copy">
          <h1 lang={locale}>{t.ui.profilePageTitle}<span>.</span></h1>
          <p>{t.ui.profilePageSubtitle}</p>

          <div className="profile-hero-kpis">
            <div className="profile-kpi-pill">
              <strong>{completed.size}<span>/{problems.length}</span></strong>
              <small>Solved</small>
            </div>
            <div className="profile-kpi-pill">
              <strong><Flame size={15} aria-hidden="true" /> {streak}d</strong>
              <small>Best {longestStreak}d</small>
            </div>
            <div className="profile-kpi-pill">
              <strong>{totalFavorites}</strong>
              <small>Favorites</small>
            </div>
            <div className="profile-kpi-pill">
              <strong>{linkedCount}</strong>
              <small>Platforms</small>
            </div>
          </div>

          <div className="marketing-hero-actions">
            <Button variant="solid" size="sm" onClick={() => onNavigate('/roadmap')}>
              {t.nav.roadmap} <ArrowRight size={14} aria-hidden="true" />
            </Button>
            <Button variant="outlined" size="sm" onClick={() => onNavigate('/tracks')}>
              {t.nav.tracks}
            </Button>
            <Button variant="quiet" size="sm" onClick={() => onNavigate('/rooms')}>
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
            <Star size={16} fill="currentColor" aria-hidden="true" /> Favorites &amp; Read Again
          </h3>
          <span>{totalFavorites}</span>
        </div>

        {totalFavorites === 0 ? (
          <div className="profile-saved-empty">
            <Mascot mood="idle" size={76} label="No favorites saved yet" />
            <div>
              <strong>Your reading queue is clear</strong>
              <p>Star any study guide, GitHub doc, notebook, or video walkthrough in the viewer to revisit it here before interviews.</p>
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
