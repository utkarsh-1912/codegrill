import React from 'react';

export function BrandLogo({ name = 'codegrill', size = 32, showWordmark = true }) {
  const splitIndex = name.toLowerCase().startsWith('code') && name.length > 4 ? 4 : 0;
  const prefix = splitIndex ? name.slice(0, splitIndex) : '';
  const suffix = splitIndex ? name.slice(splitIndex) : name;

  return (
    <span className="brand-lockup">
      <svg
        className="brand-emblem"
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="cg-logo-forge" x1="6" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ff8547" />
            <stop offset="52%" stopColor="#f05a28" />
            <stop offset="100%" stopColor="#c2410c" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="15" fill="url(#cg-logo-forge)" />
        <rect x="1.5" y="1.5" width="61" height="61" rx="13.5" stroke="#fff4e6" strokeOpacity="0.24" strokeWidth="1.5" />
        <path d="M23 19L11 32L23 45" stroke="#1b120d" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M41 19L53 32L41 45" stroke="#1b120d" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="26" y="21" width="12" height="4.5" rx="2.25" fill="#fff4e6" />
        <rect x="24" y="29.75" width="16" height="4.5" rx="2.25" fill="#1b120d" />
        <rect x="26" y="38.5" width="12" height="4.5" rx="2.25" fill="#fff4e6" />
      </svg>
      {showWordmark && (
        <span className="brand-wordmark">
          {prefix && <span className="brand-prefix">{prefix}</span>}
          <span className="brand-suffix">{suffix}</span>
          <span className="brand-dot" aria-hidden="true">.</span>
        </span>
      )}
    </span>
  );
}
