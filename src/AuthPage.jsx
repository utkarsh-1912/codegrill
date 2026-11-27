import React, { useState } from 'react';
import { Button, Card } from '@utkristi/ui';
import { ArrowRight, CheckCircle2, Cloud, Eye, EyeOff, Globe, Lock, Mail, ShieldCheck } from 'lucide-react';
import { BrandLogo } from './BrandLogo.jsx';
import { Mascot } from './Mascot.jsx';
import { isFirebaseConfigured, isGoogleAuthConfigured, signInWithEmail, signInWithGoogle, signUpWithEmail } from './firebaseAuth.mjs';
import { getMessages } from './i18n.mjs';

export function AuthPage({
  mode = 'login',
  locale = 'en',
  brandName = 'codegrill',
  authSession = null,
  onAuthSignIn,
  onNavigate,
}) {
  const t = getMessages(locale);
  const [tab, setTab] = useState(mode === 'signup' ? 'signup' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const firebaseReady = isFirebaseConfigured();
  const googleReady = isGoogleAuthConfigured();

  const mascotMood = busy
    ? 'loading'
    : error
      ? 'lost'
      : passwordFocused
        ? 'shield'
        : tab === 'signup'
          ? 'happy'
          : 'idle';

  const mascotCaption = busy
    ? 'Authenticating & syncing...'
    : error
      ? 'Check your details and retry'
      : passwordFocused
        ? 'Privacy shield active'
        : tab === 'signup'
          ? 'Ready to sync your journey'
          : 'Welcome back to the forge';

  async function handleSubmit(event) {
    event.preventDefault();
    if (!firebaseReady) {
      setError('Firebase Authentication is not configured yet. Add VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, and VITE_FIREBASE_PROJECT_ID in Vercel Environment Variables and redeploy.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const sess = tab === 'signup'
        ? await signUpWithEmail(email, password)
        : await signInWithEmail(email, password);
      await onAuthSignIn?.(sess);
      onNavigate?.('/profile');
    } catch (err) {
      setError(err?.message || (tab === 'signup' ? t.studio.auth.signUpFailed : t.studio.auth.signInFailed));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    if (!googleReady) {
      setError('Google sign-in requires VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, and VITE_FIREBASE_PROJECT_ID in environment variables.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const sess = await signInWithGoogle();
      await onAuthSignIn?.(sess);
      onNavigate?.('/profile');
    } catch (err) {
      const msg = err?.code === 'auth/popup-closed-by-user'
        ? t.studio.auth.googleCancelled
        : (err?.message || t.studio.auth.googleFailed);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  if (authSession) {
    return (
      <section className="page-section auth-page">
        <Card variant="outlined" className="auth-card auth-signed-in-card">
          <div className="auth-mascot-stage auth-mascot-stage-sm" aria-hidden="true">
            <div className="legal-orbit-ring ring-1" />
            <Mascot mood="happy" size={116} label="Signed in Ember companion" />
          </div>
          <h1>{authSession.displayName || authSession.email}</h1>
          <p className="auth-signed-in-sub">
            <span className="sync-dot is-online" aria-hidden="true" /> {t.controls.backendOnline}
          </p>
          <div className="auth-signed-in-actions">
            <Button variant="solid" onClick={() => onNavigate?.('/profile')}>
              {t.nav.profile} <ArrowRight size={15} aria-hidden="true" />
            </Button>
            <Button variant="outlined" onClick={() => onNavigate?.('/roadmap')}>
              {t.nav.roadmap}
            </Button>
          </div>
        </Card>
      </section>
    );
  }

  return (
    <section className="page-section auth-page">
      <div className="auth-shell auth-shell-v2">
        <div className="auth-aside auth-aside-v2">
          <div className="auth-aside-top">
            <a
              href="/"
              className="auth-brand-link"
              onClick={(e) => { e.preventDefault(); onNavigate?.('/'); }}
            >
              <BrandLogo name={brandName} size={30} />
            </a>
            <span className="auth-badge-pill">
              <ShieldCheck size={12} aria-hidden="true" />
              <span>Cloud Sync</span>
            </span>
          </div>

          <div className="auth-mascot-stage" aria-hidden="true">
            <div className="auth-mascot-glow" />
            <div className="legal-orbit-ring ring-1" />
            <div className="legal-orbit-ring ring-2" />
            <Mascot mood={mascotMood} size={142} label="Ember authentication companion" />
            <span className="marketing-hero-caption auth-mascot-caption">{mascotCaption}</span>
          </div>

          <div className="auth-aside-copy">
            <h1 lang={locale}>
              {tab === 'signup' ? t.studio.auth.createAccount : t.studio.auth.signIn}
              <span>.</span>
            </h1>
            <p>{t.studio.backup.backupHint}</p>
          </div>

          <div className="auth-pillar-pills">
            <span><Cloud size={13} aria-hidden="true" /> Neon Sync</span>
            <span><ShieldCheck size={13} aria-hidden="true" /> Conflict-Safe OCC</span>
            <span><Globe size={13} aria-hidden="true" /> 6 Languages</span>
          </div>
        </div>

        <Card variant="outlined" className="auth-card auth-card-v2">
          <div className="auth-card-head">
            <h2>{tab === 'signup' ? t.studio.auth.createAccount : t.studio.auth.signIn}</h2>
            <p>{t.studio.auth.signInToSync}</p>
          </div>

          <div className="auth-mode-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'login'}
              className={`auth-mode-tab ${tab === 'login' ? 'is-active' : ''}`}
              onClick={() => { setTab('login'); setError(''); }}
            >
              {t.studio.auth.signIn}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'signup'}
              className={`auth-mode-tab ${tab === 'signup' ? 'is-active' : ''}`}
              onClick={() => { setTab('signup'); setError(''); }}
            >
              {t.studio.auth.createAccount}
            </button>
          </div>

          <button
            type="button"
            className="auth-google-btn"
            disabled={busy}
            onClick={handleGoogle}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.26-2.08 3.57-5.15 3.57-8.64z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.96H1.29v3.09A12 12 0 0 0 12 24z" />
              <path fill="#FBBC05" d="M5.28 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.28V6.63H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.37l3.99-3.09z" />
              <path fill="#EA4335" d="M12 4.76c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.63l3.99 3.09C6.23 6.87 8.88 4.76 12 4.76z" />
            </svg>
            <span>{t.studio.auth.continueWithGoogle}</span>
          </button>

          <div className="auth-or-divider">
            <span>or</span>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-field">
              <span>{t.studio.auth.emailPlaceholder}</span>
              <div className="auth-input-wrap">
                <Mail size={15} aria-hidden="true" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </label>

            <label className="auth-field">
              <span>{t.studio.auth.passwordPlaceholder}</span>
              <div className="auth-input-wrap">
                <Lock size={15} aria-hidden="true" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
                  placeholder="••••••••"
                  value={password}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                </button>
              </div>
            </label>

            {error && (
              <p className="auth-error-banner" role="alert">
                {error}
              </p>
            )}

            <Button variant="solid" type="submit" disabled={busy} className="auth-submit-btn">
              {busy
                ? '...'
                : (tab === 'signup' ? t.studio.auth.createAccount : t.studio.auth.signIn)}
              <ArrowRight size={15} aria-hidden="true" />
            </Button>
          </form>

          <div className="auth-guest-footer">
            <a
              href="/roadmap"
              onClick={(e) => { e.preventDefault(); onNavigate?.('/roadmap'); }}
            >
              <CheckCircle2 size={13} aria-hidden="true" />
              <span>Continue as guest without an account</span>
            </a>
          </div>
        </Card>
      </div>
    </section>
  );
}
