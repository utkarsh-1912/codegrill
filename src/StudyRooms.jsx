import React, { useState } from 'react';
import { Button, Card } from '@utkristi/ui';
import { ArrowUpRight } from 'lucide-react';
import { newRoomId, roomEditor, roomInvite, roomsDirectory } from './rooms.mjs';
import { getMessages } from './i18n.mjs';

const directory = roomsDirectory(import.meta.env.VITE_COLLAB_ROOMS_URL || undefined);

export function StudyRooms({ title, locale, children }) {
  const t = getMessages(locale);
  const [invite, setInvite] = useState('');
  const [error, setError] = useState('');

  function join(event) {
    event.preventDefault();
    const url = roomInvite(invite, directory);
    if (!url) {
      setError(t.rooms.invalidInvite);
      return;
    }
    window.open(url.href, '_blank', 'noopener,noreferrer');
  }

  return (
    <section className="page-section rooms-page">
      <div className="section-heading">
        <div>
          <h1 lang={locale}>{title}</h1>
          <p>{t.rooms.subtitle}</p>
        </div>
      </div>
      {directory ? (
        <div className="room-grid">
          <Card variant="outlined" className="study-panel">
            <div className="rooms-intro">
              <div>
                <h2>{t.rooms.startTitle}</h2>
                <p>{t.rooms.startDesc}</p>
              </div>
            </div>
            <div className="rooms-actions">
              <Button variant="solid" onClick={() => {
                const url = roomEditor(newRoomId(), directory);
                window.open(url.href, '_blank', 'noopener,noreferrer');
              }}>{t.rooms.createRoom}</Button>
              <a className="external-room" href={directory.href} target="_blank" rel="noopener noreferrer">
                {t.rooms.openColabs} <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            </div>
            {children}
          </Card>

          <Card variant="outlined" className="study-panel">
            <div className="rooms-intro">
              <div>
                <h2>{t.rooms.joinTitle}</h2>
                <p>{t.rooms.joinDesc}</p>
              </div>
            </div>
            <form className="invite-form" onSubmit={join}>
              <label className="visually-hidden" htmlFor="room-invite">{t.rooms.placeholder}</label>
              <div>
                <input
                  id="room-invite"
                  type="text"
                  value={invite}
                  required
                  placeholder={t.rooms.placeholder}
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'invite-error' : undefined}
                  onChange={(event) => { setInvite(event.target.value); setError(''); }}
                />
                <Button variant="outlined" type="submit">{t.rooms.joinBtn}</Button>
              </div>
              {error && <p id="invite-error" role="alert">{error}</p>}
            </form>
          </Card>
        </div>
      ) : (
        <p>{t.rooms.unavailable}</p>
      )}
    </section>
  );
}
