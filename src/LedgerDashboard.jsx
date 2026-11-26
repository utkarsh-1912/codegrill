import React, { useMemo } from 'react';
import { Badge, Button, Card } from '@utkristi/ui';
import { ArrowRight } from 'lucide-react';
import { getMessages } from './i18n.mjs';

export function LedgerDashboard({
  problems,
  categories,
  completed,
  bookmarked,
  activity,
  dailyChallenge,
  streak,
  longestStreak,
  activityDays,
  locale,
  defaultLocale,
  onOpenProblem,
}) {
  const t = getMessages(locale);

  const byDifficulty = useMemo(() => {
    const counts = { Easy: { done: 0, total: 0 }, Medium: { done: 0, total: 0 }, Hard: { done: 0, total: 0 } };
    for (const p of problems) {
      if (counts[p.difficulty]) {
        counts[p.difficulty].total += 1;
        if (completed.has(p.slug)) counts[p.difficulty].done += 1;
      }
    }
    return counts;
  }, [problems, completed]);

  const ledgerDays = useMemo(() => {
    const days = [];
    const today = new Date();
    const span = Math.max(7, Number(activityDays) || 28);
    for (let offset = span - 1; offset >= 0; offset -= 1) {
      const d = new Date(today);
      d.setUTCDate(today.getUTCDate() - offset);
      const date = d.toISOString().slice(0, 10);
      days.push({ date, count: Number(activity?.[date] || 0) });
    }
    return days;
  }, [activity, activityDays]);

  const dailyProblem = useMemo(
    () => (dailyChallenge ? problems.find((p) => p.slug === dailyChallenge.slug) : null),
    [dailyChallenge, problems],
  );

  const revisionItems = useMemo(() => {
    const list = [];
    for (const slug of bookmarked) {
      const p = problems.find((item) => item.slug === slug);
      if (p) list.push(p);
      if (list.length >= 4) break;
    }
    return list;
  }, [bookmarked, problems]);

  const categoryName = (id) => {
    const cat = categories.find((c) => c.id === id);
    return cat ? (cat.labels[locale] ?? cat.labels[defaultLocale]) : id;
  };

  return (
    <section className="ledger-bento" aria-label={t.ledger.title}>
      <Card variant="outlined" className="ledger-card ledger-daily">
        <div className="ledger-eyebrow">
          <span>{t.ledger.dailyEyebrow}</span>
          {dailyChallenge?.date && <time dateTime={dailyChallenge.date}>{dailyChallenge.date}</time>}
        </div>
        {dailyProblem && (
          <>
            <h3 lang={dailyProblem.translations[locale] ? locale : defaultLocale}>
              #{dailyProblem.leetcode_id} {dailyProblem.translations[locale]?.title || dailyProblem.translations[defaultLocale].title}
            </h3>
            <div className="ledger-daily-meta">
              <Badge tone={{ Easy: 'ok', Medium: 'warn', Hard: 'bad' }[dailyProblem.difficulty]}>
                {t.sheets[dailyProblem.difficulty.toLowerCase()] || dailyProblem.difficulty}
              </Badge>
              <span className="ledger-topic-tag" lang={locale}>{categoryName(dailyProblem.category_id)}</span>
            </div>
            <div className="ledger-daily-cta">
              <Button variant="solid" size="sm" onClick={() => onOpenProblem(dailyProblem.slug)}>
                {t.ledger.solveDaily} <ArrowRight size={14} aria-hidden="true" />
              </Button>
            </div>
          </>
        )}
      </Card>

      <Card variant="outlined" className="ledger-card ledger-difficulty">
        <div className="ledger-eyebrow">
          <span>{t.ledger.difficultySplit}</span>
          <span>{completed.size}/{problems.length}</span>
        </div>
        <div className="difficulty-bars">
          {(['Easy', 'Medium', 'Hard']).map((level) => {
            const stat = byDifficulty[level];
            return (
              <div key={level} className="difficulty-bar-row">
                <div className="difficulty-bar-label">
                  <span>{t.sheets[level.toLowerCase()] || level}</span>
                  <strong>{stat.done}<span>/{stat.total}</span></strong>
                </div>
                <progress className={`diff-${level.toLowerCase()}`} value={stat.done} max={Math.max(1, stat.total)} />
              </div>
            );
          })}
        </div>
      </Card>

      <Card variant="outlined" className="ledger-card ledger-activity">
        <div className="ledger-eyebrow">
          <span>{t.ledger.activityTitle}</span>
          <span>{streak} {t.progress.streak}{longestStreak > streak ? ` · max ${longestStreak}` : ''}</span>
        </div>
        <div className="ledger-stamp-grid" role="img" aria-label={t.ledger.activityTitle}>
          {ledgerDays.map((day) => {
            const level = day.count === 0 ? 0 : day.count === 1 ? 1 : day.count <= 3 ? 2 : 3;
            return (
              <span
                key={day.date}
                className={`ledger-stamp level-${level}`}
                title={`${day.date}: ${day.count}`}
              />
            );
          })}
        </div>
        {revisionItems.length > 0 ? (
          <div className="ledger-revision">
            <span className="ledger-rev-label">{t.ledger.revisionQueue}</span>
            <div className="ledger-rev-chips">
              {revisionItems.map((p) => (
                <button key={p.slug} type="button" onClick={() => onOpenProblem(p.slug)}>
                  #{p.leetcode_id} {p.translations[locale]?.title || p.translations[defaultLocale].title}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="ledger-rev-empty">{t.ledger.revisionEmpty}</p>
        )}
      </Card>
    </section>
  );
}
