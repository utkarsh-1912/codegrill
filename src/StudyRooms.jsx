import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card } from '@utkristi/ui';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Shuffle,
  Trash2,
  Users,
} from 'lucide-react';
import {
  ROOM_FORMATS,
  ROOM_PROMPTS,
  ROOM_ROLES,
  RUBRIC_DIMENSIONS,
  buildRoomDebriefMarkdown,
  buildRoomShareUrl,
  createDefaultRoomState,
  getRoomFormat,
  isValidRoomId,
  newRoomId,
  parseRoomInput,
  readRoomProfile,
  readRoomState,
  readSavedRooms,
  removeSavedRoom,
  roomEditor,
  roomsDirectory,
  upsertSavedRoom,
  writeRoomProfile,
  writeRoomState,
} from './rooms.mjs';
import { RichTextInterpreter } from './RichTextInterpreter.jsx';
import { SelectDropdown } from './SelectDropdown.jsx';
import { getMessages } from './i18n.mjs';

const directory = roomsDirectory(import.meta.env.VITE_COLLAB_ROOMS_URL || undefined);

function formatClock(totalSeconds) {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatRelativeTime(ts) {
  if (!ts) return '';
  const diffMin = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

function getProblemTitle(problem, locale, defaultLocale) {
  if (!problem) return '';
  return problem.translations?.[locale]?.title || problem.translations?.[defaultLocale]?.title || problem.slug;
}

export function StudyRooms({
  title,
  locale,
  defaultLocale = 'en',
  problems = [],
  activeRoomId = '',
  activeMode = '',
  sharedProblem = '',
  onNavigate,
  onOpenProblem,
  children,
}) {
  const t = getMessages(locale);
  const validActiveRoom = isValidRoomId(activeRoomId) ? activeRoomId.trim() : '';

  // Profile (name + role) persisted locally
  const [profile, setProfile] = useState(readRoomProfile);
  const [savedRooms, setSavedRooms] = useState(readSavedRooms);

  // Lobby state
  const [setupMode, setSetupMode] = useState(() => (
    ROOM_FORMATS.some((f) => f.id === activeMode) ? activeMode : 'dsa'
  ));
  const [selectedSlug, setSelectedSlug] = useState(sharedProblem || '');
  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [invite, setInvite] = useState('');
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState('');

  // Active room state
  const [roomState, setRoomState] = useState(() => (
    validActiveRoom
      ? readRoomState(validActiveRoom, activeMode || 'dsa', { problemSlug: sharedProblem })
      : createDefaultRoomState('dsa')
  ));
  const [editorTab, setEditorTab] = useState('write'); // 'write' | 'preview' | 'split'
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapQuery, setSwapQuery] = useState('');
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [copiedDebrief, setCopiedDebrief] = useState(false);
  const [peers, setPeers] = useState({});

  const tabIdRef = useRef(`tab-${Math.random().toString(36).slice(2, 9)}`);
  const channelRef = useRef(null);

  useEffect(() => {
    if (sharedProblem) setSelectedSlug(sharedProblem);
  }, [sharedProblem]);

  // Hydrate room state whenever activeRoomId changes
  useEffect(() => {
    if (!validActiveRoom) return;
    const loaded = readRoomState(validActiveRoom, activeMode || 'dsa', {
      problemSlug: sharedProblem || '',
    });
    if (sharedProblem && !loaded.problemSlug) {
      loaded.problemSlug = sharedProblem;
    }
    setRoomState(loaded);
    writeRoomState(validActiveRoom, loaded);

    const prob = problems.find((p) => p.slug === loaded.problemSlug);
    const label = prob
      ? getProblemTitle(prob, locale, defaultLocale)
      : loaded.promptTitle || getRoomFormat(loaded.mode).label;

    setSavedRooms(upsertSavedRoom({
      roomId: validActiveRoom,
      mode: loaded.mode,
      title: label,
      problemSlug: loaded.problemSlug,
    }));
  }, [validActiveRoom, activeMode, sharedProblem]);

  // BroadcastChannel multi-tab sync for presence, notes, timer, checklist, and rubric
  useEffect(() => {
    if (!validActiveRoom || typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
      return undefined;
    }
    const channel = new BroadcastChannel(`codegrill-room:${validActiveRoom}`);
    channelRef.current = channel;
    const myId = tabIdRef.current;

    const announce = (kind = 'hello') => {
      try {
        channel.postMessage({
          type: kind,
          tabId: myId,
          name: profile.name || 'You',
          role: profile.role,
          ts: Date.now(),
        });
      } catch {
        // Ignore closed channel
      }
    };

    channel.onmessage = (event) => {
      const msg = event.data;
      if (!msg || msg.tabId === myId) return;
      if (msg.type === 'hello' || msg.type === 'heartbeat') {
        setPeers((prev) => ({
          ...prev,
          [msg.tabId]: { name: msg.name || 'Partner', role: msg.role || 'peer', ts: Date.now() },
        }));
        if (msg.type === 'hello') announce('heartbeat');
      } else if (msg.type === 'bye') {
        setPeers((prev) => {
          const next = { ...prev };
          delete next[msg.tabId];
          return next;
        });
      } else if (msg.type === 'state' && msg.state) {
        setRoomState(msg.state);
        writeRoomState(validActiveRoom, msg.state);
      }
    };

    announce('hello');
    const beat = window.setInterval(() => {
      announce('heartbeat');
      setPeers((prev) => {
        const cutoff = Date.now() - 12000;
        const next = {};
        for (const [k, v] of Object.entries(prev)) {
          if (v.ts >= cutoff) next[k] = v;
        }
        return next;
      });
    }, 4500);

    return () => {
      announce('bye');
      window.clearInterval(beat);
      channel.close();
      channelRef.current = null;
      setPeers({});
    };
  }, [validActiveRoom, profile.name, profile.role]);

  // Live countdown tick when timer is running
  useEffect(() => {
    if (!validActiveRoom || !roomState.timerRunning) return undefined;
    const timer = window.setInterval(() => {
      setRoomState((prev) => {
        if (!prev.timerRunning) return prev;
        const nextSec = Math.max(0, prev.timerRemainingSec - 1);
        const next = {
          ...prev,
          timerRemainingSec: nextSec,
          timerRunning: nextSec > 0,
          timerUpdatedAt: Date.now(),
        };
        writeRoomState(validActiveRoom, next);
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [validActiveRoom, roomState.timerRunning]);

  function updateRoomState(updater) {
    setRoomState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      if (validActiveRoom) {
        writeRoomState(validActiveRoom, next);
        try {
          channelRef.current?.postMessage({
            type: 'state',
            tabId: tabIdRef.current,
            state: next,
          });
        } catch {
          // Ignore channel post errors
        }
      }
      return next;
    });
  }

  function updateProfile(patch) {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      writeRoomProfile(next);
      return next;
    });
  }

  function launchNewRoom(openExternalOnly = false) {
    const id = newRoomId();
    const fmt = getRoomFormat(setupMode);
    const chosenProblem = setupMode === 'dsa' ? problems.find((p) => p.slug === selectedSlug) : null;
    const promptTitle = setupMode === 'dsa'
      ? (chosenProblem ? getProblemTitle(chosenProblem, locale, defaultLocale) : '')
      : (selectedPrompt.trim() || ROOM_PROMPTS[setupMode]?.[0]?.title || fmt.label);

    const initial = createDefaultRoomState(fmt.id, {
      problemSlug: chosenProblem?.slug || '',
      promptTitle,
    });
    writeRoomState(id, initial);
    setSavedRooms(upsertSavedRoom({
      roomId: id,
      mode: fmt.id,
      title: promptTitle || fmt.label,
      problemSlug: chosenProblem?.slug || '',
    }));

    if (openExternalOnly && directory) {
      const extUrl = roomEditor(id, directory);
      if (extUrl) window.open(extUrl.href, '_blank', 'noopener,noreferrer');
      return;
    }

    const params = new URLSearchParams({ room: id, mode: fmt.id });
    if (chosenProblem?.slug) params.set('problem', chosenProblem.slug);
    onNavigate?.(`/rooms?${params.toString()}`);
  }

  function handleJoin(event, openExternalOnly = false) {
    event?.preventDefault();
    const parsed = parseRoomInput(invite, directory);
    if (!parsed) {
      setError(t.rooms.invalidInvite);
      return;
    }
    setError('');
    if (openExternalOnly && parsed.colabsUrl) {
      window.open(parsed.colabsUrl.href, '_blank', 'noopener,noreferrer');
      return;
    }
    const params = new URLSearchParams({ room: parsed.roomId });
    if (parsed.mode) params.set('mode', parsed.mode);
    if (parsed.problem) params.set('problem', parsed.problem);
    setInvite('');
    onNavigate?.(`/rooms?${params.toString()}`);
  }

  function pickRandomProblem() {
    if (!problems.length) return;
    const random = problems[Math.floor(Math.random() * problems.length)];
    if (random) setSelectedSlug(random.slug);
  }

  async function copyRoomLink(roomId, mode, problemSlug) {
    const url = buildRoomShareUrl(window.location.origin, { roomId, mode, problem: problemSlug });
    try {
      await navigator.clipboard.writeText(url);
      if (roomId === validActiveRoom) {
        setCopiedInvite(true);
        setTimeout(() => setCopiedInvite(false), 1800);
      } else {
        setCopiedId(roomId);
        setTimeout(() => setCopiedId(''), 1800);
      }
    } catch {
      // Ignore clipboard failures
    }
  }

  const problemOptions = useMemo(() => ([
    { value: '', label: 'No problem attached (open session)' },
    ...problems.slice(0, 177).map((p) => ({
      value: p.slug,
      label: `${p.leetcode_id}. ${getProblemTitle(p, locale, defaultLocale)}`,
      badge: p.difficulty,
    })),
  ]), [problems, locale, defaultLocale]);

  const activeFormat = getRoomFormat(roomState.mode);
  const activeProblem = useMemo(
    () => problems.find((p) => p.slug === roomState.problemSlug) || null,
    [problems, roomState.problemSlug],
  );
  const activeExerciseTitle = activeProblem
    ? getProblemTitle(activeProblem, locale, defaultLocale)
    : roomState.promptTitle || activeFormat.label;

  const participantList = useMemo(() => {
    const selfLabel = `${profile.name || 'You'} (${profile.role})`;
    const remoteLabels = Object.values(peers).map((p) => `${p.name} (${p.role})`);
    return [selfLabel, ...remoteLabels];
  }, [profile.name, profile.role, peers]);

  const ratedValues = RUBRIC_DIMENSIONS.map((d) => Number(roomState.scores?.[d.id]) || 0).filter((v) => v > 0);
  const avgScore = ratedValues.length
    ? (ratedValues.reduce((a, b) => a + b, 0) / ratedValues.length).toFixed(1)
    : null;
  const hireSignal = !avgScore
    ? 'Rate criteria to compute signal'
    : Number(avgScore) >= 3.5
      ? 'Strong Hire'
      : Number(avgScore) >= 2.75
        ? 'Hire'
        : Number(avgScore) >= 2.0
          ? 'Lean / Needs Polish'
          : 'Practice Again';

  const filteredSwapProblems = useMemo(() => {
    const q = swapQuery.trim().toLowerCase();
    if (!q) return problems.slice(0, 12);
    return problems
      .filter((p) => {
        const name = getProblemTitle(p, locale, defaultLocale).toLowerCase();
        return name.includes(q) || String(p.leetcode_id).toLowerCase().includes(q) || p.slug.includes(q);
      })
      .slice(0, 12);
  }, [problems, swapQuery, locale, defaultLocale]);

  function insertSnippet(snippet) {
    updateRoomState((prev) => ({
      ...prev,
      notes: `${prev.notes.trimEnd()}\n\n${snippet}\n`,
    }));
  }

  async function handleExportDebrief(downloadFile = false) {
    const elapsedMin = Math.max(0, Math.round((roomState.timerDurationSec - roomState.timerRemainingSec) / 60));
    const md = buildRoomDebriefMarkdown({
      roomId: validActiveRoom,
      mode: roomState.mode,
      exerciseTitle: activeExerciseTitle,
      role: profile.role,
      participants: participantList,
      elapsedMin,
      checklist: roomState.checklist,
      scores: roomState.scores,
      notes: roomState.notes,
    });

    if (downloadFile) {
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `codegrill-room-${validActiveRoom}-debrief.md`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    try {
      await navigator.clipboard.writeText(md);
      setCopiedDebrief(true);
      setTimeout(() => setCopiedDebrief(false), 1800);
    } catch {
      // Ignore clipboard failures
    }
  }

  // ==================== ACTIVE ROOM WORKSPACE ====================
  if (validActiveRoom) {
    const colabsUrl = directory ? roomEditor(validActiveRoom, directory) : null;
    const completedStages = roomState.checklist.filter(Boolean).length;
    const isLowTime = roomState.timerRemainingSec > 0 && roomState.timerRemainingSec <= 300;

    return (
      <section className="page-section rooms-page room-workspace">
        <div className="room-topbar">
          <div className="room-topbar-left">
            <Button variant="quiet" size="sm" onClick={() => onNavigate?.('/rooms')}>
              <ArrowLeft size={15} aria-hidden="true" /> Lobby
            </Button>
            <span className="room-id-pill">#{validActiveRoom}</span>
            <span className="room-format-pill">{activeFormat.label}</span>
            <span className="room-presence-pill" title={participantList.join(', ')}>
              <Users size={13} aria-hidden="true" /> {participantList.length} active
            </span>
          </div>

          <div className="room-topbar-actions">
            <div className="room-role-pills" role="group" aria-label="Session role">
              {ROOM_ROLES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={profile.role === r.id ? 'is-active' : ''}
                  onClick={() => updateProfile({ role: r.id })}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <Button
              variant="outlined"
              size="sm"
              onClick={() => copyRoomLink(validActiveRoom, roomState.mode, roomState.problemSlug)}
            >
              {copiedInvite ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              {copiedInvite ? 'Copied' : 'Invite link'}
            </Button>

            {colabsUrl && (
              <Button variant="solid" size="sm" href={colabsUrl.href} target="_blank" rel="noopener noreferrer">
                Colabs Editor <ExternalLink size={14} aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>

        <div className="room-studio-grid">
          {/* Left Main Pane: Exercise Brief + Shared Scratchpad */}
          <div className="room-main-pane">
            <Card variant="outlined" className="room-brief-card">
              <div className="room-brief-head">
                <div className="room-brief-copy">
                  <span className="eyebrow">Active Exercise · {activeFormat.short}</span>
                  <h2>{activeExerciseTitle}</h2>
                </div>
                <div className="room-brief-actions">
                  {activeProblem && (
                    <>
                      <span className="difficulty-badge" data-level={activeProblem.difficulty}>
                        {activeProblem.difficulty}
                      </span>
                      {onOpenProblem && (
                        <Button variant="outlined" size="sm" onClick={() => onOpenProblem(activeProblem.slug)}>
                          Open Problem
                        </Button>
                      )}
                      {activeProblem.leetcode_url && (
                        <Button
                          variant="quiet"
                          size="sm"
                          href={activeProblem.leetcode_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Practice <ArrowUpRight size={14} aria-hidden="true" />
                        </Button>
                      )}
                    </>
                  )}
                  <Button variant="quiet" size="sm" onClick={() => setSwapOpen((v) => !v)}>
                    {swapOpen ? 'Done' : 'Change'}
                  </Button>
                </div>
              </div>

              {swapOpen && (
                <div className="room-swap-panel">
                  <div className="room-format-strip">
                    {ROOM_FORMATS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        className={roomState.mode === f.id ? 'is-active' : ''}
                        onClick={() => {
                          const nextFmt = getRoomFormat(f.id);
                          updateRoomState((prev) => ({
                            ...prev,
                            mode: nextFmt.id,
                            checklist: nextFmt.stages.map(() => false),
                            timerDurationSec: nextFmt.minutes * 60,
                            timerRemainingSec: nextFmt.minutes * 60,
                            timerRunning: false,
                          }));
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {roomState.mode === 'dsa' ? (
                    <div className="room-swap-picker">
                      <input
                        type="text"
                        value={swapQuery}
                        onChange={(e) => setSwapQuery(e.target.value)}
                        placeholder="Search 177 DSA problems by title or ID..."
                      />
                      <div className="room-swap-list">
                        {filteredSwapProblems.map((p) => (
                          <button
                            key={p.slug}
                            type="button"
                            className={`room-swap-item ${roomState.problemSlug === p.slug ? 'is-active' : ''}`}
                            onClick={() => {
                              const nextTitle = getProblemTitle(p, locale, defaultLocale);
                              updateRoomState({ problemSlug: p.slug, promptTitle: nextTitle });
                              setSavedRooms(upsertSavedRoom({
                                roomId: validActiveRoom,
                                mode: 'dsa',
                                title: nextTitle,
                                problemSlug: p.slug,
                              }));
                              setSwapOpen(false);
                            }}
                          >
                            <span>{p.leetcode_id}. {getProblemTitle(p, locale, defaultLocale)}</span>
                            <small>{p.difficulty}</small>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="room-swap-list">
                      {(ROOM_PROMPTS[roomState.mode] || []).map((pr) => (
                        <button
                          key={pr.id}
                          type="button"
                          className={`room-swap-item ${roomState.promptTitle === pr.title ? 'is-active' : ''}`}
                          onClick={() => {
                            updateRoomState({ problemSlug: '', promptTitle: pr.title });
                            setSavedRooms(upsertSavedRoom({
                              roomId: validActiveRoom,
                              mode: roomState.mode,
                              title: pr.title,
                              problemSlug: '',
                            }));
                            setSwapOpen(false);
                          }}
                        >
                          <span>{pr.title}</span>
                          <small>{pr.tag}</small>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>

            <Card variant="outlined" className="room-pad-card">
              <div className="room-pad-toolbar">
                <div className="segmented-tabs" role="group" aria-label="Scratchpad view">
                  <button type="button" aria-pressed={editorTab === 'write'} onClick={() => setEditorTab('write')}>
                    Write
                  </button>
                  <button type="button" aria-pressed={editorTab === 'preview'} onClick={() => setEditorTab('preview')}>
                    Preview
                  </button>
                  <button type="button" aria-pressed={editorTab === 'split'} onClick={() => setEditorTab('split')}>
                    Split
                  </button>
                </div>

                <div className="room-snippet-bar">
                  <button
                    type="button"
                    onClick={() => insertSnippet('```python\ndef solution():\n    pass\n```')}
                  >
                    + Code
                  </button>
                  <button
                    type="button"
                    onClick={() => insertSnippet('```mermaid\nflowchart LR\n    Client --> API --> DB[("Database")]\n```')}
                  >
                    + Mermaid
                  </button>
                  <button
                    type="button"
                    onClick={() => insertSnippet('$$T(n) = 2T(n/2) + O(n) = O(n \\log n)$$')}
                  >
                    + Math
                  </button>
                </div>
              </div>

              <div className={`room-pad-body is-${editorTab}`}>
                {(editorTab === 'write' || editorTab === 'split') && (
                  <textarea
                    className="room-pad-textarea"
                    value={roomState.notes}
                    onChange={(e) => updateRoomState({ notes: e.target.value })}
                    placeholder="Write Markdown, code blocks, $O(n \log n)$ math, or ```mermaid diagrams..."
                    spellCheck={false}
                  />
                )}
                {(editorTab === 'preview' || editorTab === 'split') && (
                  <div className="room-pad-preview">
                    <RichTextInterpreter content={roomState.notes} format="markdown" />
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Right Conductor Pane: Timer + Stage Checklist + Rubric */}
          <aside className="room-side-pane">
            <Card variant="outlined" className="room-widget-card">
              <div className="room-widget-head">
                <span className="room-widget-title">
                  <Clock size={15} aria-hidden="true" /> Interview Timer
                </span>
                <div className="room-timer-presets">
                  {[15, 30, 45, 60].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      className={roomState.timerDurationSec === mins * 60 ? 'is-active' : ''}
                      onClick={() => updateRoomState({
                        timerDurationSec: mins * 60,
                        timerRemainingSec: mins * 60,
                        timerRunning: false,
                        timerUpdatedAt: Date.now(),
                      })}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>

              <div className={`room-timer-display ${isLowTime ? 'is-warning' : ''}`}>
                {formatClock(roomState.timerRemainingSec)}
              </div>

              <div className="room-timer-controls">
                <Button
                  variant="solid"
                  size="sm"
                  onClick={() => updateRoomState((prev) => ({
                    ...prev,
                    timerRunning: !prev.timerRunning,
                    timerUpdatedAt: Date.now(),
                  }))}
                >
                  {roomState.timerRunning ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
                  {roomState.timerRunning ? 'Pause' : 'Start'}
                </Button>
                <Button
                  variant="outlined"
                  size="sm"
                  onClick={() => updateRoomState((prev) => ({
                    ...prev,
                    timerRemainingSec: prev.timerDurationSec,
                    timerRunning: false,
                    timerUpdatedAt: Date.now(),
                  }))}
                >
                  <RotateCcw size={14} aria-hidden="true" /> Reset
                </Button>
              </div>
            </Card>

            <Card variant="outlined" className="room-widget-card">
              <div className="room-widget-head">
                <span className="room-widget-title">Stage Checklist</span>
                <span className="room-stage-count">{completedStages}/{activeFormat.stages.length}</span>
              </div>
              <ul className="room-stage-list">
                {activeFormat.stages.map((stage, idx) => (
                  <li key={idx}>
                    <label>
                      <input
                        type="checkbox"
                        checked={Boolean(roomState.checklist[idx])}
                        onChange={() => updateRoomState((prev) => {
                          const nextList = [...prev.checklist];
                          nextList[idx] = !nextList[idx];
                          return { ...prev, checklist: nextList };
                        })}
                      />
                      <span className={roomState.checklist[idx] ? 'is-done' : ''}>{stage}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </Card>

            <Card variant="outlined" className="room-widget-card">
              <div className="room-widget-head">
                <span className="room-widget-title">Interviewer Rubric</span>
                {avgScore && <span className="room-score-avg">{avgScore} / 4.0</span>}
              </div>

              <div className="room-rubric-list">
                {RUBRIC_DIMENSIONS.map((dim) => {
                  const val = roomState.scores?.[dim.id] || 0;
                  return (
                    <div key={dim.id} className="room-rubric-row">
                      <span>{dim.label}</span>
                      <div className="room-score-pills" role="group" aria-label={dim.label}>
                        {[1, 2, 3, 4].map((score) => (
                          <button
                            key={score}
                            type="button"
                            className={val === score ? 'is-active' : ''}
                            onClick={() => updateRoomState((prev) => ({
                              ...prev,
                              scores: { ...prev.scores, [dim.id]: prev.scores[dim.id] === score ? 0 : score },
                            }))}
                          >
                            {score}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="room-signal-bar">
                <span>Signal</span>
                <strong>{hireSignal}</strong>
              </div>

              <div className="room-debrief-actions">
                <Button variant="outlined" size="sm" onClick={() => handleExportDebrief(false)}>
                  {copiedDebrief ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                  {copiedDebrief ? 'Copied' : 'Copy debrief'}
                </Button>
                <Button variant="solid" size="sm" onClick={() => handleExportDebrief(true)}>
                  <Download size={14} aria-hidden="true" /> Export .md
                </Button>
              </div>
            </Card>
          </aside>
        </div>
      </section>
    );
  }

  // ==================== ROOMS LOBBY ====================
  return (
    <section className="page-section rooms-page">
      <div className="section-heading">
        <div>
          <h1 lang={locale}>{title}</h1>
          <p>{t.rooms.subtitle}</p>
        </div>
      </div>

      {directory ? (
        <>
          <div className="room-grid room-lobby-grid">
            <Card variant="outlined" className="study-panel room-setup-card">
              <div className="rooms-intro">
                <div>
                  <h2>{t.rooms.startTitle}</h2>
                  <p>{t.rooms.startDesc}</p>
                </div>
              </div>

              <div className="room-format-grid" role="radiogroup" aria-label="Interview format">
                {ROOM_FORMATS.map((fmt) => (
                  <button
                    key={fmt.id}
                    type="button"
                    className={`room-format-tile ${setupMode === fmt.id ? 'is-active' : ''}`}
                    aria-checked={setupMode === fmt.id}
                    role="radio"
                    onClick={() => {
                      setSetupMode(fmt.id);
                      if (fmt.id !== 'dsa') {
                        setSelectedPrompt(ROOM_PROMPTS[fmt.id]?.[0]?.title || '');
                      }
                    }}
                  >
                    <div className="room-format-tile-top">
                      <strong>{fmt.label}</strong>
                      <span>{fmt.minutes}m</span>
                    </div>
                    <small>{fmt.description}</small>
                  </button>
                ))}
              </div>

              <div className="room-identity-row">
                <label className="room-field-stack">
                  <span>Display name</span>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => updateProfile({ name: e.target.value })}
                    placeholder="e.g. Alex"
                    maxLength={32}
                  />
                </label>

                <div className="room-field-stack">
                  <span>Role</span>
                  <div className="room-role-pills" role="group" aria-label="Role">
                    {ROOM_ROLES.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        className={profile.role === r.id ? 'is-active' : ''}
                        onClick={() => updateProfile({ role: r.id })}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {setupMode === 'dsa' ? (
                <div className="room-attach-row">
                  <div className="room-attach-select">
                    <SelectDropdown
                      ariaLabel="Attach problem"
                      value={selectedSlug}
                      onChange={setSelectedSlug}
                      options={problemOptions}
                    />
                  </div>
                  <Button variant="outlined" size="sm" onClick={pickRandomProblem} title="Pick random problem">
                    <Shuffle size={14} aria-hidden="true" /> Random
                  </Button>
                </div>
              ) : (
                <div className="room-prompt-chips">
                  {(ROOM_PROMPTS[setupMode] || []).map((pr) => (
                    <button
                      key={pr.id}
                      type="button"
                      className={`room-prompt-chip ${selectedPrompt === pr.title ? 'is-active' : ''}`}
                      onClick={() => setSelectedPrompt(pr.title)}
                    >
                      {pr.title}
                    </button>
                  ))}
                </div>
              )}

              <div className="rooms-actions">
                <Button variant="solid" onClick={() => launchNewRoom(false)}>
                  <Plus size={15} aria-hidden="true" /> {t.rooms.createRoom}
                </Button>
                <Button variant="outlined" onClick={() => launchNewRoom(true)}>
                  {t.rooms.openColabs} <ArrowUpRight size={15} aria-hidden="true" />
                </Button>
              </div>
              {children}
            </Card>

            <div className="room-lobby-side">
              <Card variant="outlined" className="study-panel">
                <div className="rooms-intro">
                  <div>
                    <h2>{t.rooms.joinTitle}</h2>
                    <p>{t.rooms.joinDesc}</p>
                  </div>
                </div>
                <form className="invite-form" onSubmit={(e) => handleJoin(e, false)}>
                  <label className="visually-hidden" htmlFor="room-invite">{t.rooms.placeholder}</label>
                  <div>
                    <input
                      id="room-invite"
                      type="text"
                      value={invite}
                      required
                      placeholder={t.rooms.placeholder}
                      autoCapitalize="none"
                      spellCheck={false}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? 'invite-error' : undefined}
                      onChange={(event) => { setInvite(event.target.value); setError(''); }}
                    />
                    <Button variant="solid" type="submit">{t.rooms.joinBtn}</Button>
                  </div>
                  {error && <p id="invite-error" role="alert">{error}</p>}
                </form>
                <div className="room-join-secondary">
                  <a className="external-room" href={directory.href} target="_blank" rel="noopener noreferrer">
                    {t.rooms.openColabs} <ArrowUpRight size={15} aria-hidden="true" />
                  </a>
                </div>
              </Card>

              <Card variant="outlined" className="study-panel room-recent-card">
                <div className="room-widget-head">
                  <h2>Recent rooms</h2>
                  <span className="room-stage-count">{savedRooms.length}</span>
                </div>
                {savedRooms.length === 0 ? (
                  <p className="room-empty-hint">
                    Rooms you create or join appear here with your saved scratchpad, timer, and rubric.
                  </p>
                ) : (
                  <ul className="room-recent-list">
                    {savedRooms.map((item) => {
                      const fmt = getRoomFormat(item.mode);
                      const colabs = roomEditor(item.roomId, directory);
                      return (
                        <li key={item.roomId} className="room-recent-item">
                          <button
                            type="button"
                            className="room-recent-open"
                            onClick={() => {
                              const params = new URLSearchParams({ room: item.roomId, mode: item.mode });
                              if (item.problemSlug) params.set('problem', item.problemSlug);
                              onNavigate?.(`/rooms?${params.toString()}`);
                            }}
                          >
                            <span className="room-format-pill">{fmt.short}</span>
                            <span className="room-recent-copy">
                              <strong>{item.title || fmt.label}</strong>
                              <small>#{item.roomId} · {formatRelativeTime(item.updatedAt)}</small>
                            </span>
                          </button>
                          <div className="room-recent-actions">
                            <button
                              type="button"
                              className="icon-btn"
                              aria-label="Copy room invite"
                              title="Copy room invite"
                              onClick={() => copyRoomLink(item.roomId, item.mode, item.problemSlug)}
                            >
                              {copiedId === item.roomId ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                            </button>
                            {colabs && (
                              <a
                                className="icon-btn"
                                href={colabs.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Open in Colabs"
                                title="Open in Colabs"
                              >
                                <ExternalLink size={14} aria-hidden="true" />
                              </a>
                            )}
                            <button
                              type="button"
                              className="icon-btn"
                              aria-label="Remove room"
                              title="Remove room"
                              onClick={() => setSavedRooms(removeSavedRoom(item.roomId))}
                            >
                              <Trash2 size={14} aria-hidden="true" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        </>
      ) : (
        <p>{t.rooms.unavailable}</p>
      )}
    </section>
  );
}
