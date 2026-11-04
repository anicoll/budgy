# Agent guide

- `deprecated/budgy-v1/` is the archived personal app. Treat it as read-only: copy code out of it, never edit it in place.
- New code goes in `packages/` and `apps/`. Run `pnpm typecheck`, `pnpm lint` and `pnpm test` from the root before pushing.
- Money is integer cents everywhere in the engine.
