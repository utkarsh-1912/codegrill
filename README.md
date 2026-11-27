<p align="center">
  <img src="public/codegrill.svg" alt="Codegrill Logo" width="84" height="84" />
</p>

<h1 align="center">Codegrill</h1>

<p align="center">
  <strong>Editorial, multilingual technical interview preparation workspace.</strong><br />
  Connected multi-domain roadmaps, 177+ curated problems across LeetCode, Codeforces &amp; HackerRank, in-app walkthrough &amp; Markdown readers, synced coding platform profiles, and progress analytics.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-ea580c?style=flat-square&logo=react&logoColor=white" alt="React 18" />
  <img src="https://img.shields.io/badge/Vite-6-f97316?style=flat-square&logo=vite&logoColor=white" alt="Vite 6" />
  <img src="https://img.shields.io/badge/Locales-EN%20%7C%20JA%20%7C%20HI%20%7C%20ES%20%7C%20ZH%20%7C%20KO-c2410c?style=flat-square" alt="6 Locales" />
  <img src="https://img.shields.io/badge/CI-GitHub%20Actions-1f1916?style=flat-square&logo=githubactions&logoColor=white" alt="GitHub Actions CI" />
</p>

---

## Highlights

- **6-Domain Interactive Prerequisite Roadmap**
  - **DSA & Algorithms** (18-topic prerequisite DAG connected to 177 problems)
  - **System Design (HLD)** (scalability, caching, sharding, CAP/Raft, queues, classic blueprints)
  - **Low-Level Design (LLD & OOD)** (SOLID, design patterns, machine coding prompts)
  - **SQL & Databases** (window functions, recursive CTEs, B-Tree/LSM internals, ACID & MVCC)
  - **Concurrency & OS** (threads, locks/deadlocks, producer-consumer, event loops, TCP/TLS)
  - **AI Systems & Behavioral** (RAG, agents, evals, STAR storytelling, leadership)
- **Multi-Platform Problem Catalog & Curated Sheets**
  - **177 problems** across **LeetCode (150)**, **Codeforces (15)**, and **HackerRank (12)** with platform filters, difficulty badges, progressive Socratic hints, countdown interview timer, verbal checklist console, and personal notes.
  - **8 curated sheets** (Codegrill 150, Striver A2Z Core, Striver SDE Core, Blind 75, Grind 75 Weekly Planner, FAANG 30, Codeforces Competitive Core, HackerRank Interview Prep Kit) + **Custom Series Builder**.
- **Dedicated Profile & Progress Hub (`/profile`)**
  - Daily challenge, Easy/Medium/Hard mastery split, 28-day activity heatmap & streaks, spaced-repetition revision queue, per-platform and per-domain readiness bars.
  - **Auto-Synced Coding Profiles** for **LeetCode, Codeforces, AtCoder, CodeChef, GeeksforGeeks, HackerRank, and GitHub** with server-side & browser CORS live sync and combined solved count aggregation.
- **In-App Content & Video Plugins**
  - **YouTube Video & Channel Plugin** with YouTube-style overlaid controls (`YT.Player` two-way sync), playback speed, timeline scrubber, and interactive timestamped walkthrough script panel.
  - **GitHub Folder & File Browser** with nested Back/Forward history stack, pagination, and syntax-ready code viewer.
  - **Custom Rich Text / Markdown Interpreter** with HTML `<img>`/`<a>` conversion and full HTML entity decoding (`&quot;`, `&lt;`, `&gt;`, numeric/hex entities).
  - **Web Article Readers** supporting official Medium RSS, Qiita API v2, and DEV.to API.
- **Full 6-Language Localization**
  - Native UI and translated problem titles in **English (`en`)**, **Japanese (`ja`)**, **Hindi (`hi`)**, **Spanish (`es`)**, **Chinese (`zh`)**, and **Korean (`ko`)**, plus light & dark ember themes and Focus mode.

---

## Project Architecture

```text
codegrill/
├── api/
│   └── profiles/sync.js          # Vercel Serverless Function for live profile sync
├── public/
│   ├── codegrill.svg             # Brand emblem & README logo
│   └── favicon.svg               # Browser favicon
├── server/
│   ├── config.mjs                # Environment-driven server configuration
│   ├── index.mjs                 # Node HTTP REST API (/api/*)
│   ├── store.mjs                 # JSON persistence for progress, sheets & profiles
│   └── plugins/                  # YouTube, GitHub, Web/Medium RSS, Transcript & Profile plugins
├── src/
│   ├── main.jsx                  # App shell, clean History API routing, Roadmap & Library
│   ├── ProfilePage.jsx           # Dedicated /profile progress & linked platforms page
│   ├── PlatformProfiles.jsx      # Coding platform linkage, auto-sync & rankings
│   ├── LedgerDashboard.jsx       # Daily challenge, difficulty split & activity heatmap
│   ├── SheetsPage.jsx            # Curated sheets, weekly planner & Custom Series Builder
│   ├── ContentViewer.jsx         # Modal viewer with nested Back/Forward history & pagination
│   ├── ViewerPage.jsx            # Full-page /viewer with immediate Prev/Next playlist
│   ├── CustomVideoPlayer.jsx     # Overlaid YouTube/HTML5 player + synced script drawer
│   ├── RichTextInterpreter.jsx   # XSS-safe Markdown + HTML tag & entity interpreter
│   ├── domainRoadmaps.mjs        # 6-domain technical interview prerequisite DAGs
│   ├── externalProblems.mjs      # Curated Codeforces & HackerRank problem sets
│   ├── profiles.mjs              # Multi-platform profile registry & stats aggregator
│   └── i18n.mjs                  # Complete 6-locale translation tables
├── scripts/
│   ├── check-catalog.mjs         # Catalog, sheets, i18n & plugin contract verifier
│   ├── test-all.mjs              # Unit & store integration test suite
│   └── translate-catalog.mjs     # 6-locale problem title generator
└── .github/workflows/ci.yml      # GitHub Actions CI (Node 20/22 check, test, build & audit)
```

---

## Getting Started

### Prerequisites
- **Node.js 20+** and **npm**

### Install & Run Locally

```bash
npm install
```

Run the frontend dev server (Vite):

```bash
npm run dev
```

Optionally run the full Node.js backend API in a second terminal:

```bash
npm run server
```

Guest progress, notes, and custom sheets stay in browser storage by default. The Node API requires a Firebase ID token for private workspace routes. The Vercel build can serve public catalog, contest, and content routes. Hosted workspace storage requires a database adapter and client sign-in integration. Public portfolios require an explicit publishing flow.

### Verification & Build

```bash
npm run check   # Verify catalog, sheets, 6 locales & plugin contracts
npm test        # Run unit & backend store integration tests
npm run build   # Build production bundle to dist/
```

---

## REST & Serverless Endpoints

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/health` | `GET` | Service status, catalog counts & active plugins |
| `/api/config` | `GET` | Public runtime configuration |
| `/api/catalog` | `GET` | Full merged problem catalog (LeetCode, Codeforces, HackerRank) |
| `/api/daily` | `GET` | Deterministic daily challenge problem |
| `/api/progress` | `GET` / `PUT` / `DELETE` | Load, save, or reset user progress, bookmarks & notes |
| `/api/analytics` | `GET` | Difficulty/topic mastery, streaks & revision queue |
| `/api/sheets` | `GET` / `POST` / `DELETE` | Built-in sheets and custom user series |
| `/api/profiles` | `GET` / `PUT` | Persisted linked coding platform handles & stats |
| `/api/profiles/sync` | `GET` | Live server-side sync (`?platform=leetcode&handle=...`, also deployed on Vercel) |
| `/api/plugins/fetch` | `GET` | In-app plugin extraction (`?url=...&locale=...`) |
| `/api/plugins/transcript` | `GET` | YouTube walkthrough transcript cues (`?videoId=...`) |

---

## CI Pipeline

Every push and pull request runs [.github/workflows/ci.yml](.github/workflows/ci.yml) across **Node.js 20 and 22**:
1. `npm ci`
2. `npm run check`
3. `npm test`
4. `npm run build` + build artifact verification
5. Security hygiene check (verifies no `.env` is tracked + `npm audit`)

---

## License

All rights reserved. See `/terms`, `/privacy`, and `/copyright` inside the app for usage notices and third-party attribution.
