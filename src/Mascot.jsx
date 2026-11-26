import React from 'react';

// "Ember" — Codegrill's forged code-spark mascot with expressive moods:
// 'idle' | 'loading' | 'lost' (404) | 'error'
export function Mascot({ mood = 'idle', size = 128, label = 'Codegrill mascot' }) {
  const isLost = mood === 'lost';
  const isError = mood === 'error';
  const isLoading = mood === 'loading';

  return (
    <div className={`mascot mascot-${mood}`} style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="m-shell" x1="28" y1="22" x2="112" y2="118" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ff8c52" />
            <stop offset="55%" stopColor="#f05a28" />
            <stop offset="100%" stopColor="#c2410c" />
          </linearGradient>
          <linearGradient id="m-flame" x1="70" y1="6" x2="70" y2="34" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="55%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
        </defs>

        {/* Ground shadow */}
        <ellipse className="mascot-shadow" cx="70" cy="126" rx="34" ry="6" fill="#1a110c" fillOpacity="0.22" />

        {/* Orbiting sparks for loading state */}
        {isLoading && (
          <g className="mascot-orbit">
            <circle cx="20" cy="70" r="4.5" fill="#fb923c" />
            <circle cx="120" cy="70" r="3.5" fill="#fde047" />
            <circle cx="70" cy="14" r="3" fill="#ff693d" />
          </g>
        )}

        <g className="mascot-body">
          {/* Crown forge flame */}
          <path
            className="mascot-flame"
            d="M70 10C75 20 83 24 81 33C79 39 61 39 59 33C57 24 65 20 70 10Z"
            fill="url(#m-flame)"
          />

          {/* Main forged chassis */}
          <rect x="28" y="34" width="84" height="74" rx="22" fill="url(#m-shell)" />
          <rect x="30" y="36" width="80" height="70" rx="20" stroke="#fff4e6" strokeOpacity="0.28" strokeWidth="2" />

          {/* Visor screen */}
          <rect x="38" y="46" width="64" height="32" rx="12" fill="#1b120d" />

          {/* Expressive code-bracket eyes */}
          {isError ? (
            <g stroke="#ff8547" strokeWidth="3.8" strokeLinecap="round">
              <path d="M51 57L60 66M60 57L51 66" />
              <path d="M80 57L89 66M89 57L80 66" />
            </g>
          ) : isLost ? (
            <g className="mascot-eyes">
              <circle cx="55" cy="62" r="5" fill="#fff4e6" />
              <circle cx="57" cy="61" r="2" fill="#1b120d" />
              <circle cx="85" cy="62" r="5" fill="#fff4e6" />
              <circle cx="87" cy="61" r="2" fill="#1b120d" />
            </g>
          ) : (
            <g className="mascot-eyes" stroke="#fff4e6" strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M59 56L51 62L59 68" />
              <path d="M81 56L89 62L81 68" />
              <circle cx="70" cy="62" r="2.4" fill="#ff8547" stroke="none" />
            </g>
          )}

          {/* Signature 3 ember grill bars on chest */}
          <rect x="52" y="86" width="36" height="4.5" rx="2.25" fill="#fff4e6" fillOpacity="0.92" />
          <rect x="48" y="93.5" width="44" height="4.5" rx="2.25" fill="#1b120d" fillOpacity="0.82" />
          <rect x="56" y="101" width="28" height="3.5" rx="1.75" fill="#ffd1a9" />

          {/* Little side handles / arms */}
          <rect x="18" y="60" width="8" height="22" rx="4" fill="#1b120d" />
          <rect x="114" y="60" width="8" height="22" rx="4" fill="#1b120d" />
        </g>

        {/* Mood badges */}
        {isLost && (
          <g className="mascot-badge">
            <circle cx="114" cy="34" r="13" fill="#1b120d" stroke="#ff8547" strokeWidth="2.5" />
            <text x="114" y="39" textAnchor="middle" fill="#fff4e6" fontSize="15" fontWeight="700" fontFamily="IBM Plex Mono, monospace">?</text>
          </g>
        )}
        {isError && (
          <g className="mascot-badge">
            <circle cx="114" cy="34" r="13" fill="#dc2626" stroke="#fff4e6" strokeWidth="2.5" />
            <text x="114" y="39" textAnchor="middle" fill="#fff" fontSize="15" fontWeight="700" fontFamily="IBM Plex Mono, monospace">!</text>
          </g>
        )}
      </svg>
    </div>
  );
}
