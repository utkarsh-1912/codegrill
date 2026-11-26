import React, { useEffect, useState } from 'react';
import { Badge, Button } from '@utkristi/ui';
import { Check, Copy, ExternalLink, X } from 'lucide-react';
import { fetchPluginContent } from './api.mjs';
import { getMessages } from './i18n.mjs';
import { LoadingState } from './LoadingState.jsx';

export function ContentViewer({ item, locale, languages, onClose }) {
  const t = getMessages(locale);
  const [activeUrl, setActiveUrl] = useState(item?.url || '');
  const [activeTitle, setActiveTitle] = useState(item?.title || '');
  const [selectedLang, setSelectedLang] = useState(item?.solutionLang || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!item) return;
    setActiveUrl(item.url);
    setActiveTitle(item.title || '');
    setSelectedLang(item.solutionLang || '');
  }, [item]);

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

  useEffect(() => {
    if (!item) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [item, onClose]);

  if (!item) return null;

  const solutionEntries = item.solutions
    ? Object.entries(languages).filter(([id]) => item.solutions[id])
    : [];

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
    <div className="viewer-backdrop" role="dialog" aria-modal="true" aria-label={activeTitle || t.viewer.pluginBadge}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="viewer-panel">
        <div className="viewer-header">
          <div className="viewer-title-group">
            <Badge variant="outlined">{data?.plugin || t.viewer.pluginBadge}</Badge>
            <h2>{activeTitle || data?.title}</h2>
            {data?.author && <p className="viewer-meta">{data.author}</p>}
            {data?.repo && <p className="viewer-meta">{data.repo} · {data.filePath || data.title}</p>}
            {data?.siteName && <p className="viewer-meta">{data.siteName}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t.viewer.close} title={t.viewer.close}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {solutionEntries.length > 0 && item.kind === 'code' && (
          <div className="viewer-lang-tabs" role="tablist" aria-label={t.problems.solutionCode}>
            {solutionEntries.map(([langId, langName]) => (
              <button
                key={langId}
                type="button"
                role="tab"
                aria-selected={selectedLang === langId}
                onClick={() => {
                  setSelectedLang(langId);
                  setActiveUrl(item.solutions[langId]);
                  setActiveTitle(`${item.problemTitle || ''} — ${langName}`);
                }}
              >
                {langName}
              </button>
            ))}
          </div>
        )}

        <div className="viewer-body">
          {loading && <LoadingState locale={locale} message={t.viewer.loading} compact />}

          {!loading && data?.kind === 'video' && (
            <div className="video-frame-wrap">
              <iframe
                src={data.embedUrl}
                title={data.title || activeTitle}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}

          {!loading && (data?.kind === 'code' || data?.kind === 'markdown') && (
            <div className="code-viewer">
              <div className="code-toolbar">
                <span>{data.language}</span>
                <button type="button" className="icon-btn" onClick={copyCode} aria-label={t.viewer.copyCode} title={copied ? t.viewer.copiedCode : t.viewer.copyCode}>
                  {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                </button>
              </div>
              <pre><code>{data.content}</code></pre>
            </div>
          )}

          {!loading && data?.kind === 'article' && (
            <article className="article-reader">
              {data.description && <p className="article-lead">{data.description}</p>}
              {data.blocks?.length > 0 ? data.blocks.map((block, index) => {
                if (block.tag === 'h1' || block.tag === 'h2') return <h3 key={index}>{block.text}</h3>;
                if (block.tag === 'h3') return <h4 key={index}>{block.text}</h4>;
                if (block.tag === 'pre') return <pre key={index}><code>{block.text}</code></pre>;
                return <p key={index}>{block.text}</p>;
              }) : <p className="viewer-fallback-note">{t.viewer.emptyBlocks}</p>}
            </article>
          )}

          {!loading && data?.kind === 'error' && (
            <div className="viewer-error">
              <p>{t.viewer.errorNote}</p>
            </div>
          )}
        </div>

        <div className="viewer-footer">
          <Button variant="quiet" size="sm" href={activeUrl} target="_blank" rel="noopener noreferrer">
            {t.viewer.openOriginal} <ExternalLink size={14} aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
