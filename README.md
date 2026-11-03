# Budgy

Budgy is being rebuilt as a set of free, public financial planning tools for Australians, starting with a mortgage "what if" calculator.

## Status

The calculation engine is in place; the web app comes next.

- `packages/engine`: the calculation code (pure TypeScript, integer cents, tested)
- `apps/web` (next): the public site, one page per tool, static and login-free

## Development

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
```

## The original app

The previous personal budgeting app (Next.js front end, Go backend, bank sync) is archived, unchanged, in [`deprecated/budgy-v1`](deprecated/budgy-v1). It is no longer deployed or built in CI. Its mortgage and super maths will be moved into `packages/engine` as the new tools need it.

To run the archived app, follow [`deprecated/budgy-v1/README.md`](deprecated/budgy-v1/README.md) from inside that folder.
