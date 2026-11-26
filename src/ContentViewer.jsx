import React, { useEffect, useState } from 'react';
import { Badge, Button } from '@utkristi/ui';
import { Check, Copy, ExternalLink, FileCode2, Folder, Maximize2, Play, X } from 'lucide-react';
import { fetchPluginContent } from './api.mjs';
import { getMessages } from './i18n.mjs';
import { LoadingState } from './LoadingState.jsx';
import { RichTextInterpreter } from './RichTextInterpreter.jsx';
import { CustomVideoPlayer } from './CustomVideoPlayer.jsx';

export function formatViewerTitle(problemTitle, resourceTitle) {
  const cleanProb = String(problemTitle || '').trim();
  const cleanRes = String(resourceTitle || '').trim();
  if (!cleanProb) return cleanRes;
  if (!cleanRes) return cleanProb;
  if (cleanRes.toLowerCase().includes(cleanProb.toLowerCase())) return cleanRes;
  return `${cleanProb} — ${cleanRes}`;
}

export function formatPluginBadge(data, fallback) {
  if (!data?.plugin) return fallback;
  if (data.plugin.startsWith('youtube')) return 'YouTube';
  if (data.plugin.startsWith('github')) return 'GitHub';
  if (data.plugin === 'web-article') return data.siteName || 'Article';
  return fallback;
}

export function buildViewerPath(item) {
  const params = new URLSearchParams();
  if (item?.url) params.set('url', item.url);
  if (item?.title) params.set('title', item.title);
  if (item?.kind) params.set('kind', item.kind);
  if (item?.problemSlug) params.set('problem', item.problemSlug);
  if (item?.solutionLang) params.set('lang', item.solutionLang);
  return `/viewer?${params.toString()}`;
}

export function ContentViewerBody({
  activeUrl,
  activeTitle,
  locale,
  data,
  loading,
  copied,
  customPlayerTemplate,
  onCopyCode,
  onSelectSubUrl,
}) {
  const t = getMessages(locale);
  const [selectedVideoId, setSelectedVideoId] = useState('');

  useEffect(() => {
    setSelectedVideoId('');
  }, [activeUrl]);

  const activeChannelEmbed = selectedVideoId
    ? `https://www.youtube-nocookie.com/embed/${selectedVideoId}?rel=0&modestbranding=1&cc_lang_pref=${encodeURIComponent(locale)}&hl=${encodeURIComponent(locale)}`
    : data?.embedUrl;

  if (loading) {
    return <LoadingState locale={locale} message={t.viewer.loading} compact />;
  }

  if (data?.kind === 'video') {
    return (
      <CustomVideoPlayer
        embedUrl={data.embedUrl}
        sourceUrl={data.sourceUrl || activeUrl}
        title={data.title || activeTitle}
        customPlayerTemplate={customPlayerTemplate}
      />
    );
  }

  if (data?.kind === 'channel') {
    return (
      <div className="channel-viewer">
        <CustomVideoPlayer
          embedUrl={activeChannelEmbed}
          sourceUrl={selectedVideoId ? `https://www.youtube.com/watch?v=${selectedVideoId}` : activeUrl}
          title={data.title || activeTitle}
          customPlayerTemplate={customPlayerTemplate}
        />
        {data.videos?.length > 0 && (
          <div className="channel-video-grid">
            {data.videos.map((vid) => (
              <button
                key={vid.videoId}
                type="button"
                className={`channel-video-card ${selectedVideoId === vid.videoId ? 'is-selected' : ''}`}
                onClick={() => setSelectedVideoId(vid.videoId)}
              >
                <div className="channel-thumb-wrap">
                  <img src={vid.thumbnailUrl} alt="" loading="lazy" />
                  <span className="channel-play-pill"><Play size={13} aria-hidden="true" /></span>
                </div>
                <div className="channel-video-info">
                  <strong>{vid.title}</strong>
                  {vid.published && <small>{vid.published}</small>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (data?.kind === 'directory') {
    return (
      <div className="github-dir-list">
        {data.entries?.map((entry) => (
          <button
            key={entry.path}
            type="button"
            className="github-dir-item"
            onClick={() => onSelectSubUrl?.(entry.url, `${data.repo} — ${entry.name}`)}
          >
            {entry.type === 'dir' ? <Folder size={16} aria-hidden="true" /> : <FileCode2 size={16} aria-hidden="true" />}
            <span>{entry.name}</span>
          </button>
        ))}
      </div>
    );
  }

  if (data?.kind === 'markdown' || data?.kind === 'text') {
    return (
      <RichTextInterpreter
        content={data.content}
        format={data.kind}
        sourceUrl={data.sourceUrl || activeUrl}
        onOpenLink={(nextUrl, nextTitle) => onSelectSubUrl?.(nextUrl, nextTitle)}
      />
    );
  }

  if (data?.kind === 'code') {
    return (
      <div className="code-viewer">
        <div className="code-toolbar">
          <span>{data.language}</span>
          <button type="button" className="icon-btn" onClick={onCopyCode} aria-label={t.viewer.copyCode} title={copied ? t.viewer.copiedCode : t.viewer.copyCode}>
            {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          </button>
        </div>
        <pre><code>{data.content}</code></pre>
      </div>
    );
  }

  if (data?.kind === 'article') {
    return (
      <article className="article-reader">
        {data.description && <p className="article-lead">{data.description}</p>}
        {data.blocks?.length > 0 ? data.blocks.map((block, index) => {
          if (block.tag === 'h1' || block.tag === 'h2') return <h3 key={index}>{block.text}</h3>;
          if (block.tag === 'h3') return <h4 key={index}>{block.text}</h4>;
          if (block.tag === 'pre') return <pre key={index}><code>{block.text}</code></pre>;
          return <p key={index}>{block.text}</p>;
        }) : <p className="viewer-fallback-note">{t.viewer.emptyBlocks}</p>}
      </article>
    );
  }

  return (
    <div className="viewer-error">
      <p>{t.viewer.errorNote}</p>
    </div>
  );
}

export function ContentViewer({ item, locale, languages, customPlayerTemplate, onClose, onExpand }) {
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
            <Badge variant="outlined">{formatPluginBadge(data, t.viewer.pluginBadge)}</Badge>
            <h2>{activeTitle || data?.title}</h2>
            {data?.author && data.author.toLowerCase() !== formatPluginBadge(data, '').toLowerCase() && (
              <p className="viewer-meta">{data.author}</p>
            )}
            {data?.repo && <p className="viewer-meta">{data.repo} · {data.filePath || data.title}</p>}
            {data?.siteName && data.siteName !== formatPluginBadge(data, '') && (
              <p className="viewer-meta">{data.siteName}</p>
            )}
          </div>
          <div className="viewer-header-actions">
            {onExpand && (
              <button
                type="button"
                className="icon-btn"
                onClick={() => onExpand({
                  ...item,
                  url: activeUrl,
                  title: activeTitle || data?.title || '',
                  solutionLang: selectedLang,
                })}
                aria-label="Expand to full page"
                title="Expand to full page"
              >
                <Maximize2 size={18} aria-hidden="true" />
              </button>
            )}
            <button type="button" className="icon-btn" onClick={onClose} aria-label={t.viewer.close} title={t.viewer.close}>
              <X size={20} aria-hidden="true" />
            </button>
          </div>
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
          <ContentViewerBody
            activeUrl={activeUrl}
            activeTitle={activeTitle}
            locale={locale}
            data={data}
            loading={loading}
            copied={copied}
            customPlayerTemplate={customPlayerTemplate}
            onCopyCode={copyCode}
            onSelectSubUrl={(nextUrl, nextTitle) => {
              setActiveUrl(nextUrl);
              setActiveTitle(nextTitle);
            }}
          />
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
