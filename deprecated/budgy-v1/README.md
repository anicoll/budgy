# Budgy 🐧

Budgy is a modern personal finance and budgeting application supporting both **Online (cloud synced)** and **Offline (local only)** storage modes. Core financial data (accounts, categories, transactions, budgets) can sync through a Go backend, while superannuation and mortgage plans stay in browser-local storage. Users can also run completely offline without a backend.

## Key Features

- **Dynamic Dashboard** — Net worth, cash flow, and spending charts (ApexCharts)
- **Envelope Budgeting** — Period resets and cumulative envelope (sinking fund) modes
- **Bill Calendar** — Upcoming bills and budget-health forecasts
- **Account Management** — Checking, savings, credit, investment, loan, cash, and super accounts
- **Transaction Ledger & CSV Import** — Search, filter, quick-add, and statement import
- **Mortgage Simulator** — Offset accounts, redraws, and extra repayments
- **Superannuation Projection** — SG contributions, voluntary savings, fees, and retirement forecasts
- **Privacy First** — Local IndexedDB storage with JSON export/import

## Tech Stack

- **Frontend**: Next.js 16, React 19, TailwindCSS v4, Dexie.js, TanStack React Query, Zustand
- **Backend**: Go, Connect RPC, SQLite, Bazel
- **Quality**: Biome, Vitest, Bazel tests

## Quick Start

**Prerequisites:** Node.js 18+, pnpm. See [AGENTS.md](AGENTS.md) for the full toolchain (Go, Docker, Bazel).

```bash
make install
make dev
```

Open [http://localhost:3000](http://localhost:3000).

## Online Mode

To run with the Go backend API on `http://localhost:8080`, see [AGENTS.md — Local Development Workflows](AGENTS.md#local-development-workflows). The quickest path:

```bash
make dev-online
```

## Developer Documentation

All development, testing, and codegen commands are documented in **[AGENTS.md](AGENTS.md)**. Run `make help` for a quick reference.

## License

This project is private and proprietary.
