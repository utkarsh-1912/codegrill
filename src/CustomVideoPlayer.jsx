import React, { useEffect, useRef, useState } from 'react';
import { Maximize, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

function isDirectMediaUrl(url) {
  return /\.(mp4|webm|ogg|m3u8)(\?.*)?$/i.test(String(url || ''));
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

export function CustomVideoPlayer({ embedUrl, sourceUrl, title, customPlayerTemplate }) {
  const iframeRef = useRef(null);
  const videoRef = useRef(null);
  const wrapRef = useRef(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [mode, setMode] = useState('forge'); // 'forge' | 'custom'

  const directMedia = isDirectMediaUrl(sourceUrl || embedUrl);
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

  function postYt(func, args = []) {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
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

  function restart() {
    if (directMedia && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
      setPlaying(true);
    } else {
      postYt('seekTo', [0, true]);
      postYt('playVideo');
      setPlaying(true);
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
          <button type="button" className="icon-btn" onClick={restart} aria-label="Restart" title="Restart">
            <RotateCcw size={15} aria-hidden="true" />
          </button>
          <button type="button" className="icon-btn" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} title={muted ? 'Unmute' : 'Mute'}>
            {muted ? <VolumeX size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
          </button>
        </div>

        <div className="player-controls-right">
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
  );
}
