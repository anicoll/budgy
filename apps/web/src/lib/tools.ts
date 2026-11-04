import type { ToolKey } from "./saved";

export type Area = "pay" | "home" | "buying" | "debt" | "super" | "car";

export interface Tool {
  key: ToolKey;
  /** Route from the site root, without the base path. Use with next/link. */
  href: string;
  name: string;
  blurb: string;
  area: Area;
}

export const AREAS: { area: Area; name: string }[] = [
  { area: "pay", name: "Pay and budget" },
  { area: "home", name: "Home loan" },
  { area: "buying", name: "Buying a home" },
  { area: "debt", name: "Debt and HELP" },
  { area: "super", name: "Super" },
  { area: "car", name: "Car" },
];

/** Every tool on the site, in the order the full list shows them. */
export const TOOLS: Tool[] = [
  {
    key: "pay",
    href: "/pay",
    name: "Pay calculator",
    blurb: "Your take-home pay after tax, Medicare and HELP, and what your pay slip will show.",
    area: "pay",
  },
  {
    key: "budget",
    href: "/budget",
    name: "Budget planner",
    blurb: "Start from your take-home pay, add your bills and see where every dollar goes.",
    area: "pay",
  },
  {
    key: "sacrifice",
    href: "/salary-sacrifice",
    name: "Salary sacrifice check",
    blurb: "What extra salary sacrifice costs in take-home pay, the tax it saves and the cap left.",
    area: "pay",
  },
  {
    key: "mortgage",
    href: "/mortgage",
    name: "Mortgage what-if",
    blurb: "How extra repayments, your offset, lump sums or a rate change move your payoff date.",
    area: "home",
  },
  {
    key: "rates",
    href: "/rate-check",
    name: "Am I paying too much?",
    blurb:
      "Compare your home loan rate with the Reserve Bank's averages and see what the gap costs.",
    area: "home",
  },
  {
    key: "refinance",
    href: "/refinance",
    name: "Refinance check",
    blurb: "Is switching to a lower rate worth it after fees and cashback?",
    area: "home",
  },
  {
    key: "fixed",
    href: "/fixed-vs-variable",
    name: "Fixed or variable",
    blurb: "Test a rate path and see what fixing all or part of your loan saves or costs.",
    area: "home",
  },
  {
    key: "split",
    href: "/split",
    name: "Co-borrower split",
    blurb: "Sharing a home loan? See what each of you pays and who owns how much.",
    area: "home",
  },
  {
    key: "borrow",
    href: "/borrow",
    name: "How much can I borrow?",
    blurb: "What a bank would likely lend you, tested the way lenders do.",
    area: "buying",
  },
  {
    key: "buying",
    href: "/buying-costs",
    name: "Home buying costs",
    blurb: "Stamp duty, first home buyer concessions, mortgage insurance and fees in every state.",
    area: "buying",
  },
  {
    key: "debt",
    href: "/debt",
    name: "Debt payoff planner",
    blurb: "Credit cards, car and personal loans: which to pay first and when you'll be debt-free.",
    area: "debt",
  },
  {
    key: "help",
    href: "/pay-off-help",
    name: "Pay off HELP early?",
    blurb: "Should a lump sum go on your HELP debt or in your offset or savings?",
    area: "debt",
  },
  {
    key: "super",
    href: "/super",
    name: "Super at retirement",
    blurb: "How much super your household will have, and what income it could pay.",
    area: "super",
  },
  {
    key: "super-mortgage",
    href: "/super-or-mortgage",
    name: "Super or mortgage?",
    blurb: "Should spare cash go on the home loan or into super? See which comes out ahead.",
    area: "super",
  },
  {
    key: "lease",
    href: "/novated-lease",
    name: "Novated lease calculator",
    blurb: "What a car really costs out of your pay on a novated lease, against a loan or cash.",
    area: "car",
  },
];

const BY_KEY = new Map(TOOLS.map((t) => [t.key, t]));

export function tool(key: ToolKey): Tool {
  const t = BY_KEY.get(key);
  if (!t) throw new Error(`unknown tool ${key}`);
  return t;
}
