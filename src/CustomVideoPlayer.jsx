import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Maximize, Pause, Play, RotateCcw, Search, Volume2, VolumeX } from 'lucide-react';
import { fetchVideoTranscript } from './api.mjs';

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

function isDirectMediaUrl(url) {
  return /\.(mp4|webm|ogg|m3u8)(\?.*)?$/i.test(String(url || ''));
}

function extractVideoId(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'youtu.be') return parsed.pathname.slice(1).split('/')[0] || '';
    const v = parsed.searchParams.get('v');
    if (v) return v;
    const m = /\/embed\/([a-zA-Z0-9_-]{11})/.exec(parsed.pathname);
    return m ? m[1] : '';
  } catch {
    return '';
  }
}

function enableYouTubeJsApi(embedUrl) {
  try {
    const parsed = new URL(embedUrl);
    if (parsed.hostname.includes('youtube')) {
      parsed.searchParams.set('enablejsapi', '1');
      if (typeof window !== 'undefined' && window.location?.origin) {
        parsed.searchParams.set('origin', window.location.origin);
      }
      return parsed.href;
    }
    return embedUrl;
  } catch {
    return embedUrl;
  }
}

export function CustomVideoPlayer({
  embedUrl,
  sourceUrl,
  title,
  locale = 'en',
  problem,
  customPlayerTemplate,
  defaultShowScript = false,
}) {
  const iframeRef = useRef(null);
  const videoRef = useRef(null);
  const wrapRef = useRef(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [mode, setMode] = useState('forge');
  const [showScript, setShowScript] = useState(defaultShowScript);
  const [scriptQuery, setScriptQuery] = useState('');
  const [transcript, setTranscript] = useState({ cues: [], loading: false, loadedFor: '' });

  const directMedia = isDirectMediaUrl(sourceUrl || embedUrl);
  const videoId = extractVideoId(embedUrl || sourceUrl);
  const customUrl = customPlayerTemplate && sourceUrl
    ? customPlayerTemplate.replace('{url}', encodeURIComponent(sourceUrl))
    : '';

  const finalIframeUrl = mode === 'custom' && customUrl
    ? customUrl
    : enableYouTubeJsApi(embedUrl);

  useEffect(() => {
    setPlaying(false);
    setSpeed(1);
  }, [embedUrl]);

  useEffect(() => {
    if (!showScript || !videoId || transcript.loadedFor === `${videoId}:${locale}`) return undefined;
    let cancelled = false;
    setTranscript((prev) => ({ ...prev, loading: true }));
    fetchVideoTranscript(videoId, locale).then((res) => {
      if (!cancelled) {
        setTranscript({ cues: res.cues || [], loading: false, loadedFor: `${videoId}:${locale}` });
      }
    });
    return () => { cancelled = true; };
  }, [showScript, videoId, locale, transcript.loadedFor]);

  const fallbackScript = useMemo(() => {
    const items = [];
    if (problem?.optimal_approach) {
      items.push({ time: '00:00', start: 0, text: `Core intuition & optimal approach: ${problem.optimal_approach}` });
    }
    if (problem?.time_complexity || problem?.space_complexity) {
      items.push({
        time: '01:00',
        start: 60,
        text: `Target complexity: Time ${problem.time_complexity || 'O(n)'}, Space ${problem.space_complexity || 'O(1)'}.`,
      });
    }
    items.push(
      { time: '02:00', start: 120, text: 'Clarify input constraints, empty/single-element edge cases, and expected output format.' },
      { time: '03:00', start: 180, text: 'Walk through a small example step-by-step and verify invariants before coding.' },
    );
    return items;
  }, [problem]);

  const activeCues = transcript.cues.length > 0 ? transcript.cues : fallbackScript;
  const filteredCues = useMemo(() => {
    const needle = scriptQuery.trim().toLowerCase();
    if (!needle) return activeCues;
    return activeCues.filter((c) => c.text.toLowerCase().includes(needle) || c.time.includes(needle));
  }, [activeCues, scriptQuery]);

  function postYt(func, args = []) {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
  }

  function seekTo(seconds) {
    if (directMedia && videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play();
      setPlaying(true);
    } else {
      postYt('seekTo', [seconds, true]);
      postYt('playVideo');
      setPlaying(true);
    }
  }

  function togglePlay() {
    if (directMedia && videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setPlaying(true);
      } else {
        videoRef.current.pause();
        setPlaying(false);
      }
      return;
    }
    const next = !playing;
    postYt(next ? 'playVideo' : 'pauseVideo');
    setPlaying(next);
  }

  function toggleMute() {
    const next = !muted;
    if (directMedia && videoRef.current) {
      videoRef.current.muted = next;
    } else {
      postYt(next ? 'mute' : 'unMute');
    }
    setMuted(next);
  }

  function cycleSpeed() {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (directMedia && videoRef.current) {
      videoRef.current.playbackRate = next;
    } else {
      postYt('setPlaybackRate', [next]);
    }
  }

  function requestFullscreen() {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      el.requestFullscreen?.();
    }
  }

  return (
    <div className="custom-player-shell">
      <div className="custom-player" ref={wrapRef}>
        <div className="video-frame-wrap">
          {directMedia ? (
            <video
              ref={videoRef}
              src={sourceUrl || embedUrl}
              controls
              playsInline
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />
          ) : (
            <iframe
              ref={iframeRef}
              src={finalIframeUrl}
              title={title || 'Video walkthrough'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
            />
          )}
        </div>

        <div className="player-controls" role="toolbar" aria-label="Video player controls">
          <div className="player-controls-left">
            <button type="button" className="icon-btn" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'} title={playing ? 'Pause' : 'Play'}>
              {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
            </button>
            <button type="button" className="icon-btn" onClick={() => seekTo(0)} aria-label="Restart" title="Restart">
              <RotateCcw size={15} aria-hidden="true" />
            </button>
            <button type="button" className="icon-btn" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} title={muted ? 'Unmute' : 'Mute'}>
              {muted ? <VolumeX size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
            </button>
          </div>

          <div className="player-controls-right">
            <button
              type="button"
              className={`player-speed-btn ${showScript ? 'is-active' : ''}`}
              aria-pressed={showScript}
              onClick={() => setShowScript((v) => !v)}
            >
              <FileText size={13} aria-hidden="true" /> Script
            </button>
            <button type="button" className="player-speed-btn" onClick={cycleSpeed} title="Playback speed">
              {speed}×
            </button>
            {customUrl && (
              <button
                type="button"
                className={`player-speed-btn ${mode === 'custom' ? 'is-active' : ''}`}
                onClick={() => setMode((m) => (m === 'forge' ? 'custom' : 'forge'))}
              >
                {mode === 'custom' ? 'Custom' : 'Forge'}
              </button>
            )}
            <button type="button" className="icon-btn" onClick={requestFullscreen} aria-label="Fullscreen" title="Fullscreen">
              <Maximize size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {showScript && (
        <section className="script-panel" aria-label="Walkthrough script">
          <div className="script-panel-head">
            <div className="script-panel-title">
              <strong>Walkthrough script</strong>
              <span>{transcript.cues.length > 0 ? `${transcript.cues.length} lines` : 'Study outline'}</span>
            </div>
            <label className="script-search">
              <Search size={14} aria-hidden="true" />
              <input
                type="search"
                value={scriptQuery}
                placeholder="Search script..."
                aria-label="Search script"
                onChange={(e) => setScriptQuery(e.target.value)}
              />
            </label>
          </div>
          <div className="script-cue-list">
            {transcript.loading ? (
              <p className="script-empty">Loading transcript...</p>
            ) : filteredCues.length > 0 ? (
              filteredCues.map((cue, idx) => (
                <button
                  key={`${cue.start}-${idx}`}
                  type="button"
                  className="script-cue"
                  onClick={() => seekTo(cue.start)}
                >
                  <span className="script-time">{cue.time}</span>
                  <span className="script-text">{cue.text}</span>
                </button>
              ))
            ) : (
              <p className="script-empty">No matching script lines.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
