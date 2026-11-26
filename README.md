# Codegrill

Codegrill is a deployable interview-preparation app built with React, Vite, and `@utkristi/ui`. Its DSA catalog covers the full NeetCode 150. The separate interview tracks come from the supplied dataset.

## Deploy to Vercel

Set the Vercel project's root directory to `codegrill` if the Git repository contains that folder. For a repository rooted at Codegrill, use the repository root. The checked-in configuration runs `npm ci`, validates the catalog, and builds the Vite app into `dist/`. Builds read the checked-in catalog and need no content API credentials. [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)

The optional `VITE_COLLAB_ROOMS_URL` environment variable overrides the Colabs lobby for preview or production deployments. Set it to an HTTPS Colabs deployment before the build. The default points at the supplied Utkristi Colabs deployment. See [.env.example](.env.example).

## Utkristi Colabs rooms

Open **Study rooms** or select **Study in Colabs** from a problem. Codegrill starts a new Colabs room or joins an existing one using an ID or invitation. Colabs handles collaboration and any identity prompts at `/editor/:roomId`. To share the problem with a participant, copy the problem link from Codegrill and send it in the room. [Utkristi Colabs](https://utkristi-colabs.vercel.app/)

## Update the roadmap

```sh
npm ci
npm run import:roadmap
npm run check
npm run verify:directories
```

`import:roadmap` fetches the pinned upstream metadata and repository trees, validates full coverage, and writes `src/roadmap.generated.json`. Run `npm run import:roadmap -- --refresh` to evaluate the current upstream revisions. Review the data diff before committing it. The importer records the revisions and copies the upstream MIT notice into `public/licenses/`. [NeetCode metadata and solution repository](https://github.com/neetcode-gh/leetcode) · [Doocs solution directory](https://github.com/doocs/leetcode/tree/main/solution)

- All 150 problems have a practice link, an English walkthrough, English and Chinese written solutions, and links to available source files. Topic prerequisites follow Codegrill's study order.
- The directory includes upstream catalogs, programming-language folders, and the supplied channels and study hubs across six content languages. The supplied localized titles and resources enrich the original 15 problems. Other titles fall back to English.
- `verify:directories` checks HTTP accessibility for the directory URLs. It reports site restrictions and timeouts. Playback and editorial accuracy require separate review.

## Development

Run `npm ci`, then `npm run dev`. Use `npm run build` for a production bundle.

Codegrill currently uses browser storage for language and progress. The architecture guide's Firebase and Neon design can support account sync. A separate Judge0 service can support asynchronous code execution once problem statements, starter files, and test fixtures are available. [Firebase ID tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens) · [Neon connection pooling](https://neon.com/docs/connect/connection-pooling) · [Judge0 API](https://ce.judge0.com/docs)
