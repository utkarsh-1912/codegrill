import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card } from '@utkristi/ui';
import { Calendar, Check, Clock, Download, ExternalLink, Link2, Plus, RefreshCw, Search, Trash2, Trophy } from 'lucide-react';
import { getMessages } from './i18n.mjs';
import { parseExternalPracticeUrl } from './externalImport.mjs';

const IMPORTED_PRACTICE_KEY = 'codegrill:imported-practice:v1';

const PLATFORM_CODES = {
  codeforces: 'CF',
  leetcode: 'LC',
  atcoder: 'AC',
  codechef: 'CC',
  hackerrank: 'HR',
  gfg: 'GFG',
};

function readImportedPractice() {
  try {
    const raw = JSON.parse(localStorage.getItem(IMPORTED_PRACTICE_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeImportedPractice(items) {
  try {
    localStorage.setItem(IMPORTED_PRACTICE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage quota errors
  }
}

function formatDuration(durationSec = 5400, minUnit = 'min') {
  const totalMin = Math.max(1, Math.round(durationSec / 60));
  const hrs = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${totalMin} ${minUnit}`;
}

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
  const [contests, setContests] = useState([]);
  const [platform, setPlatform] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [importUrl, setImportUrl] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState('');
  const [practiceQueue, setPracticeQueue] = useState(readImportedPractice);

  function addPracticeItems(newItems) {
    setPracticeQueue((prev) => {
      const seen = new Set(prev.map((x) => x.id));
      const merged = [
        ...newItems.filter((x) => !seen.has(x.id)).map((x) => ({ ...x, done: false, addedAt: new Date().toISOString() })),
        ...prev,
      ].slice(0, 60);
      writeImportedPractice(merged);
      return merged;
    });
  }

  function togglePracticeDone(id) {
    setPracticeQueue((prev) => {
      const next = prev.map((x) => (x.id === id ? { ...x, done: !x.done } : x));
      writeImportedPractice(next);
      return next;
    });
  }

  function removePracticeItem(id) {
    setPracticeQueue((prev) => {
      const next = prev.filter((x) => x.id !== id);
      writeImportedPractice(next);
      return next;
    });
  }

  async function handleImportSubmit(event) {
    event.preventDefault();
    setImportError('');
    const trimmed = importUrl.trim();
    if (!trimmed) return;
    setImportBusy(true);
    try {
      const base = String(apiBaseUrl || '').replace(/\/+$/, '');
      try {
        const res = await fetch(`${base}/api/platforms/import-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: trimmed }),
          signal: AbortSignal.timeout(6000),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.items) && data.items.length > 0) {
            addPracticeItems(data.items);
            setImportUrl('');
            return;
          }
        }
      } catch {
        // Fall through to client-side URL parser
      }
      const parsed = parseExternalPracticeUrl(trimmed);
      addPracticeItems([parsed]);
      setImportUrl('');
    } catch (err) {
      setImportError(err?.message || 'Could not import URL');
    } finally {
      setImportBusy(false);
    }
  }

  async function loadContests(forceRefresh = false) {
    setLoading(true);
    try {
      const base = String(apiBaseUrl || '').replace(/\/+$/, '');
      const qs = forceRefresh ? '?refresh=1' : '';
      const res = await fetch(`${base}/api/contests${qs}`, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.contests) && data.contests.length > 0) {
          setContests(data.contests);
          setLoading(false);
          return;
        }
      }
    } catch {
      // Fallback: fetch live Codeforces directly from browser
    }
    try {
      const cfRes = await fetch('https://codeforces.com/api/contest.list?gym=false', { signal: AbortSignal.timeout(7000) });
      if (cfRes.ok) {
        const cf = await cfRes.json();
        if (cf?.status === 'OK' && Array.isArray(cf.result)) {
          const cfList = cf.result
            .filter((c) => (c.phase === 'BEFORE' || c.phase === 'CODING') && c.startTimeSeconds)
            .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds)
            .slice(0, 10)
            .map((c) => ({
              id: `cf-${c.id}`,
              platform: 'codeforces',
              platformLabel: 'Codeforces',
              name: c.name,
              startTimeMs: c.startTimeSeconds * 1000,
              durationSec: c.durationSeconds || 7200,
              url: c.phase === 'CODING'
                ? `https://codeforces.com/contest/${c.id}`
                : `https://codeforces.com/contests/${c.id}`,
              live: true,
            }));
          setContests(cfList);
        }
      }
    } catch {
      // Keep current list if offline
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadContests();
    const tick = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(tick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contests.filter((c) => {
      if (platform !== 'all' && c.platform !== platform) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.platformLabel.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [contests, platform, query]);

  const countsByPlatform = useMemo(() => {
    const map = { all: contests.length, codeforces: 0, leetcode: 0, atcoder: 0, codechef: 0 };
    for (const c of contests) {
      if (Object.prototype.hasOwnProperty.call(map, c.platform)) map[c.platform] += 1;
    }
    return map;
  }, [contests]);

  const nextContest = contests[0] || null;
  const userTimeZone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
    } catch {
      return 'Local';
    }
  }, []);

  const platforms = [
    { id: 'all', label: t.ui.allPlatforms },
    { id: 'codeforces', label: 'Codeforces' },
    { id: 'leetcode', label: 'LeetCode' },
    { id: 'atcoder', label: 'AtCoder' },
    { id: 'codechef', label: 'CodeChef' },
  ];

  return (
    <section className="page-section contests-page contests-page-v2">
      <div className="contests-hero-banner">
        <div className="contests-hero-copy">
          <span className="contests-hero-eyebrow">
            <Trophy size={13} aria-hidden="true" />
            <span>{userTimeZone}</span>
          </span>
          <h1 lang={locale}>{t.studio.contests.title}<span>.</span></h1>
          <p>{t.studio.contests.subtitle}</p>
          <div className="contests-hero-actions">
            <Button variant="outlined" size="sm" className="profile-hero-ghost-btn" onClick={() => loadContests(true)} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'is-spinning' : ''} aria-hidden="true" />
              {loading ? t.studio.contests.refreshing : t.studio.contests.refresh}
            </Button>
            <span className="contests-hero-count">
              <strong>{contests.length}</strong> {t.ui.allPlatforms.toLowerCase()}
            </span>
          </div>
        </div>

        {nextContest && (
          <div className="contest-next-spotlight">
            <div className="contest-spotlight-head">
              <span className="contest-platform-chip" data-platform={nextContest.platform}>
                {PLATFORM_CODES[nextContest.platform] || 'CP'} · {nextContest.platformLabel}
              </span>
              <span className={`contest-countdown-pill ${nextContest.startTimeMs - nowMs <= 86400000 ? 'is-soon' : ''}`}>
                <Clock size={12} aria-hidden="true" />
                {nextContest.startTimeMs <= nowMs ? t.studio.contests.liveNow : formatCountdown(nextContest.startTimeMs, nowMs)}
              </span>
            </div>
            <h2>{nextContest.name}</h2>
            <p className="contest-spotlight-time">
              <Calendar size={13} aria-hidden="true" />
              <span>
                {new Date(nextContest.startTimeMs).toLocaleString(locale, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {' · '}
                {formatDuration(nextContest.durationSec, t.studio.contests.minUnit)}
              </span>
            </p>
            <div className="contest-spotlight-actions">
              <Button variant="solid" size="sm" href={nextContest.url} target="_blank" rel="noopener noreferrer">
                {t.studio.contests.register} <ExternalLink size={13} aria-hidden="true" />
              </Button>
              <Button variant="outlined" size="sm" className="profile-hero-ghost-btn" onClick={() => downloadContestIcs(nextContest)}>
                <Download size={13} aria-hidden="true" /> .ics
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="contests-toolbar">
        <div className="roadmap-domain-tabs contests-platform-tabs" role="tablist" aria-label="Contest platforms">
          {platforms.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={platform === p.id}
              className={`roadmap-domain-tab ${platform === p.id ? 'is-active' : ''}`}
              onClick={() => setPlatform(p.id)}
            >
              <span>{p.label}</span>
              <span className="contest-tab-count">{countsByPlatform[p.id] ?? 0}</span>
            </button>
          ))}
        </div>

        <label className="contests-search-box">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.palette.placeholder}
            aria-label={t.palette.placeholder}
          />
        </label>
      </div>

      <div className="contest-list-grid contest-list-v2">
        {filtered.map((contest) => {
          const startDate = new Date(contest.startTimeMs);
          const monthLabel = startDate.toLocaleString(locale, { month: 'short' }).toUpperCase();
          const dayNum = startDate.toLocaleString(locale, { day: '2-digit' });
          const weekdayLabel = startDate.toLocaleString(locale, { weekday: 'short' });
          const timeLabel = startDate.toLocaleString(locale, { hour: '2-digit', minute: '2-digit' });
          const isSoon = contest.startTimeMs - nowMs <= 86400000;
          const isLive = contest.startTimeMs <= nowMs;
          return (
            <Card key={contest.id} variant="outlined" className="contest-card contest-card-v2">
              <div className="contest-date-tile" aria-hidden="true">
                <span className="contest-date-month">{monthLabel}</span>
                <strong className="contest-date-day">{dayNum}</strong>
                <span className="contest-date-week">{weekdayLabel}</span>
              </div>

              <div className="contest-card-copy">
                <div className="contest-card-meta">
                  <span className="contest-platform-chip" data-platform={contest.platform}>
                    {PLATFORM_CODES[contest.platform] || 'CP'} · {contest.platformLabel}
                  </span>
                  <span className={`contest-countdown-pill ${isLive ? 'is-live' : isSoon ? 'is-soon' : ''}`}>
                    <Clock size={12} aria-hidden="true" />
                    {isLive ? t.studio.contests.liveNow : formatCountdown(contest.startTimeMs, nowMs)}
                  </span>
                </div>
                <h3>{contest.name}</h3>
                <p className="contest-time-line">
                  <Calendar size={13} aria-hidden="true" />
                  <span>{weekdayLabel}, {monthLabel} {dayNum} · {timeLabel}</span>
                  <span className="contest-duration-dot" aria-hidden="true">•</span>
                  <span>{formatDuration(contest.durationSec, t.studio.contests.minUnit)}</span>
                </p>
              </div>

              <div className="contest-card-actions">
                <Button
                  variant="outlined"
                  size="sm"
                  onClick={() => addPracticeItems([{
                    id: contest.id,
                    platform: contest.platform,
                    platformLabel: contest.platformLabel,
                    kind: 'contest',
                    slug: contest.id,
                    title: contest.name,
                    url: contest.url,
                  }])}
                >
                  <Plus size={14} aria-hidden="true" /> Practice
                </Button>
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

      <Card variant="outlined" className="contest-import-card">
        <div className="contest-import-head">
          <div>
            <h2>Import Any Question or Contest to Practice</h2>
            <p>Paste a LeetCode, Codeforces, AtCoder, CodeChef, HackerRank, or GeeksforGeeks URL — Codeforces rounds automatically expand their problem set.</p>
          </div>
        </div>

        <form className="contest-import-form" onSubmit={handleImportSubmit}>
          <div className="portfolio-handle-field contest-import-field">
            <span className="portfolio-handle-prefix" aria-hidden="true">
              <Link2 size={13} />
              <span>URL</span>
            </span>
            <input
              type="url"
              required
              placeholder="https://leetcode.com/problems/two-sum/ or https://codeforces.com/contest/2040"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
            />
          </div>
          <Button variant="solid" size="sm" type="submit" disabled={importBusy}>
            <Plus size={14} aria-hidden="true" /> {importBusy ? '...' : 'Import to Practice'}
          </Button>
        </form>

        {importError && (
          <p role="alert" style={{ margin: '6px 0 0', fontSize: 12, color: '#ef4444' }}>
            {importError}
          </p>
        )}

        {practiceQueue.length > 0 && (
          <div className="imported-practice-list">
            {practiceQueue.map((item) => (
              <div key={item.id} className={`imported-practice-row ${item.done ? 'is-done' : ''}`}>
                <button
                  type="button"
                  className={`imported-done-btn ${item.done ? 'is-checked' : ''}`}
                  onClick={() => togglePracticeDone(item.id)}
                  aria-label="Toggle solved"
                >
                  {item.done && <Check size={12} aria-hidden="true" />}
                </button>
                <span className="contest-platform-chip" data-platform={item.platform}>
                  {PLATFORM_CODES[item.platform] || 'CP'}
                </span>
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="imported-practice-link">
                  <strong>{item.title}</strong>
                  <ExternalLink size={12} aria-hidden="true" />
                </a>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Remove"
                  onClick={() => removePracticeItem(item.id)}
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}
