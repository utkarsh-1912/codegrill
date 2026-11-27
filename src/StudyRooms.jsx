import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card } from '@utkristi/ui';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Boxes,
  Check,
  Clock,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileCode2,
  Lightbulb,
  Maximize2,
  MessageSquare,
  Minimize2,
  Network,
  Pause,
  Pencil,
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
  buildRoomNotesTemplate,
  buildRoomShareUrl,
  createDefaultRoomState,
  getRoomFormat,
  isLegacyOrDefaultNotes,
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
import { resourcesFor } from './catalog.mjs';
import { RichTextInterpreter } from './RichTextInterpreter.jsx';
import { SelectDropdown } from './SelectDropdown.jsx';
import { Mascot } from './Mascot.jsx';
import { LanguageIcon } from './LanguageIcon.jsx';
import { getMessages } from './i18n.mjs';

const directory = roomsDirectory(import.meta.env.VITE_COLLAB_ROOMS_URL || undefined);

const FORMAT_ICONS = {
  dsa: Code2,
  hld: Network,
  lld: Boxes,
  behavioral: MessageSquare,
};

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
  categories = [],
  languages = {},
  activeRoomId = '',
  activeMode = '',
  sharedProblem = '',
  onNavigate,
  onOpenProblem,
  onOpenViewer,
  children,
}) {
  const t = getMessages(locale);
  const validActiveRoom = isValidRoomId(activeRoomId) ? activeRoomId.trim() : '';

  const getTopicLabel = (categoryId) => {
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return '';
    return cat.labels?.[locale] || cat.labels?.[defaultLocale] || cat.id;
  };

  const [profile, setProfile] = useState(readRoomProfile);
  const [savedRooms, setSavedRooms] = useState(readSavedRooms);

  const [setupMode, setSetupMode] = useState(() => (
    ROOM_FORMATS.some((f) => f.id === activeMode) ? activeMode : 'dsa'
  ));
  const [selectedSlug, setSelectedSlug] = useState(sharedProblem || '');
  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [invite, setInvite] = useState('');
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState('');

  const [roomState, setRoomState] = useState(() => (
    validActiveRoom
      ? readRoomState(validActiveRoom, activeMode || 'dsa', { problemSlug: sharedProblem })
      : createDefaultRoomState('dsa')
  ));
  const [editingNotes, setEditingNotes] = useState(false);
  const [revealedHints, setRevealedHints] = useState({ pattern: false, complexity: false, impl: false });
  const [conductorTab, setConductorTab] = useState('session'); // 'session' | 'rubric'
  const [padExpanded, setPadExpanded] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const padTextareaRef = useRef(null);
  const [swapQuery, setSwapQuery] = useState('');
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [copiedDebrief, setCopiedDebrief] = useState(false);
  const [peers, setPeers] = useState({});

  const tabIdRef = useRef(`tab-${Math.random().toString(36).slice(2, 9)}`);
  const channelRef = useRef(null);

  useEffect(() => {
    if (sharedProblem) setSelectedSlug(sharedProblem);
  }, [sharedProblem]);

  useEffect(() => {
    if (!validActiveRoom) return;
    const requestedMode = ROOM_FORMATS.some((f) => f.id === activeMode)
      ? activeMode
      : (sharedProblem ? 'dsa' : '');
    const loaded = readRoomState(validActiveRoom, requestedMode || 'dsa', {
      problemSlug: sharedProblem || '',
    });

    // Honor explicit URL mode/problem overrides over stale localStorage
    if (requestedMode && loaded.mode !== requestedMode) {
      const nextFmt = getRoomFormat(requestedMode);
      loaded.mode = nextFmt.id;
      loaded.checklist = nextFmt.stages.map(() => false);
      loaded.timerDurationSec = nextFmt.minutes * 60;
      loaded.timerRemainingSec = nextFmt.minutes * 60;
      loaded.timerRunning = false;
    }
    if (sharedProblem && loaded.problemSlug !== sharedProblem) {
      loaded.problemSlug = sharedProblem;
    }

    const prob = problems.find((p) => p.slug === loaded.problemSlug) || null;
    const probTitle = prob ? getProblemTitle(prob, locale, defaultLocale) : '';
    const topicLabel = prob ? getTopicLabel(prob.category_id) : '';
    if (prob && !loaded.promptTitle) {
      loaded.promptTitle = probTitle;
    }

    // Automatically replace legacy rubbish boilerplate or unmodified defaults with clean problem/prompt outline
    if (isLegacyOrDefaultNotes(loaded.notes)) {
      loaded.notes = buildRoomNotesTemplate(loaded.mode, {
        problem: prob,
        problemTitle: probTitle,
        promptTitle: loaded.promptTitle,
        topicLabel,
      });
    }

    setRevealedHints({ pattern: false, complexity: false, impl: false });
    setRoomState(loaded);
    writeRoomState(validActiveRoom, loaded);

    const label = probTitle || loaded.promptTitle || getRoomFormat(loaded.mode).label;

    setSavedRooms(upsertSavedRoom({
      roomId: validActiveRoom,
      mode: loaded.mode,
      title: label,
      problemSlug: loaded.problemSlug,
    }));
  }, [validActiveRoom, activeMode, sharedProblem]);

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
      problem: chosenProblem,
      problemSlug: chosenProblem?.slug || '',
      problemTitle: chosenProblem ? getProblemTitle(chosenProblem, locale, defaultLocale) : '',
      promptTitle,
      topicLabel: chosenProblem ? getTopicLabel(chosenProblem.category_id) : '',
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

  function handleJoin(event) {
    event?.preventDefault();
    const parsed = parseRoomInput(invite, directory);
    if (!parsed) {
      setError(t.rooms.invalidInvite);
      return;
    }
    setError('');
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
    { value: '', label: t.studio.rooms.noProblemAttached },
    ...problems.slice(0, 177).map((p) => ({
      value: p.slug,
      label: `${p.leetcode_id}. ${getProblemTitle(p, locale, defaultLocale)}`,
      badge: t.sheets[p.difficulty?.toLowerCase()] || p.difficulty,
    })),
  ]), [problems, locale, defaultLocale, t]);

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

  function insertSnippet(before, placeholder = '', after = '') {
    const el = padTextareaRef.current;
    const text = roomState.notes || '';
    const start = el ? el.selectionStart : text.length;
    const end = el ? el.selectionEnd : text.length;
    const selected = text.slice(start, end) || placeholder;
    const needsLeadingNewline = start > 0 && text[start - 1] !== '\n';
    const prefix = needsLeadingNewline ? `\n\n${before}` : before;
    const nextNotes = `${text.slice(0, start)}${prefix}${selected}${after}${text.slice(end)}`;
    updateRoomState({ notes: nextNotes });

    const selStart = start + prefix.length;
    const selEnd = selStart + selected.length;
    window.setTimeout(() => {
      if (!padTextareaRef.current) return;
      padTextareaRef.current.focus();
      padTextareaRef.current.setSelectionRange(selStart, selEnd);
    }, 0);
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
    const stagePct = Math.round((completedStages / Math.max(1, activeFormat.stages.length)) * 100);
    const timerPct = Math.max(
      0,
      Math.min(100, Math.round((roomState.timerRemainingSec / Math.max(1, roomState.timerDurationSec)) * 100)),
    );
    const isLowTime = roomState.timerRemainingSec > 0 && roomState.timerRemainingSec <= 300;
    const lineCount = (roomState.notes || '').split('\n').length;
    const wordCount = (roomState.notes || '').trim() ? (roomState.notes || '').trim().split(/\s+/).length : 0;
    const roomMascotMood = completedStages === activeFormat.stages.length && activeFormat.stages.length > 0
      ? 'happy'
      : roomState.timerRunning
        ? 'loading'
        : 'idle';

    return (
      <section className="page-section rooms-page room-workspace">
        <div className="room-studio-hero">
          <div className="room-studio-row-top">
            <div className="room-studio-hero-left">
              <Button variant="quiet" size="sm" className="room-back-btn" onClick={() => onNavigate?.('/rooms')}>
                <ArrowLeft size={15} aria-hidden="true" /> {t.studio.rooms.lobby}
              </Button>
              <div className="room-hero-status-group">
                <span className="room-id-pill is-dark">
                  <span className="room-live-dot" aria-hidden="true" />#{validActiveRoom}
                </span>
                <span className="room-format-pill is-dark">{t.studio.rooms.formats[activeFormat.id] || activeFormat.label}</span>
                <span className="room-presence-pill is-dark" title={participantList.join(', ')}>
                  <Users size={13} aria-hidden="true" /> {participantList.length} {t.studio.rooms.active}
                </span>
              </div>
            </div>

            <div className="room-studio-hero-right">
              <span className={`room-mini-clock ${isLowTime ? 'is-warning' : ''}`} title="Remaining time">
                <Clock size={13} aria-hidden="true" /> {formatClock(roomState.timerRemainingSec)}
              </span>

              <div className="room-hero-cta-group">
                <Button
                  variant="outlined"
                  size="sm"
                  className="room-hero-outline-btn"
                  onClick={() => copyRoomLink(validActiveRoom, roomState.mode, roomState.problemSlug)}
                >
                  {copiedInvite ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                  {copiedInvite ? t.studio.rooms.copied : t.studio.rooms.invite}
                </Button>

                {colabsUrl && (
                  <Button variant="solid" size="sm" href={colabsUrl.href} target="_blank" rel="noopener noreferrer">
                    Colabs <ExternalLink size={14} aria-hidden="true" />
                  </Button>
                )}
              </div>

              <button
                type="button"
                className="icon-btn room-expand-btn"
                onClick={() => setPadExpanded((v) => !v)}
                aria-pressed={padExpanded}
                aria-label={padExpanded ? 'Show conductor sidebar' : 'Expand scratchpad'}
                title={padExpanded ? 'Show conductor sidebar' : 'Expand scratchpad'}
              >
                {padExpanded ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
              </button>
            </div>
          </div>

          <div className="room-studio-row-exercise">
            <div className="room-exercise-main">
              <div className="room-exercise-copy">
                <span className="room-exercise-eyebrow">{t.studio.rooms.activeExercise} · {activeFormat.short}</span>
                <div className="room-brief-title-row">
                  <h1 className="room-studio-title">{activeExerciseTitle}</h1>
                  {activeProblem && (
                    <span className="room-diff-pill" data-level={activeProblem.difficulty}>
                      {t.sheets[activeProblem.difficulty?.toLowerCase()] || activeProblem.difficulty}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="room-exercise-actions">
              {activeProblem && (
                <>
                  {onOpenProblem && (
                    <Button variant="outlined" size="sm" className="room-hero-outline-btn" onClick={() => onOpenProblem(activeProblem.slug)}>
                      {t.studio.rooms.openProblem}
                    </Button>
                  )}
                  {activeProblem.leetcode_url && (
                    <Button
                      variant="quiet"
                      size="sm"
                      className="room-back-btn"
                      href={activeProblem.leetcode_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t.studio.rooms.practice} <ArrowUpRight size={14} aria-hidden="true" />
                    </Button>
                  )}
                </>
              )}
              <Button variant="quiet" size="sm" className="room-back-btn" onClick={() => setSwapOpen((v) => !v)}>
                {swapOpen ? t.studio.rooms.done : t.studio.rooms.change}
              </Button>
            </div>
          </div>

          {swapOpen && (
            <div className="room-swap-panel is-dark">
              <div className="room-format-strip">
                {ROOM_FORMATS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={roomState.mode === f.id ? 'is-active' : ''}
                    onClick={() => {
                      const nextFmt = getRoomFormat(f.id);
                      updateRoomState((prev) => {
                        const keepNotes = !isLegacyOrDefaultNotes(prev.notes);
                        const nextSlug = nextFmt.id === 'dsa' ? prev.problemSlug : '';
                        const prob = nextSlug ? problems.find((p) => p.slug === nextSlug) : null;
                        const probTitle = prob ? getProblemTitle(prob, locale, defaultLocale) : '';
                        const nextPrompt = nextFmt.id === 'dsa'
                          ? probTitle
                          : (ROOM_PROMPTS[nextFmt.id]?.[0]?.title || nextFmt.label);
                        return {
                          ...prev,
                          mode: nextFmt.id,
                          problemSlug: nextSlug,
                          promptTitle: nextPrompt,
                          notes: keepNotes
                            ? prev.notes
                            : buildRoomNotesTemplate(nextFmt.id, {
                              problem: prob,
                              problemTitle: probTitle,
                              promptTitle: nextPrompt,
                              topicLabel: prob ? getTopicLabel(prob.category_id) : '',
                            }),
                          checklist: nextFmt.stages.map(() => false),
                          timerDurationSec: nextFmt.minutes * 60,
                          timerRemainingSec: nextFmt.minutes * 60,
                          timerRunning: false,
                        };
                      });
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
                          const topicLabel = getTopicLabel(p.category_id);
                          updateRoomState((prev) => ({
                            ...prev,
                            mode: 'dsa',
                            problemSlug: p.slug,
                            promptTitle: nextTitle,
                            notes: isLegacyOrDefaultNotes(prev.notes)
                              ? buildRoomNotesTemplate('dsa', {
                                problem: p,
                                problemTitle: nextTitle,
                                topicLabel,
                              })
                              : prev.notes,
                          }));
                          setRevealedHints({ pattern: false, complexity: false, impl: false });
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
                        updateRoomState((prev) => ({
                          ...prev,
                          problemSlug: '',
                          promptTitle: pr.title,
                          notes: isLegacyOrDefaultNotes(prev.notes)
                            ? buildRoomNotesTemplate(prev.mode, { promptTitle: pr.title })
                            : prev.notes,
                        }));
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
        </div>

        <div className={`room-studio-grid ${padExpanded ? 'is-expanded' : ''}`}>
          <div className="room-main-pane">
            {activeProblem && (() => {
              const probTitle = getProblemTitle(activeProblem, locale, defaultLocale);
              const topicLabel = getTopicLabel(activeProblem.category_id);
              const solutionEntries = activeProblem.solutions
                ? Object.entries(languages).filter(([id]) => activeProblem.solutions[id])
                : [];
              const resourceLinks = resourcesFor(activeProblem.resources, locale, defaultLocale).slice(0, 4);

              return (
                <Card variant="outlined" className="room-problem-brief-card">
                  <div className="room-brief-top">
                    <div className="room-brief-meta">
                      <span className="room-brief-id">#{activeProblem.leetcode_id}</span>
                      {topicLabel && <span className="room-brief-tag">{topicLabel}</span>}
                      {activeProblem.neetcode_lists?.slice(0, 2).map((listName) => (
                        <span key={listName} className="room-brief-tag is-subtle">{listName}</span>
                      ))}
                    </div>

                    <div className="room-hint-toggles">
                      <button
                        type="button"
                        className={`room-hint-toggle ${revealedHints.pattern ? 'is-open' : ''}`}
                        onClick={() => setRevealedHints((h) => ({ ...h, pattern: !h.pattern }))}
                      >
                        <Lightbulb size={13} aria-hidden="true" />
                        {revealedHints.pattern ? t.studio.rooms.hideHint : t.studio.rooms.hintPattern}
                      </button>
                      <button
                        type="button"
                        className={`room-hint-toggle ${revealedHints.complexity ? 'is-open' : ''}`}
                        onClick={() => setRevealedHints((h) => ({ ...h, complexity: !h.complexity }))}
                      >
                        <Eye size={13} aria-hidden="true" />
                        {revealedHints.complexity ? t.studio.rooms.hideComplexity : t.studio.rooms.hintComplexity}
                      </button>
                      {(solutionEntries.length > 0 || resourceLinks.length > 0) && (
                        <button
                          type="button"
                          className={`room-hint-toggle ${revealedHints.impl ? 'is-open' : ''}`}
                          onClick={() => setRevealedHints((h) => ({ ...h, impl: !h.impl }))}
                        >
                          <FileCode2 size={13} aria-hidden="true" />
                          {revealedHints.impl ? t.studio.rooms.hideSolutions : t.studio.rooms.implementation}
                        </button>
                      )}
                    </div>
                  </div>

                  {(revealedHints.pattern || revealedHints.complexity || revealedHints.impl) && (
                    <div className="room-hints-drawer">
                      {revealedHints.pattern && (
                        <div className="room-hint-item">
                          <strong>{t.studio.rooms.optimalPattern}</strong>
                          <span>{activeProblem.optimal_approach || topicLabel || ''}</span>
                        </div>
                      )}
                      {revealedHints.complexity && (
                        <div className="room-hint-item">
                          <strong>{t.studio.rooms.targetComplexity}</strong>
                          <span>
                            {t.problems.time} <code>{activeProblem.time_complexity || 'O(n)'}</code> · {t.problems.space} <code>{activeProblem.space_complexity || 'O(n)'}</code>
                          </span>
                        </div>
                      )}
                      {revealedHints.impl && (
                        <div className="room-hint-impl">
                          {solutionEntries.length > 0 && (
                            <div className="room-impl-group">
                              <strong>{t.studio.rooms.referenceCode}</strong>
                              <div className="room-impl-pills">
                                {solutionEntries.map(([langId, langName]) => (
                                  <button
                                    key={langId}
                                    type="button"
                                    className="room-impl-pill"
                                    onClick={() => onOpenViewer?.({
                                      url: activeProblem.solutions[langId],
                                      title: `${probTitle} — ${langName}`,
                                      kind: 'code',
                                      solutionLang: langId,
                                      solutions: activeProblem.solutions,
                                      problemTitle: probTitle,
                                      problemSlug: activeProblem.slug,
                                    })}
                                  >
                                    <LanguageIcon lang={langId} size={14} /> {langName}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {resourceLinks.length > 0 && (
                            <div className="room-impl-group">
                              <strong>{t.studio.rooms.walkthroughsEditorials}</strong>
                              <div className="room-impl-pills">
                                {resourceLinks.map((link) => (
                                  <button
                                    key={link.kind + link.url}
                                    type="button"
                                    className="room-impl-pill is-resource"
                                    onClick={() => onOpenViewer?.({
                                      url: link.url,
                                      title: `${probTitle} — ${link.title}`,
                                      kind: link.kind === 'video' ? 'video' : 'article',
                                      problemTitle: probTitle,
                                    })}
                                  >
                                    {link.kind === 'video' ? <Play size={12} aria-hidden="true" /> : <BookOpen size={12} aria-hidden="true" />}
                                    <span>{link.title}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })()}

            <Card variant="outlined" className="room-pad-card">
              <div className="room-pad-toolbar">
                <div className="room-pad-heading">
                  <span className="room-pad-label">{t.studio.rooms.sharedNotes}</span>
                  <span className="room-pad-hint">
                    {editingNotes ? t.studio.rooms.escToRender : t.studio.rooms.clickToEdit}
                  </span>
                </div>

                <div className="room-pad-actions">
                  {editingNotes && (
                    <div className="room-snippet-bar">
                      <button
                        type="button"
                        onClick={() => insertSnippet('```\n', '', '\n```')}
                      >
                        + Code
                      </button>
                      <button
                        type="button"
                        onClick={() => insertSnippet('```mermaid\nflowchart LR\n    ', 'A --> B', '\n```')}
                      >
                        + Mermaid
                      </button>
                      <button
                        type="button"
                        onClick={() => insertSnippet('$$\n', '', '\n$$')}
                      >
                        + Math
                      </button>
                      <button
                        type="button"
                        onClick={() => insertSnippet('| ', 'Col 1', ' | Col 2 |\n| --- | --- |\n|  |  |')}
                      >
                        + Table
                      </button>
                    </div>
                  )}

                  <Button
                    variant={editingNotes ? 'solid' : 'outlined'}
                    size="sm"
                    onClick={() => {
                      setEditingNotes((v) => {
                        const next = !v;
                        if (next) {
                          window.setTimeout(() => padTextareaRef.current?.focus(), 0);
                        }
                        return next;
                      });
                    }}
                  >
                    {editingNotes ? (
                      <><Check size={14} aria-hidden="true" /> {t.studio.rooms.done}</>
                    ) : (
                      <><Pencil size={14} aria-hidden="true" /> {t.studio.rooms.edit}</>
                    )}
                  </Button>
                </div>
              </div>

              <div className={`room-pad-body ${editingNotes ? 'is-editing' : 'is-reading'}`}>
                {editingNotes ? (
                  <textarea
                    ref={padTextareaRef}
                    className="room-pad-textarea"
                    value={roomState.notes}
                    onChange={(e) => updateRoomState({ notes: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape' || ((e.metaKey || e.ctrlKey) && e.key === 'Enter')) {
                        e.preventDefault();
                        setEditingNotes(false);
                      }
                    }}
                    placeholder="Write Markdown, code blocks, $O(n \log n)$ math, or ```mermaid diagrams..."
                    spellCheck={false}
                  />
                ) : (
                  <div
                    className="room-pad-preview is-clickable"
                    onClick={(e) => {
                      if (e.target.closest('a, button, summary, details, pre')) return;
                      setEditingNotes(true);
                      window.setTimeout(() => padTextareaRef.current?.focus(), 0);
                    }}
                    title="Click to edit notes"
                  >
                    <RichTextInterpreter content={roomState.notes} format="markdown" />
                  </div>
                )}
              </div>

              <div className="room-pad-footer">
                <span>Markdown · KaTeX · Mermaid · Live sync</span>
                <span>{wordCount} words · {lineCount} lines · auto-saved</span>
              </div>
            </Card>
          </div>

          {!padExpanded && (
            <aside className="room-side-pane">
              <div className="room-conductor-tabs" role="tablist" aria-label="Conductor tools">
                <button
                  type="button"
                  role="tab"
                  aria-selected={conductorTab === 'session'}
                  className={conductorTab === 'session' ? 'is-active' : ''}
                  onClick={() => setConductorTab('session')}
                >
                  {t.studio.rooms.timerStages} ({completedStages}/{activeFormat.stages.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={conductorTab === 'rubric'}
                  className={conductorTab === 'rubric' ? 'is-active' : ''}
                  onClick={() => setConductorTab('rubric')}
                >
                  {avgScore ? `${t.studio.rooms.rubric} · ${avgScore}` : t.studio.rooms.rubricDebrief}
                </button>
              </div>

              {conductorTab === 'session' && (
                <>
                  <Card variant="outlined" className="room-widget-card">
                    <div className="room-widget-head">
                      <span className="room-widget-title">
                        <Clock size={15} aria-hidden="true" /> {t.studio.rooms.interviewTimer}
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
                    <div className="room-progress-track" aria-hidden="true">
                      <div className="room-progress-fill" style={{ width: `${timerPct}%` }} />
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
                        {roomState.timerRunning ? t.studio.rooms.pause : t.studio.rooms.start}
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
                        <RotateCcw size={14} aria-hidden="true" /> {t.studio.rooms.reset}
                      </Button>
                    </div>
                  </Card>

                  <Card variant="outlined" className="room-widget-card">
                    <div className="room-widget-head">
                      <span className="room-widget-title">{t.studio.rooms.stageChecklist}</span>
                      <span className="room-stage-count">{completedStages}/{activeFormat.stages.length}</span>
                    </div>
                    <div className="room-progress-track" aria-hidden="true">
                      <div className="room-progress-fill" style={{ width: `${stagePct}%` }} />
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
                </>
              )}

              {conductorTab === 'rubric' && (
                <Card variant="outlined" className="room-widget-card">
                  <div className="room-widget-head">
                    <span className="room-widget-title">{t.studio.rooms.interviewerRubric}</span>
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
                    <span>{t.studio.rooms.signal}</span>
                    <strong>{hireSignal}</strong>
                  </div>

                  <div className="room-debrief-actions">
                    <Button variant="outlined" size="sm" onClick={() => handleExportDebrief(false)}>
                      {copiedDebrief ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                      {copiedDebrief ? t.studio.rooms.copied : t.studio.rooms.copyDebrief}
                    </Button>
                    <Button variant="solid" size="sm" onClick={() => handleExportDebrief(true)}>
                      <Download size={14} aria-hidden="true" /> {t.studio.rooms.exportMd}
                    </Button>
                  </div>
                </Card>
              )}
            </aside>
          )}
        </div>
      </section>
    );
  }

  // ==================== OVERHAULED ROOMS LOBBY ====================
  return (
    <section className="page-section rooms-page rooms-lobby-v2">
      <div className="rooms-hero-banner">
        <div className="rooms-hero-copy">
          <h1 lang={locale}>{title}<span>.</span></h1>
          <p>{t.rooms.subtitle}</p>

          {directory && (
            <form className="rooms-quick-join" onSubmit={handleJoin}>
              <label className="visually-hidden" htmlFor="room-invite">{t.rooms.placeholder}</label>
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
              <Button variant="solid" type="submit">
                {t.rooms.joinBtn} <ArrowRight size={15} aria-hidden="true" />
              </Button>
            </form>
          )}
          {error && <p id="invite-error" className="rooms-hero-error" role="alert">{error}</p>}
        </div>

        <div className="rooms-hero-stage" aria-hidden="true">
          <div className="legal-orbit-ring ring-1" />
          <div className="legal-orbit-ring ring-2" />
          <Mascot mood="happy" size={134} label="Ember mock interview host" />
          <span className="rooms-hero-status">
            <span className="room-live-dot" /> {t.studio.rooms.liveSyncReady}
          </span>
        </div>
      </div>

      {directory ? (
        <div className="room-grid room-lobby-grid">
          <Card variant="outlined" className="study-panel room-setup-card">
            <div className="rooms-intro">
              <div>
                <h2>{t.rooms.startTitle}</h2>
                <p>{t.rooms.startDesc}</p>
              </div>
            </div>

            <div className="room-step-block">
              <span className="room-step-label">{t.studio.rooms.stepFormat}</span>
              <div className="room-format-grid" role="radiogroup" aria-label={t.studio.rooms.stepFormat}>
                {ROOM_FORMATS.map((fmt) => {
                  const Icon = FORMAT_ICONS[fmt.id] || Code2;
                  return (
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
                        <span className="room-format-tile-title">
                          <Icon size={15} aria-hidden="true" />
                          <strong>{t.studio.rooms.formats[fmt.id] || fmt.label}</strong>
                        </span>
                        <span>{fmt.minutes}m</span>
                      </div>
                      <small>{fmt.description}</small>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="room-step-block">
              <span className="room-step-label">{t.studio.rooms.stepIdentity}</span>
              <div className="room-identity-row">
                <label className="room-field-stack">
                  <span>{t.studio.rooms.displayName}</span>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => updateProfile({ name: e.target.value })}
                    placeholder="e.g. Alex"
                    maxLength={32}
                  />
                </label>
              </div>
            </div>

            <div className="room-step-block">
              <span className="room-step-label">{t.studio.rooms.stepAttach}</span>
              {setupMode === 'dsa' ? (
                <div className="room-attach-row">
                  <div className="room-attach-select">
                    <SelectDropdown
                      ariaLabel={t.studio.rooms.stepAttach}
                      value={selectedSlug}
                      onChange={setSelectedSlug}
                      options={problemOptions}
                    />
                  </div>
                  <Button variant="outlined" size="sm" onClick={pickRandomProblem} title={t.studio.rooms.random}>
                    <Shuffle size={14} aria-hidden="true" /> {t.studio.rooms.random}
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
            </div>

            <div className="rooms-actions room-launch-bar">
              <Button variant="solid" onClick={() => launchNewRoom(false)}>
                <Plus size={15} aria-hidden="true" /> {t.rooms.createRoom}
              </Button>
              <Button variant="outlined" onClick={() => launchNewRoom(true)}>
                {t.rooms.openColabs} <ArrowUpRight size={15} aria-hidden="true" />
              </Button>
            </div>
            {children}
          </Card>

          <Card variant="outlined" className="study-panel room-recent-card">
            <div className="room-widget-head">
              <div>
                <h2>{t.studio.rooms.recentSessions}</h2>
                <p className="room-recent-sub">{t.studio.rooms.recentSub}</p>
              </div>
              <span className="room-stage-count">{savedRooms.length}</span>
            </div>

            {savedRooms.length === 0 ? (
              <div className="room-recent-empty">
                <Mascot mood="idle" size={88} label={t.studio.rooms.recentSessions} />
                <p>{t.studio.rooms.recentEmpty}</p>
                <a className="external-room" href={directory.href} target="_blank" rel="noopener noreferrer">
                  {t.rooms.openColabs} <ArrowUpRight size={15} aria-hidden="true" />
                </a>
              </div>
            ) : (
              <>
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
                <div className="room-join-secondary">
                  <a className="external-room" href={directory.href} target="_blank" rel="noopener noreferrer">
                    {t.rooms.openColabs} <ArrowUpRight size={15} aria-hidden="true" />
                  </a>
                </div>
              </>
            )}
          </Card>
        </div>
      ) : (
        <p>{t.rooms.unavailable}</p>
      )}
    </section>
  );
}
