const ACCOUNT_SCOPED_KEYS = new Set([
  'codegrill:study:v1',
  'codegrill:custom-sheets:v1',
  'codegrill:linked-profiles:v1',
]);

const STORAGE_KEYS = [
  'codegrill:study:v1',
  'codegrill:custom-sheets:v1',
  'codegrill:linked-profiles:v1',
  'codegrill:domain-roadmap:v1',
  'codegrill:domain-favorites:v1',
  'codegrill:content-favorites:v1',
  'codegrill:modules:v1',
  'codegrill:rooms:v1',
  'codegrill:room-profile:v1',
];

export function exportLocalWorkspaceBackup(uid = '') {
  const data = {};
  for (const key of STORAGE_KEYS) {
    try {
      const storageKey = ACCOUNT_SCOPED_KEYS.has(key) ? scopedStorageKey(key, uid) : key;
      const raw = localStorage.getItem(storageKey);
      if (raw !== null) data[key] = JSON.parse(raw);
    } catch {
      // Skip malformed entry
    }
  }
  return {
    schema: 'codegrill-backup-v1',
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function importLocalWorkspaceBackup(rawInput, uid = '') {
  const parsed = typeof rawInput === 'string' ? JSON.parse(rawInput) : rawInput;
  if (!parsed || typeof parsed !== 'object' || !parsed.data || typeof parsed.data !== 'object') {
    throw new Error('Invalid Codegrill backup file format');
  }
  let restoredKeys = 0;
  for (const key of STORAGE_KEYS) {
    const sourceValue = Object.prototype.hasOwnProperty.call(parsed.data, key)
      ? parsed.data[key]
      : (key === 'codegrill:study:v1' && Object.prototype.hasOwnProperty.call(parsed.data, 'codegrill-preferences-v2')
          ? parsed.data['codegrill-preferences-v2']
          : undefined);
    if (sourceValue !== undefined) {
      const targetKey = ACCOUNT_SCOPED_KEYS.has(key) ? scopedStorageKey(key, uid) : key;
      localStorage.setItem(targetKey, JSON.stringify(sourceValue));
      restoredKeys += 1;
    }
  }
  return { ok: true, restoredKeys };
}

export function mergeNotesByTimestamp(
  remoteNotes = {},
  remoteTs = {},
  localNotes = {},
  localTs = {},
  fallbackRemoteTs = '',
  { preferRemoteDeletions = false } = {},
) {
  const mergedNotes = { ...(remoteNotes || {}) };
  const mergedNotesUpdatedAt = { ...(remoteTs || {}) };
  const fallbackRemoteTime = Date.parse(fallbackRemoteTs || '') || 0;
  for (const [slug, localText] of Object.entries(localNotes || {})) {
    if (typeof localText !== 'string' || !localText.trim()) continue;
    const remoteText = mergedNotes[slug];
    const remoteTime = Date.parse(mergedNotesUpdatedAt[slug] || fallbackRemoteTs || '') || 0;
    const localTime = Date.parse(localTs?.[slug] || '') || 0;
    const allowMissingRemote = !remoteText && (!preferRemoteDeletions || localTime > fallbackRemoteTime);
    if (allowMissingRemote || (remoteText && localTime > remoteTime)) {
      mergedNotes[slug] = localText;
      if (localTs?.[slug]) {
        mergedNotesUpdatedAt[slug] = localTs[slug];
      }
    }
  }
  return { notes: mergedNotes, notesUpdatedAt: mergedNotesUpdatedAt };
}

export function scopedStorageKey(baseKey, uid = '') {
  const cleanUid = String(uid || '').trim();
  return cleanUid ? `${baseKey}:uid:${cleanUid}` : baseKey;
}

export function createCloudApiAdapter({ apiBaseUrl = '', getIdToken = async () => '' } = {}) {
  const base = String(apiBaseUrl || '').replace(/\/+$/, '');

  async function authedFetch(path, options = {}) {
    const token = await getIdToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const res = await fetch(`${base}${path}`, { ...options, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error = new Error(err?.error || `HTTP ${res.status}`);
      error.status = res.status;
      error.code = err?.code || '';
      error.progress = err?.progress || null;
      throw error;
    }
    return res.json();
  }

  return {
    mode: 'cloud',
    getProgress: () => authedFetch('/api/progress'),
    upsertProgress: (payload) => authedFetch('/api/progress', { method: 'PUT', body: JSON.stringify(payload) }),
    resetProgress: () => authedFetch('/api/progress', { method: 'DELETE' }),
    importGuestProgress: (payload) => authedFetch('/api/progress/import', { method: 'POST', body: JSON.stringify(payload) }),
    restoreWorkspace: (payload) => authedFetch('/api/progress/restore', { method: 'POST', body: JSON.stringify(payload) }),
    getLinkedProfiles: () => authedFetch('/api/profiles'),
    saveLinkedProfiles: (profiles) => authedFetch('/api/profiles', { method: 'PUT', body: JSON.stringify({ profiles }) }),
    getCustomSheets: () => authedFetch('/api/sheets'),
    saveCustomSheet: (sheet) => authedFetch('/api/sheets', { method: 'POST', body: JSON.stringify(sheet) }),
    deleteCustomSheet: (sheetId) => authedFetch(`/api/sheets/${encodeURIComponent(sheetId)}`, { method: 'DELETE' }),
  };
}
