import React from 'react';
import { Button, Card } from '@utkristi/ui';
import { getMessages } from './i18n.mjs';

export const sitePages = ['home', 'how-it-works', 'about', 'help'];

const workflowLinks = ['#sheets', '#problems', '#roadmap', '#roadmap'];

export function Workflow({ locale = 'en' }) {
  const t = getMessages(locale);
  return (
    <ol className="workflow-grid">
      {t.site.workflow.map((step, index) => (
        <li key={step.title}>
          <Card variant="outlined">
            <span className="workflow-step-num">0{index + 1}</span>
            <h3>{step.title}</h3>
            <p>{step.desc}</p>
            <a href={workflowLinks[index]}>{step.action}</a>
          </Card>
        </li>
      ))}
    </ol>
  );
}

export function SitePages({ page, locale = 'en', topicCount, problemCount, sheetCount }) {
  const t = getMessages(locale);

  if (page === 'home') {
    return (
      <div className="marketing-page">
        <section className="landing-hero">
          <div>
            <h1 lang={locale}>{t.site.landingTitle}<span>.</span></h1>
            <p>{t.site.landingDesc}</p>
            <div className="rooms-actions">
              <Button variant="solid" href="#sheets">{t.hero.exploreSheets}</Button>
              <Button variant="outlined" href="#roadmap">{t.site.exploreRoadmap}</Button>
            </div>
          </div>
          <img src="/atlas.svg" alt="" />
        </section>

        <dl className="site-stats">
          <div><dt>{t.site.statProblems}</dt><dd>{problemCount}</dd></div>
          <div><dt>{t.site.statTopics}</dt><dd>{topicCount}</dd></div>
          <div><dt>{t.site.statSheets}</dt><dd>{sheetCount}</dd></div>
        </dl>

        <section className="marketing-section">
          <h2>{t.site.fromTopic}</h2>
          <Workflow locale={locale} />
        </section>

        <section className="marketing-section">
          <h2>{t.site.chooseStudy}</h2>
          <div className="study-options">
            <Card variant="outlined">
              <h3>{t.site.prepareRoleTitle}</h3>
              <p>{t.site.prepareRoleDesc}</p>
              <Button variant="outlined" href="#tracks">{t.site.exploreTracks}</Button>
            </Card>
            <Card variant="outlined">
              <h3>{t.site.partnerTitle}</h3>
              <p>{t.site.partnerDesc}</p>
              <Button variant="outlined" href="#rooms">{t.site.goToRooms}</Button>
            </Card>
          </div>
        </section>
      </div>
    );
  }

  if (page === 'how-it-works') {
    return (
      <section className="page-section marketing-page">
        <div className="section-heading">
          <div>
            <h1>{t.site.howItWorks}</h1>
            <p>{t.site.landingDesc}</p>
          </div>
        </div>
        <Workflow locale={locale} />
        <div className="marketing-section study-options">
          <Card variant="outlined">
            <h2>{t.site.prepareRoleTitle}</h2>
            <p>{t.site.prepareRoleDesc}</p>
            <Button variant="outlined" href="#tracks">{t.site.exploreTracks}</Button>
          </Card>
          <Card variant="outlined">
            <h2>{t.site.partnerTitle}</h2>
            <p>{t.site.partnerDesc}</p>
            <Button variant="outlined" href="#rooms">{t.site.goToRooms}</Button>
          </Card>
        </div>
      </section>
    );
  }

  if (page === 'about') {
    return (
      <section className="page-section marketing-page">
        <div className="section-heading">
          <div>
            <h1>{t.site.aboutTitle}</h1>
            <p>{t.site.aboutDesc}</p>
          </div>
        </div>
        <div className="study-options">
          <Card variant="outlined">
            <h2>{t.sheets.title}</h2>
            <p>{t.sheets.subtitle}</p>
            <a href="#sheets">{t.hero.exploreSheets}</a>
          </Card>
          <Card variant="outlined">
            <h2>{t.progress.title}</h2>
            <p>{t.site.workflow[3].desc}</p>
            <a href="#roadmap">{t.site.exploreRoadmap}</a>
          </Card>
        </div>
      </section>
    );
  }

  return (
    <section className="page-section marketing-page">
      <div className="section-heading">
        <div>
          <h1>{t.site.helpTitle}</h1>
          <p>{t.site.helpDesc}</p>
        </div>
      </div>
      <div className="module-list">
        {t.faq.map(([question, answer]) => (
          <Card key={question} variant="outlined">
            <details><summary>{question}</summary><p>{answer}</p></details>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function SiteFooter({ locale = 'en', config }) {
  const t = getMessages(locale);
  const brandName = config?.brand?.name || 'codegrill';
  const sources = config?.sources || [];
  const navEntries = [
    ['roadmap', t.nav.roadmap],
    ['sheets', t.nav.sheets],
    ['problems', t.nav.problems],
    ['tracks', t.nav.tracks],
    ['resources', t.nav.resources],
    ['rooms', t.nav.rooms],
  ];
  return (
    <footer className="app-footer">
      <div className="shell site-footer-inner">
        <div className="footer-brand">
          <a className="brand" href="#home">
            <img src="/codegrill.svg" width="29" height="29" alt="" />{brandName}
          </a>
          <p>{t.site.footerTagline}</p>
        </div>
        <nav aria-label={t.site.footerStudy}>
          <h2>{t.site.footerStudy}</h2>
          {navEntries.map(([page, label]) => (
            <a key={page} href={'#' + page} lang={locale}>{label}</a>
          ))}
        </nav>
        <nav aria-label={t.site.footerProduct}>
          <h2>{t.site.footerProduct}</h2>
          <a href="#how-it-works">{t.site.howItWorks}</a>
          <a href="#about">{t.site.footerAbout}</a>
          <a href="#help">{t.site.footerGuide}</a>
        </nav>
        <nav aria-label={t.site.footerSources}>
          <h2>{t.site.footerSources}</h2>
          {sources.map((src) => (
            <a key={src.url} href={src.url} target="_blank" rel="noopener noreferrer">{src.label}</a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
