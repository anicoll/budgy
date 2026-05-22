# Budgy 🐧

Budgy is a modern, elegant, and **offline-first** personal finance and budgeting application. Built with Next.js and TailwindCSS, it is designed for privacy-by-default, storing all user financial data locally in the browser using IndexedDB. No servers, no tracking, and no external APIs mean your financial records never leave your device.

## Key Features

- 📊 **Dynamic Dashboard**: Gain a bird's-eye view of your net worth, cash flow, and spending distributions with interactive charts (powered by ApexCharts).
- ✉️ **Envelope Budgeting**: Plan your finances with a flexible budgeting system supporting both period-resets and cumulative envelope modes (sinking funds) for irregular expenses.
- 📅 **Interactive Bill Calendar**: Visualize upcoming bills, expected payouts, and budget-health forecasts over the month.
- 💳 **Account Management**: Track everyday checking, savings, credit cards, investments, loans, cash, and superannuation (retirement) accounts in one consolidated Net Worth ledger.
- 📝 **Transaction Ledger & CSV Import**: View, filter, and search transaction histories, quick-add transactions, and import statements via an interactive CSV mapper.
- 🏡 **Mortgage Simulator**: Forecast your mortgage trajectory by factoring in current interest rates, offset accounts, redraws, and extra repayments.
- 🇦🇺 **Superannuation Projection**: Model employer SG contributions, voluntary concessional/non-concessional savings, fees, and expected returns, with inflation-adjusted retirement drawing forecasts.
- 🔒 **Privacy First & Local Backups**: Secure client-side storage via Dexie.js (IndexedDB). Easily export or import your entire financial state as a JSON file.

## Tech Stack

- **Framework**: Next.js 16 (App Router) & React 19
- **Styling & Components**: TailwindCSS v4, Radix UI Primitives, Lucide Icons
- **Database & Sync**: Dexie.js (IndexedDB wrapper) & TanStack React Query
- **State Management**: Zustand (for light persistent app state)
- **Quality & Testing**: Biome (linting/formatting), Vitest (testing)

## Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org) (v18+) and [pnpm](https://pnpm.io) installed.

### Installation

```bash
make install
# or
pnpm install
```

### Running Locally

To start the development server with Turbopack:

```bash
make dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

### Running Quality Checks

Budgy is configured with standard checks to guarantee code health:

- **Typecheck**: `make typecheck`
- **Linter & Formatter**: `make lint` (or auto-fix with `make lint-fix`)
- **Unit Tests**: `make test` (uses Vitest with mocked IndexedDB)
- **All-in-one check**: `make check` (runs typecheck + lint + tests)

## License

This project is private and proprietary.
