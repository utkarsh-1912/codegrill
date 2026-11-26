import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Card } from '@utkristi/ui';
import {
  Edit3, ExternalLink, Link2, Plus, RefreshCw, Trash2, Trophy, X,
} from 'lucide-react';
import {
  CODING_PLATFORMS,
  PLATFORM_MAP,
  buildProfileUrl,
  computeCombinedProfileStats,
  sanitizeHandle,
} from './profiles.mjs';
import { syncPlatformProfile } from './api.mjs';
import { SelectDropdown } from './SelectDropdown.jsx';
import { getMessages } from './i18n.mjs';

export function PlatformProfiles({
  linkedProfiles,
  codegrillSolved,
  apiBaseUrl,
  locale,
  onSaveProfiles,
}) {
  const t = getMessages(locale).profiles;
  const [formOpen, setFormOpen] = useState(false);
  const [platformId, setPlatformId] = useState('leetcode');
  const [handleInput, setHandleInput] = useState('');
  const [solvedInput, setSolvedInput] = useState('');
  const [ratingInput, setRatingInput] = useState('');
  const [rankInput, setRankInput] = useState('');
  const [syncingId, setSyncingId] = useState(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [statusNote, setStatusNote] = useState('');
  const autoSyncedRef = useRef(false);

  // Auto-sync linked profiles on load if stats are missing or older than 15 minutes
  useEffect(() => {
    if (autoSyncedRef.current) return;
    const entries = Object.values(linkedProfiles || {}).filter(Boolean);
    if (!entries.length) return;
    const staleThresholdMs = 15 * 60 * 1000;
    const now = Date.now();
    const needsSync = entries.filter((e) => {
      const missing = e.solved == null && e.rating == null && e.extraCount == null;
      const stale = !e.syncedAt || (now - Date.parse(e.syncedAt)) > staleThresholdMs;
      return missing || stale;
    });
    if (!needsSync.length) return;
    autoSyncedRef.current = true;

    let cancelled = false;
    setSyncingAll(true);
    Promise.all(
      needsSync.map(async (entry) => {
        const res = await syncPlatformProfile(entry.platform, entry.handle, apiBaseUrl);
        return { entry, res };
      }),
    ).then((results) => {
      if (cancelled) return;
      let changed = false;
      const next = { ...linkedProfiles };
      for (const { entry, res } of results) {
        if (res?.ok && res.stats) {
          next[entry.platform] = {
            ...entry,
            ...res.stats,
            solved: res.stats.solved ?? entry.solved,
            rating: res.stats.rating ?? entry.rating,
            rank: res.stats.rank || entry.rank,
            syncedAt: res.syncedAt || new Date().toISOString(),
            source: 'live',
          };
          changed = true;
        }
      }
      setSyncingAll(false);
      if (changed) onSaveProfiles(next);
    });

    return () => { cancelled = true; };
  }, [linkedProfiles, apiBaseUrl]);

  const summary = useMemo(
    () => computeCombinedProfileStats(linkedProfiles, codegrillSolved),
    [linkedProfiles, codegrillSolved],
  );

  const linkedList = useMemo(
    () => CODING_PLATFORMS
      .filter((p) => linkedProfiles?.[p.id])
      .map((p) => ({ meta: p, entry: linkedProfiles[p.id] })),
    [linkedProfiles],
  );

  const unlinkedPlatforms = useMemo(
    () => CODING_PLATFORMS.filter((p) => !linkedProfiles?.[p.id]),
    [linkedProfiles],
  );

  function openLinkForm(targetPlatform = 'leetcode') {
    const existing = linkedProfiles?.[targetPlatform];
    setPlatformId(targetPlatform);
    setHandleInput(existing?.handle || '');
    setSolvedInput(existing?.solved != null ? String(existing.solved) : '');
    setRatingInput(existing?.rating != null ? String(existing.rating) : '');
    setRankInput(existing?.rank || '');
    setStatusNote('');
    setFormOpen(true);
  }

  async function handleSaveAndSync(event) {
    event.preventDefault();
    const cleanHandle = sanitizeHandle(platformId, handleInput);
    if (!cleanHandle) return;

    const existing = linkedProfiles?.[platformId] || {};
    const manualSolved = solvedInput.trim() !== '' ? Number(solvedInput) : null;
    const manualRating = ratingInput.trim() !== '' ? Number(ratingInput) : null;
    const manualRank = rankInput.trim();

    const baseEntry = {
      ...existing,
      platform: platformId,
      handle: cleanHandle,
      profileUrl: buildProfileUrl(platformId, cleanHandle),
      solved: Number.isFinite(manualSolved) ? manualSolved : (existing.solved ?? null),
      rating: Number.isFinite(manualRating) ? manualRating : (existing.rating ?? null),
      rank: manualRank || existing.rank || '',
      source: 'manual',
    };

    const nextMap = { ...linkedProfiles, [platformId]: baseEntry };
    onSaveProfiles(nextMap);
    setFormOpen(false);
    setStatusNote('');

    // Attempt live sync immediately
    setSyncingId(platformId);
    const res = await syncPlatformProfile(platformId, cleanHandle, apiBaseUrl);
    setSyncingId(null);

    if (res?.ok && res.stats) {
      const merged = {
        ...baseEntry,
        ...res.stats,
        solved: res.stats.solved ?? baseEntry.solved,
        rating: res.stats.rating ?? baseEntry.rating,
        rank: res.stats.rank || baseEntry.rank,
        syncedAt: res.syncedAt || new Date().toISOString(),
        source: 'live',
      };
      onSaveProfiles({ ...nextMap, [platformId]: merged });
      setStatusNote('');
    } else if (res?.note) {
      setStatusNote(`${PLATFORM_MAP.get(platformId)?.name || platformId}: ${res.note}`);
    }
  }

  async function handleSyncOne(id) {
    const entry = linkedProfiles?.[id];
    if (!entry?.handle) return;
    setSyncingId(id);
    setStatusNote('');
    const res = await syncPlatformProfile(id, entry.handle, apiBaseUrl);
    setSyncingId(null);

    if (res?.ok && res.stats) {
      onSaveProfiles({
        ...linkedProfiles,
        [id]: {
          ...entry,
          ...res.stats,
          solved: res.stats.solved ?? entry.solved,
          rating: res.stats.rating ?? entry.rating,
          rank: res.stats.rank || entry.rank,
          syncedAt: res.syncedAt || new Date().toISOString(),
          source: 'live',
        },
      });
    } else if (res?.note) {
      setStatusNote(`${PLATFORM_MAP.get(id)?.name || id}: ${res.note}`);
    }
  }

  async function handleSyncAll() {
    if (!linkedList.length || syncingAll) return;
    setSyncingAll(true);
    setStatusNote('');
    const updated = { ...linkedProfiles };
    const notes = [];

    await Promise.all(
      linkedList.map(async ({ meta, entry }) => {
        const res = await syncPlatformProfile(meta.id, entry.handle, apiBaseUrl);
        if (res?.ok && res.stats) {
          updated[meta.id] = {
            ...entry,
            ...res.stats,
            solved: res.stats.solved ?? entry.solved,
            rating: res.stats.rating ?? entry.rating,
            rank: res.stats.rank || entry.rank,
            syncedAt: res.syncedAt || new Date().toISOString(),
            source: 'live',
          };
        } else if (res?.note) {
          notes.push(`${meta.name}: ${res.note}`);
        }
      }),
    );

    onSaveProfiles(updated);
    setSyncingAll(false);
    if (notes.length) setStatusNote(notes[0]);
  }

  function handleUnlink(id) {
    const next = { ...linkedProfiles };
    delete next[id];
    onSaveProfiles(next);
  }

  const activeMeta = PLATFORM_MAP.get(platformId);

  return (
    <section className="profiles-section" aria-label={t.title}>
      <div className="profiles-header">
        <div>
          <span className="profiles-eyebrow">{t.eyebrow}</span>
          <h2>{t.title}</h2>
          <p>{t.subtitle}</p>
        </div>
        <div className="profiles-header-actions">
          {linkedList.length > 0 && (
            <Button
              variant="outlined"
              size="sm"
              disabled={syncingAll}
              onClick={handleSyncAll}
            >
              <RefreshCw size={14} className={syncingAll ? 'spin-icon' : ''} aria-hidden="true" />
              {syncingAll ? t.syncing : t.syncAll}
            </Button>
          )}
          <Button
            variant="solid"
            size="sm"
            onClick={() => (formOpen ? setFormOpen(false) : openLinkForm(unlinkedPlatforms[0]?.id || 'leetcode'))}
          >
            {formOpen ? <X size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
            {formOpen ? t.cancel : t.linkProfile}
          </Button>
        </div>
      </div>

      <div className="profiles-kpi-strip">
        <div className="profiles-kpi">
          <span className="profiles-kpi-label">{t.totalSolved}</span>
          <strong className="profiles-kpi-value">{summary.totalSolved.toLocaleString()}</strong>
          <small>
            {t.codegrillSolved}: {summary.codegrillSolved} · {t.externalSolved}: {summary.externalSolved.toLocaleString()}
          </small>
        </div>
        <div className="profiles-kpi">
          <span className="profiles-kpi-label">{t.highestRating}</span>
          <strong className="profiles-kpi-value">
            {summary.highestRating !== null ? summary.highestRating.toLocaleString() : '—'}
          </strong>
          <small>{summary.highestRatingPlatform || '—'}</small>
        </div>
        <div className="profiles-kpi">
          <span className="profiles-kpi-label">{t.linkedCount}</span>
          <strong className="profiles-kpi-value">
            {summary.linkedCount}<span>/{CODING_PLATFORMS.length}</span>
          </strong>
          <small>{linkedList.map(({ meta }) => meta.badge).join(' · ') || '—'}</small>
        </div>
      </div>

      {formOpen && (
        <Card variant="outlined" className="profiles-form-card">
          <form className="profiles-form" onSubmit={handleSaveAndSync}>
            <div className="profiles-form-grid">
              <div className="profiles-field">
                <label>{t.platformLabel}</label>
                <SelectDropdown
                  ariaLabel={t.platformLabel}
                  value={platformId}
                  onChange={(nextId) => {
                    setPlatformId(nextId);
                    const ex = linkedProfiles?.[nextId];
                    setHandleInput(ex?.handle || '');
                    setSolvedInput(ex?.solved != null ? String(ex.solved) : '');
                    setRatingInput(ex?.rating != null ? String(ex.rating) : '');
                    setRankInput(ex?.rank || '');
                  }}
                  options={CODING_PLATFORMS.map((p) => ({
                    value: p.id,
                    label: p.name,
                    badge: p.badge,
                  }))}
                />
              </div>

              <div className="profiles-field">
                <label htmlFor="profile-handle-input">{t.handleLabel}</label>
                <input
                  id="profile-handle-input"
                  type="text"
                  required
                  value={handleInput}
                  onChange={(e) => setHandleInput(e.target.value)}
                  placeholder={activeMeta?.placeholder || t.handlePlaceholder}
                />
              </div>

              <div className="profiles-field">
                <label htmlFor="profile-solved-input">{t.solvedLabel}</label>
                <input
                  id="profile-solved-input"
                  type="number"
                  min="0"
                  value={solvedInput}
                  onChange={(e) => setSolvedInput(e.target.value)}
                  placeholder="0"
                />
              </div>

              <div className="profiles-field">
                <label htmlFor="profile-rating-input">{t.ratingLabel}</label>
                <input
                  id="profile-rating-input"
                  type="number"
                  min="0"
                  value={ratingInput}
                  onChange={(e) => setRatingInput(e.target.value)}
                  placeholder="1600"
                />
              </div>

              <div className="profiles-field">
                <label htmlFor="profile-rank-input">{t.rankLabel}</label>
                <input
                  id="profile-rank-input"
                  type="text"
                  value={rankInput}
                  onChange={(e) => setRankInput(e.target.value)}
                  placeholder="Knight / Expert / Top 5%"
                />
              </div>
            </div>

            <div className="profiles-form-actions">
              <Button variant="solid" size="sm" type="submit">
                <Link2 size={14} aria-hidden="true" />
                {t.saveAndSync}
              </Button>
              <Button variant="quiet" size="sm" type="button" onClick={() => setFormOpen(false)}>
                {t.cancel}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {statusNote && (
        <p className="profiles-status-note" role="status">{statusNote}</p>
      )}

      {linkedList.length > 0 ? (
        <div className="profiles-grid">
          {linkedList.map(({ meta, entry }) => {
            const isSyncing = syncingId === meta.id || syncingAll;
            return (
              <Card key={meta.id} variant="outlined" className="profile-platform-card">
                <div className="profile-card-head">
                  <div className="profile-card-brand">
                    <span className={`platform-monogram plat-${meta.id}`}>{meta.badge}</span>
                    <div className="profile-card-identity">
                      <strong>{meta.name}</strong>
                      <a
                        href={entry.profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="profile-handle-link"
                        title={t.openProfile}
                      >
                        @{entry.handle}
                        <ExternalLink size={12} aria-hidden="true" />
                      </a>
                    </div>
                  </div>
                  <Badge variant="outlined">
                    {entry.source === 'live' ? t.liveBadge : t.manualBadge}
                  </Badge>
                </div>

                <div className="profile-card-stats">
                  {meta.metricKind === 'repos' ? (
                    <div className="profile-stat">
                      <span>{entry.extraLabel || 'Repos'}</span>
                      <strong>{entry.extraCount != null ? entry.extraCount.toLocaleString() : '—'}</strong>
                    </div>
                  ) : (
                    <div className="profile-stat">
                      <span>{t.solvedStat}</span>
                      <strong>{entry.solved != null ? entry.solved.toLocaleString() : '—'}</strong>
                    </div>
                  )}

                  <div className="profile-stat">
                    <span>{t.ratingStat}</span>
                    <strong>
                      {entry.rating != null ? entry.rating.toLocaleString() : '—'}
                      {entry.maxRating != null && entry.maxRating > (entry.rating || 0) && (
                        <small> max {entry.maxRating}</small>
                      )}
                    </strong>
                  </div>

                  <div className="profile-stat">
                    <span>{t.rankStat}</span>
                    <strong className="profile-rank-val">
                      {entry.rank || (entry.globalRank ? `#${entry.globalRank.toLocaleString()}` : '—')}
                    </strong>
                  </div>
                </div>

                {(entry.easy != null || entry.medium != null || entry.hard != null) && (
                  <div className="profile-diff-pills">
                    {entry.easy != null && <span className="pdiff-easy">E {entry.easy}</span>}
                    {entry.medium != null && <span className="pdiff-med">M {entry.medium}</span>}
                    {entry.hard != null && <span className="pdiff-hard">H {entry.hard}</span>}
                    {entry.globalRank != null && (
                      <span className="pdiff-global">
                        <Trophy size={11} aria-hidden="true" /> #{entry.globalRank.toLocaleString()}
                      </span>
                    )}
                  </div>
                )}

                <div className="profile-card-footer">
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => handleSyncOne(meta.id)}
                    disabled={isSyncing}
                    aria-label={t.syncOne}
                    title={t.syncOne}
                  >
                    <RefreshCw size={14} className={isSyncing ? 'spin-icon' : ''} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => openLinkForm(meta.id)}
                    aria-label={t.editProfile}
                    title={t.editProfile}
                  >
                    <Edit3 size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => handleUnlink(meta.id)}
                    aria-label={t.unlinkProfile}
                    title={t.unlinkProfile}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <p className="profiles-empty-hint">{t.emptyHint}</p>
      )}

      {unlinkedPlatforms.length > 0 && (
        <div className="profiles-quick-row">
          <span className="profiles-quick-label">{t.quickAdd}</span>
          <div className="profiles-quick-chips">
            {unlinkedPlatforms.map((p) => (
              <button
                key={p.id}
                type="button"
                className="profiles-quick-chip"
                onClick={() => openLinkForm(p.id)}
              >
                <Plus size={12} aria-hidden="true" />
                <span>{p.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
