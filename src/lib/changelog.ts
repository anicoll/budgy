export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.12.0",
    date: "2026-05-17",
    title: "Household super — spouse funds, maximise target & bug fixes",
    changes: [
      "Any super fund can now be marked as belonging to a different person (e.g. spouse) with their own salary, current age, retirement age and SG rate",
      "Spouse / independent funds show an amber badge in the fund list and display their own employer SG note",
      "Accumulation chart switched to calendar year axis — funds with different owner ages now align correctly on the same timeline",
      "Post-retirement balance held as a flat line in the stacked chart instead of collapsing to zero",
      '"Maximise to age 100" button next to monthly income target — computes the highest sustainable monthly withdrawal via binary search of the drawdown simulation',
      "Super drawdown maximise and projection: 9 new unit tests covering real/nominal precision, inflation-factor formula, and the new maximise function",
      "Toggle inputs (switch component) fixed — data selectors now correctly match Radix UI's data-state attribute; all colour rules previously had no effect",
      "Age/number inputs fixed — now uncontrolled (blur-to-commit) so intermediate keystrokes are not rejected by the min/max guard",
    ],
  },
  {
    version: "0.11.0",
    date: "2026-05-17",
    title: "Categories redesign & UX polish",
    changes: [
      "Category management fully redesigned: tabbed card grid (Expense / Income / Transfer) with search, drag-to-reorder, and count badges",
      "Quick-add subcategory inline inside each card — no sheet required; Enter saves, Escape cancels",
      "Category form: live avatar preview, hex colour input, emoji icon field, archived toggle in edit mode",
      "All category dropdowns sorted alphabetically across transactions, budgets and filter bars",
      "Data reset now fully clears super plans, mortgage plans, novated leases and salary settings",
      "Dexie schema simplified to a single version — no more incremental migrations",
    ],
  },
  {
    version: "0.10.0",
    date: "2026-05-16",
    title: "Super drawdown, budget planner uplift & CSV import",
    changes: [
      "Super projector: full retirement drawdown modelling — year-by-year simulation with investment returns and inflation-escalated withdrawals",
      '"Funds last to age" KPI: green (100+), amber (90–99), red (<90); top-up banner shows fortnightly contribution needed to close a shortfall',
      "Drawdown chart: second area chart showing portfolio declining post-retirement, coloured by longevity status",
      'Budget planner: period navigator (← →) to browse past periods, PocketSmith-style rows with progress bar and "$X left / over" framing',
      "Category hierarchy rollup: subcategories aggregate into their parent budget row — no double-counting",
      "CSV import: upload ANZ or CommBank bank exports directly into transactions (drag-and-drop or click to upload)",
      "Dashboard: Spending Insights card comparing current vs prior period spend by category",
      "Sidebar is now fixed — stays visible while scrolling long pages like Transactions and Budgets",
      "Budget mortgage/salary sync banners and row amount updates take effect immediately without a page refresh",
      "Error boundary screens added across all main routes",
    ],
  },
  {
    version: "0.9.0",
    date: "2026-05-15",
    title: "Holistic integration — salary, housing & novated leases",
    changes: [
      "Onboarding now captures annual gross salary and private hospital cover",
      "Salary pre-fills the income budget target using AU FY2024-25 tax estimate (Stage 3 cuts + Medicare + MLS)",
      "Adding 'Rent / Mortgage' to the budget opens a smart dialog: choose renting or mortgage",
      "Mortgage path back-calculates loan balance from repayment + rate + term and pre-fills the Mortgage projector",
      "Novated leases added to Settings (Salary & Tax section): name, annual pre-tax sacrifice, FBT rate (0% EV / 20% / 47% / custom)",
      "Leases reduce taxable income in the take-home estimate; FBT rate adds an after-tax component",
      "System categories (Salary, Rent / Mortgage) show a System badge and cannot be deleted",
      "Settings gains a full Salary & Tax section: edit salary, private health toggle, manage leases, live take-home preview",
    ],
  },
  {
    version: "0.8.0",
    date: "2026-05-14",
    title: "Multi-fund super projector",
    changes: [
      "Super projector supports multiple funds — each with its own balance, return rate, fees, and voluntary contributions",
      "Only one fund is 'active' (receives employer SG from salary); inactive funds grow from returns only",
      "Stacked area chart shows each fund as a distinct coloured band; the stack top equals total balance",
      "Global settings (ages, salary, employer SG %, inflation) shared across all funds",
      "Accordion left panel: expand one fund at a time for editing",
      "Chart and KPI cards fixed for light mode (dynamic dark/light theme detection)",
    ],
  },
  {
    version: "0.7.0",
    date: "2026-05-13",
    title: "Mortgage projector",
    changes: [
      "Mortgage projector: per-period amortisation (weekly / fortnightly / monthly)",
      "Offset account reduces interest-bearing balance each period",
      "Redraw balance tracked — baseline comparison uses original balance (before extra repayments) to show total savings",
      "Interest rate: slider + free-text input for exact entry",
      "Amortisation schedule tab with paginated table (60 rows/page) and cumulative interest column",
      "Interest saved and periods saved shown vs no-offset/extra baseline",
    ],
  },
  {
    version: "0.6.0",
    date: "2026-05-12",
    title: "Super projector",
    changes: [
      "Month-by-month super balance projection to retirement age",
      "AU SG rate (12%), concessional cap ($30K), non-concessional cap ($120K) with breach warnings",
      "Voluntary contributions: monthly / fortnightly / yearly, concessional or non-concessional",
      "Expected return, fees, and inflation assumptions with slider inputs",
      "KPI cards: nominal balance, real balance (today's dollars), estimated monthly drawdown, years to retirement",
    ],
  },
  {
    version: "0.5.0",
    date: "2026-05-10",
    title: "Budget planner redesign",
    changes: [
      "Sorted-style inline budget planner: period tabs (Week / 2 Week / Month / Year), category chip strip, inline amount + frequency editing",
      "Days-based frequency normalisation (FY2024-25): $3,400/mo → $793/wk matches AU app expectations",
      "Quarterly frequency added as a valid budget target frequency",
      "Auto-save on blur for amounts; immediate save on frequency change",
      "Housing smart dialog wired to budget planner",
    ],
  },
  {
    version: "0.4.0",
    date: "2026-03-01",
    title: "Onboarding, settings & PWA",
    changes: [
      "First-run onboarding wizard: theme pick, salary, account creation, sample transaction",
      "Settings page: appearance, preferences, export/import JSON, load demo data, reset",
      "PWA manifest for installable app experience",
      "Export/import round-trips all data; demo data seeds 3 months of sample transactions",
    ],
  },
  {
    version: "0.3.0",
    date: "2026-02-01",
    title: "Dashboard",
    changes: [
      "4 KPI cards: net worth, period income, period spend, savings rate",
      "Net-worth area chart (12-month rolling), cashflow bar chart, category-spend donut",
      "Account strip with sparklines, recent transactions table",
      "AnimatedNumber count-up on KPI values",
    ],
  },
  {
    version: "0.2.0",
    date: "2026-01-15",
    title: "Categories & Transactions",
    changes: [
      "Full category tree with income / expense / transfer types, colour & icon picker",
      "Transaction list with filter bar (account, category, type, date range, search)",
      "Transfer pairing: creating a transfer creates two linked transactions atomically",
      "Balance recompute on every mutation",
      "Bulk categorise and edit actions",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-01-01",
    title: "Foundation & Accounts",
    changes: [
      "Next.js 15 App Router + React 19 + TypeScript strict",
      "Dark-first design system (Tailwind v4, violet/cyan accent palette)",
      "Dexie 4 IndexedDB storage with Repository<T> abstraction for future backend swap",
      "Accounts: create, edit, reorder (drag-and-drop), archive",
      "Shell: collapsible sidebar (desktop), bottom tab bar (mobile), command palette",
    ],
  },
];
