# Budgy

Budgy is being rebuilt as a set of free, public financial planning tools for Australians, starting with a mortgage "what if" calculator.

## Status

The tools are live at https://budgy.nicoll.dev/. Every green CI run on `main` deploys the static site to GitHub Pages (`.github/workflows/deploy.yml`), using the repo's Pages custom domain. DNS for nicoll.dev is on Cloudflare, with a `budgy` CNAME to `anicoll.github.io` set to DNS only (grey cloud).

- `packages/engine`: the calculation code (pure TypeScript, integer cents, tested)
- `apps/web`: the public site, one page per tool, static and login-free (`/mortgage`)

## Development

Needs Node 24+ and pnpm 11 (the exact version is pinned in `package.json`; CI uses the same one).

- **Node from nvm, fnm or nodejs.org:** `corepack enable` sets up the pinned pnpm.
- **Node from apt (Ubuntu/Debian, WSL):** the bundled corepack can't write to `/usr/bin` and is too old to run pnpm 11. Install a current corepack in your home folder instead:

  ```bash
  npm config set prefix ~/.local
  npm install -g corepack@latest     # ~/.local/bin must come before /usr/bin in PATH
  corepack enable --install-directory ~/.local/bin
  ```

  Or skip corepack: `curl -fsSL https://get.pnpm.io/install.sh | env PNPM_VERSION=11.28.10 sh -`

Always use pnpm 11 when changing dependencies: it refuses packages published less than a day ago, and a lockfile made with an older pnpm can fail CI.

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm dev     # http://localhost:3000/mortgage
pnpm build   # static site in apps/web/out
```

## The original app

The previous personal budgeting app (Next.js front end, Go backend, bank sync) is archived, unchanged, in [`deprecated/budgy-v1`](deprecated/budgy-v1). It is no longer deployed or built in CI. Its mortgage and super maths will be moved into `packages/engine` as the new tools need it.

To run the archived app, follow [`deprecated/budgy-v1/README.md`](deprecated/budgy-v1/README.md) from inside that folder.
