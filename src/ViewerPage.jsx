import React, { useEffect, useState } from 'react';
import { Badge, Button, Card } from '@utkristi/ui';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, ExternalLink, Play, Star } from 'lucide-react';
import { fetchPluginContent } from './api.mjs';
import { resourcesFor } from './catalog.mjs';
import { getMessages } from './i18n.mjs';
import { ContentViewerBody, buildViewerPath, formatPluginBadge, formatViewerTitle } from './ContentViewer.jsx';
import { isContentFavorited, toggleFavoriteContent } from './favorites.mjs';

const VIEWER_HISTORY_KEY = 'codegrill:viewer-history:v1';

function readCarriedHistory(targetUrl, fallbackTitle) {
  try {
    const raw = JSON.parse(sessionStorage.getItem(VIEWER_HISTORY_KEY) || 'null');
    if (raw && Array.isArray(raw.history) && raw.history.length > 0) {
      const idx = Math.max(0, Math.min(raw.history.length - 1, Number(raw.historyIndex) || 0));
      if (raw.history[idx]?.url === targetUrl || raw.url === targetUrl) {
        return { history: raw.history, historyIndex: idx };
      }
    }
  } catch {
    // Ignore storage errors
  }
  return { history: [{ url: targetUrl || '', title: fallbackTitle || '' }], historyIndex: 0 };
}

function getParentGitHubUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.hostname !== 'github.com' && u.hostname !== 'www.github.com') return null;
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 5 || (parts[2] !== 'blob' && parts[2] !== 'tree')) return null;
    const [owner, repo, , ref, ...rest] = parts;
    const parentParts = rest.slice(0, -1);
    const parentUrl = parentParts.length > 0
      ? `https://github.com/${owner}/${repo}/tree/${ref}/${parentParts.join('/')}`
      : `https://github.com/${owner}/${repo}/tree/${ref}`;
    const parentLabel = parentParts.length > 0
      ? `${owner}/${repo} — ${parentParts[parentParts.length - 1]}`
      : `${owner}/${repo}`;
    return { url: parentUrl, title: parentLabel };
  } catch {
    return null;
  }
}

export function ViewerPage({
  url,
  title,
  kind,
  problem,
  moduleId,
  allModules = [],
  allProblems = [],
  directories = [],
  initialLang,
  languages,
  locale,
  defaultLocale,
  customPlayerTemplate,
  onNavigate,
}) {
  const t = getMessages(locale);
  const initialCarried = readCarriedHistory(url, title);
  const [history, setHistory] = useState(initialCarried.history);
  const [historyIndex, setHistoryIndex] = useState(initialCarried.historyIndex);
  const [selectedLang, setSelectedLang] = useState(initialLang || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [favorited, setFavorited] = useState(false);

  useEffect(() => {
    const carried = readCarriedHistory(url, title);
    setHistory(carried.history);
    setHistoryIndex(carried.historyIndex);
    setSelectedLang(initialLang || '');
  }, [url, title, initialLang]);

  const currentEntry = history[historyIndex] || { url: url || '', title: title || '' };
  const activeUrl = currentEntry.url;
  const activeTitle = currentEntry.title;
  const parentGitHub = getParentGitHubUrl(activeUrl);
  const canGoBack = historyIndex > 0 || Boolean(parentGitHub);
  const canGoForward = historyIndex < history.length - 1;

  useEffect(() => {
    try {
      sessionStorage.setItem(VIEWER_HISTORY_KEY, JSON.stringify({
        url: activeUrl,
        history,
        historyIndex,
      }));
    } catch {
      // Ignore storage errors
    }
  }, [activeUrl, history, historyIndex]);

  useEffect(() => {
    setFavorited(isContentFavorited({ url: activeUrl, title: activeTitle }));
  }, [activeUrl, activeTitle]);

  function handleToggleFav() {
    const res = toggleFavoriteContent({
      url: activeUrl,
      title: activeTitle || data?.title || activeUrl,
      kind: data?.kind || kind || 'article',
      badge: formatPluginBadge(data, t.viewer.pluginBadge),
      sourceUrl: activeUrl,
    });
    setFavorited(res.favorited);
  }

  function navigateNested(nextUrl, nextTitle) {
    if (!nextUrl || nextUrl === activeUrl) return;
    setHistory((prev) => [...prev.slice(0, historyIndex + 1), { url: nextUrl, title: nextTitle || '' }]);
    setHistoryIndex((idx) => idx + 1);
  }

  function goBackNested() {
    if (historyIndex > 0) {
      setHistoryIndex((idx) => idx - 1);
      return;
    }
    if (parentGitHub && parentGitHub.url !== activeUrl) {
      setHistory((prev) => [parentGitHub, ...prev]);
      setHistoryIndex(0);
    }
  }

  function goForwardNested() {
    if (canGoForward) setHistoryIndex((idx) => idx + 1);
  }

  useEffect(() => {
    if (!activeUrl) return undefined;
    let cancelled = false;
    setLoading(true);
    setCopied(false);
    fetchPluginContent(activeUrl, locale).then((result) => {
      if (!cancelled) {
        setData(result);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [activeUrl, locale]);

  const solutionEntries = problem?.solutions
    ? Object.entries(languages).filter(([id]) => problem.solutions[id])
    : [];

  const problemTitle = problem
    ? (problem.translations[locale]?.title || problem.translations[defaultLocale].title)
    : '';

  // Flattened immediate Prev / Next playlist across Learning Module resources (then adjacent modules)
  const modIndex = moduleId ? allModules.findIndex((m) => m.id === moduleId) : -1;
  const modulePlaylist = [];
  if (moduleId && allModules.length > 0) {
    allModules.forEach((mod, mIdx) => {
      const modTitle = mod.titles[locale] ?? mod.titles[defaultLocale];
      const links = resourcesFor(mod.resources, locale, defaultLocale);
      links.forEach((link, rIdx) => {
        modulePlaylist.push({
          url: link.url,
          title: formatViewerTitle(modTitle, link.title),
          shortLabel: link.title || modTitle,
          kind: link.kind === 'video' ? 'video' : 'article',
          moduleId: mod.id,
          modIndex: mIdx,
          resIndex: rIdx,
          resTotal: links.length,
        });
      });
    });
  }
  const currentModulePlayIdx = moduleId
    ? (() => {
        const exact = modulePlaylist.findIndex((item) => item.moduleId === moduleId && item.url === url);
        if (exact >= 0) return exact;
        return modulePlaylist.findIndex((item) => item.moduleId === moduleId);
      })()
    : -1;
  const currentModuleItem = currentModulePlayIdx >= 0 ? modulePlaylist[currentModulePlayIdx] : null;
  const prevModuleItem = currentModulePlayIdx > 0 ? modulePlaylist[currentModulePlayIdx - 1] : null;
  const nextModuleItem = currentModulePlayIdx >= 0 && currentModulePlayIdx < modulePlaylist.length - 1
    ? modulePlaylist[currentModulePlayIdx + 1]
    : null;

  function openPlaylistItem(item) {
    if (!item) return;
    onNavigate(buildViewerPath({
      url: item.url,
      title: item.title,
      kind: item.kind,
      moduleId: item.moduleId,
      problemSlug: item.problemSlug,
      solutionLang: item.solutionLang,
    }));
  }

  // Flattened immediate Prev / Next playlist across Problem resources (then sibling problems in topic)
  const topicSiblings = problem ? allProblems.filter((p) => p.category_id === problem.category_id) : [];
  const problemPlaylist = [];
  if (problem && kind !== 'code') {
    topicSiblings.forEach((p) => {
      const pTitle = p.translations[locale]?.title || p.translations[defaultLocale].title;
      const links = resourcesFor(p.resources, locale, defaultLocale);
      links.forEach((link) => {
        problemPlaylist.push({
          url: link.url,
          title: formatViewerTitle(pTitle, link.title),
          shortLabel: p.slug === problem.slug ? (link.title || pTitle) : `#${p.leetcode_id} ${pTitle}`,
          kind: link.kind === 'video' ? 'video' : 'article',
          problemSlug: p.slug,
        });
      });
    });
  } else if (problem && kind === 'code') {
    topicSiblings.forEach((p) => {
      if (selectedLang && p.solutions?.[selectedLang]) {
        const pTitle = p.translations[locale]?.title || p.translations[defaultLocale].title;
        problemPlaylist.push({
          url: p.solutions[selectedLang],
          title: `${pTitle} — ${languages[selectedLang] || selectedLang}`,
          shortLabel: `#${p.leetcode_id} ${pTitle}`,
          kind: 'code',
          problemSlug: p.slug,
          solutionLang: selectedLang,
        });
      }
    });
  }
  const currentProbPlayIdx = problem
    ? (() => {
        const exact = problemPlaylist.findIndex((item) => item.problemSlug === problem.slug && item.url === url);
        if (exact >= 0) return exact;
        return problemPlaylist.findIndex((item) => item.problemSlug === problem.slug);
      })()
    : -1;
  const prevProblemItem = currentProbPlayIdx > 0 ? problemPlaylist[currentProbPlayIdx - 1] : null;
  const nextProblemItem = currentProbPlayIdx >= 0 && currentProbPlayIdx < problemPlaylist.length - 1
    ? problemPlaylist[currentProbPlayIdx + 1]
    : null;

  async function copyCode() {
    if (!data?.content) return;
    try {
      await navigator.clipboard.writeText(data.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  const isVideoView = data?.kind === 'video' || data?.kind === 'channel' || (!data && kind === 'video');
  const badgeLabel = formatPluginBadge(data, t.viewer.pluginBadge);

  const titleSection = (
    <div className="viewer-title-section">
      <div className="viewer-title-row">
        <Badge variant="outlined">{badgeLabel}</Badge>
        {currentModuleItem && (
          <span className="viewer-seq-badge">
            {String(currentModuleItem.resIndex + 1).padStart(2, '0')} / {String(currentModuleItem.resTotal).padStart(2, '0')}
            {' · '}M{String(currentModuleItem.modIndex + 1).padStart(2, '0')}
          </span>
        )}
        <button
          type="button"
          className={`icon-btn viewer-fav-mobile ${favorited ? 'is-active' : ''}`}
          onClick={handleToggleFav}
          aria-pressed={favorited}
          aria-label={favorited ? 'Remove from favorites' : 'Mark favorite / read again'}
          title={favorited ? 'Saved to favorites' : 'Mark favorite / read again'}
        >
          <Star size={17} fill={favorited ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      </div>
      <h1>{activeTitle || data?.title || t.viewer.pluginBadge}</h1>
      {data?.author && data.author.toLowerCase() !== badgeLabel.toLowerCase() && (
        <p className="viewer-meta">{data.author}</p>
      )}
      {data?.repo && <p className="viewer-meta">{data.repo} · {data.filePath || data.title}</p>}
      {data?.siteName && data.siteName !== badgeLabel && (
        <p className="viewer-meta">{data.siteName}</p>
      )}
    </div>
  );

  const prevStep = prevModuleItem || prevProblemItem;
  const nextStep = nextModuleItem || nextProblemItem;

  const stepNavigation = (prevStep || nextStep) && (
    <nav className="viewer-step-nav" aria-label="Sequence navigation">
      {prevStep ? (
        <Button variant="outlined" size="sm" onClick={() => openPlaylistItem(prevStep)}>
          <ChevronLeft size={15} aria-hidden="true" /> {prevStep.shortLabel}
        </Button>
      ) : <span />}

      {nextStep ? (
        <Button variant="solid" size="sm" onClick={() => openPlaylistItem(nextStep)}>
          {nextStep.shortLabel} <ChevronRight size={15} aria-hidden="true" />
        </Button>
      ) : <span />}
    </nav>
  );

  return (
    <section className="page-section viewer-page">
      <div className="viewer-page-bar">
        <div className="viewer-page-bar-left">
          <Button
            variant="quiet"
            size="sm"
            onClick={() => {
              if (window.history.length > 1) window.history.back();
              else onNavigate(moduleId ? '/tracks' : '/resources');
            }}
          >
            <ArrowLeft size={16} aria-hidden="true" /> {t.status.goHome}
          </Button>
        </div>
        <div className="viewer-page-bar-left">
          {(history.length > 1 || Boolean(parentGitHub)) && (
            <div className="viewer-history-nav" role="group" aria-label="Nested plugin history">
              <button
                type="button"
                className="icon-btn"
                disabled={!canGoBack}
                onClick={goBackNested}
                aria-label="Back"
                title={historyIndex > 0 ? 'Back' : 'Parent folder'}
              >
                <ArrowLeft size={16} aria-hidden="true" />
              </button>
              <span className="viewer-history-count">{historyIndex + 1}/{history.length}</span>
              <button
                type="button"
                className="icon-btn"
                disabled={!canGoForward}
                onClick={goForwardNested}
                aria-label="Forward"
                title="Forward"
              >
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          )}
          <button
            type="button"
            className={`icon-btn viewer-fav-desktop ${favorited ? 'is-active' : ''}`}
            onClick={handleToggleFav}
            aria-pressed={favorited}
            aria-label={favorited ? 'Remove from favorites' : 'Mark favorite / read again'}
            title={favorited ? 'Saved to favorites' : 'Mark favorite / read again'}
          >
            <Star size={17} fill={favorited ? 'currentColor' : 'none'} aria-hidden="true" />
          </button>
          {activeUrl && (
            <Button variant="outlined" size="sm" href={activeUrl} target="_blank" rel="noopener noreferrer">
              {t.viewer.openOriginal} <ExternalLink size={14} aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      {isVideoView ? (
        <div className="viewer-cinema-layout">
          <div className="viewer-cinema-stage">
            <ContentViewerBody
              activeUrl={activeUrl}
              activeTitle={activeTitle}
              locale={locale}
              data={data}
              loading={loading}
              copied={copied}
              problem={problem}
              defaultShowScript
              customPlayerTemplate={customPlayerTemplate}
              onCopyCode={copyCode}
              onSelectSubUrl={(nextUrl, nextTitle) => {
                navigateNested(nextUrl, nextTitle);
              }}
            />
          </div>
          {titleSection}
          {stepNavigation}
        </div>
      ) : (
        <>
          {titleSection}
          <Card variant="outlined" className="viewer-page-card">
            {solutionEntries.length > 0 && kind === 'code' && (
              <div className="viewer-lang-tabs" role="tablist" aria-label={t.problems.solutionCode}>
                {solutionEntries.map(([langId, langName]) => (
                  <button
                    key={langId}
                    type="button"
                    role="tab"
                    aria-selected={selectedLang === langId}
                    onClick={() => {
                      setSelectedLang(langId);
                      navigateNested(problem.solutions[langId], `${problemTitle} — ${langName}`);
                    }}
                  >
                    {langName}
                  </button>
                ))}
              </div>
            )}

            <div className="viewer-page-body">
              <ContentViewerBody
                activeUrl={activeUrl}
                activeTitle={activeTitle}
                locale={locale}
                data={data}
                loading={loading}
                copied={copied}
                problem={problem}
                customPlayerTemplate={customPlayerTemplate}
                onCopyCode={copyCode}
                onSelectSubUrl={(nextUrl, nextTitle) => {
                  navigateNested(nextUrl, nextTitle);
                }}
              />
            </div>
          </Card>
          {stepNavigation}
        </>
      )}

      {problem ? (
        <section className="related-section viewer-related">
          <h2>{t.related.problemsTitle}</h2>
          <div className="related-grid">
            {allProblems
              .filter((p) => p.category_id === problem.category_id && p.slug !== problem.slug)
              .slice(0, 4)
              .map((item) => {
                const itemLocale = item.translations[locale] ? locale : defaultLocale;
                return (
                  <button
                    key={item.slug}
                    type="button"
                    className="related-card"
                    onClick={() => onNavigate(`/problems?${new URLSearchParams({ problem: item.slug })}`)}
                  >
                    <span className="problem-number">#{item.leetcode_id}</span>
                    <strong lang={itemLocale}>{item.translations[itemLocale].title}</strong>
                    <Badge tone={{ Easy: 'ok', Medium: 'warn', Hard: 'bad' }[item.difficulty]}>
                      {t.sheets[item.difficulty.toLowerCase()] || item.difficulty}
                    </Badge>
                  </button>
                );
              })}
          </div>
        </section>
      ) : (
        directories.length > 0 && (
          <section className="related-section viewer-related">
            <h2>{t.related.contentTitle}</h2>
            <div className="related-grid">
              {directories
                .filter((d) => d.url !== activeUrl && (d.locale === locale || d.locale === defaultLocale))
                .slice(0, 4)
                .map((entry) => (
                  <button
                    key={entry.url}
                    type="button"
                    className="related-card"
                    onClick={() => onNavigate(buildViewerPath({ url: entry.url, title: entry.name, kind: entry.url.includes('youtube') ? 'video' : 'article' }))}
                  >
                    <strong>{entry.name}</strong>
                    {entry.url.includes('youtube') ? <Play size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}
                  </button>
                ))}
            </div>
          </section>
        )
      )}
    </section>
  );
}
