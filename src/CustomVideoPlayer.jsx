import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Maximize, Minimize, Pause, Play, RotateCcw, Search, Volume2, VolumeX } from 'lucide-react';
import { fetchVideoTranscript } from './api.mjs';

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

let ytApiPromise = null;
function loadYouTubeIframeApi() {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve, reject) => {
    const existing = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      existing?.();
      resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => reject(new Error('Failed to load YouTube API'));
    document.head.appendChild(script);
  });
  return ytApiPromise;
}

function isDirectMediaUrl(url) {
  return /\.(mp4|webm|ogg|m3u8)(\?.*)?$/i.test(String(url || ''));
}

function parseYouTubeTarget(embedUrl, sourceUrl) {
  for (const raw of [embedUrl, sourceUrl]) {
    if (!raw) continue;
    try {
      const parsed = new URL(raw);
      if (parsed.hostname === 'youtu.be') {
        const id = parsed.pathname.slice(1).split('/')[0];
        if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return { videoId: id, playlistId: '' };
      }
      if (parsed.hostname.includes('youtube')) {
        const v = parsed.searchParams.get('v');
        if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return { videoId: v, playlistId: '' };
        const m = /\/embed\/([a-zA-Z0-9_-]{11})/.exec(parsed.pathname);
        if (m) return { videoId: m[1], playlistId: '' };
        const list = parsed.searchParams.get('list');
        if (list) return { videoId: '', playlistId: list };
      }
    } catch {
      // ignore invalid URL
    }
  }
  return { videoId: '', playlistId: '' };
}

function formatTime(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
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
  const wrapRef = useRef(null);
  const ytHostRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const videoRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [mode, setMode] = useState('forge');
  const [apiFailed, setApiFailed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const syncFs = () => {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      setIsFullscreen(Boolean(fsEl && wrapRef.current && (fsEl === wrapRef.current || wrapRef.current.contains(fsEl))));
    };
    document.addEventListener('fullscreenchange', syncFs);
    document.addEventListener('webkitfullscreenchange', syncFs);
    return () => {
      document.removeEventListener('fullscreenchange', syncFs);
      document.removeEventListener('webkitfullscreenchange', syncFs);
    };
  }, []);

  const [showScript, setShowScript] = useState(defaultShowScript);
  const [scriptQuery, setScriptQuery] = useState('');
  const [transcript, setTranscript] = useState({ cues: [], loading: false, loadedFor: '' });

  const directMedia = isDirectMediaUrl(sourceUrl || embedUrl);
  const { videoId, playlistId } = useMemo(
    () => parseYouTubeTarget(embedUrl, sourceUrl),
    [embedUrl, sourceUrl],
  );
  const isYouTube = !directMedia && Boolean(videoId || playlistId);
  const customUrl = customPlayerTemplate && sourceUrl
    ? customPlayerTemplate.replace('{url}', encodeURIComponent(sourceUrl))
    : '';
  const useCustomExternal = mode === 'custom' && Boolean(customUrl);

  // Mount real YT.Player with true two-way state sync
  useEffect(() => {
    if (!isYouTube || useCustomExternal) return undefined;
    let cancelled = false;
    setReady(false);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setApiFailed(false);

    loadYouTubeIframeApi()
      .then((YT) => {
        if (cancelled || !ytHostRef.current) return;
        ytHostRef.current.innerHTML = '';
        const mountNode = document.createElement('div');
        ytHostRef.current.appendChild(mountNode);

        const playerVars = {
          controls: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          iv_load_policy: 3,
          hl: locale,
          cc_lang_pref: locale,
          ...(locale !== 'en' ? { cc_load_policy: 1 } : {}),
          ...(playlistId && !videoId ? { listType: 'playlist', list: playlistId } : {}),
        };

        ytPlayerRef.current = new YT.Player(mountNode, {
          host: 'https://www.youtube-nocookie.com',
          width: '100%',
          height: '100%',
          ...(videoId ? { videoId } : {}),
          playerVars,
          events: {
            onReady: (event) => {
              if (cancelled) return;
              const p = event.target;
              setReady(true);
              setDuration(Number(p.getDuration?.() || 0));
              setMuted(Boolean(p.isMuted?.()));
              setSpeed(Number(p.getPlaybackRate?.() || 1));
            },
            onStateChange: (event) => {
              if (cancelled) return;
              const p = event.target;
              setPlaying(event.data === YT.PlayerState.PLAYING);
              const dur = Number(p.getDuration?.() || 0);
              if (dur > 0) setDuration(dur);
              setCurrentTime(Number(p.getCurrentTime?.() || 0));
              setMuted(Boolean(p.isMuted?.()));
            },
            onPlaybackRateChange: (event) => {
              if (!cancelled) setSpeed(Number(event.data || 1));
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) setApiFailed(true);
      });

    return () => {
      cancelled = true;
      try {
        ytPlayerRef.current?.destroy?.();
      } catch {
        // ignore cleanup error
      }
      ytPlayerRef.current = null;
    };
  }, [isYouTube, useCustomExternal, videoId, playlistId, locale]);

  // Continuous 2-way time & mute sync while YouTube player is ready
  useEffect(() => {
    if (!isYouTube || !ready || useCustomExternal) return undefined;
    const id = setInterval(() => {
      const p = ytPlayerRef.current;
      if (!p) return;
      try {
        const t = Number(p.getCurrentTime?.() || 0);
        const d = Number(p.getDuration?.() || 0);
        const m = Boolean(p.isMuted?.());
        const r = Number(p.getPlaybackRate?.() || 1);
        setCurrentTime(t);
        if (d > 0) setDuration(d);
        setMuted(m);
        setSpeed(r);
      } catch {
        // ignore transient iframe read
      }
    }, 450);
    return () => clearInterval(id);
  }, [isYouTube, ready, useCustomExternal]);

  // Load transcript when Script panel is open
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

  // Index of currently spoken cue synced to currentTime
  const activeCueIndex = useMemo(() => {
    let idx = -1;
    for (let i = 0; i < filteredCues.length; i += 1) {
      if (filteredCues[i].start <= currentTime + 0.5) idx = i;
      else break;
    }
    return idx;
  }, [filteredCues, currentTime]);

  function seekTo(seconds) {
    const clamped = Math.max(0, Math.min(duration || seconds, seconds));
    setCurrentTime(clamped);
    if (directMedia && videoRef.current) {
      videoRef.current.currentTime = clamped;
      videoRef.current.play();
    } else if (ytPlayerRef.current?.seekTo) {
      ytPlayerRef.current.seekTo(clamped, true);
      ytPlayerRef.current.playVideo?.();
    }
  }

  function togglePlay() {
    if (directMedia && videoRef.current) {
      if (videoRef.current.paused) videoRef.current.play();
      else videoRef.current.pause();
      return;
    }
    const p = ytPlayerRef.current;
    if (!p) return;
    if (playing) p.pauseVideo?.();
    else p.playVideo?.();
  }

  function toggleMute() {
    if (directMedia && videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setMuted(videoRef.current.muted);
      return;
    }
    const p = ytPlayerRef.current;
    if (!p) return;
    if (muted) {
      p.unMute?.();
      setMuted(false);
    } else {
      p.mute?.();
      setMuted(true);
    }
  }

  function cycleSpeed() {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (directMedia && videoRef.current) {
      videoRef.current.playbackRate = next;
    } else {
      ytPlayerRef.current?.setPlaybackRate?.(next);
    }
  }

  function requestFullscreen() {
    const el = wrapRef.current;
    if (!el) return;
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl) {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      return;
    }
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    } else if (directMedia && videoRef.current?.webkitEnterFullscreen) {
      videoRef.current.webkitEnterFullscreen();
    }
  }

  return (
    <div className="custom-player-shell">
      <div className={`custom-player ${playing ? 'is-playing' : 'is-paused'}`} ref={wrapRef}>
        <div className="video-frame-wrap">
          {directMedia ? (
            <video
              ref={videoRef}
              src={sourceUrl || embedUrl}
              playsInline
              onClick={togglePlay}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime || 0)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
              onRateChange={(e) => setSpeed(e.currentTarget.playbackRate)}
            />
          ) : useCustomExternal || apiFailed || !isYouTube ? (
            <iframe
              src={useCustomExternal ? customUrl : embedUrl}
              title={title || 'Video walkthrough'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
            />
          ) : (
            <div ref={ytHostRef} className="yt-api-mount" aria-label={title || 'Video walkthrough'} />
          )}

          {!useCustomExternal && (
            <div className="player-overlay-controls">
              {duration > 0 && (
                <div className="player-scrubber-row">
                  <input
                    type="range"
                    className="player-scrubber"
                    min={0}
                    max={Math.floor(duration)}
                    value={Math.floor(currentTime)}
                    aria-label="Seek video timeline"
                    onChange={(e) => seekTo(Number(e.target.value))}
                  />
                </div>
              )}

              <div className="player-controls" role="toolbar" aria-label="Video player controls">
                <div className="player-controls-left">
                  <button type="button" className="player-ov-btn" onClick={togglePlay} disabled={isYouTube && !ready}
                    aria-label={playing ? 'Pause' : 'Play'} title={playing ? 'Pause' : 'Play'}>
                    {playing ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}
                  </button>
                  <button type="button" className="player-ov-btn" onClick={() => seekTo(0)} disabled={isYouTube && !ready}
                    aria-label="Restart" title="Restart">
                    <RotateCcw size={15} aria-hidden="true" />
                  </button>
                  <button type="button" className="player-ov-btn" onClick={toggleMute} disabled={isYouTube && !ready}
                    aria-label={muted ? 'Unmute' : 'Mute'} title={muted ? 'Unmute' : 'Mute'}>
                    {muted ? <VolumeX size={17} aria-hidden="true" /> : <Volume2 size={17} aria-hidden="true" />}
                  </button>
                  {duration > 0 && (
                    <span className="player-time-inline">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  )}
                </div>

                <div className="player-controls-right">
                  <button
                    type="button"
                    className={`player-ov-btn ${showScript ? 'is-active' : ''}`}
                    aria-pressed={showScript}
                    aria-label="Walkthrough script"
                    title="Walkthrough script"
                    onClick={() => setShowScript((v) => !v)}
                  >
                    <FileText size={16} aria-hidden="true" />
                  </button>
                  <button type="button" className="player-ov-speed" onClick={cycleSpeed} title="Playback speed">
                    {speed}×
                  </button>
                  {customUrl && (
                    <button
                      type="button"
                      className={`player-ov-speed ${mode === 'custom' ? 'is-active' : ''}`}
                      onClick={() => setMode((m) => (m === 'forge' ? 'custom' : 'forge'))}
                    >
                      {mode === 'custom' ? 'Custom' : 'Forge'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="player-ov-btn"
                    onClick={requestFullscreen}
                    aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                    title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                  >
                    {isFullscreen ? <Minimize size={16} aria-hidden="true" /> : <Maximize size={16} aria-hidden="true" />}
                  </button>
                </div>
              </div>
            </div>
          )}
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
                  className={`script-cue ${idx === activeCueIndex ? 'is-active' : ''}`}
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
