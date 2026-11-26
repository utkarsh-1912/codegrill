import React from 'react';
import { Button, Card } from '@utkristi/ui';
import { Mascot } from './Mascot.jsx';
import { getMessages } from './i18n.mjs';

export function NotFoundPage({ locale = 'en', pathname = '', onNavigate }) {
  const t = getMessages(locale);

  return (
    <section className="status-page page-enter" aria-labelledby="status-404-title">
      <Card variant="outlined" className="status-card">
        <Mascot mood="lost" size={136} label="404" />
        <p className="status-code">404</p>
        <h1 id="status-404-title">{t.status.notFoundTitle}</h1>
        <p className="status-desc">{t.status.notFoundDesc}</p>
        {pathname && <code className="status-path">{pathname}</code>}
        <div className="status-actions">
          <Button variant="solid" href="/" onClick={(e) => { e.preventDefault(); onNavigate('/'); }}>
            {t.status.goHome}
          </Button>
          <Button variant="outlined" href="/roadmap" onClick={(e) => { e.preventDefault(); onNavigate('/roadmap'); }}>
            {t.nav.roadmap}
          </Button>
          <Button variant="quiet" href="/sheets" onClick={(e) => { e.preventDefault(); onNavigate('/sheets'); }}>
            {t.nav.sheets}
          </Button>
        </div>
      </Card>
    </section>
  );
}

export function ErrorPage({ locale = 'en', error, onReset, onNavigate }) {
  const t = getMessages(locale);

  return (
    <section className="status-page page-enter" aria-labelledby="status-error-title">
      <Card variant="outlined" className="status-card">
        <Mascot mood="error" size={136} label="Error" />
        <p className="status-code">ERR</p>
        <h1 id="status-error-title">{t.status.errorTitle}</h1>
        <p className="status-desc">{t.status.errorDesc}</p>
        {error?.message && <code className="status-path">{error.message}</code>}
        <div className="status-actions">
          {onReset && (
            <Button variant="solid" onClick={onReset}>{t.status.retry}</Button>
          )}
          <Button variant="outlined" href="/" onClick={(e) => {
            if (onNavigate) {
              e.preventDefault();
              onNavigate('/');
            }
          }}>{t.status.goHome}</Button>
        </div>
      </Card>
    </section>
  );
}

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="shell">
          <ErrorPage
            locale={this.props.locale || 'en'}
            error={this.state.error}
            onReset={() => this.setState({ error: null })}
            onNavigate={(path) => {
              this.setState({ error: null });
              window.history.pushState({}, '', path);
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
          />
        </main>
      );
    }
    return this.props.children;
  }
}
