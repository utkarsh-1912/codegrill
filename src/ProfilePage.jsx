import React, { useMemo } from 'react';
import { Button, Card } from '@utkristi/ui';
import { ArrowRight } from 'lucide-react';
import { LedgerDashboard } from './LedgerDashboard.jsx';
import { PlatformProfiles } from './PlatformProfiles.jsx';
import { ROADMAP_DOMAINS, buildDomainRoadmap } from './domainRoadmaps.mjs';
import { getMessages } from './i18n.mjs';

const DOMAIN_CHECKS_KEY = 'codegrill:domain-roadmap:v1';

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
  onNavigate,
}) {
  const t = getMessages(locale);

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

  return (
    <section className="page-section profile-page">
      <div className="section-heading">
        <div>
          <h1 lang={locale}>{t.ui.profilePageTitle}</h1>
          <p>{t.ui.profilePageSubtitle}</p>
        </div>
        <Button variant="outlined" size="sm" onClick={() => onNavigate('/roadmap')}>
          {t.nav.roadmap} <ArrowRight size={14} aria-hidden="true" />
        </Button>
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
