import React from 'react';
import { Mascot } from './Mascot.jsx';
import { getMessages } from './i18n.mjs';

export function LoadingState({ locale = 'en', message, compact = false }) {
  const t = getMessages(locale);
  const text = message || t.status.loading;

  return (
    <div className={`loading-state ${compact ? 'is-compact' : ''}`} role="status" aria-live="polite">
      <Mascot mood="loading" size={compact ? 72 : 108} label={text} />
      <p className="loading-text">{text}</p>
      <div className="loading-bar" aria-hidden="true">
        <span />
      </div>
    </div>
  );
}
