import React, { useEffect, useState } from 'react';
import { Badge, Button, Card } from '@utkristi/ui';
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Play } from 'lucide-react';
import { fetchPluginContent } from './api.mjs';
import { resourcesFor } from './catalog.mjs';
import { getMessages } from './i18n.mjs';
import { ContentViewerBody, buildViewerPath, formatPluginBadge } from './ContentViewer.jsx';

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
  const [activeUrl, setActiveUrl] = useState(url || '');
  const [activeTitle, setActiveTitle] = useState(title || '');
  const [selectedLang, setSelectedLang] = useState(initialLang || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setActiveUrl(url || '');
    setActiveTitle(title || '');
    setSelectedLang(initialLang || '');
  }, [url, title, initialLang]);

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

  // Connected Prev / Next for Learning Modules
  const modIndex = moduleId ? allModules.findIndex((m) => m.id === moduleId) : -1;
  const prevModule = modIndex > 0 ? allModules[modIndex - 1] : null;
  const nextModule = modIndex >= 0 && modIndex < allModules.length - 1 ? allModules[modIndex + 1] : null;

  function openModuleInViewer(mod) {
    if (!mod) return;
    const links = resourcesFor(mod.resources, locale, defaultLocale);
    const primary = links[0];
    if (!primary) {
      onNavigate('/tracks');
      return;
    }
    const modTitle = mod.titles[locale] ?? mod.titles[defaultLocale];
    onNavigate(buildViewerPath({
      url: primary.url,
      title: modTitle,
      kind: primary.kind === 'video' ? 'video' : 'article',
      moduleId: mod.id,
    }));
  }

  // Connected Prev / Next for Problems in same topic
  const topicSiblings = problem ? allProblems.filter((p) => p.category_id === problem.category_id) : [];
  const probIndex = problem ? topicSiblings.findIndex((p) => p.slug === problem.slug) : -1;
  const prevProblem = probIndex > 0 ? topicSiblings[probIndex - 1] : null;
  const nextProblem = probIndex >= 0 && probIndex < topicSiblings.length - 1 ? topicSiblings[probIndex + 1] : null;

  function openProblemInViewer(p) {
    if (!p) return;
    const pTitle = p.translations[locale]?.title || p.translations[defaultLocale].title;
    if (kind === 'code' && selectedLang && p.solutions?.[selectedLang]) {
      onNavigate(buildViewerPath({
        url: p.solutions[selectedLang],
        title: `${pTitle} — ${languages[selectedLang] || selectedLang}`,
        kind: 'code',
        problemSlug: p.slug,
        solutionLang: selectedLang,
      }));
      return;
    }
    const links = resourcesFor(p.resources, locale, defaultLocale);
    const primary = links.find((l) => l.kind === 'video') || links[0];
    if (primary) {
      onNavigate(buildViewerPath({
        url: primary.url,
        title: pTitle,
        kind: primary.kind === 'video' ? 'video' : 'article',
        problemSlug: p.slug,
      }));
    } else {
      onNavigate(`/problems?${new URLSearchParams({ problem: p.slug })}`);
    }
  }

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
        {modIndex >= 0 && (
          <span className="viewer-seq-badge">
            {String(modIndex + 1).padStart(2, '0')} / {String(allModules.length).padStart(2, '0')}
          </span>
        )}
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

  const stepNavigation = (prevModule || nextModule || prevProblem || nextProblem) && (
    <nav className="viewer-step-nav" aria-label="Module sequence navigation">
      {prevModule ? (
        <Button variant="outlined" size="sm" onClick={() => openModuleInViewer(prevModule)}>
          <ChevronLeft size={15} aria-hidden="true" /> {prevModule.titles[locale] ?? prevModule.titles[defaultLocale]}
        </Button>
      ) : prevProblem ? (
        <Button variant="outlined" size="sm" onClick={() => openProblemInViewer(prevProblem)}>
          <ChevronLeft size={15} aria-hidden="true" /> #{prevProblem.leetcode_id} {prevProblem.translations[locale]?.title || prevProblem.translations[defaultLocale].title}
        </Button>
      ) : <span />}

      {nextModule ? (
        <Button variant="solid" size="sm" onClick={() => openModuleInViewer(nextModule)}>
          {nextModule.titles[locale] ?? nextModule.titles[defaultLocale]} <ChevronRight size={15} aria-hidden="true" />
        </Button>
      ) : nextProblem ? (
        <Button variant="solid" size="sm" onClick={() => openProblemInViewer(nextProblem)}>
          #{nextProblem.leetcode_id} {nextProblem.translations[locale]?.title || nextProblem.translations[defaultLocale].title} <ChevronRight size={15} aria-hidden="true" />
        </Button>
      ) : <span />}
    </nav>
  );

  return (
    <section className="page-section viewer-page">
      <div className="viewer-page-bar">
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
        {activeUrl && (
          <Button variant="outlined" size="sm" href={activeUrl} target="_blank" rel="noopener noreferrer">
            {t.viewer.openOriginal} <ExternalLink size={14} aria-hidden="true" />
          </Button>
        )}
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
                setActiveUrl(nextUrl);
                setActiveTitle(nextTitle);
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
                      setActiveUrl(problem.solutions[langId]);
                      setActiveTitle(`${problemTitle} — ${langName}`);
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
                  setActiveUrl(nextUrl);
                  setActiveTitle(nextTitle);
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
