# Budgy 🐧

Budgy is a modern, elegant personal finance and budgeting application supporting both **Online (Cloud Synced)** and **Offline (Local Only)** storage modes. Built with Next.js and TailwindCSS, by default it routes core financial data (accounts, categories, transactions, budgets) to a Go REST API backend, while retaining superannuation and mortgage plans in browser-local storage (IndexedDB). Users can also choose to run completely offline without a backend.

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

## Running with Go Backend API (Online Mode)

Budgy includes a containerized Go REST/JSON backend for centralizing data persistence. By default, the application runs in **Online Mode** and expects the backend API to be running on `http://localhost:8080`.

### 1. Build and Start the Go Backend
Ensure Docker is installed and running, then:

```bash
# 1. Build the backend Docker image using Bazel (OCI image)
make backend-build
# or: pnpm backend:build

# 2. Run the backend container in the background (uses SQLite on host at ./data/budget.db)
make backend-up
# or: pnpm backend:up
```

Verify that the backend is running and listening on port `8080` by following the logs:
```bash
make backend-logs
# or: pnpm backend:logs
```

### 2. Start the Frontend
Start the Next.js development server:

```bash
make dev
# or: pnpm dev
```

The app will start in Online Mode and redirect to the Login screen. 

*Note: Unauthenticated users can choose to bypass login and use **Offline Mode** by clicking the "Skip and use offline" button. Users in Offline Mode can transition to Online Mode via the Settings page, which will wipe local core tables and prompt them to register/login.*

### 3. Stop the Backend
To clean up and stop the backend container:

```bash
make backend-down
# or: pnpm backend:down
```


### Running Quality Checks

Budgy is configured with standard checks to guarantee code health:

- **Typecheck**: `make typecheck`
- **Linter & Formatter**: `make lint` (or auto-fix with `make lint-fix`)
- **Unit Tests**: `make test` (uses Vitest with mocked IndexedDB)
- **All-in-one check**: `make check` (runs typecheck + lint + tests)

## License

This project is private and proprietary.
