const AUTH_SESSION_KEY = 'codegrill:auth-session:v1';
let lazyFirebaseAuth = null;
let tokenRefreshPromise = null;

// Direct `import.meta.env.VITE_*` (without optional chaining) is required for Vite static replacement.
const BUILD_FIREBASE_API_KEY = String((import.meta.env && import.meta.env.VITE_FIREBASE_API_KEY) || '').trim();
const BUILD_FIREBASE_PROJECT_ID = String((import.meta.env && import.meta.env.VITE_FIREBASE_PROJECT_ID) || '').trim();
const BUILD_FIREBASE_AUTH_DOMAIN = String(
  (import.meta.env && import.meta.env.VITE_FIREBASE_AUTH_DOMAIN)
  || (BUILD_FIREBASE_PROJECT_ID ? `${BUILD_FIREBASE_PROJECT_ID}.firebaseapp.com` : '')
).trim();

let runtimeFirebaseConfig = {
  apiKey: BUILD_FIREBASE_API_KEY,
  authDomain: BUILD_FIREBASE_AUTH_DOMAIN,
  projectId: BUILD_FIREBASE_PROJECT_ID,
};
let runtimeConfigPromise = null;

export function getFirebaseApiKey() {
  return runtimeFirebaseConfig.apiKey;
}

export function getFirebaseAuthDomain() {
  return runtimeFirebaseConfig.authDomain || (runtimeFirebaseConfig.projectId ? `${runtimeFirebaseConfig.projectId}.firebaseapp.com` : '');
}

export function getFirebaseProjectId() {
  return runtimeFirebaseConfig.projectId;
}

export function isFirebaseConfigured() {
  return Boolean(getFirebaseApiKey());
}

export function isGoogleAuthConfigured() {
  return Boolean(getFirebaseApiKey() && getFirebaseAuthDomain() && getFirebaseProjectId());
}

export async function ensureFirebaseConfig() {
  if (isGoogleAuthConfigured()) return runtimeFirebaseConfig;
  if (typeof fetch !== 'function') return runtimeFirebaseConfig;
  if (!runtimeConfigPromise) {
    runtimeConfigPromise = fetch('/api/config', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const fb = data?.firebase;
        if (fb && typeof fb === 'object') {
          const apiKey = String(fb.apiKey || runtimeFirebaseConfig.apiKey || '').trim();
          const projectId = String(fb.projectId || runtimeFirebaseConfig.projectId || '').trim();
          const authDomain = String(
            fb.authDomain || runtimeFirebaseConfig.authDomain || (projectId ? `${projectId}.firebaseapp.com` : '')
          ).trim();
          runtimeFirebaseConfig = { apiKey, authDomain, projectId };
        }
        return runtimeFirebaseConfig;
      })
      .catch(() => runtimeFirebaseConfig)
      .finally(() => {
        if (!isGoogleAuthConfigured()) runtimeConfigPromise = null;
      });
  }
  return runtimeConfigPromise;
}

export function readAuthSession() {
  try {
    const rawLocal = localStorage.getItem(AUTH_SESSION_KEY);
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal);
      if (parsed && parsed.uid && (parsed.idToken || parsed.refreshToken)) return parsed;
    }
    // One-time migration from legacy sessionStorage persistence
    const rawSession = sessionStorage.getItem(AUTH_SESSION_KEY);
    if (rawSession) {
      const parsed = JSON.parse(rawSession);
      if (parsed && parsed.uid && (parsed.idToken || parsed.refreshToken)) {
        try {
          localStorage.setItem(AUTH_SESSION_KEY, rawSession);
          sessionStorage.removeItem(AUTH_SESSION_KEY);
        } catch {
          // Ignore storage errors
        }
        return parsed;
      }
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

function writeAuthSession(session) {
  try {
    if (session) {
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
      sessionStorage.removeItem(AUTH_SESSION_KEY);
    } else {
      localStorage.removeItem(AUTH_SESSION_KEY);
      sessionStorage.removeItem(AUTH_SESSION_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

async function callIdentityToolkit(endpoint, email, password) {
  await ensureFirebaseConfig();
  const apiKey = getFirebaseApiKey();
  if (!apiKey) throw new Error('Firebase Authentication is not configured.');
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), password, returnSecureToken: true }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message?.replace(/_/g, ' ') || 'Authentication failed');
  }
  const expiresSec = Math.max(300, Number(data.expiresIn) || 3600);
  const session = {
    uid: data.localId,
    email: data.email || email.trim(),
    displayName: data.displayName || '',
    photoURL: data.profilePicture || '',
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + (expiresSec - 60) * 1000,
  };
  writeAuthSession(session);
  return session;
}

export function signInWithEmail(email, password) {
  return callIdentityToolkit('signInWithPassword', email, password);
}

export function signUpWithEmail(email, password) {
  return callIdentityToolkit('signUp', email, password);
}

export async function signInWithGoogle() {
  await ensureFirebaseConfig();
  const apiKey = getFirebaseApiKey();
  const authDomain = getFirebaseAuthDomain();
  const projectId = getFirebaseProjectId();
  if (!apiKey || !authDomain || !projectId) {
    throw new Error('Google sign-in requires VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, and VITE_FIREBASE_PROJECT_ID.');
  }

  const [{ getApps, initializeApp }, { GoogleAuthProvider, browserLocalPersistence, getAuth, setPersistence, signInWithPopup }] = await Promise.all([
    import('@firebase/app'),
    import('@firebase/auth'),
  ]);

  const app = getApps().length
    ? getApps()[0]
    : initializeApp({ apiKey, authDomain, projectId });
  const auth = getAuth(app);
  lazyFirebaseAuth = auth;
  await setPersistence(auth, browserLocalPersistence);

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  const result = await signInWithPopup(auth, provider);
  const user = result.user;
  const tokenResult = await user.getIdTokenResult(true);
  const expiresAt = tokenResult.expirationTime
    ? Math.max(Date.now() + 60_000, Date.parse(tokenResult.expirationTime) - 60_000)
    : Date.now() + 55 * 60_000;

  const session = {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || '',
    photoURL: user.photoURL || '',
    provider: 'google',
    idToken: tokenResult.token,
    refreshToken: user.refreshToken || '',
    expiresAt,
  };
  writeAuthSession(session);
  return session;
}

export function signOutAuth() {
  writeAuthSession(null);
  if (lazyFirebaseAuth) {
    lazyFirebaseAuth.signOut().catch(() => {});
  }
}

export async function getValidIdToken() {
  const session = readAuthSession();
  if (!session) return '';
  if (session.idToken && session.expiresAt > Date.now()) return session.idToken;

  if (tokenRefreshPromise) return tokenRefreshPromise;

  tokenRefreshPromise = (async () => {
    await ensureFirebaseConfig();
    const apiKey = getFirebaseApiKey();
    if (!apiKey || !session.refreshToken) return session.idToken || '';

    try {
      const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(session.refreshToken)}`,
      });
      if (!res.ok) {
        if (res.status === 400 || res.status === 401) {
          // Refresh token revoked or expired permanently
          writeAuthSession(null);
        }
        return '';
      }
      const data = await res.json();
      const expiresSec = Math.max(300, Number(data.expires_in) || 3600);
      const refreshed = {
        ...session,
        idToken: data.id_token,
        refreshToken: data.refresh_token || session.refreshToken,
        expiresAt: Date.now() + (expiresSec - 60) * 1000,
      };
      writeAuthSession(refreshed);
      return refreshed.idToken;
    } catch {
      return '';
    } finally {
      tokenRefreshPromise = null;
    }
  })();

  return tokenRefreshPromise;
}
