import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Menu, Minimize2, Moon, RotateCcw, Search, Settings, Sun, User, X } from 'lucide-react';
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

  const settingsRef = useRef(null);

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
                  className={`locale-field icon-only-control ${settingsOpen ? 'is-active' : ''}`}
                  onClick={() => setSettingsOpen((v) => !v)}
                  aria-expanded={settingsOpen}
                  aria-haspopup="true"
                  aria-label={t.palette.settings}
                  title={t.palette.settings}
                >
                  <Settings size={18} aria-hidden="true" />
                </button>

                {settingsOpen && (
                  <div className="settings-popover" role="dialog" aria-label={t.palette.settings}>
                    <div className="settings-popover-header settings-popover-status-only">
                      <span className="settings-sync-pill">
                        <span className={`sync-dot ${backendOnline ? 'is-online' : ''}`} />
                        {backendOnline ? t.controls.backendOnline : t.controls.backendLocal}
                      </span>
                    </div>

                    <div className="settings-row">
                      <span>{t.palette.theme}</span>
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
                        onClick={() => { onToggleZen(); setSettingsOpen(false); }}
                        aria-pressed={zenMode}
                        aria-label={zenMode ? t.controls.zenExit : t.controls.zenEnter}
                        title={zenMode ? t.controls.zenExit : t.controls.zenEnter}
                      >
                        {zenMode ? <Minimize2 size={17} aria-hidden="true" /> : <Maximize2 size={17} aria-hidden="true" />}
                      </button>
                    </div>

                    <div className="settings-row">
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

                    <div className="settings-row">
                      <span>{t.nav.profile}</span>
                      <a
                        href="/profile"
                        className={`locale-field icon-only-control ${page === 'profile' ? 'is-active' : ''}`}
                        aria-current={page === 'profile' ? 'page' : undefined}
                        aria-label={t.nav.profile}
                        title={t.nav.profile}
                        onClick={linkClick('/profile')}
                      >
                        <User size={17} aria-hidden="true" />
                      </a>
                    </div>

                    <div className="settings-row">
                      {!confirmReset ? (
                        <>
                          <span>{t.ui.resetProgress}</span>
                          <button
                            type="button"
                            className="locale-field icon-only-control reset-trigger-btn"
                            onClick={() => setConfirmReset(true)}
                            aria-label={t.ui.resetProgress}
                            title={t.ui.resetProgress}
                          >
                            <RotateCcw size={16} aria-hidden="true" />
                          </button>
                        </>
                      ) : (
                        <div className="reset-confirm-row">
                          <button
                            type="button"
                            className="reset-confirm-yes"
                            onClick={() => {
                              onResetProgress?.();
                              setConfirmReset(false);
                              setSettingsOpen(false);
                            }}
                          >
                            {t.ui.confirmReset}
                          </button>
                          <button
                            type="button"
                            className="reset-confirm-no"
                            onClick={() => setConfirmReset(false)}
                          >
                            {t.sheets.cancel}
                          </button>
                        </div>
                      )}
                    </div>
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
                  <span>{t.palette.theme}</span>
                  <button
                    type="button"
                    className="locale-field icon-only-control"
                    onClick={onToggleTheme}
                    aria-label={isDark ? t.controls.switchToLight : t.controls.switchToDark}
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
                        onClick={() => setConfirmReset(true)}
                        aria-label={t.ui.resetProgress}
                      >
                        <RotateCcw size={16} aria-hidden="true" />
                      </button>
                    </>
                  ) : (
                    <div className="reset-confirm-row">
                      <button
                        type="button"
                        className="reset-confirm-yes"
                        onClick={() => {
                          onResetProgress?.();
                          setConfirmReset(false);
                          setSidebarOpen(false);
                        }}
                      >
                        {t.ui.confirmReset}
                      </button>
                      <button
                        type="button"
                        className="reset-confirm-no"
                        onClick={() => setConfirmReset(false)}
                      >
                        {t.sheets.cancel}
                      </button>
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
