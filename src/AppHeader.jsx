import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Calendar, ChevronRight, Maximize2, Menu, Minimize2, Moon, RotateCcw, Search, Sun, User, X } from 'lucide-react';
import { BrandLogo } from './BrandLogo.jsx';
import { SelectDropdown } from './SelectDropdown.jsx';
import { getMessages } from './i18n.mjs';

export function AppHeader({
  brandName,
  page,
  pathIds,
  navLabels,
  locale,
  locales,
  isDark,
  zenMode,
  backendOnline,
  authSession = null,
  onLocaleChange,
  onToggleTheme,
  onToggleZen,
  onResetProgress,
  onOpenPalette,
  onNavigate,
}) {
  const t = getMessages(locale);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState('');

  async function handleConfirmReset(closePanel) {
    setResetBusy(true);
    setResetError('');
    try {
      await onResetProgress?.();
      setConfirmReset(false);
      closePanel();
    } catch (err) {
      setResetError(err?.message || t.studio.auth.resetFailed);
    } finally {
      setResetBusy(false);
    }
  }

  const settingsRef = useRef(null);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    setAvatarFailed(false);
  }, [authSession?.photoURL]);

  const avatarUrl = !avatarFailed && authSession?.photoURL ? authSession.photoURL : '';
  const userInitial = authSession
    ? (authSession.displayName || authSession.email || 'U').slice(0, 1).toUpperCase()
    : '';

  useEffect(() => {
    setSidebarOpen(false);
    setSettingsOpen(false);
  }, [page]);

  // Lock body scroll while mobile sidebar drawer is open
  useEffect(() => {
    if (!sidebarOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [sidebarOpen]);

  // Close popovers on Escape or outside click
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSidebarOpen(false);
        setSettingsOpen(false);
      }
    };
    const onMouseDown = (e) => {
      if (e.target?.closest?.('[data-select-menu="true"]')) return;
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, []);

  function linkClick(path) {
    return (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      onNavigate(path);
      setSidebarOpen(false);
      setSettingsOpen(false);
    };
  }

  return (
    <>
      <header className="app-header">
        <div className="header-inner">
          <div className="header-left">
            <a className="brand" href="/" aria-label={brandName} onClick={linkClick('/')}>
              <BrandLogo name={brandName} size={32} />
            </a>
          </div>

          <nav className="desktop-nav" aria-label="Study navigation">
            {pathIds.map((id, index) => (
              <a
                key={id}
                href={'/' + id}
                lang={locale}
                aria-current={page === id ? 'page' : undefined}
                onClick={linkClick('/' + id)}
              >
                {navLabels[index]}
              </a>
            ))}
          </nav>

          <div className="header-right">
            <div className="header-utility-group">
              <button
                type="button"
                className="locale-field icon-only-control"
                onClick={() => {
                  setSettingsOpen(false);
                  setSidebarOpen(false);
                  onOpenPalette?.();
                }}
                aria-label={t.palette.placeholder}
                title={`${t.palette.placeholder} (⌘K)`}
              >
                <Search size={18} aria-hidden="true" />
              </button>

              <div className="settings-anchor" ref={settingsRef}>
                <button
                  type="button"
                  className={`locale-field icon-only-control header-user-btn ${settingsOpen ? 'is-active' : ''} ${authSession ? 'is-signed-in' : ''} ${avatarUrl ? 'has-avatar' : ''}`}
                  onClick={() => setSettingsOpen((v) => !v)}
                  aria-expanded={settingsOpen}
                  aria-haspopup="true"
                  aria-label={authSession?.displayName || authSession?.email || t.nav.profile}
                  title={authSession?.displayName || authSession?.email || t.nav.profile}
                >
                  {avatarUrl ? (
                    <img
                      className="header-user-avatar-img"
                      src={avatarUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarFailed(true)}
                    />
                  ) : authSession ? (
                    <span className="header-user-initial" aria-hidden="true">
                      {userInitial}
                    </span>
                  ) : (
                    <User size={18} aria-hidden="true" />
                  )}
                </button>

                {settingsOpen && (
                  <div className="settings-popover settings-menu-v2" role="dialog" aria-label={t.nav.profile}>
                    <a
                      href="/profile"
                      className={`settings-profile-card ${page === 'profile' ? 'is-active' : ''}`}
                      aria-current={page === 'profile' ? 'page' : undefined}
                      onClick={linkClick('/profile')}
                    >
                      <span className="settings-profile-avatar" aria-hidden="true">
                        {avatarUrl ? (
                          <img
                            className="header-user-avatar-img"
                            src={avatarUrl}
                            alt=""
                            referrerPolicy="no-referrer"
                            onError={() => setAvatarFailed(true)}
                          />
                        ) : authSession ? (
                          <span className="header-user-initial">{userInitial}</span>
                        ) : (
                          <User size={16} />
                        )}
                      </span>
                      <span className="settings-profile-copy">
                        <strong>{authSession?.displayName || authSession?.email || t.nav.profile}</strong>
                        <small className="settings-sync-inline">
                          <span className={`sync-dot ${authSession || backendOnline ? 'is-online' : ''}`} />
                          {authSession
                            ? t.controls.backendOnline
                            : backendOnline
                              ? t.controls.backendOnline
                              : t.controls.backendLocal}
                        </small>
                      </span>
                      <ChevronRight size={15} className="settings-profile-chevron" aria-hidden="true" />
                    </a>

                    {!authSession && (
                      <a
                        href="/login"
                        className="settings-get-started-cta"
                        onClick={linkClick('/login')}
                      >
                        <span>{t.studio.auth.signIn}</span>
                        <ArrowRight size={14} aria-hidden="true" />
                      </a>
                    )}

                    <a
                      href="/contests"
                      className={`settings-nav-shortcut ${page === 'contests' ? 'is-active' : ''}`}
                      aria-current={page === 'contests' ? 'page' : undefined}
                      onClick={linkClick('/contests')}
                    >
                      <Calendar size={15} aria-hidden="true" />
                      <span>{t.studio.backup.contests}</span>
                      <ChevronRight size={14} className="settings-profile-chevron" aria-hidden="true" />
                    </a>

                    <div className="settings-divider" />

                    <div className="settings-quick-grid">
                      <button
                        type="button"
                        className={`settings-quick-tile ${isDark ? 'is-active' : ''}`}
                        onClick={onToggleTheme}
                        aria-label={isDark ? t.controls.switchToLight : t.controls.switchToDark}
                        title={isDark ? t.controls.switchToLight : t.controls.switchToDark}
                      >
                        <span className="settings-tile-icon" aria-hidden="true">
                          {isDark ? <Sun size={16} /> : <Moon size={16} />}
                        </span>
                        <span className="settings-tile-label">
                          {isDark ? t.controls.switchToLight : t.controls.switchToDark}
                        </span>
                      </button>

                      <button
                        type="button"
                        className={`settings-quick-tile ${zenMode ? 'is-active' : ''}`}
                        aria-pressed={zenMode}
                        onClick={() => { onToggleZen(); setSettingsOpen(false); }}
                        aria-label={zenMode ? t.controls.zenExit : t.controls.zenEnter}
                      >
                        <span className="settings-tile-icon" aria-hidden="true">
                          {zenMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </span>
                        <span className="settings-tile-label">{t.palette.zen}</span>
                      </button>
                    </div>

                    <div className="settings-lang-row">
                      <span>{t.controls.language}</span>
                      <SelectDropdown
                        compact
                        align="right"
                        ariaLabel={t.controls.language}
                        prefix={locale}
                        value={locale}
                        onChange={onLocaleChange}
                        options={locales.map(({ code, native_name }) => ({
                          value: code,
                          label: native_name,
                          badge: code,
                          lang: code,
                        }))}
                      />
                    </div>

                    <div className="settings-divider" />

                    {!confirmReset ? (
                      <button
                        type="button"
                        className="settings-danger-item"
                        onClick={() => { setResetError(''); setConfirmReset(true); }}
                      >
                        <RotateCcw size={15} aria-hidden="true" />
                        <span>{t.ui.resetProgress}</span>
                      </button>
                    ) : (
                      <>
                        <div className="reset-confirm-row">
                          <button
                            type="button"
                            className="reset-confirm-yes"
                            disabled={resetBusy}
                            onClick={() => handleConfirmReset(() => setSettingsOpen(false))}
                          >
                            {resetBusy ? '...' : t.ui.confirmReset}
                          </button>
                          <button
                            type="button"
                            className="reset-confirm-no"
                            disabled={resetBusy}
                            onClick={() => { setResetError(''); setConfirmReset(false); }}
                          >
                            {t.sheets.cancel}
                          </button>
                        </div>
                        {resetError && (
                          <p role="alert" style={{ margin: '6px 0 0', fontSize: 12, color: '#ef4444' }}>
                            {resetError}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                className="locale-field icon-only-control mobile-menu-btn"
                onClick={() => setSidebarOpen(true)}
                aria-label={t.palette.menu}
                aria-expanded={sidebarOpen}
                aria-controls="mobile-sidebar"
              >
                <Menu size={19} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {sidebarOpen && createPortal(
        <div
          className="mobile-sidebar-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={t.palette.menu}
          onClick={(e) => { if (e.target === e.currentTarget) setSidebarOpen(false); }}
        >
          <aside id="mobile-sidebar" className="mobile-sidebar">
            <div className="mobile-sidebar-head">
              <a className="brand" href="/" onClick={linkClick('/')}>
                <BrandLogo name={brandName} size={28} />
              </a>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setSidebarOpen(false)}
                aria-label={t.viewer.close}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <div className="mobile-sidebar-scroll">
              <a
                href="/profile"
                className={`settings-profile-card mobile-profile-card ${page === 'profile' ? 'is-active' : ''}`}
                aria-current={page === 'profile' ? 'page' : undefined}
                onClick={linkClick('/profile')}
              >
                <span className="settings-profile-avatar" aria-hidden="true">
                  {avatarUrl ? (
                    <img
                      className="header-user-avatar-img"
                      src={avatarUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarFailed(true)}
                    />
                  ) : authSession ? (
                    <span className="header-user-initial">{userInitial}</span>
                  ) : (
                    <User size={16} />
                  )}
                </span>
                <span className="settings-profile-copy">
                  <strong>{authSession?.displayName || authSession?.email || t.nav.profile}</strong>
                  <small className="settings-sync-inline">
                    <span className={`sync-dot ${authSession || backendOnline ? 'is-online' : ''}`} />
                    {authSession || backendOnline ? t.controls.backendOnline : t.controls.backendLocal}
                  </small>
                </span>
                <ChevronRight size={15} className="settings-profile-chevron" aria-hidden="true" />
              </a>

              {!authSession && (
                <a
                  href="/login"
                  className="settings-get-started-cta mobile-get-started-cta"
                  onClick={linkClick('/login')}
                >
                  <span>{t.studio.auth.signIn}</span>
                  <ArrowRight size={14} aria-hidden="true" />
                </a>
              )}

              <nav className="mobile-sidebar-nav" aria-label="Study navigation">
                {pathIds.map((id, index) => (
                  <a
                    key={id}
                    href={'/' + id}
                    lang={locale}
                    aria-current={page === id ? 'page' : undefined}
                    onClick={linkClick('/' + id)}
                  >
                    {navLabels[index]}
                  </a>
                ))}
                <a
                  href="/contests"
                  lang={locale}
                  aria-current={page === 'contests' ? 'page' : undefined}
                  onClick={linkClick('/contests')}
                >
                  {t.studio.backup.contests}
                </a>
              </nav>

              <div className="mobile-sidebar-section">
                <span className="mobile-sidebar-section-label">{t.palette.settings}</span>

                <div className="settings-row">
                  <span>{t.nav.profile}</span>
                  <a
                    href="/profile"
                    className={`locale-field icon-only-control ${page === 'profile' ? 'is-active' : ''}`}
                    aria-current={page === 'profile' ? 'page' : undefined}
                    aria-label={t.nav.profile}
                    onClick={linkClick('/profile')}
                  >
                    <User size={17} aria-hidden="true" />
                  </a>
                </div>

                <div className="settings-row">
                  <button
                    type="button"
                    className="locale-field icon-only-control"
                    onClick={onToggleTheme}
                    aria-label={isDark ? t.controls.switchToLight : t.controls.switchToDark}
                    title={isDark ? t.controls.switchToLight : t.controls.switchToDark}
                  >
                    {isDark ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
                  </button>
                </div>

                <div className="settings-row">
                  <span>{t.palette.zen}</span>
                  <button
                    type="button"
                    className={`locale-field icon-only-control ${zenMode ? 'is-active' : ''}`}
                    onClick={() => { onToggleZen(); setSidebarOpen(false); }}
                    aria-pressed={zenMode}
                    aria-label={zenMode ? t.controls.zenExit : t.controls.zenEnter}
                  >
                    {zenMode ? <Minimize2 size={17} aria-hidden="true" /> : <Maximize2 size={17} aria-hidden="true" />}
                  </button>
                </div>

                <div className="mobile-lang-block">
                  <span>{t.controls.language}</span>
                  <div className="mobile-lang-grid" role="group" aria-label={t.controls.language}>
                    {locales.map(({ code, native_name }) => (
                      <button
                        key={code}
                        type="button"
                        className={`mobile-lang-pill ${locale === code ? 'is-active' : ''}`}
                        aria-pressed={locale === code}
                        onClick={() => onLocaleChange(code)}
                        lang={code}
                        title={native_name}
                      >
                        <span className="mobile-lang-code">{code}</span>
                        <span className="mobile-lang-name">{native_name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="settings-divider" />

                <div className="settings-row">
                  {!confirmReset ? (
                    <>
                      <span>{t.ui.resetProgress}</span>
                      <button
                        type="button"
                        className="locale-field icon-only-control reset-trigger-btn"
                        onClick={() => { setResetError(''); setConfirmReset(true); }}
                        aria-label={t.ui.resetProgress}
                      >
                        <RotateCcw size={16} aria-hidden="true" />
                      </button>
                    </>
                  ) : (
                    <div>
                      <div className="reset-confirm-row">
                        <button
                          type="button"
                          className="reset-confirm-yes"
                          disabled={resetBusy}
                          onClick={() => handleConfirmReset(() => setSidebarOpen(false))}
                        >
                          {resetBusy ? '...' : t.ui.confirmReset}
                        </button>
                        <button
                          type="button"
                          className="reset-confirm-no"
                          disabled={resetBusy}
                          onClick={() => { setResetError(''); setConfirmReset(false); }}
                        >
                          {t.sheets.cancel}
                        </button>
                      </div>
                      {resetError && (
                        <p role="alert" style={{ margin: '6px 0 0', fontSize: 12, color: '#ef4444' }}>
                          {resetError}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>,
        document.body,
      )}
    </>
  );
}
