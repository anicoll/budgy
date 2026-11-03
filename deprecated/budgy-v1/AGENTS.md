# Developer Agent Guide: Budgy

This document is the authoritative guide for developers and coding agents working in the Budgy repository. **All commands go through `make`** — run `make help` for the full list.

---

## Prerequisites

| Tool | Purpose |
|------|---------|
| [Node.js](https://nodejs.org) 18+ | Frontend toolchain |
| [pnpm](https://pnpm.io) | Package manager |
| [Go](https://go.dev) | Backend codegen and vet |
| [Docker](https://www.docker.com) | Local backend container |
| Bazel (via [bazelisk](https://github.com/bazelbuild/bazelisk) or `make bootstrap-bazel`) | Backend build and test |

After cloning:

```bash
make install
```

If Bazel is not on your PATH, bootstrap it once:

```bash
make bootstrap-bazel
```

---

## Makefile Reference

Run `make help` anytime for an up-to-date list. Targets are grouped below.

### Setup

| Command | Description |
|---------|-------------|
| `make install` | Install frontend (pnpm) and backend (go mod) dependencies |
| `make clean` | Remove `.next`, `.turbo`, and coverage output |
| `make reset` | Remove `node_modules` and reinstall |
| `make bootstrap-bazel` | Download Bazelisk to `.bin/bazel` (linux amd64) |

### Local development

| Command | Description |
|---------|-------------|
| `make dev` | Next.js dev server on `:3000` (offline mode) |
| `make dev-api` | Next.js dev server with backend API enabled |
| `make dev-online` | Build backend, start container, then run `dev-api` |
| `make backend-build` | Build backend Docker image via Bazel (`budgeting_system_backend:latest`) |
| `make backend-up` | Build backend image (if needed) and start container |
| `make backend-down` | Stop the backend container |
| `make backend-logs` | Follow backend container logs |

### Quality checks

| Command | Description |
|---------|-------------|
| `make typecheck` | TypeScript check without emitting |
| `make lint` | Biome (frontend) + Go vet (backend) in parallel |
| `make lint-fix` | Auto-fix Biome issues and format Go source |
| `make test` | Vitest (frontend) + Bazel tests (backend) in parallel |
| `make test-watch` | Vitest in watch mode |
| `make build` | Next.js production build + Bazel backend build in parallel |
| `make start` | Build then serve the production frontend |
| `make check` | Full local CI: typecheck, then lint + test + build in parallel |

### Code generation

| Command | Description |
|---------|-------------|
| `make proto-generate` | Regenerate protobuf stubs (`proto/` → `src/gen/`, `backend/internal/gen/`) |
| `make db-generate` | Dump schema and regenerate sqlc models |
| `make mocks-generate` | Regenerate Go test mocks (mockery) |
| `make mappings-generate` | Regenerate sesame mappers |
| `make gen-all` | Run all generators above, then `go fix` |

### UI scaffolding

| Command | Description |
|---------|-------------|
| `make shadcn-add COMP=<name>` | Add a shadcn/ui component |

---

## Local Development Workflows

### Offline mode

All core data stays in the browser (IndexedDB). No backend required.

```bash
make install
make dev
```

Open [http://localhost:3000](http://localhost:3000).

### Online mode (manual)

Start the Go backend, then the frontend with API routing enabled.

```bash
make install
make backend-up      # builds via Bazel, starts Docker on :8080
make dev-api         # frontend talks to http://localhost:8080
```

Stop the backend when done:

```bash
make backend-down
```

### Online mode (one command)

```bash
make install
make dev-online      # backend-up + dev-api
```

Copy `env.local.example` to `.env.local` and set `NEXT_PUBLIC_USE_BACKEND=true` if you prefer env-based configuration over `dev-api`.

---

## Architecture

Budgy supports **hybrid storage**: core financial entities can sync through a Go backend, while some features remain browser-local.

### Frontend (Next.js 16, React 19)

- **Online path**: Accounts, categories, transactions, and budgets route through Connect RPC to the Go backend (`src/lib/api/`).
- **Offline path**: Same entities stored in IndexedDB via Dexie.js (`src/lib/storage/local-repository.ts`).
- **Always local**: Superannuation and mortgage plans stay in IndexedDB regardless of mode.
- **State**: TanStack React Query for server/DB sync; Zustand for preferences and theme.

Key paths:

```
src/
├── app/              # Next.js App Router
├── components/ui/    # shadcn/ui primitives
├── features/         # Feature modules (accounts, budgets, transactions, …)
├── gen/              # Generated protobuf TypeScript (do not edit)
├── lib/
│   ├── api/          # Connect RPC client and API repositories
│   ├── storage/      # IndexedDB setup and repository abstractions
│   └── money/        # Cents type and formatting
└── test/             # Vitest setup
```

### Backend (Go, Bazel)

- Connect RPC services backed by SQLite (via sqlc-generated queries).
- Built and tested through Bazel; Docker image produced by `rules_oci`.
- Key paths:

```
backend/
├── cmd/budgetd/      # Main server entrypoint
├── internal/
│   ├── api/          # Connect RPC handlers
│   ├── domain/       # Domain models and interfaces
│   ├── gen/          # Generated protobuf Go (do not edit)
│   ├── mappings/     # Generated sesame mappers (do not edit)
│   ├── service/      # Business logic
│   └── storage/      # SQLite + sqlc models (do not edit generated files)
└── sqlc.yaml
proto/                # Protobuf source definitions
```

---

## Code Generation Rules

**Never hand-edit generated files.** Regenerate with the appropriate `make` target:

| Generated output | Trigger |
|------------------|---------|
| `src/gen/**` | `make proto-generate` |
| `backend/internal/gen/**` | `make proto-generate` |
| `backend/internal/storage/db/*.go` | `make db-generate` |
| `backend/internal/service/mocks/**` | `make mocks-generate` |
| `backend/internal/domain/mocks/**` | `make mocks-generate` |
| `backend/internal/mappings/*_gen.go` | `make mappings-generate` |

When in doubt, run `make gen-all`.

---

## Engineering Conventions

### Client boundary

Pages and components that touch repositories, stores, or IndexedDB must be client components (`"use client"` at the top).

### Currency

Never use floating-point for money. Use the branded `Cents` type and utilities in `src/lib/money/`.

### Dates

Use ISO date strings (`YYYY-MM-DD` or `YYYY-MM`). Manipulate with `date-fns` and `date-fns-tz`.

### IndexedDB schema changes

When entity shapes change, update indices in `src/lib/storage/db.ts` and bump the Dexie schema version.

### Styling

Use TailwindCSS and components from `src/components/ui/`. Do not add ESLint or Prettier — this project uses **Biome** only. Run `make lint-fix` to auto-fix.

### Feature module layout

```
src/features/[name]/
├── components/
├── hooks.ts
├── repository.ts
├── schema.ts
├── types.ts
└── utils/
```

---

## Entity Cheatsheet (IndexedDB)

Quick reference for offline/local entities:

- **Account**: `id`, `name`, `type`, `openingBalance` (Cents), `currentBalance` (Cents), `archived`, `sortOrder`
- **Transaction**: `id`, `accountId`, `categoryId`, `amount` (Cents), `date`, `cleared`, `transferGroupId`
- **Category**: `id`, `name`, `type` (`income` \| `expense` \| `transfer`), `parentId`, `system`
- **Budget**: `id`, `name`, `period`, `targets`, `active`

---

## Further Reading

- [Basiq sandbox testing credentials](docs/basiq-testing.md)
