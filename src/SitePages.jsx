import React from 'react';
import { Button, Card } from '@utkristi/ui';
import {
  ArrowRight,
  BookOpen,
  Boxes,
  Code2,
  Compass,
  Cpu,
  Database,
  Flame,
  Layers,
  Network,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import { getMessages } from './i18n.mjs';
import { BrandLogo } from './BrandLogo.jsx';
import { ForgeAtlas } from './ForgeAtlas.jsx';
import { Mascot } from './Mascot.jsx';
import { ROADMAP_DOMAINS } from './domainRoadmaps.mjs';

export const sitePages = ['home', 'how-it-works', 'about', 'help', 'privacy', 'terms', 'copyright'];

const workflowLinks = ['/sheets', '/problems', '/roadmap', '/profile'];

const DOMAIN_META = {
  dsa: {
    icon: Code2,
    tag: 'DSA',
    summary: 'Arrays, graphs, DP, trees, and 177 problems across LeetCode, Codeforces, and HackerRank.',
  },
  'system-design': {
    icon: Network,
    tag: 'HLD',
    summary: 'Load balancers, caching, sharding, Kafka queues, and distributed scale blueprints.',
  },
  lld: {
    icon: Boxes,
    tag: 'LLD',
    summary: 'SOLID principles, design patterns, class diagrams, and clean extensible object models.',
  },
  databases: {
    icon: Database,
    tag: 'SQL',
    summary: 'B-Tree indexing, MVCC isolation levels, query plans, transactions, and NoSQL trade-offs.',
  },
  concurrency: {
    icon: Cpu,
    tag: 'OS',
    summary: 'Threads, mutexes, deadlocks, lock-free queues, memory models, and async runtimes.',
  },
  'ai-behavioral': {
    icon: Sparkles,
    tag: 'AI · STAR',
    summary: 'RAG pipelines, LLM evaluation, agent architectures, and structured leadership stories.',
  },
};

function navHandler(onNavigate, path) {
  return (event) => {
    if (!onNavigate || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    onNavigate(path);
  };
}

function MarketingHero({ title, subtitle, mood = 'idle', caption = '', actions = null, locale = 'en' }) {
  return (
    <div className="marketing-hero-banner">
      <div className="marketing-hero-copy">
        <h1 lang={locale}>{title}<span>.</span></h1>
        <p>{subtitle}</p>
        {actions && <div className="marketing-hero-actions">{actions}</div>}
      </div>
      <div className="marketing-hero-stage" aria-hidden="true">
        <div className="legal-orbit-ring ring-1" />
        <div className="legal-orbit-ring ring-2" />
        <Mascot mood={mood} size={132} label={`${title} mascot`} />
        {caption && <span className="marketing-hero-caption">{caption}</span>}
      </div>
    </div>
  );
}

const WORKFLOW_ICONS = [Layers, Code2, Compass, Trophy];

export function Workflow({ locale = 'en', onNavigate }) {
  const t = getMessages(locale);
  return (
    <ol className="workflow-grid workflow-grid-v2">
      {t.site.workflow.map((step, index) => {
        const StepIcon = WORKFLOW_ICONS[index] || Code2;
        return (
          <li key={step.title} className="workflow-item-v2">
            <Card variant="outlined" className="workflow-card-v2">
              <div className="workflow-card-head">
                <span className="workflow-step-badge">0{index + 1}</span>
                <span className="workflow-icon-badge" aria-hidden="true">
                  <StepIcon size={16} />
                </span>
              </div>
              <div className="workflow-card-body">
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </div>
              <a
                className="workflow-cta-link"
                href={workflowLinks[index]}
                onClick={navHandler(onNavigate, workflowLinks[index])}
              >
                <span>{step.action}</span>
                <ArrowRight size={14} aria-hidden="true" />
              </a>
            </Card>
          </li>
        );
      })}
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
          </div>
          <ForgeAtlas variant="dark" className="landing-atlas" />
        </section>

        <section className="home-pulse-strip">
          <dl className="site-stats home-stats-grid">
            <div><dt>{t.site.statProblems}</dt><dd>{problemCount}</dd></div>
            <div><dt>{t.studio.home.domainsStat}</dt><dd>{ROADMAP_DOMAINS.length}</dd></div>
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
                  {solvedCount} {t.progress.solvedOf} · {streak}d {t.progress.streak}
                </a>
              )}
            </div>
            {dailyChallenge ? (
              <div className="home-daily-row">
                <div className="home-daily-info">
                  <strong>{dailyChallenge.leetcode_id}. {dailyTitle}</strong>
                  <span className="difficulty-badge" data-level={dailyChallenge.difficulty}>
                    {t.sheets[dailyChallenge.difficulty?.toLowerCase()] || dailyChallenge.difficulty}
                  </span>
                </div>
                <Button
                  variant="solid"
                  size="sm"
                  onClick={() => (onOpenDaily ? onOpenDaily(dailyChallenge.slug) : onNavigate?.(`/problems?problem=${dailyChallenge.slug}`))}
                >
                  {t.studio.home.solveNow} <ArrowRight size={14} aria-hidden="true" />
                </Button>
              </div>
            ) : (
              <div className="home-daily-row">
                <strong>{t.studio.home.dailyEmpty}</strong>
                <Button variant="outlined" size="sm" href="/problems" onClick={navHandler(onNavigate, '/problems')}>
                  {t.studio.home.browseLibrary}
                </Button>
              </div>
            )}
          </Card>
        </section>

        <section className="marketing-section">
          <div className="home-section-head">
            <div>
              <h2>{t.studio.home.atlasTitle}</h2>
              <p>{t.studio.home.atlasDesc}</p>
            </div>
            <a className="home-section-link" href="/roadmap" onClick={navHandler(onNavigate, '/roadmap')}>
              {t.studio.home.openFullRoadmap} <ArrowRight size={14} aria-hidden="true" />
            </a>
          </div>
          <div className="home-domain-grid">
            {ROADMAP_DOMAINS.map((dom) => {
              const meta = DOMAIN_META[dom.id] || { icon: Code2, tag: dom.id.toUpperCase(), summary: '' };
              const Icon = meta.icon;
              const label = dom.labels?.[locale] || dom.labels?.en || dom.id;
              const summary = t.studio.home.domainSummaries?.[dom.id] || meta.summary;
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
                    <span className="home-domain-tag">{meta.tag}</span>
                  </div>
                  <h3>{label}</h3>
                  <p>{summary}</p>
                  <span className="home-domain-cta">
                    {t.studio.home.openRoadmap} <ArrowRight size={13} aria-hidden="true" />
                  </span>
                </a>
              );
            })}
          </div>
        </section>

        <section className="marketing-section">
          <div className="home-section-head">
            <div>
              <h2>{t.studio.home.superpowersTitle}</h2>
              <p>{t.studio.home.superpowersDesc}</p>
            </div>
          </div>
          <div className="home-bento-grid">
            <Card variant="outlined" className="home-bento-card">
              <span className="home-bento-icon" aria-hidden="true"><BookOpen size={18} /></span>
              <h3>{t.studio.home.viewerTitle}</h3>
              <p>{t.studio.home.viewerDesc}</p>
              <a href="/resources" onClick={navHandler(onNavigate, '/resources')}>
                {t.studio.home.exploreResources} <ArrowRight size={13} aria-hidden="true" />
              </a>
            </Card>

            <Card variant="outlined" className="home-bento-card">
              <span className="home-bento-icon" aria-hidden="true"><Users size={18} /></span>
              <h3>{t.studio.home.studioTitle}</h3>
              <p>{t.studio.home.studioDesc}</p>
              <a href="/rooms" onClick={navHandler(onNavigate, '/rooms')}>
                {t.studio.home.launchRoom} <ArrowRight size={13} aria-hidden="true" />
              </a>
            </Card>

            <Card variant="outlined" className="home-bento-card">
              <span className="home-bento-icon" aria-hidden="true"><Trophy size={18} /></span>
              <h3>{t.studio.home.profileTitle}</h3>
              <p>{t.studio.home.profileDesc}</p>
              <a href="/profile" onClick={navHandler(onNavigate, '/profile')}>
                {t.studio.home.openProfile} <ArrowRight size={13} aria-hidden="true" />
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
        <MarketingHero
          locale={locale}
          title={t.site.howItWorks}
          subtitle={t.site.landingDesc}
          mood="loading"
          caption="4-step mastery loop"
          actions={(
            <>
              <Button variant="solid" href="/roadmap" onClick={navHandler(onNavigate, '/roadmap')}>
                {t.site.exploreRoadmap} <ArrowRight size={15} aria-hidden="true" />
              </Button>
              <Button variant="outlined" href="/rooms" onClick={navHandler(onNavigate, '/rooms')}>
                {t.site.goToRooms}
              </Button>
            </>
          )}
        />
        <Workflow locale={locale} onNavigate={onNavigate} />

        <section className="marketing-section">
          <div className="home-section-head">
            <div>
              <h2>Recommended Study Cadences</h2>
              <p>Pick a rhythm that matches your timeline and combine solo drills with live mock sessions.</p>
            </div>
          </div>
          <div className="home-bento-grid">
            <Card variant="outlined" className="home-bento-card">
              <span className="home-domain-tag">DAILY · 30 MIN</span>
              <h3>Daily Warmup Habit</h3>
              <p>Solve the Daily Challenge, revisit one starred item from your Favorites queue, and read one built-in roadmap guide.</p>
              <a href="/profile" onClick={navHandler(onNavigate, '/profile')}>
                Open profile ledger <ArrowRight size={13} aria-hidden="true" />
              </a>
            </Card>
            <Card variant="outlined" className="home-bento-card">
              <span className="home-domain-tag">4 WEEKS · FOCUSED</span>
              <h3>Onsite Interview Sprint</h3>
              <p>Complete Blind 75 or Grind 75 with the weekly planner, review 2 System Design blueprints per week, and run 1 timed mock room.</p>
              <a href="/sheets" onClick={navHandler(onNavigate, '/sheets')}>
                Configure weekly plan <ArrowRight size={13} aria-hidden="true" />
              </a>
            </Card>
            <Card variant="outlined" className="home-bento-card">
              <span className="home-domain-tag">8 WEEKS · FULL LOOP</span>
              <h3>Senior & Full-Stack Mastery</h3>
              <p>Progress through all 6 domains — DSA, HLD, LLD, SQL, Concurrency, and AI/Behavioral — and export Markdown debriefs after every mock room.</p>
              <a href="/roadmap" onClick={navHandler(onNavigate, '/roadmap')}>
                Start 6-domain atlas <ArrowRight size={13} aria-hidden="true" />
              </a>
            </Card>
          </div>
        </section>

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
        <MarketingHero
          locale={locale}
          title={t.site.aboutTitle}
          subtitle={t.site.aboutDesc}
          mood="happy"
          caption={`${ecosystem} · ${problemCount} problems · 6 domains`}
          actions={(
            <>
              <Button variant="solid" href="/sheets" onClick={navHandler(onNavigate, '/sheets')}>
                {t.hero.exploreSheets} <ArrowRight size={15} aria-hidden="true" />
              </Button>
              <Button variant="outlined" href="/profile" onClick={navHandler(onNavigate, '/profile')}>
                {t.nav.profile}
              </Button>
            </>
          )}
        />

        <div className="home-bento-grid marketing-section">
          <Card variant="outlined" className="home-bento-card">
            <span className="home-bento-icon" aria-hidden="true"><BookOpen size={18} /></span>
            <h3>{t.sheets.title}</h3>
            <p>{t.sheets.subtitle}</p>
            <a href="/sheets" onClick={navHandler(onNavigate, '/sheets')}>
              {t.hero.exploreSheets} <ArrowRight size={13} aria-hidden="true" />
            </a>
          </Card>
          <Card variant="outlined" className="home-bento-card">
            <span className="home-bento-icon" aria-hidden="true"><Trophy size={18} /></span>
            <h3>{t.progress.title}</h3>
            <p>{t.site.workflow[3].desc}</p>
            <a href="/profile" onClick={navHandler(onNavigate, '/profile')}>
              {t.site.workflow[3].action} <ArrowRight size={13} aria-hidden="true" />
            </a>
          </Card>
          <Card variant="outlined" className="home-bento-card">
            <span className="home-bento-icon" aria-hidden="true"><Users size={18} /></span>
            <h3>{t.site.partnerTitle}</h3>
            <p>{t.site.partnerDesc}</p>
            <a href="/rooms" onClick={navHandler(onNavigate, '/rooms')}>
              {t.site.goToRooms} <ArrowRight size={13} aria-hidden="true" />
            </a>
          </Card>
        </div>

        <section className="marketing-section">
          <div className="home-section-head">
            <div>
              <h2>What Powers {brandName}</h2>
              <p>Designed as a complete engineering interview studio rather than a static problem list.</p>
            </div>
          </div>
          <div className="about-feature-grid">
            <Card variant="outlined" className="about-feature-card">
              <span className="workflow-step-num">01</span>
              <h3>6 Connected Domains</h3>
              <p>Move seamlessly from DSA into System Design (HLD), Low-Level Design (LLD), SQL & Databases, Concurrency & OS, and AI Systems & Behavioral prep.</p>
            </Card>
            <Card variant="outlined" className="about-feature-card">
              <span className="workflow-step-num">02</span>
              <h3>In-App Multi-Format Viewers</h3>
              <p>Read GitHub repositories, Markdown with KaTeX math and Mermaid diagrams, Jupyter notebooks (.ipynb), Anki decks (.apkg), and captioned video walkthroughs without leaving the app.</p>
            </Card>
            <Card variant="outlined" className="about-feature-card">
              <span className="workflow-step-num">03</span>
              <h3>7-Platform Profile Aggregation</h3>
              <p>Connect LeetCode, Codeforces, AtCoder, CodeChef, GeeksforGeeks, HackerRank, and GitHub handles for automatic stats alongside your Favorites & Read Again list.</p>
            </Card>
            <Card variant="outlined" className="about-feature-card">
              <span className="workflow-step-num">04</span>
              <h3>Local-First & 6 Languages</h3>
              <p>Everything saves instantly in your browser with optional backend sync, localized across English, Japanese, Hindi, Spanish, Chinese, and Korean.</p>
            </Card>
          </div>
        </section>
      </section>
    );
  }

  if (page === 'privacy') {
    return (
      <section className="page-section marketing-page">
        <div className="section-heading">
          <div>
            <h1>Privacy Policy</h1>
            <p>Effective Date: November 27, {year} · Data Controller: {ecosystem} ({brandName}).</p>
          </div>
        </div>
        <Card variant="outlined" className="legal-card legal-card-split">
          <div className="legal-card-copy">
            <h2>1. Scope &amp; Dual-Mode Data Architecture</h2>
            <p>{brandName} is engineered on a <strong>Guest Local-First</strong> architecture with optional <strong>Authenticated Cloud Sync</strong>. You may browse all 6 interview roadmaps, 177+ curated problems, multi-language guides, and local study rooms without creating an account or submitting personal data to our servers.</p>
            <ul>
              <li><strong>Guest Mode (Default):</strong> Solved problem states, revision bookmarks, personal Markdown notes, activity streaks, favorites, custom sheets, and mock room drafts are stored exclusively in your browser via <code>localStorage</code> and <code>sessionStorage</code>. This data never leaves your device unless you trigger an explicit JSON export or connect a backend instance.</li>
              <li><strong>Authenticated Cloud Sync (Optional):</strong> Where enabled via Firebase Authentication and Neon PostgreSQL, we process your Firebase User ID (<code>uid</code>), email address, display name, preferred locale, problem progress, notes, custom sheets, and linked public handles solely to synchronize your workspace across devices and render your optional public portfolio (<code>/u/:handle</code>).</li>
            </ul>

            <h2>2. Third-Party Coding Profile Aggregation</h2>
            <p>When you voluntarily link public handles for LeetCode, Codeforces, AtCoder, CodeChef, GeeksforGeeks, HackerRank, or GitHub, our server-side sync proxy (<code>/api/profiles/sync</code>) retrieves <strong>publicly available statistics only</strong> (such as solved counts, contest ratings, and public profile URLs). We never request, collect, or store your passwords, session cookies, or private credentials for any third-party platform. Sync responses are cached transiently (up to 30 minutes) to respect upstream rate limits.</p>

            <h2>3. Embedded Media, Content Plugins &amp; Zero Ad Tracking</h2>
            <p>We do not sell personal data, serve behavioral advertisements, or embed third-party ad-tracking pixels. Video walkthroughs load through YouTube&apos;s privacy-enhanced domain (<code>youtube-nocookie.com</code>) or a user-configured player template. External GitHub repositories, Markdown guides, and public technical articles are retrieved through our SSRF-hardened plugin layer, which strips private network targets and enforces strict size and rate limits. Interacting with embedded YouTube players or opening external links remains subject to those providers&apos; respective privacy policies.</p>

            <h2>4. Browser Storage, Telemetry &amp; Cookies</h2>
            <p>{brandName} uses browser <code>localStorage</code> and <code>sessionStorage</code> strictly for essential workspace functionality (theme preference, locale selection, problem progress, viewer navigation history, and room drafts). No third-party marketing cookies are set by {brandName}. Server endpoints log minimal operational metadata (such as transient IP hashes for sliding-window rate limiting under <code>/api/profiles/sync</code> and <code>/api/plugins/fetch</code>) strictly to prevent abuse and protect service availability.</p>

            <h2>5. Data Retention, Portability &amp; Your Legal Rights</h2>
            <p>Consistent with the <strong>EU General Data Protection Regulation (GDPR)</strong>, the <strong>California Consumer Privacy Act / CPRA</strong>, and India&apos;s <strong>Digital Personal Data Protection Act, 2023 (DPDP Act)</strong>, you maintain full control over your data:</p>
            <ul>
              <li><strong>Right of Access &amp; Portability:</strong> Download a complete, machine-readable JSON copy of your entire workspace at any time from <strong>Profile → Export JSON</strong>.</li>
              <li><strong>Right to Erasure (&ldquo;Right to be Forgotten&rdquo;):</strong> Permanently clear all saved progress, bookmarks, notes, and streak history immediately from Settings via <strong>Reset progress</strong>, or clear browser site data. For authenticated cloud accounts, deletion requests purge associated records across all database tables via cascading foreign keys.</li>
              <li><strong>Public Portfolio Opt-In:</strong> Public recruiter portfolios (<code>/u/:handle</code>) expose only stats you explicitly choose to publish.</li>
            </ul>

            <h2>6. Security Safeguards &amp; Children&apos;s Privacy</h2>
            <p>We implement defense-in-depth technical safeguards including HTTPS-only transport, strict CORS origin allowlisting, RS256 JWT bearer verification on authenticated mutations, CIDR/DNS SSRF filtering, and per-IP/per-user rate limiting. {brandName} is intended for students and engineering professionals aged 13 and older (or 16 in jurisdictions requiring higher digital consent age); we do not knowingly collect personal data from children under the applicable threshold.</p>

            <h2>7. Policy Updates &amp; Contact</h2>
            <p>We may update this Privacy Policy to reflect architectural or legal changes; material revisions will update the Effective Date above. For privacy inquiries, data access requests, or grievance redressal under the DPDP Act / GDPR, contact the {ecosystem} team via <a href="https://utkristi-io.netlify.app/" target="_blank" rel="noopener noreferrer">utkristi-io.netlify.app</a> or the official repository issue tracker.</p>
          </div>
          <div className="legal-card-art" aria-hidden="true">
            <div className="legal-art-stage">
              <div className="legal-orbit-ring ring-1" />
              <div className="legal-orbit-ring ring-2" />
              <Mascot mood="shield" size={142} label="Privacy guardian Ember" />
            </div>
            <span className="legal-art-caption">Local-first · Zero ad trackers · GDPR &amp; DPDP ready</span>
          </div>
        </Card>
      </section>
    );
  }

  if (page === 'terms') {
    return (
      <section className="page-section marketing-page">
        <div className="section-heading">
          <div>
            <h1>Terms of Service</h1>
            <p>Effective Date: November 27, {year} · Governing access to {brandName} and its companion tools.</p>
          </div>
        </div>
        <Card variant="outlined" className="legal-card legal-card-split">
          <div className="legal-card-copy">
            <h2>1. Acceptance &amp; Eligibility</h2>
            <p>By accessing or using {brandName} (including the web application, API endpoints, Study Rooms, and the optional CodeGrill Companion browser extension), you agree to be bound by these Terms of Service and our <a href="/privacy" onClick={navHandler(onNavigate, '/privacy')}>Privacy Policy</a>. If you use {brandName} on behalf of an organization or study cohort, you represent that you have authority to bind that entity to these Terms.</p>

            <h2>2. Limited License &amp; Permitted Educational Use</h2>
            <p>Subject to compliance with these Terms, {ecosystem} grants you a personal, non-exclusive, non-transferable, revocable license to access and use {brandName} solely for individual or peer-collaborative technical interview preparation, computer science study, and portfolio organization.</p>

            <h2>3. Acceptable Use &amp; Prohibited Conduct</h2>
            <p>You agree not to misuse {brandName} or its infrastructure. Specifically, you must not:</p>
            <ul>
              <li>Abuse <code>/api/profiles/sync</code>, <code>/api/plugins/fetch</code>, or <code>/api/plugins/transcript</code> as an open web scraper, proxy relay, or automated bulk-harvesting service, or attempt to circumvent rate limits, CORS restrictions, or SSRF protections.</li>
              <li>Probe, scan, or test the vulnerability of any {brandName} server or attempt to access another user&apos;s authenticated progress or profile data without authorization.</li>
              <li>Circumvent paywalls, authentication gates, or technical access controls on any third-party learning platform linked from {brandName}.</li>
              <li>Upload, share, or broadcast unlawful, harassing, defamatory, or infringing content inside Study Rooms or public portfolios (<code>/u/:handle</code>).</li>
            </ul>

            <h2>4. User-Generated Content &amp; Collaborative Rooms</h2>
            <p>You retain full ownership of the personal notes, custom problem sheets, Mermaid diagrams, and interview debriefs you author in {brandName}. Study Rooms may integrate with <a href="https://utkristi-colabs.vercel.app/" target="_blank" rel="noopener noreferrer">Utkristi CoLabs</a> and browser <code>BroadcastChannel</code> sync; anyone holding a room link or ID may join that session, so do not share proprietary employer code, NDA-protected interview prompts, or sensitive personal secrets in shared rooms.</p>

            <h2>5. Third-Party Services &amp; No Affiliation</h2>
            <p>{brandName} links to and surfaces public metadata from independent platforms—including LeetCode, Codeforces, HackerRank, AtCoder, CodeChef, GeeksforGeeks, GitHub, and YouTube. {brandName} is an independent workspace and is <strong>not affiliated with, sponsored by, or endorsed by</strong> any of those platforms. Your use of third-party websites remains governed solely by their respective terms of service.</p>

            <h2>6. Disclaimers &amp; Limitation of Liability</h2>
            <p>{brandName} and all curated roadmaps, study guides, complexity notes, and third-party links are provided strictly on an <strong>&ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo;</strong> basis, without warranties of any kind—express or implied—including merchantability, fitness for a particular purpose, accuracy, or non-infringement. We make no guarantee of job placement, interview outcomes, or uninterrupted availability of external APIs. To the fullest extent permitted by applicable law, {ecosystem} and its contributors shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or loss of data or profits arising from your use of the service.</p>

            <h2>7. Termination, Changes &amp; Governing Law</h2>
            <p>We reserve the right to suspend or restrict API access for any IP address or account violating these Terms or threatening platform stability. We may modify these Terms periodically; continued use after the Effective Date constitutes acceptance. These Terms shall be governed by and construed in accordance with applicable laws of India, without regard to conflict-of-law principles, subject to mandatory consumer protections in your jurisdiction.</p>
          </div>
          <div className="legal-card-art" aria-hidden="true">
            <div className="legal-art-stage">
              <div className="legal-orbit-ring ring-1" />
              <div className="legal-orbit-ring ring-2" />
              <Mascot mood="idle" size={142} label="Ember workspace mascot" />
            </div>
            <span className="legal-art-caption">Clear boundaries · Built for fair study</span>
          </div>
        </Card>
      </section>
    );
  }

  if (page === 'copyright') {
    return (
      <section className="page-section marketing-page">
        <div className="section-heading">
          <div>
            <h1>Copyright, DMCA &amp; Attribution</h1>
            <p>© {year} {ecosystem} / {brandName}. Intellectual property notice, open-source credits, and takedown procedure.</p>
          </div>
        </div>
        <Card variant="outlined" className="legal-card legal-card-split">
          <div className="legal-card-copy">
            <h2>1. Proprietary Platform Rights</h2>
            <p>All original source code, user interface designs, mascot artwork (Ember), prerequisite roadmap DAGs, study room tooling, first-party Markdown study guides, SVG architecture diagrams, and localization strings authored for {brandName} are © {year} {ecosystem} / {brandName}. All rights reserved, as further stated in the repository&apos;s root <code>LICENSE</code> file. No portion of the proprietary platform UI or branding may be redistributed or resold without prior written permission.</p>

            <h2>2. Third-Party Content, Fair Use &amp; Attribution</h2>
            <p>{brandName} acts as an educational index and in-app study reader. We do not claim ownership over linked external problems, open-source repositories, technical articles, or creator videos:</p>
            <ul>
              <li><strong>Open-Source Repositories:</strong> Curated references to public GitHub repositories—including <code>doocs/leetcode</code>, <code>neetcode-gh/leetcode</code>, <code>donnemartin/system-design-primer</code>, <code>ashishps1/awesome-low-level-design</code>, <code>ashishps1/awesome-system-design-resources</code>, and <code>ByteByteGoHq/system-design-101</code>—remain governed by their respective open-source licenses and original authors, with direct source links preserved on every view.</li>
              <li><strong>Video Walkthroughs:</strong> All YouTube videos remain the exclusive intellectual property of their respective creators and are rendered solely via official YouTube embeddable players with clear attribution and links to the original video.</li>
              <li><strong>Trademarks:</strong> LeetCode, Codeforces, HackerRank, AtCoder, CodeChef, GeeksforGeeks, GitHub, YouTube, ByteByteGo, NeetCode, takeUforward (Striver), Blind 75, and Grind 75 are trademarks or community curriculums of their respective owners. Mention herein is purely nominative for educational identification.</li>
            </ul>

            <h2>3. Copyright &amp; DMCA Takedown Procedure</h2>
            <p>{ecosystem} respects intellectual property rights and complies with the U.S. Digital Millennium Copyright Act (17 U.S.C. § 512) and the Indian Copyright Act, 1957. If you believe any link, embedded resource, or text indexed in {brandName} infringes your copyright, please submit a written notice containing:</p>
            <ul>
              <li>Identification of the copyrighted work claimed to have been infringed.</li>
              <li>The exact URL or path within {brandName} where the disputed reference appears.</li>
              <li>Your contact information (name, organization, and email address) and a statement of good-faith belief that the disputed use is not authorized by the copyright owner, its agent, or the law.</li>
              <li>A statement under penalty of perjury that the information in your notice is accurate and that you are authorized to act on behalf of the rights holder.</li>
            </ul>
            <p>Submit notices via <a href="https://utkristi-io.netlify.app/" target="_blank" rel="noopener noreferrer">utkristi-io.netlify.app</a> or the repository&apos;s security/legal contact. Valid takedown requests are reviewed and acted upon promptly, including removing disputed links or cached excerpts where appropriate.</p>

            <h2>4. Open-Source Software Dependencies</h2>
            <p>{brandName} is built with open-source libraries including React, Vite, Lucide Icons, KaTeX, and Mermaid.js, each used in accordance with its respective MIT or open-source license.</p>
          </div>
          <div className="legal-card-art" aria-hidden="true">
            <div className="legal-art-stage">
              <div className="legal-orbit-ring ring-1" />
              <div className="legal-orbit-ring ring-2" />
              <Mascot mood="happy" size={142} label="Ember community mascot" />
            </div>
            <span className="legal-art-caption">DMCA compliant · Full creator attribution</span>
          </div>
        </Card>
      </section>
    );
  }

  return (
    <section className="page-section marketing-page">
      <MarketingHero
        locale={locale}
        title={t.site.helpTitle}
        subtitle={t.site.helpDesc}
        mood="lost"
        caption="Quick answers & study tips"
        actions={(
          <>
            <Button variant="solid" href="/roadmap" onClick={navHandler(onNavigate, '/roadmap')}>
              {t.site.exploreRoadmap} <ArrowRight size={15} aria-hidden="true" />
            </Button>
            <Button variant="outlined" href="/rooms" onClick={navHandler(onNavigate, '/rooms')}>
              {t.site.goToRooms}
            </Button>
          </>
        )}
      />

      <section className="marketing-section">
        <div className="home-section-head">
          <div>
            <h2>Keyboard Shortcuts & Power Workflows</h2>
            <p>Navigate faster across problems, study guides, video walkthroughs, and mock rooms.</p>
          </div>
        </div>
        <div className="help-shortcuts-grid">
          <Card variant="outlined" className="help-shortcut-card">
            <kbd className="rt-kbd">⌘K / Ctrl+K</kbd>
            <strong>Global Search Palette</strong>
            <p>Search all 177 problems, 6 roadmap domains, curated sheets, and interview track modules from anywhere.</p>
          </Card>
          <Card variant="outlined" className="help-shortcut-card">
            <kbd className="rt-kbd">★ Favorite</kbd>
            <strong>Save Any Content</strong>
            <p>Star any roadmap checklist guide, GitHub file, notebook, video, or article inside the viewer to revisit it on /profile.</p>
          </Card>
          <Card variant="outlined" className="help-shortcut-card">
            <kbd className="rt-kbd">Split Mode</kbd>
            <strong>Live Room Scratchpad</strong>
            <p>Draft Markdown, $O(n \log n)$ math, and Mermaid architecture diagrams side-by-side in /rooms and export a .md debrief.</p>
          </Card>
        </div>
      </section>

      <section className="marketing-section">
        <div className="home-section-head">
          <div>
            <h2>Supported In-App Formats</h2>
            <p>Built-in readers automatically format content without forcing tab switches.</p>
          </div>
        </div>
        <div className="help-formats-strip">
          <span><strong>Markdown</strong> · KaTeX &amp; Mermaid</span>
          <span><strong>Jupyter</strong> · .ipynb cells &amp; outputs</span>
          <span><strong>Anki</strong> · .apkg interactive flashcards</span>
          <span><strong>YouTube</strong> · Custom player &amp; transcripts</span>
          <span><strong>GitHub</strong> · Repos, folders, code &amp; images</span>
          <span><strong>Colabs</strong> · Shared live room links</span>
        </div>
      </section>

      <section className="marketing-section">
        <div className="home-section-head">
          <div>
            <h2>Frequently Asked Questions</h2>
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
    </section>
  );
}

export function SiteFooter({ locale = 'en', config, onNavigate }) {
  const t = getMessages(locale);
  const brandName = config?.brand?.name || 'codegrill';
  const ecosystem = config?.brand?.ecosystem || 'Utkristi';
  const ecosystemUrl = 'https://utkristi-io.netlify.app/';
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
          <p>
            <a className="footer-ecosystem-link" href={ecosystemUrl} target="_blank" rel="noopener noreferrer">
              {t.site.footerTagline}
            </a>
          </p>
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
        <span>
          © {new Date().getFullYear()} {brandName} ·{' '}
          <a className="footer-ecosystem-link" href={ecosystemUrl} target="_blank" rel="noopener noreferrer">
            {ecosystem}
          </a>
        </span>
        <div className="footer-legal">
          <a href="/privacy" onClick={navHandler(onNavigate, '/privacy')}>{t.studio.legal.privacy}</a>
          <a href="/terms" onClick={navHandler(onNavigate, '/terms')}>{t.studio.legal.terms}</a>
          <a href="/copyright" onClick={navHandler(onNavigate, '/copyright')}>{t.studio.legal.copyright}</a>
        </div>
      </div>
    </footer>
  );
}
