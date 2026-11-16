# Agent guide

- New code goes in `packages/` and `apps/`. Run `pnpm typecheck`, `pnpm lint` and `pnpm test` from the root before pushing.
- Money is integer cents everywhere in the engine.

## Web platform guidance

- Before writing or changing UI, CSS or client-side JS in `apps/web`, use the Modern Web Guidance skill (from Google Chrome, Edge, Firefox and MDN). Claude Code installs it from `.claude/settings.json`; other agents can run `npx modern-web-guidance@latest install`. Prefer a built-in browser feature over custom JS or a new dependency when the guide says one exists.
- If `npx modern-web-guidance` can't run (no network, or a sandbox blocks it), read the same guides from the installed plugin's `skills/modern-web-guidance/guides` folder, or from https://github.com/GoogleChrome/modern-web-guidance/tree/main/skills/modern-web-guidance/guides.
- Keep React, Next.js, Tailwind and React Aria. Adapt the guides' vanilla HTML/CSS to them rather than replacing a React Aria control with a native one the guide marks as not Baseline yet.
- **Browser support:** Baseline Widely available features need no fallback. Newly available features are fine when the page still works without them (feature-detect or let them degrade). No polyfills.
