import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Badge } from '@utkristi/ui';
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
  defaultLocale,
  locales,
  isDark,
  zenMode,
  backendOnline,
  problems,
  categories,
  sheets,
  onLocaleChange,
  onToggleTheme,
  onToggleZen,
  onResetProgress,
  onOpenPalette,
  onSelectSearchItem,
  onNavigate,
}) {
  const t = getMessages(locale);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [navQuery, setNavQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const settingsRef = useRef(null);
  const searchRef = useRef(null);
  const mobileSearchInputRef = useRef(null);

  // Close sidebar on navigation
  useEffect(() => {
    setSidebarOpen(false);
    setMobileSearchOpen(false);
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

  useEffect(() => {
    if (mobileSearchOpen) {
      requestAnimationFrame(() => mobileSearchInputRef.current?.focus());
    }
  }, [mobileSearchOpen]);

  // Close popovers on Escape or outside click
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSidebarOpen(false);
        setSettingsOpen(false);
        setSearchFocused(false);
        setMobileSearchOpen(false);
      }
    };
    const onMouseDown = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setSettingsOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchFocused(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, []);

  const searchResults = useMemo(() => {
    const needle = navQuery.trim().toLowerCase();
    if (!needle) return [];

    const matchedProblems = problems
      .filter((p) => (
        String(p.display_id || p.leetcode_id).toLowerCase().includes(needle) ||
        String(p.platform || 'leetcode').toLowerCase().includes(needle) ||
        p.slug.includes(needle) ||
        Object.values(p.translations).some((tr) => tr.title.toLowerCase().includes(needle))
      ))
      .slice(0, 6)
      .map((p) => ({
        kind: 'problem',
        id: p.slug,
        label: `${p.display_id || `#${p.leetcode_id}`} ${p.translations[locale]?.title || p.translations[defaultLocale].title}`,
        meta: p.difficulty,
      }));

    const matchedTopics = categories
      .filter((c) => Object.values(c.labels || {}).some((l) => l.toLowerCase().includes(needle)))
      .slice(0, 3)
      .map((c) => ({
        kind: 'topic',
        id: c.id,
        label: c.labels[locale] ?? c.labels[defaultLocale],
        meta: t.nav.roadmap,
      }));

    const matchedSheets = sheets
      .filter((s) => Object.values(s.names || {}).some((n) => n.toLowerCase().includes(needle)))
      .slice(0, 3)
      .map((s) => ({
        kind: 'sheet',
        id: s.id,
        label: s.names[locale] ?? s.names[defaultLocale],
        meta: s.source,
      }));

    return [...matchedProblems, ...matchedTopics, ...matchedSheets];
  }, [navQuery, problems, categories, sheets, locale, defaultLocale, t]);

  function handleSearchSelect(item) {
    onSelectSearchItem(item);
    setNavQuery('');
    setSearchFocused(false);
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    if (searchResults.length > 0) {
      handleSearchSelect(searchResults[0]);
    } else if (navQuery.trim()) {
      onNavigate('/problems');
      setSearchFocused(false);
    }
  }

  function linkClick(path) {
    return (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      onNavigate(path);
      setSidebarOpen(false);
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
            <button
              type="button"
              className={`locale-field icon-only-control mobile-search-btn ${mobileSearchOpen ? 'is-active' : ''}`}
              onClick={() => {
                setMobileSearchOpen((v) => !v);
                setSettingsOpen(false);
              }}
              aria-expanded={mobileSearchOpen}
              aria-label={t.palette.placeholder}
              title={t.palette.placeholder}
            >
              <Search size={18} aria-hidden="true" />
            </button>

            <div className="navbar-search-wrap desktop-search" ref={searchRef}>
              <form className="navbar-search" onSubmit={handleSearchSubmit} role="search">
                <Search size={16} aria-hidden="true" />
                <input
                  type="search"
                  value={navQuery}
                  placeholder={t.palette.placeholder}
                  aria-label={t.palette.placeholder}
                  onFocus={() => setSearchFocused(true)}
                  onChange={(e) => { setNavQuery(e.target.value); setSearchFocused(true); }}
                />
                {navQuery ? (
                  <button
                    type="button"
                    className="navbar-search-clear"
                    onClick={() => setNavQuery('')}
                    aria-label={t.problems.clearFilters}
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                ) : (
                  <kbd className="navbar-search-kbd" aria-hidden="true">⌘K</kbd>
                )}
              </form>
              {searchFocused && navQuery.trim() && (
                <div className="navbar-search-dropdown" role="listbox">
                  {searchResults.length > 0 ? searchResults.map((item) => (
                    <button
                      key={`${item.kind}:${item.id}`}
                      type="button"
                      role="option"
                      className="navbar-search-option"
                      onClick={() => handleSearchSelect(item)}
                    >
                      <span>{item.label}</span>
                      <Badge variant="outlined">{item.meta}</Badge>
                    </button>
                  )) : (
                    <p className="navbar-search-empty">{t.problems.empty}</p>
                  )}
                </div>
              )}
            </div>

            <div className="header-utility-group">
              <a
                href="/profile"
                className={`locale-field icon-only-control ${page === 'profile' ? 'is-active' : ''}`}
                aria-current={page === 'profile' ? 'page' : undefined}
                aria-label={t.nav.profile}
                title={t.nav.profile}
                onClick={linkClick('/profile')}
              >
                <User size={18} aria-hidden="true" />
              </a>

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
                  <div className="settings-popover-header">
                    <strong>{t.palette.settings}</strong>
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
                    {!confirmReset ? (
                      <>
                        <span>Reset progress</span>
                        <button
                          type="button"
                          className="locale-field icon-only-control reset-trigger-btn"
                          onClick={() => setConfirmReset(true)}
                          aria-label="Reset progress"
                          title="Reset progress"
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
                onClick={() => {
                  setSidebarOpen(true);
                  setMobileSearchOpen(false);
                }}
                aria-label={t.palette.menu}
                aria-expanded={sidebarOpen}
                aria-controls="mobile-sidebar"
              >
                <Menu size={19} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
        {mobileSearchOpen && (
          <div className="mobile-search-bar">
            <form className="navbar-search" onSubmit={handleSearchSubmit} role="search">
              <Search size={16} aria-hidden="true" />
              <input
                ref={mobileSearchInputRef}
                type="search"
                value={navQuery}
                placeholder={t.palette.placeholder}
                aria-label={t.palette.placeholder}
                onChange={(e) => setNavQuery(e.target.value)}
              />
              {navQuery && (
                <button
                  type="button"
                  className="navbar-search-clear"
                  onClick={() => setNavQuery('')}
                  aria-label={t.problems.clearFilters}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </form>
            {navQuery.trim() && (
              <div className="mobile-search-results" role="listbox">
                {searchResults.length > 0 ? searchResults.map((item) => (
                  <button
                    key={`${item.kind}:${item.id}`}
                    type="button"
                    role="option"
                    className="navbar-search-option"
                    onClick={() => {
                      handleSearchSelect(item);
                      setMobileSearchOpen(false);
                    }}
                  >
                    <span>{item.label}</span>
                    <Badge variant="outlined">{item.meta}</Badge>
                  </button>
                )) : (
                  <p className="navbar-search-empty">{t.problems.empty}</p>
                )}
              </div>
            )}
          </div>
        )}
      </header>

      {/* Overhauled Mobile Sidebar Drawer (Portal + Scroll Lock + Inline Language Pills) */}
      {sidebarOpen && createPortal(
        <div
          className="mobile-sidebar-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
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
