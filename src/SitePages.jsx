import React from 'react';
import { Button, Card } from '@utkristi/ui';
import {
  ArrowRight,
  BookOpen,
  Boxes,
  Code2,
  Cpu,
  Database,
  Flame,
  Network,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import { getMessages } from './i18n.mjs';
import { BrandLogo } from './BrandLogo.jsx';
import { ForgeAtlas } from './ForgeAtlas.jsx';
import { ROADMAP_DOMAINS } from './domainRoadmaps.mjs';

export const sitePages = ['home', 'how-it-works', 'about', 'help', 'privacy', 'terms', 'copyright'];

const workflowLinks = ['/sheets', '/problems', '/roadmap', '/profile'];

const DOMAIN_ICONS = {
  dsa: Code2,
  'system-design': Network,
  lld: Boxes,
  sql: Database,
  concurrency: Cpu,
  'ai-behavioral': Sparkles,
};

function navHandler(onNavigate, path) {
  return (event) => {
    if (!onNavigate || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    onNavigate(path);
  };
}

export function Workflow({ locale = 'en', onNavigate }) {
  const t = getMessages(locale);
  return (
    <ol className="workflow-grid">
      {t.site.workflow.map((step, index) => (
        <li key={step.title}>
          <Card variant="outlined">
            <span className="workflow-step-num">0{index + 1}</span>
            <h3>{step.title}</h3>
            <p>{step.desc}</p>
            <a href={workflowLinks[index]} onClick={navHandler(onNavigate, workflowLinks[index])}>{step.action}</a>
          </Card>
        </li>
      ))}
    </ol>
  );
}

export function SitePages({
  page,
  locale = 'en',
  topicCount,
  problemCount,
  sheetCount,
  solvedCount = 0,
  streak = 0,
  dailyChallenge = null,
  config,
  onNavigate,
  onOpenDaily,
}) {
  const t = getMessages(locale);
  const brandName = config?.brand?.name || 'codegrill';
  const ecosystem = config?.brand?.ecosystem || 'Utkristi';
  const year = new Date().getFullYear();

  if (page === 'home') {
    const dailyTitle = dailyChallenge
      ? (dailyChallenge.translations?.[locale]?.title || dailyChallenge.translations?.en?.title || dailyChallenge.slug)
      : '';

    return (
      <div className="marketing-page home-page">
        <section className="landing-hero landing-hero-v2">
          <div className="landing-hero-copy">
            <span className="landing-eyebrow">6 DOMAINS · 6 LANGUAGES · IN-APP VIEWERS</span>
            <h1 lang={locale}>{t.site.landingTitle}<span>.</span></h1>
            <p>{t.site.landingDesc}</p>
            <div className="rooms-actions landing-cta-row">
              <Button variant="solid" href="/roadmap" onClick={navHandler(onNavigate, '/roadmap')}>
                {t.site.exploreRoadmap} <ArrowRight size={15} aria-hidden="true" />
              </Button>
              <Button variant="outlined" href="/sheets" onClick={navHandler(onNavigate, '/sheets')}>
                {t.hero.exploreSheets}
              </Button>
              <Button variant="quiet" href="/rooms" onClick={navHandler(onNavigate, '/rooms')}>
                {t.nav.rooms}
              </Button>
            </div>
            <div className="landing-domain-pills" aria-label="Jump to domain roadmap">
              {ROADMAP_DOMAINS.map((dom) => (
                <a
                  key={dom.id}
                  href={`/roadmap?domain=${dom.id}`}
                  className="landing-domain-pill"
                  onClick={navHandler(onNavigate, `/roadmap?domain=${dom.id}`)}
                >
                  {dom.shortLabel}
                </a>
              ))}
            </div>
          </div>
          <ForgeAtlas variant="dark" className="landing-atlas" />
        </section>

        <section className="home-pulse-strip">
          <dl className="site-stats home-stats-grid">
            <div><dt>{t.site.statProblems}</dt><dd>{problemCount}</dd></div>
            <div><dt>Domains</dt><dd>{ROADMAP_DOMAINS.length}</dd></div>
            <div><dt>{t.site.statTopics}</dt><dd>{topicCount}</dd></div>
            <div><dt>{t.site.statSheets}</dt><dd>{sheetCount}</dd></div>
          </dl>

          <Card variant="outlined" className="home-daily-card">
            <div className="home-daily-meta">
              <span className="eyebrow">
                <Flame size={13} aria-hidden="true" /> {t.ledger.dailyEyebrow}
              </span>
              {solvedCount > 0 && (
                <a href="/profile" className="home-streak-pill" onClick={navHandler(onNavigate, '/profile')}>
                  {solvedCount} solved · {streak}d streak
                </a>
              )}
            </div>
            {dailyChallenge ? (
              <div className="home-daily-row">
                <div className="home-daily-info">
                  <strong>{dailyChallenge.leetcode_id}. {dailyTitle}</strong>
                  <span className="difficulty-badge" data-level={dailyChallenge.difficulty}>
                    {dailyChallenge.difficulty}
                  </span>
                </div>
                <Button
                  variant="solid"
                  size="sm"
                  onClick={() => (onOpenDaily ? onOpenDaily(dailyChallenge.slug) : onNavigate?.(`/problems?problem=${dailyChallenge.slug}`))}
                >
                  Solve now <ArrowRight size={14} aria-hidden="true" />
                </Button>
              </div>
            ) : (
              <div className="home-daily-row">
                <strong>Pick a sheet or launch a timed mock room</strong>
                <Button variant="outlined" size="sm" href="/problems" onClick={navHandler(onNavigate, '/problems')}>
                  Browse library
                </Button>
              </div>
            )}
          </Card>
        </section>

        <section className="marketing-section">
          <div className="home-section-head">
            <div>
              <h2>Complete Engineering Interview Atlas</h2>
              <p>Structured prerequisite roadmaps with built-in guides, Mermaid diagrams, and curated references beyond DSA.</p>
            </div>
            <a className="home-section-link" href="/roadmap" onClick={navHandler(onNavigate, '/roadmap')}>
              Open full roadmap <ArrowRight size={14} aria-hidden="true" />
            </a>
          </div>
          <div className="home-domain-grid">
            {ROADMAP_DOMAINS.map((dom) => {
              const Icon = DOMAIN_ICONS[dom.id] || Code2;
              return (
                <a
                  key={dom.id}
                  href={`/roadmap?domain=${dom.id}`}
                  className="home-domain-card"
                  onClick={navHandler(onNavigate, `/roadmap?domain=${dom.id}`)}
                >
                  <div className="home-domain-card-top">
                    <span className="home-domain-icon" aria-hidden="true">
                      <Icon size={17} />
                    </span>
                    <span className="home-domain-tag">{dom.shortLabel}</span>
                  </div>
                  <h3>{dom.label}</h3>
                  <p>{dom.subtitle}</p>
                  <span className="home-domain-cta">
                    Explore track <ArrowRight size={13} aria-hidden="true" />
                  </span>
                </a>
              );
            })}
          </div>
        </section>

        <section className="marketing-section">
          <div className="home-section-head">
            <div>
              <h2>Built for Deep Practice</h2>
              <p>Everything you need to read, watch, diagram, and rehearse in one keyboard-first workspace.</p>
            </div>
          </div>
          <div className="home-bento-grid">
            <Card variant="outlined" className="home-bento-card">
              <span className="home-bento-icon" aria-hidden="true"><BookOpen size={18} /></span>
              <h3>In-App Study Viewer</h3>
              <p>Watch walkthroughs with synchronized transcripts, browse GitHub repos, and render Markdown, KaTeX math, Mermaid diagrams, Jupyter notebooks, and Anki decks inline.</p>
              <a href="/resources" onClick={navHandler(onNavigate, '/resources')}>
                Explore resources <ArrowRight size={13} aria-hidden="true" />
              </a>
            </Card>

            <Card variant="outlined" className="home-bento-card">
              <span className="home-bento-icon" aria-hidden="true"><Users size={18} /></span>
              <h3>Mock Interview Studio</h3>
              <p>Run timed Pair DSA, System Design, LLD, or Behavioral sessions with a shared Markdown/Mermaid scratchpad, stage checklist, interviewer rubric, and Utkristi Colabs sync.</p>
              <a href="/rooms" onClick={navHandler(onNavigate, '/rooms')}>
                Launch a room <ArrowRight size={13} aria-hidden="true" />
              </a>
            </Card>

            <Card variant="outlined" className="home-bento-card">
              <span className="home-bento-icon" aria-hidden="true"><Trophy size={18} /></span>
              <h3>Multi-Platform Profile</h3>
              <p>Sync handles across LeetCode, Codeforces, AtCoder, CodeChef, GeeksforGeeks, HackerRank, and GitHub alongside your 28-day streak ledger and Favorites queue.</p>
              <a href="/profile" onClick={navHandler(onNavigate, '/profile')}>
                Open profile <ArrowRight size={13} aria-hidden="true" />
              </a>
            </Card>
          </div>
        </section>

        <section className="marketing-section">
          <h2>{t.site.fromTopic}</h2>
          <Workflow locale={locale} onNavigate={onNavigate} />
        </section>

        <section className="marketing-section">
          <h2>{t.site.chooseStudy}</h2>
          <div className="study-options">
            <Card variant="outlined">
              <h3>{t.site.prepareRoleTitle}</h3>
              <p>{t.site.prepareRoleDesc}</p>
              <Button variant="outlined" href="/tracks" onClick={navHandler(onNavigate, '/tracks')}>{t.site.exploreTracks}</Button>
            </Card>
            <Card variant="outlined">
              <h3>{t.site.partnerTitle}</h3>
              <p>{t.site.partnerDesc}</p>
              <Button variant="outlined" href="/rooms" onClick={navHandler(onNavigate, '/rooms')}>{t.site.goToRooms}</Button>
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
        <Workflow locale={locale} onNavigate={onNavigate} />
        <div className="marketing-section study-options">
          <Card variant="outlined">
            <h2>{t.site.prepareRoleTitle}</h2>
            <p>{t.site.prepareRoleDesc}</p>
            <Button variant="outlined" href="/tracks" onClick={navHandler(onNavigate, '/tracks')}>{t.site.exploreTracks}</Button>
          </Card>
          <Card variant="outlined">
            <h2>{t.site.partnerTitle}</h2>
            <p>{t.site.partnerDesc}</p>
            <Button variant="outlined" href="/rooms" onClick={navHandler(onNavigate, '/rooms')}>{t.site.goToRooms}</Button>
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
            <a href="/sheets" onClick={navHandler(onNavigate, '/sheets')}>{t.hero.exploreSheets}</a>
          </Card>
          <Card variant="outlined">
            <h2>{t.progress.title}</h2>
            <p>{t.site.workflow[3].desc}</p>
            <a href="/profile" onClick={navHandler(onNavigate, '/profile')}>{t.site.workflow[3].action}</a>
          </Card>
        </div>
      </section>
    );
  }

  if (page === 'privacy') {
    return (
      <section className="page-section marketing-page">
        <div className="section-heading">
          <div>
            <h1>Privacy notice</h1>
            <p>How {brandName} stores your study progress, notes, and embedded media preferences.</p>
          </div>
        </div>
        <Card variant="outlined" className="legal-card">
          <h2>Local-first storage & optional sync</h2>
          <p>Your solved problems, revision bookmarks, personal notes, activity ledger, and custom series are stored locally in your browser via <code>localStorage</code> and optionally synced with your self-hosted or connected {brandName} backend instance.</p>
          <h2>Privacy-enhanced embeds</h2>
          <p>Walkthrough videos load through YouTube&apos;s privacy-enhanced domain (<code>youtube-nocookie.com</code>) or your configured custom player template. Solution code and Markdown editorials are fetched through the {brandName} plugin layer without third-party ad trackers.</p>
          <h2>Full control & reset</h2>
          <p>You can permanently erase all saved progress, bookmarks, notes, and streak history at any time from the Settings menu using <strong>Reset progress</strong>.</p>
        </Card>
      </section>
    );
  }

  if (page === 'terms') {
    return (
      <section className="page-section marketing-page">
        <div className="section-heading">
          <div>
            <h1>Terms of use</h1>
            <p>Guidelines for using {brandName} and its integrated study tools.</p>
          </div>
        </div>
        <Card variant="outlined" className="legal-card">
          <h2>Educational & interview preparation use</h2>
          <p>{brandName} is provided as an educational workspace to organize coding interview roadmaps, curated practice series, personal notes, and study rooms. Content is provided &ldquo;as is&rdquo; without warranty of interview outcomes.</p>
          <h2>Third-party platforms & plugins</h2>
          <p>Built-in plugins retrieve publicly accessible metadata, open-source code files, and official embeddable video streams from third-party platforms (such as LeetCode, YouTube, GitHub, and technical blogs). Use of external platforms remains subject to their respective terms.</p>
          <h2>User-created series & notes</h2>
          <p>Custom sheets and personal notes you author belong to you and are stored solely for your study workflow.</p>
        </Card>
      </section>
    );
  }

  if (page === 'copyright') {
    return (
      <section className="page-section marketing-page">
        <div className="section-heading">
          <div>
            <h1>Copyright & attribution</h1>
            <p>© {year} {brandName} · {ecosystem}. All platform UI, plugins, and original tooling rights reserved.</p>
          </div>
        </div>
        <Card variant="outlined" className="legal-card">
          <h2>Open-source & community attributions</h2>
          <p>Problem metadata, multilingual translations, and reference solution indexes incorporate open-source contributions from community repositories including <code>doocs/leetcode</code> and <code>neetcode-gh/leetcode</code> under their respective open-source licenses.</p>
          <h2>Third-party trademarks & video creators</h2>
          <p>LeetCode, YouTube, GitHub, takeUforward (Striver), Blind 75, and Grind 75 are trademarks or community curriculums of their respective owners. Video walkthroughs remain the intellectual property of their original creators and are played via official embeddable players with source attribution.</p>
        </Card>
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

export function SiteFooter({ locale = 'en', config, onNavigate }) {
  const t = getMessages(locale);
  const brandName = config?.brand?.name || 'codegrill';
  const ecosystem = config?.brand?.ecosystem || 'Utkristi';
  const sources = config?.sources || [];
  const navEntries = [
    ['/roadmap', t.nav.roadmap],
    ['/sheets', t.nav.sheets],
    ['/problems', t.nav.problems],
    ['/tracks', t.nav.tracks],
    ['/resources', t.nav.resources],
    ['/rooms', t.nav.rooms],
  ];
  return (
    <footer className="app-footer">
      <div className="shell site-footer-inner">
        <div className="footer-brand">
          <a className="brand" href="/" aria-label={brandName} onClick={navHandler(onNavigate, '/')}>
            <BrandLogo name={brandName} size={28} />
          </a>
          <p>{t.site.footerTagline}</p>
        </div>
        <nav aria-label={t.site.footerStudy}>
          <h2>{t.site.footerStudy}</h2>
          {navEntries.map(([path, label]) => (
            <a key={path} href={path} lang={locale} onClick={navHandler(onNavigate, path)}>{label}</a>
          ))}
        </nav>
        <nav aria-label={t.site.footerProduct}>
          <h2>{t.site.footerProduct}</h2>
          <a href="/how-it-works" onClick={navHandler(onNavigate, '/how-it-works')}>{t.site.howItWorks}</a>
          <a href="/about" onClick={navHandler(onNavigate, '/about')}>{t.site.footerAbout}</a>
          <a href="/help" onClick={navHandler(onNavigate, '/help')}>{t.site.footerGuide}</a>
        </nav>
        <nav aria-label={t.site.footerSources}>
          <h2>{t.site.footerSources}</h2>
          {sources.map((src) => (
            <a key={src.url} href={src.url} target="_blank" rel="noopener noreferrer">{src.label}</a>
          ))}
        </nav>
      </div>
      <div className="shell footer-bottom">
        <span>© {new Date().getFullYear()} {brandName} · {ecosystem}</span>
        <div className="footer-legal">
          <a href="/privacy" onClick={navHandler(onNavigate, '/privacy')}>Privacy</a>
          <a href="/terms" onClick={navHandler(onNavigate, '/terms')}>Terms</a>
          <a href="/copyright" onClick={navHandler(onNavigate, '/copyright')}>Copyright</a>
        </div>
      </div>
    </footer>
  );
}
