You are working on Lanternfall, a Devvit Web game that runs inside Reddit posts.

## Tech stack

- **Frontend**: TypeScript and Vite, no framework. The game itself is a canvas engine in plain JavaScript (`src/client/game/engine.js`) with its types in `engine.d.ts`.
- **Backend**: Devvit serverless Node, Hono routes, Redis for storage.

## Layout

- `src/server`: Hono app. `routes/api.ts` serves the game, `routes/menu.ts`, `routes/triggers.ts` and `routes/scheduler.ts` are Reddit hooks. `core/store.ts` owns every Redis key.
- `src/client`: `splash.html` is the inline post shown in the feed (keep it light). `game.html` is the expanded game.
- `src/shared`: rules shared by both sides: nights, modifiers, votes and scoring (`night.ts`) and API types (`api.ts`).

## Rules

- Use `navigateTo`, `showToast` and `exitExpandedMode` from `@devvit/web/client` instead of browser navigation and alerts.
- Every new menu item, trigger or scheduled task needs its endpoint mapped in `devvit.json`.
- Do not use `@devvit/public-api` or blocks; this project is Devvit Web only.
- Gameplay randomness that affects fairness (spawns, cards, drops) must come from the night's seeded generator, not `Math.random`.

## Commands

- `npm run test:types`, `npm run lint`, `npm run test:unit`, `npm run build`
- `npm run dev` playtests on Reddit, `npm run deploy` uploads a new version.

Docs: https://developers.reddit.com/docs/llms.txt
