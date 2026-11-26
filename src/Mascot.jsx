import React, { useId } from 'react';

// "Ember" — Codegrill's forged code-spark mascot with expressive moods:
// 'idle' | 'loading' | 'lost' (404) | 'error' | 'happy' | 'shield'
export function Mascot({ mood = 'idle', size = 128, label = 'Codegrill mascot' }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const isLost = mood === 'lost';
  const isError = mood === 'error';
  const isLoading = mood === 'loading';
  const isHappy = mood === 'happy';
  const isShield = mood === 'shield';

  return (
    <div className={`mascot mascot-${mood}`} style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id={`m-aura-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ff7a3d" stopOpacity="0.34" />
            <stop offset="60%" stopColor="#ea580c" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`m-shell-${uid}`} x1="34" y1="30" x2="126" y2="128" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ff9a62" />
            <stop offset="48%" stopColor="#f05a28" />
            <stop offset="100%" stopColor="#b8370a" />
          </linearGradient>
          <linearGradient id={`m-visor-${uid}`} x1="46" y1="52" x2="114" y2="90" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#261a14" />
            <stop offset="100%" stopColor="#120b08" />
          </linearGradient>
          <linearGradient id={`m-flame-${uid}`} x1="80" y1="8" x2="80" y2="42" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="48%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
          <linearGradient id={`m-core-${uid}`} x1="80" y1="18" x2="80" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fffbeb" />
            <stop offset="100%" stopColor="#fde047" />
          </linearGradient>
        </defs>

        {/* Warm ambient forge aura */}
        <circle className="mascot-aura" cx="80" cy="82" r="62" fill={`url(#m-aura-${uid})`} />

        {/* Ground shadow */}
        <ellipse className="mascot-shadow" cx="80" cy="144" rx="38" ry="6.5" fill="#1a110c" fillOpacity="0.22" />

        {/* Orbiting sparks for loading / shield / happy */}
        {(isLoading || isHappy || isShield) && (
          <g className="mascot-orbit">
            <circle cx="22" cy="80" r="4" fill="#fb923c" />
            <circle cx="138" cy="80" r="3.2" fill="#fde047" />
            <circle cx="80" cy="18" r="2.8" fill="#ff693d" />
          </g>
        )}

        {/* Rising ambient micro-sparks */}
        <g className="mascot-sparks">
          <circle className="mascot-spark s1" cx="56" cy="28" r="2.4" fill="#fde047" />
          <circle className="mascot-spark s2" cx="105" cy="24" r="2" fill="#fb923c" />
          <circle className="mascot-spark s3" cx="92" cy="16" r="1.8" fill="#fef08a" />
        </g>

        <g className="mascot-body">
          {/* Layered crown forge flame */}
          <g className="mascot-flame">
            <path
              d="M80 10C87 22 96 27 93 38C91 45 69 45 67 38C64 27 73 22 80 10Z"
              fill={`url(#m-flame-${uid})`}
            />
            <path
              d="M80 20C84 27 88 31 86 37C85 41 75 41 74 37C72 31 76 27 80 20Z"
              fill={`url(#m-core-${uid})`}
            />
          </g>

          {/* Articulated side arms */}
          <rect className="mascot-arm mascot-arm-l" x="22" y="68" width="10" height="26" rx="5" fill="#1e140f" />
          <rect className="mascot-arm mascot-arm-l" x="24" y="71" width="3" height="12" rx="1.5" fill="#ff9a62" fillOpacity="0.45" />
          <rect className="mascot-arm mascot-arm-r" x="128" y="68" width="10" height="26" rx="5" fill="#1e140f" />
          <rect className="mascot-arm mascot-arm-r" x="133" y="71" width="3" height="12" rx="1.5" fill="#ff9a62" fillOpacity="0.45" />

          {/* Main forged chassis */}
          <rect x="34" y="40" width="92" height="82" rx="25" fill={`url(#m-shell-${uid})`} />
          <rect x="36.5" y="42.5" width="87" height="77" rx="22.5" stroke="#fff4e6" strokeOpacity="0.32" strokeWidth="2" />
          {/* Top specular rim highlight */}
          <path d="M54 45H106" stroke="#fff7ed" strokeOpacity="0.45" strokeWidth="2.4" strokeLinecap="round" />

          {/* Visor screen */}
          <rect x="44" y="53" width="72" height="36" rx="14" fill={`url(#m-visor-${uid})`} stroke="#40281c" strokeWidth="1.5" />
          {/* Subtle visor glass sheen */}
          <path d="M54 57H78" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="2" strokeLinecap="round" />

          {/* Expressive code-bracket eyes */}
          {isError ? (
            <g stroke="#ff8547" strokeWidth="4" strokeLinecap="round">
              <path d="M58 65L68 75M68 65L58 75" />
              <path d="M92 65L102 75M102 65L92 75" />
            </g>
          ) : isLost ? (
            <g className="mascot-eyes">
              <circle cx="64" cy="71" r="5.5" fill="#fff4e6" />
              <circle cx="66.5" cy="70" r="2.3" fill="#1b120d" />
              <circle cx="96" cy="71" r="5.5" fill="#fff4e6" />
              <circle cx="98.5" cy="70" r="2.3" fill="#1b120d" />
            </g>
          ) : isHappy ? (
            <g className="mascot-eyes" stroke="#fff4e6" strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M57 73C59.5 67 66.5 67 69 73" />
              <path d="M91 73C93.5 67 100.5 67 103 73" />
              <circle cx="80" cy="74" r="2.4" fill="#fb923c" stroke="none" />
            </g>
          ) : (
            <g className="mascot-eyes mascot-blink" stroke="#fff4e6" strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M68 64L59 71L68 78" />
              <path d="M92 64L101 71L92 78" />
              <circle cx="80" cy="71" r="2.6" fill="#ff8547" stroke="none" />
            </g>
          )}

          {/* Warm cheek glow */}
          <ellipse cx="52" cy="79" rx="4" ry="2" fill="#ff8547" fillOpacity="0.32" />
          <ellipse cx="108" cy="79" rx="4" ry="2" fill="#ff8547" fillOpacity="0.32" />

          {/* Signature glowing 3 ember grill bars on chest */}
          <rect x="60" y="96" width="40" height="4.8" rx="2.4" fill="#fff4e6" fillOpacity="0.94" />
          <rect x="55" y="104" width="50" height="4.8" rx="2.4" fill="#1b120d" fillOpacity="0.86" />
          <rect className="mascot-grill-glow" x="64" y="112" width="32" height="3.8" rx="1.9" fill="#fde047" />
        </g>

        {/* Mood badges */}
        {isLost && (
          <g className="mascot-badge">
            <circle cx="126" cy="40" r="14" fill="#1b120d" stroke="#ff8547" strokeWidth="2.5" />
            <text x="126" y="45" textAnchor="middle" fill="#fff4e6" fontSize="16" fontWeight="700" fontFamily="IBM Plex Mono, monospace">?</text>
          </g>
        )}
        {isError && (
          <g className="mascot-badge">
            <circle cx="126" cy="40" r="14" fill="#dc2626" stroke="#fff4e6" strokeWidth="2.5" />
            <text x="126" y="45" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="700" fontFamily="IBM Plex Mono, monospace">!</text>
          </g>
        )}
        {isShield && (
          <g className="mascot-badge">
            <circle cx="126" cy="40" r="14" fill="#1b120d" stroke="#fb923c" strokeWidth="2.2" />
            <path d="M126 32L132 34.5V39.5C132 43.2 129.4 46.4 126 47.6C122.6 46.4 120 43.2 120 39.5V34.5L126 32Z" fill="#ff8547" />
          </g>
        )}
      </svg>
    </div>
  );
}
