import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card } from '@utkristi/ui';
import { Calendar, Clock, Download, ExternalLink, RefreshCw } from 'lucide-react';
import { getMessages } from './i18n.mjs';

function nextWeekdayUtc(targetDayOfWeek, hourUtc, minuteUtc = 0, from = new Date()) {
  const d = new Date(from);
  const diff = (targetDayOfWeek - d.getUTCDay() + 7) % 7;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(hourUtc, minuteUtc, 0, 0);
  if (d.getTime() <= from.getTime()) d.setUTCDate(d.getUTCDate() + 7);
  return d;
}

function buildFallbackContests() {
  const now = new Date();
  const lcWeekly = nextWeekdayUtc(0, 2, 30, now);
  const lcBiweekly = nextWeekdayUtc(6, 14, 30, now);
  const atcoderAbc = nextWeekdayUtc(6, 12, 0, now);
  const codechefStarters = nextWeekdayUtc(3, 14, 30, now);
  return [
    { id: 'lc-weekly', platform: 'leetcode', platformLabel: 'LeetCode', name: 'LeetCode Weekly Contest', startTimeMs: lcWeekly.getTime(), durationSec: 5400, url: 'https://leetcode.com/contest/' },
    { id: 'lc-biweekly', platform: 'leetcode', platformLabel: 'LeetCode', name: 'LeetCode Biweekly Contest', startTimeMs: lcBiweekly.getTime(), durationSec: 5400, url: 'https://leetcode.com/contest/' },
    { id: 'atcoder-abc', platform: 'atcoder', platformLabel: 'AtCoder', name: 'AtCoder Beginner Contest (ABC)', startTimeMs: atcoderAbc.getTime(), durationSec: 6000, url: 'https://atcoder.jp/contests/' },
    { id: 'codechef-starters', platform: 'codechef', platformLabel: 'CodeChef', name: 'CodeChef Starters', startTimeMs: codechefStarters.getTime(), durationSec: 7200, url: 'https://www.codechef.com/contests' },
  ].sort((a, b) => a.startTimeMs - b.startTimeMs);
}

function formatCountdown(startTimeMs, nowMs) {
  const diffSec = Math.max(0, Math.floor((startTimeMs - nowMs) / 1000));
  if (diffSec === 0) return 'Live now';
  const days = Math.floor(diffSec / 86400);
  const hrs = Math.floor((diffSec % 86400) / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  if (days > 0) return `in ${days}d ${hrs}h`;
  if (hrs > 0) return `in ${hrs}h ${mins}m`;
  return `in ${mins}m`;
}

function formatIcsDate(ms) {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function downloadContestIcs(contest) {
  const dtStart = formatIcsDate(contest.startTimeMs);
  const dtEnd = formatIcsDate(contest.startTimeMs + (contest.durationSec || 5400) * 1000);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Codegrill//Contest Calendar//EN',
    'BEGIN:VEVENT',
    `UID:${contest.id}@codegrill.app`,
    `DTSTAMP:${formatIcsDate(Date.now())}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${contest.name} (${contest.platformLabel})`,
    `URL:${contest.url}`,
    `DESCRIPTION:Upcoming ${contest.platformLabel} contest — ${contest.url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([lines], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${contest.id}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ContestsPage({ apiBaseUrl = '', locale = 'en' }) {
  const t = getMessages(locale);
  const [contests, setContests] = useState(buildFallbackContests);
  const [platform, setPlatform] = useState('all');
  const [loading, setLoading] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  async function loadContests() {
    setLoading(true);
    try {
      const base = String(apiBaseUrl || '').replace(/\/+$/, '');
      const res = await fetch(`${base}/api/contests`, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.contests) && data.contests.length > 0) {
          setContests(data.contests);
          setLoading(false);
          return;
        }
      }
    } catch {
      // Fallback: fetch Codeforces directly from browser
    }
    try {
      const cfRes = await fetch('https://codeforces.com/api/contest.list?gym=false', { signal: AbortSignal.timeout(6000) });
      if (cfRes.ok) {
        const cf = await cfRes.json();
        if (cf?.status === 'OK' && Array.isArray(cf.result)) {
          const cfList = cf.result
            .filter((c) => c.phase === 'BEFORE' && c.startTimeSeconds)
            .slice(0, 8)
            .map((c) => ({
              id: `cf-${c.id}`,
              platform: 'codeforces',
              platformLabel: 'Codeforces',
              name: c.name,
              startTimeMs: c.startTimeSeconds * 1000,
              durationSec: c.durationSeconds || 7200,
              url: `https://codeforces.com/contest/${c.id}`,
            }));
          setContests([...cfList, ...buildFallbackContests()].sort((a, b) => a.startTimeMs - b.startTimeMs));
        }
      }
    } catch {
      // Keep recurring schedule fallback
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadContests();
    const tick = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(tick);
  }, []);

  const filtered = useMemo(() => (
    platform === 'all' ? contests : contests.filter((c) => c.platform === platform)
  ), [contests, platform]);

  const platforms = [
    { id: 'all', label: t.ui.allPlatforms },
    { id: 'codeforces', label: 'Codeforces' },
    { id: 'leetcode', label: 'LeetCode' },
    { id: 'atcoder', label: 'AtCoder' },
    { id: 'codechef', label: 'CodeChef' },
  ];

  return (
    <section className="page-section contests-page">
      <div className="section-heading">
        <div>
          <h1 lang={locale}>{t.studio.contests.title}</h1>
          <p>{t.studio.contests.subtitle}</p>
        </div>
        <Button variant="outlined" size="sm" onClick={loadContests} disabled={loading}>
          <RefreshCw size={14} aria-hidden="true" /> {loading ? t.studio.contests.refreshing : t.studio.contests.refresh}
        </Button>
      </div>

      <div className="roadmap-domain-tabs" role="tablist" aria-label="Contest platforms">
        {platforms.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={platform === p.id}
            className={`roadmap-domain-tab ${platform === p.id ? 'is-active' : ''}`}
            onClick={() => setPlatform(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="contest-list-grid">
        {filtered.map((contest) => {
          const localTime = new Date(contest.startTimeMs).toLocaleString(locale, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
          const durationMin = Math.round((contest.durationSec || 5400) / 60);
          return (
            <Card key={contest.id} variant="outlined" className="contest-card">
              <div className="contest-card-copy">
                <div className="contest-card-meta">
                  <span className="room-format-pill">{contest.platformLabel}</span>
                  <span className="contest-countdown">
                    <Clock size={12} aria-hidden="true" /> {contest.startTimeMs <= nowMs ? t.studio.contests.liveNow : formatCountdown(contest.startTimeMs, nowMs)}
                  </span>
                </div>
                <h3>{contest.name}</h3>
                <p className="contest-time-line">
                  <Calendar size={13} aria-hidden="true" /> {localTime} · {durationMin} {t.studio.contests.minUnit}
                </p>
              </div>
              <div className="contest-card-actions">
                <Button variant="outlined" size="sm" onClick={() => downloadContestIcs(contest)}>
                  <Download size={14} aria-hidden="true" /> .ics
                </Button>
                <Button variant="solid" size="sm" href={contest.url} target="_blank" rel="noopener noreferrer">
                  {t.studio.contests.register} <ExternalLink size={14} aria-hidden="true" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
