import React, { useEffect, useState } from 'react';
import { Badge, Button } from '@utkristi/ui';
import { ArrowLeft, ArrowRight, Check, Copy, Download, ExternalLink, FileArchive, FileCode2, Folder, Maximize2, Play, Star, X } from 'lucide-react';
import { fetchPluginContent } from './api.mjs';
import { getMessages } from './i18n.mjs';
import { LoadingState } from './LoadingState.jsx';
import { RichTextInterpreter } from './RichTextInterpreter.jsx';
import { CustomVideoPlayer } from './CustomVideoPlayer.jsx';
import { Pagination } from './Pagination.jsx';
import { AnkiDeckViewer, NotebookViewer } from './MediaViewers.jsx';
import { LanguageIcon } from './LanguageIcon.jsx';
import { isContentFavorited, toggleFavoriteContent } from './favorites.mjs';

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
  if (data.plugin === 'codegrill-docs') return 'Codegrill Docs';
  if (data.plugin.startsWith('youtube')) return 'YouTube';
  if (data.plugin.startsWith('github')) return 'GitHub';
  if (data.plugin.startsWith('medium')) return 'Medium';
  if (data.plugin.startsWith('qiita')) return 'Qiita';
  if (data.plugin.startsWith('devto')) return 'DEV Community';
  if (data.plugin === 'web-article') return data.siteName || 'Article';
  return fallback;
}

export function buildViewerPath(item) {
  const params = new URLSearchParams();
  if (item?.url) params.set('url', item.url);
  if (item?.title) params.set('title', item.title);
  if (item?.kind) params.set('kind', item.kind);
  if (item?.problemSlug) params.set('problem', item.problemSlug);
  if (item?.moduleId) params.set('module', item.moduleId);
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
  problem,
  defaultShowScript = false,
  customPlayerTemplate,
  onCopyCode,
  onSelectSubUrl,
}) {
  const t = getMessages(locale);
  const [selectedVideoId, setSelectedVideoId] = useState('');
  const [dirPage, setDirPage] = useState(1);
  const [channelPage, setChannelPage] = useState(1);

  useEffect(() => {
    setSelectedVideoId('');
    setDirPage(1);
    setChannelPage(1);
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
        locale={locale}
        problem={problem}
        defaultShowScript={defaultShowScript}
        customPlayerTemplate={customPlayerTemplate}
      />
    );
  }

  if (data?.kind === 'channel') {
    const channelPageSize = 8;
    const allVideos = data.videos || [];
    const totalChannelPages = Math.max(1, Math.ceil(allVideos.length / channelPageSize));
    const safeChannelPage = Math.min(channelPage, totalChannelPages);
    const visibleVideos = allVideos.slice((safeChannelPage - 1) * channelPageSize, safeChannelPage * channelPageSize);

    return (
      <div className="channel-viewer">
        <CustomVideoPlayer
          embedUrl={activeChannelEmbed}
          sourceUrl={selectedVideoId ? `https://www.youtube.com/watch?v=${selectedVideoId}` : activeUrl}
          title={data.title || activeTitle}
          locale={locale}
          problem={problem}
          defaultShowScript={defaultShowScript}
          customPlayerTemplate={customPlayerTemplate}
        />
        {allVideos.length > 0 && (
          <>
            <div className="channel-video-grid">
              {visibleVideos.map((vid) => (
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
            <Pagination
              page={safeChannelPage}
              pageSize={channelPageSize}
              totalItems={allVideos.length}
              onPageChange={setChannelPage}
              locale={locale}
            />
          </>
        )}
      </div>
    );
  }

  if (data?.kind === 'directory') {
    const dirPageSize = 14;
    const allEntries = data.entries || [];
    const totalDirPages = Math.max(1, Math.ceil(allEntries.length / dirPageSize));
    const safeDirPage = Math.min(dirPage, totalDirPages);
    const visibleEntries = allEntries.slice((safeDirPage - 1) * dirPageSize, safeDirPage * dirPageSize);

    return (
      <div className="github-dir-shell">
        <div className="github-dir-list">
          {visibleEntries.map((entry) => (
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
        <Pagination
          page={safeDirPage}
          pageSize={dirPageSize}
          totalItems={allEntries.length}
          onPageChange={setDirPage}
          locale={locale}
        />
        {data.readme && (
          <div className="github-dir-readme">
            <RichTextInterpreter
              content={data.readme}
              format="markdown"
              sourceUrl={data.readmeSourceUrl || data.sourceUrl || activeUrl}
              onOpenLink={(nextUrl, nextTitle) => onSelectSubUrl?.(nextUrl, nextTitle)}
            />
          </div>
        )}
      </div>
    );
  }

  if (data?.kind === 'notebook' && Array.isArray(data?.cells)) {
    return (
      <NotebookViewer
        cells={data.cells}
        language={data.language || 'python'}
        sourceUrl={data.sourceUrl || activeUrl}
        onOpenLink={(nextUrl, nextTitle) => onSelectSubUrl?.(nextUrl, nextTitle)}
      />
    );
  }

  if (data?.kind === 'apkg') {
    return (
      <AnkiDeckViewer
        title={data.title || activeTitle}
        downloadUrl={data.downloadUrl || activeUrl}
      />
    );
  }

  if (data?.kind === 'binary') {
    const extLabel = (data.extension || 'binary').toUpperCase();
    return (
      <div className="binary-viewer-card">
        <span className="binary-viewer-icon" aria-hidden="true">
          <FileArchive size={26} />
        </span>
        <span className="binary-viewer-badge">.{extLabel}</span>
        <h3>{data.title || activeTitle}</h3>
        <p>{t.studio.viewer.binaryNote}</p>
        <div className="binary-viewer-actions">
          {data.downloadUrl && (
            <Button variant="solid" size="sm" href={data.downloadUrl} target="_blank" rel="noopener noreferrer">
              <Download size={14} aria-hidden="true" /> {t.studio.viewer.download} {data.title || ''}
            </Button>
          )}
          <Button variant="outlined" size="sm" href={data.sourceUrl || activeUrl} target="_blank" rel="noopener noreferrer">
            {t.studio.viewer.viewOnGitHub} <ExternalLink size={14} aria-hidden="true" />
          </Button>
        </div>
      </div>
    );
  }

  if (data?.kind === 'image' && data?.imageUrl) {
    return (
      <figure className="viewer-image-stage">
        <img src={data.imageUrl} alt={data.title || activeTitle || 'Image preview'} loading="lazy" />
        {(data.filePath || data.title) && <figcaption>{data.filePath || data.title}</figcaption>}
      </figure>
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
          <span className="code-toolbar-lang">
            <LanguageIcon lang={data.language} size={15} /> {data.language}
          </span>
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

  const targetHref = data?.sourceUrl || activeUrl;
  let targetHost = '';
  try {
    targetHost = targetHref ? new URL(targetHref).hostname.replace(/^www\./, '') : '';
  } catch {
    targetHost = '';
  }

  return (
    <div className="viewer-error">
      <p>{t.viewer.errorNote}</p>
      {targetHref && (
        <div className="viewer-error-actions">
          <Button
            as="a"
            href={targetHref}
            target="_blank"
            rel="noopener noreferrer"
            variant="solid"
            size="sm"
          >
            {t.viewer.openSource}{targetHost ? ` (${targetHost})` : ''}
            <ExternalLink size={14} aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  );
}

export function ContentViewer({ item, locale, languages, customPlayerTemplate, onClose, onExpand }) {
  const t = getMessages(locale);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [selectedLang, setSelectedLang] = useState(item?.solutionLang || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [favorited, setFavorited] = useState(false);

  useEffect(() => {
    if (!item) return;
    setHistory([{
      url: item.url || '',
      title: item.title || '',
      inlineContent: item.content || '',
      inlineKind: item.content ? (item.kind || 'markdown') : '',
      inlineSource: item.sourceUrl || item.url || '',
    }]);
    setHistoryIndex(0);
    setSelectedLang(item.solutionLang || '');
  }, [item]);

  const currentEntry = history[historyIndex] || { url: item?.url || '', title: item?.title || '', inlineContent: item?.content || '' };
  const activeUrl = currentEntry.url;
  const activeTitle = currentEntry.title;
  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < history.length - 1;

  useEffect(() => {
    setFavorited(isContentFavorited({ url: activeUrl, title: activeTitle }));
  }, [activeUrl, activeTitle]);

  function handleToggleFav() {
    const res = toggleFavoriteContent({
      url: activeUrl,
      title: activeTitle || data?.title || activeUrl,
      kind: data?.kind || item?.kind || 'article',
      badge: formatPluginBadge(data, t.viewer.pluginBadge),
      content: currentEntry.inlineContent || '',
      sourceUrl: currentEntry.inlineSource || activeUrl,
    });
    setFavorited(res.favorited);
  }

  function navigateNested(nextUrl, nextTitle) {
    if (!nextUrl || nextUrl === activeUrl) return;
    setHistory((prev) => [...prev.slice(0, historyIndex + 1), { url: nextUrl, title: nextTitle || '', inlineContent: '' }]);
    setHistoryIndex((idx) => idx + 1);
  }

  function goBack() {
    if (canGoBack) setHistoryIndex((idx) => idx - 1);
  }

  function goForward() {
    if (canGoForward) setHistoryIndex((idx) => idx + 1);
  }

  useEffect(() => {
    if (currentEntry.inlineContent) {
      setData({
        plugin: 'codegrill-guide',
        kind: currentEntry.inlineKind || 'markdown',
        title: currentEntry.title,
        siteName: 'Codegrill Guide',
        content: currentEntry.inlineContent,
        sourceUrl: currentEntry.inlineSource || '',
      });
      setLoading(false);
      return undefined;
    }
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
  }, [activeUrl, currentEntry.inlineContent, currentEntry.inlineKind, currentEntry.inlineSource, currentEntry.title, locale]);

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
          <div className="viewer-header-top">
            <Badge variant="outlined">{formatPluginBadge(data, t.viewer.pluginBadge)}</Badge>
            <div className="viewer-header-actions">
              <button
                type="button"
                className={`icon-btn ${favorited ? 'is-active' : ''}`}
                onClick={handleToggleFav}
                aria-pressed={favorited}
                aria-label={favorited ? 'Remove from favorites' : 'Mark favorite / read again'}
                title={favorited ? 'Saved to favorites' : 'Mark favorite / read again'}
              >
                <Star size={17} fill={favorited ? 'currentColor' : 'none'} aria-hidden="true" />
              </button>
              {onExpand && (
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => onExpand({
                    ...item,
                    url: activeUrl,
                    title: activeTitle || data?.title || '',
                    solutionLang: selectedLang,
                    history: history.map(({ url: u, title: ttl }) => ({ url: u, title: ttl })),
                    historyIndex,
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
          <div className="viewer-title-group">
            <h2>{activeTitle || data?.title}</h2>
            {data?.author && data.author.toLowerCase() !== formatPluginBadge(data, '').toLowerCase() && (
              <p className="viewer-meta">{data.author}</p>
            )}
            {data?.repo && <p className="viewer-meta">{data.repo} · {data.filePath || data.title}</p>}
            {data?.siteName && data.siteName !== formatPluginBadge(data, '') && (
              <p className="viewer-meta">{data.siteName}</p>
            )}
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
                  navigateNested(item.solutions[langId], `${item.problemTitle || ''} — ${langName}`);
                }}
              >
                <LanguageIcon lang={langId} size={14} /> {langName}
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
              navigateNested(nextUrl, nextTitle);
            }}
          />
        </div>

        <div className="viewer-footer">
          <div className="viewer-footer-left">
            {history.length > 1 && (
              <div className="viewer-history-nav" role="group" aria-label="Nested plugin history">
                <button
                  type="button"
                  className="icon-btn"
                  disabled={!canGoBack}
                  onClick={goBack}
                  aria-label="Back"
                  title="Back"
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                </button>
                <span className="viewer-history-count">{historyIndex + 1}/{history.length}</span>
                <button
                  type="button"
                  className="icon-btn"
                  disabled={!canGoForward}
                  onClick={goForward}
                  aria-label="Forward"
                  title="Forward"
                >
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
          <Button variant="quiet" size="sm" href={activeUrl} target="_blank" rel="noopener noreferrer">
            {t.viewer.openOriginal} <ExternalLink size={14} aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
