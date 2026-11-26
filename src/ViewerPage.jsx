import React, { useEffect, useState } from 'react';
import { Badge, Button, Card } from '@utkristi/ui';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { fetchPluginContent } from './api.mjs';
import { getMessages } from './i18n.mjs';
import { ContentViewerBody, formatPluginBadge } from './ContentViewer.jsx';

export function ViewerPage({
  url,
  title,
  kind,
  problem,
  initialLang,
  languages,
  locale,
  defaultLocale,
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

  return (
    <section className="page-section viewer-page">
      <div className="viewer-page-bar">
        <Button
          variant="quiet"
          size="sm"
          onClick={() => {
            if (window.history.length > 1) window.history.back();
            else onNavigate('/resources');
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

      <Card variant="outlined" className="viewer-page-card">
        <div className="viewer-page-head">
          <Badge variant="outlined">{formatPluginBadge(data, t.viewer.pluginBadge)}</Badge>
          <h1>{activeTitle || data?.title || t.viewer.pluginBadge}</h1>
          {data?.author && data.author.toLowerCase() !== formatPluginBadge(data, '').toLowerCase() && (
            <p className="viewer-meta">{data.author}</p>
          )}
          {data?.repo && <p className="viewer-meta">{data.repo} · {data.filePath || data.title}</p>}
          {data?.siteName && data.siteName !== formatPluginBadge(data, '') && (
            <p className="viewer-meta">{data.siteName}</p>
          )}
        </div>

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
            onCopyCode={copyCode}
            onSelectSubUrl={(nextUrl, nextTitle) => {
              setActiveUrl(nextUrl);
              setActiveTitle(nextTitle);
            }}
          />
        </div>
      </Card>
    </section>
  );
}
