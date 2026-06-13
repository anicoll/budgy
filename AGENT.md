# Developer Agent Guide: Budgy 🤖

Welcome! This document provides a high-level technical overview of the **Budgy** repository to help you understand the architecture, coding patterns, directory structure, and engineering rules quickly.

---

## 1. Tech Stack Overview
- **Core**: Next.js 16 (App Router, Turbopack) & React 19 (Client-only rendering).
- **Styling**: TailwindCSS v4, Radix UI primitives, Lucide Icons.
- **Local Storage**: Dexie.js (IndexedDB wrapper).
- **State & Queries**: TanStack React Query (server-state/DB-state sync) & Zustand (client preferences/theme).
- **Quality Tools**: Biome (Linter/Formatter/Import sorter), Vitest (Unit & Repository testing with `fake-indexeddb`).

---

## 2. Core Architecture: Offline-First & Client-Only
Budgy has **no backend database or server APIs**. It is designed to run completely inside the client's browser.
- **Zero Backend**: All business logic, storage, and page generation happen on the client.
- **Data Layer**:
  - `src/lib/storage/db.ts` defines the IndexedDB database instance (`BudgyDB`) and versioned schemas.
  - `src/lib/storage/repository.ts` defines the generic `Repository<T>` interface.
  - `src/lib/storage/local-repository.ts` implements this interface using Dexie.js.
- **Query Hook Sync**: Each domain module manages reads/writes through custom React Query hooks (e.g., `useQuery`, `useMutation`). This provides caching, reactive updates, and cache invalidation automatically on mutation.
- **Global Settings / Preferences**: Managed using a lightweight Zustand store with local storage persistence (`src/lib/state/prefs-store.ts`).

---

## 3. Directory Structure
Code is organized into feature-driven modules under `src/features/`:

```
src/
├── app/                  # Next.js App Router (Layouts & routing entry points)
│   ├── (app)/            # Authenticated/Onboarded routes
│   └── onboarding/       # Setup Wizard flow
├── components/           # Shared presentation and layout UI elements (shadcn/ui lives here)
├── features/             # Feature domains (Encapsulated module code)
│   ├── [feature_name]/   # e.g., accounts, budgets, mortgage, super, transactions
│   │   ├── components/   # Feature-specific UI elements (e.g., CsvImportSheet, AccountStrip)
│   │   ├── hooks.ts      # Query/Mutation hooks linking components to repository
│   │   ├── repository.ts # Dexie storage queries/manipulations for the feature
│   │   ├── schema.ts     # Zod validation schemas
│   │   ├── types.ts      # Domain interface definitions
│   │   └── utils/        # Calculations & pure business logic (amortization, projections)
├── lib/                  # Shared helper code (currency handling, date logic, DB setup)
└── test/                 # Test environment utilities & setup scripts
```

---

## 4. Key Engineering & Coding Rules

### 💡 Client Boundary & `"use client"`
- Since this application relies on IndexedDB (which accesses the browser's `window` object), ensure pages and components interacting with repositories or stores are client components. Mark them with `"use client"` at the top.

### 💰 Currency & Money
- **Never use floating-point numbers for money.**
- All monetary representations use the custom `Cents` type (which is type-branded `number`).
- Code utilities under `src/lib/money/` must be used for conversion, formatting, and mathematical operations.

### 📅 Dates
- Use ISO date strings (`YYYY-MM-DD` or `YYYY-MM` for monthly plans).
- Use `date-fns` and `date-fns-tz` for manipulation.

### 🗄️ Database Changes (Dexie.js)
- If you modify any entity schema in `types.ts`, check if the IndexedDB indices in `src/lib/storage/db.ts` need updating.
- To modify indices, increment the schema version (`this.version(N)`) in `db.ts` and define upgrade paths or tables if required.

### 🎨 Styling & Design
- Use TailwindCSS classes.
- Use predefined components from `src/components/ui/` (Dialog, Sheet, Button, Input, Table, etc.) rather than writing ad-hoc layout primitives.

### 🔍 Linting & Formatting
- **Do not use ESLint or Prettier.** This project strictly uses **Biome**.
- Run `make lint-fix` to resolve imports, formatting, and linting rules.

### 🗄️ Database & Mock Generation (Do Not Hand-Craft)
- **Do not manually update or write database models, DTOs, or mock repository files.**
- **Go Mock Generation**: The repository uses `vektra/mockery` to generate test mocks. If you add or modify any repository or service interface, regenerate all Go mocks automatically by running:
  ```bash
  go generate ./...
  ```
  from the `backend` directory.
- **SQLC Model Generation**: Database DTOs and queries can be compiled from SQL schemas using:
  ```bash
  make db-generate
  ```
  which runs the `schema-dump` generator and compiles the schema using `sqlc`.

---

## 5. Development & Testing Commands
Use `make` commands to interact with the environment:

| Command | Action |
|---|---|
| `make install` | Installs project dependencies via pnpm. |
| `make dev` | Starts Next.js local development server (Turbopack) on port 3000. |
| `make typecheck` | Validates TypeScript compiler checks without emitting files. |
| `make lint` | Audits the project for lint and formatting issues via Biome. |
| `make lint-fix` | Safe auto-fixes for styling, imports, and layout. |
| `make test` | Runs the full Vitest suite in single-run mode. |
| `make test-watch` | Starts Vitest in watch mode. |
| `make check` | Runs full CI checks (`typecheck` -> `lint` -> `test`). |

---

## 6. Primary Database Schema & Entity Cheatsheet
Below is a fast reference for key objects stored in Dexie:

- **Account** (`accounts` table):
  - `id`: string (UUID/ULID)
  - `name`: string
  - `type`: Everyday checking, savings, credit, investment, loan, cash, super
  - `openingBalance`: Cents
  - `currentBalance`: Cents
  - `archived`: boolean
  - `sortOrder`: number

- **Transaction** (`transactions` table):
  - `id`: string
  - `accountId`: string
  - `categoryId`: string | null
  - `amount`: Cents (positive for income, negative for expense)
  - `date`: ISO string
  - `cleared`: boolean
  - `transferGroupId`: string | null (to pair transfer legs)

- **Category** (`categories` table):
  - `id`: string
  - `name`: string
  - `type`: `income` | `expense` | `transfer`
  - `parentId`: string | null (for subcategories)
  - `system`: boolean (immutable categories like transfers or uncategorized)

- **Budget** (`budgets` table):
  - `id`: string
  - `name`: string
  - `period`: `weekly` | `fortnightly` | `monthly` | `yearly`
  - `targets`: `CategoryTarget[]` (`{ categoryId, amount, frequency, mode: "envelope" | "period", openedAt }`)
  - `active`: boolean
