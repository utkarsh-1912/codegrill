const defaultRoomsUrl = 'https://utkristi-colabs.vercel.app/';
const roomIdPattern = /^[a-zA-Z0-9_-]{1,128}$/;
const roomAlphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';

const SAVED_ROOMS_KEY = 'codegrill:rooms:v1';
const ROOM_STATE_PREFIX = 'codegrill:room-state:';
const ROOM_PROFILE_KEY = 'codegrill:room-profile:v1';

export function roomsDirectory(config = defaultRoomsUrl) {
  try {
    const url = new URL(config);
    return url.protocol === 'https:' && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

export function roomEditor(id, directory) {
  return directory && roomIdPattern.test(id) ? new URL('/editor/' + id, directory) : null;
}

export function newRoomId() {
  return Array.from(crypto.getRandomValues(new Uint32Array(8)), (value) => (
    roomAlphabet[value % roomAlphabet.length]
  )).join('');
}

export function roomInvite(value, directory) {
  const invite = value.trim();
  if (roomIdPattern.test(invite)) return roomEditor(invite, directory);
  const url = roomsDirectory(invite);
  if (!directory || url?.origin !== directory.origin) return null;
  const [, id] = /^\/editor\/([^/]+)\/?$/.exec(url.pathname) ?? [];
  if (id && roomIdPattern.test(id)) return url;
  return roomEditor(url.searchParams.get('room') ?? '', directory);
}

export function studyLocation(hash, problemSlugs) {
  const [page, query] = hash.slice(1).split('?', 2);
  const problem = new URLSearchParams(query).get('problem');
  return {
    page,
    problem: (page === 'problems' || page === 'rooms') && problemSlugs.has(problem) ? problem : '',
  };
}

export function problemShareUrl(address, slug) {
  const url = new URL(address);
  url.search = '';
  url.hash = 'problems?' + new URLSearchParams({ problem: slug });
  return url.href;
}

export const ROOM_FORMATS = [
  {
    id: 'dsa',
    label: 'Pair DSA',
    short: 'DSA',
    minutes: 45,
    description: 'Timed coding interview with complexity walkthrough and dry-run.',
    stages: [
      'Clarify constraints, input bounds & edge cases',
      'Explain brute-force baseline & bottleneck',
      'Derive optimal algorithm & data structures',
      'Implement clean code & trace edge cases',
      'State time O(...) and space O(...) complexity',
    ],
    template: `## 1. Constraints & Edge Cases
- 

## 2. Approach & Complexity
- **Brute Force**: 
- **Optimal**: 
- **Time**:  · **Space**: 

## 3. Implementation
\`\`\`python
# Write your implementation here
\`\`\`
`,
  },
  {
    id: 'hld',
    label: 'System Design',
    short: 'HLD',
    minutes: 45,
    description: 'High-level architecture, back-of-the-envelope scale, and Mermaid diagrams.',
    stages: [
      'Clarify functional & non-functional requirements',
      'Estimate QPS, storage & bandwidth',
      'Define APIs & core data schema',
      'Draw high-level architecture diagram',
      'Deep-dive bottlenecks, caching & failure modes',
    ],
    template: `## 1. Functional & Non-Functional Requirements
- 

## 2. Scale & Capacity Estimates
- 

## 3. API & Data Model
- 

## 4. Architecture & Deep Dive
- 
`,
  },
  {
    id: 'lld',
    label: 'LLD & OOD',
    short: 'LLD',
    minutes: 45,
    description: 'Object modeling, interfaces, concurrency locks, and extensible design patterns.',
    stages: [
      'List core actors, entities & use cases',
      'Define interfaces, invariants & class diagram',
      'Choose design patterns (Strategy / State / Factory)',
      'Handle concurrency, locking & error states',
      'Walk through extensibility for new requirements',
    ],
    template: `## 1. Requirements & Actors
- 

## 2. Entities, Interfaces & Patterns
- 

## 3. Implementation & Concurrency
- 
`,
  },
  {
    id: 'behavioral',
    label: 'Behavioral',
    short: 'STAR',
    minutes: 30,
    description: 'Structured STAR stories, leadership signals, and deep-dive follow-up drills.',
    stages: [
      'Situation: crisp 2-sentence context & stakes',
      'Task: your specific ownership & goal',
      'Action: trade-offs you drove (use "I", not "we")',
      'Result: quantified metric + reflection learned',
    ],
    template: `## Story Notes (STAR)
- **Situation**: 
- **Task**: 
- **Action**: 
- **Result**: 
`,
  },
];

export const ROOM_ROLES = [
  { id: 'peer', label: 'Peer' },
  { id: 'interviewer', label: 'Interviewer' },
  { id: 'candidate', label: 'Candidate' },
];

export const RUBRIC_DIMENSIONS = [
  { id: 'approach', label: 'Problem Solving & Architecture' },
  { id: 'communication', label: 'Communication & Clarity' },
  { id: 'execution', label: 'Code / Technical Depth' },
  { id: 'tradeoffs', label: 'Edge Cases & Trade-offs' },
];

export const ROOM_PROMPTS = {
  hld: [
    { id: 'hld-url-shortener', title: 'Design a URL Shortener (TinyURL)', tag: 'Classic · Read-heavy' },
    { id: 'hld-rate-limiter', title: 'Design a Distributed Rate Limiter', tag: 'Infra · Redis / Token Bucket' },
    { id: 'hld-chat', title: 'Design Real-Time Chat (WhatsApp / Slack)', tag: 'WebSockets · Fanout' },
    { id: 'hld-newsfeed', title: 'Design a Social News Feed', tag: 'Fan-out on Write vs Read' },
    { id: 'hld-notification', title: 'Design a Notification & Alerting System', tag: 'Queues · Retries · DLQ' },
    { id: 'hld-search', title: 'Design Search Autocomplete / Typeahead', tag: 'Trie · Edge Caching' },
  ],
  lld: [
    { id: 'lld-parking-lot', title: 'Design a Multi-Floor Parking Lot', tag: 'Strategy · Concurrency' },
    { id: 'lld-elevator', title: 'Design an Elevator Dispatch System', tag: 'State · Scheduling' },
    { id: 'lld-lru-cache', title: 'Design a Thread-Safe LRU / LFU Cache', tag: 'DLL + HashMap · Locks' },
    { id: 'lld-rate-limiter', title: 'Design an In-Memory Rate Limiter SDK', tag: 'Sliding Window · Token Bucket' },
    { id: 'lld-splitwise', title: 'Design Expense Sharing (Splitwise)', tag: 'Graph · Strategy' },
  ],
  behavioral: [
    { id: 'beh-conflict', title: 'Disagreement with a Senior Engineer or PM', tag: 'Influence · Alignment' },
    { id: 'beh-incident', title: 'Production Outage or High-Stakes Debugging', tag: 'Ownership · Calm under pressure' },
    { id: 'beh-ambiguity', title: 'Shipping Under High Ambiguity & Tight Deadlines', tag: 'Execution · Prioritization' },
    { id: 'beh-mistake', title: 'A Technical Mistake & What You Changed Afterward', tag: 'Growth · Humility' },
  ],
};

export function getRoomFormat(formatId) {
  return ROOM_FORMATS.find((f) => f.id === formatId) || ROOM_FORMATS[0];
}

export function isValidRoomId(id) {
  return typeof id === 'string' && roomIdPattern.test(id.trim());
}

export function parseRoomInput(rawValue, directory) {
  const trimmed = String(rawValue || '').trim();
  if (!trimmed) return null;
  if (roomIdPattern.test(trimmed)) {
    return { roomId: trimmed, mode: '', problem: '', colabsUrl: roomEditor(trimmed, directory) };
  }
  try {
    const parsed = new URL(trimmed);
    const roomParam = parsed.searchParams.get('room') || '';
    if (roomParam && roomIdPattern.test(roomParam)) {
      const modeParam = parsed.searchParams.get('mode') || '';
      const problemParam = parsed.searchParams.get('problem') || '';
      return {
        roomId: roomParam,
        mode: ROOM_FORMATS.some((f) => f.id === modeParam) ? modeParam : '',
        problem: problemParam,
        colabsUrl: roomEditor(roomParam, directory),
      };
    }
    const colabsMatch = roomInvite(trimmed, directory);
    if (colabsMatch) {
      const [, id] = /^\/editor\/([^/]+)\/?$/.exec(colabsMatch.pathname) ?? [];
      if (id && roomIdPattern.test(id)) {
        return { roomId: id, mode: '', problem: '', colabsUrl: colabsMatch };
      }
    }
  } catch {
    // Not a valid URL
  }
  return null;
}

export function buildRoomShareUrl(origin, { roomId, mode, problem } = {}) {
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : 'https://codegrill.app');
  const params = new URLSearchParams();
  if (roomId) params.set('room', roomId);
  if (mode && ROOM_FORMATS.some((f) => f.id === mode)) params.set('mode', mode);
  if (problem) params.set('problem', problem);
  const qs = params.toString();
  return `${base.replace(/\/+$/, '')}/rooms${qs ? `?${qs}` : ''}`;
}

export function readRoomProfile() {
  try {
    const raw = JSON.parse(localStorage.getItem(ROOM_PROFILE_KEY) || '{}');
    return {
      name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 32) : '',
      role: ROOM_ROLES.some((r) => r.id === raw.role) ? raw.role : 'peer',
    };
  } catch {
    return { name: '', role: 'peer' };
  }
}

export function writeRoomProfile(profile) {
  try {
    localStorage.setItem(ROOM_PROFILE_KEY, JSON.stringify({
      name: String(profile?.name || '').trim().slice(0, 32),
      role: ROOM_ROLES.some((r) => r.id === profile?.role) ? profile.role : 'peer',
    }));
  } catch {
    // Ignore storage errors
  }
}

export function readSavedRooms() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVED_ROOMS_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter((item) => item && isValidRoomId(item.roomId)).slice(0, 12);
  } catch {
    return [];
  }
}

export function upsertSavedRoom(entry) {
  if (!entry || !isValidRoomId(entry.roomId)) return readSavedRooms();
  const current = readSavedRooms().filter((r) => r.roomId !== entry.roomId);
  const next = [
    {
      roomId: entry.roomId,
      mode: ROOM_FORMATS.some((f) => f.id === entry.mode) ? entry.mode : 'dsa',
      title: String(entry.title || '').trim().slice(0, 120),
      problemSlug: String(entry.problemSlug || '').trim(),
      promptId: String(entry.promptId || '').trim(),
      updatedAt: Date.now(),
    },
    ...current,
  ].slice(0, 12);
  try {
    localStorage.setItem(SAVED_ROOMS_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors
  }
  return next;
}

export function removeSavedRoom(roomId) {
  const next = readSavedRooms().filter((r) => r.roomId !== roomId);
  try {
    localStorage.setItem(SAVED_ROOMS_KEY, JSON.stringify(next));
    localStorage.removeItem(`${ROOM_STATE_PREFIX}${roomId}`);
  } catch {
    // Ignore storage errors
  }
  return next;
}

export function buildRoomNotesTemplate(mode = 'dsa', { problem = null, problemTitle = '', promptTitle = '', topicLabel = '' } = {}) {
  const fmt = getRoomFormat(mode);
  if (problem) {
    const heading = problem.leetcode_id
      ? `# ${problem.leetcode_id}. ${problemTitle || problem.slug}`
      : `# ${problemTitle || problem.slug}`;
    const meta = [
      problem.difficulty ? `**Difficulty**: ${problem.difficulty}` : '',
      topicLabel ? `**Topic**: ${topicLabel}` : '',
    ].filter(Boolean).join(' · ');
    return [
      heading,
      meta ? `> ${meta}` : '',
      '',
      fmt.template.trim(),
      '',
    ].filter((line, idx) => !(idx === 1 && !line)).join('\n');
  }
  if (promptTitle) {
    return `# ${promptTitle}\n\n${fmt.template}`;
  }
  return fmt.template;
}

const LEGACY_BOILERPLATE_MARKERS = [
  '## Scale Estimates\n- **DAU**: 50M',
  '## Approach Notes\n- **Constraints**: $n \\le 10^5$',
  '## Core Entities & Patterns\n- **Patterns**: Strategy for pricing',
  '## Story Brief (STAR)\n- **Situation**: Production latency spiked 3x',
];

export function isLegacyOrDefaultNotes(notes) {
  const text = String(notes || '').trim();
  if (!text) return true;
  if (LEGACY_BOILERPLATE_MARKERS.some((marker) => text.startsWith(marker))) return true;
  if (ROOM_FORMATS.some((f) => f.template.trim() === text)) return true;
  // Also match an unedited header-prefixed default template
  const withoutHeader = text.replace(/^# [^\n]+\n(?:> [^\n]+\n)?\n*/, '').trim();
  if (ROOM_FORMATS.some((f) => f.template.trim() === withoutHeader)) return true;
  return false;
}

export function createDefaultRoomState(mode = 'dsa', { problem = null, problemSlug = '', problemTitle = '', promptTitle = '', topicLabel = '' } = {}) {
  const fmt = getRoomFormat(mode);
  return {
    mode: fmt.id,
    problemSlug: problem?.slug || problemSlug || '',
    promptTitle: promptTitle || problemTitle || '',
    notes: buildRoomNotesTemplate(fmt.id, { problem, problemTitle, promptTitle, topicLabel }),
    checklist: fmt.stages.map(() => false),
    scores: { approach: 0, communication: 0, execution: 0, tradeoffs: 0 },
    timerDurationSec: fmt.minutes * 60,
    timerRemainingSec: fmt.minutes * 60,
    timerRunning: false,
    timerUpdatedAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function readRoomState(roomId, fallbackMode = 'dsa', extras = {}) {
  if (!isValidRoomId(roomId)) return createDefaultRoomState(fallbackMode, extras);
  try {
    const raw = JSON.parse(localStorage.getItem(`${ROOM_STATE_PREFIX}${roomId}`) || 'null');
    if (raw && typeof raw === 'object') {
      const fmt = getRoomFormat(raw.mode || fallbackMode);
      const checklist = Array.isArray(raw.checklist) && raw.checklist.length === fmt.stages.length
        ? raw.checklist.map(Boolean)
        : fmt.stages.map(() => false);
      return {
        ...createDefaultRoomState(fmt.id, extras),
        ...raw,
        mode: fmt.id,
        checklist,
        scores: {
          approach: Number(raw.scores?.approach) || 0,
          communication: Number(raw.scores?.communication) || 0,
          execution: Number(raw.scores?.execution) || 0,
          tradeoffs: Number(raw.scores?.tradeoffs) || 0,
        },
      };
    }
  } catch {
    // Fallback to fresh room state
  }
  return createDefaultRoomState(fallbackMode, extras);
}

export function writeRoomState(roomId, state) {
  if (!isValidRoomId(roomId)) return;
  try {
    localStorage.setItem(`${ROOM_STATE_PREFIX}${roomId}`, JSON.stringify({
      ...state,
      updatedAt: Date.now(),
    }));
  } catch {
    // Ignore storage quota errors
  }
}

export function buildRoomDebriefMarkdown({
  roomId,
  mode,
  exerciseTitle,
  role,
  participants = [],
  elapsedMin = 0,
  checklist = [],
  scores = {},
  notes = '',
}) {
  const fmt = getRoomFormat(mode);
  const rated = RUBRIC_DIMENSIONS.map((d) => Number(scores[d.id]) || 0).filter((v) => v > 0);
  const avg = rated.length ? (rated.reduce((a, b) => a + b, 0) / rated.length).toFixed(1) : 'N/A';
  const signal = !rated.length
    ? 'Unrated'
    : Number(avg) >= 3.5
      ? 'Strong Hire'
      : Number(avg) >= 2.75
        ? 'Hire'
        : Number(avg) >= 2.0
          ? 'Lean / Needs Polish'
          : 'No Hire (Practice Again)';

  const lines = [
    `# Codegrill Interview Debrief — Room \`${roomId}\``,
    '',
    `- **Format**: ${fmt.label}`,
    `- **Exercise**: ${exerciseTitle || 'Open Session'}`,
    `- **Your Role**: ${role}`,
    `- **Participants**: ${participants.length ? participants.join(', ') : 'Solo / Local'}`,
    `- **Time Spent**: ${elapsedMin} min`,
    `- **Signal**: ${signal} (${avg} / 4.0)`,
    '',
    '## Stage Checklist',
    ...fmt.stages.map((stage, idx) => `- [${checklist[idx] ? 'x' : ' '}] ${stage}`),
    '',
    '## Rubric Scores',
    ...RUBRIC_DIMENSIONS.map((dim) => `- **${dim.label}**: ${scores[dim.id] ? `${scores[dim.id]} / 4` : 'Not rated'}`),
    '',
    '## Session Notes & Diagrams',
    notes.trim() || '_No notes recorded._',
    '',
  ];
  return lines.join('\n');
}
