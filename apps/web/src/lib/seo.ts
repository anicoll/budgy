import type { Metadata } from "next";
import type { ToolKey } from "./saved";
import { tool } from "./tools";

export const SITE_URL = "https://budgy.nicoll.dev";
export const SITE_NAME = "budgy";
export const SITE_TITLE = "budgy: free Australian money calculators";
export const SITE_DESCRIPTION =
  "Free, private financial calculators for Australians: take-home pay, budget, mortgage, borrowing power, stamp duty, HELP, super and novated lease. No sign-up, and your numbers never leave your device.";

/**
 * The share card from app/opengraph-image.png. A page that sets openGraph loses
 * the file-based image, so pageMetadata names it again.
 */
const SHARE_IMAGE = {
  url: "/opengraph-image.png",
  width: 1200,
  height: 630,
  type: "image/png",
  alt: "budgy: free money tools for Australians. Pay, mortgage, super and debt calculators at budgy.nicoll.dev. Every nickel counts.",
};

/**
 * What each tool page says to search engines. The titles lead with the words
 * Australians search for ("calculator", "HECS", "stamp duty"), which aren't
 * always the friendly names the site uses.
 */
export const TOOL_SEO: Record<ToolKey, { title: string; description: string }> = {
  pay: {
    title: "Pay calculator Australia: take-home pay after tax",
    description:
      "What you take home each week, fortnight or month after tax, Medicare and HELP. Uses the ATO's current rates and withholding tables, with overtime, salary sacrifice and packaging. Free and private.",
  },
  budget: {
    title: "Budget planner Australia: free budget calculator",
    description:
      "A budget that starts from your real take-home pay after tax. Enter bills weekly, monthly, quarterly or yearly and see where every dollar goes. Free, no sign-up, and private.",
  },
  sacrifice: {
    title: "Salary sacrifice calculator: super tax savings",
    description:
      "How much extra super salary sacrifice really costs in take-home pay, the tax it saves and the cap room left, for one person or a whole household. Uses the ATO's current rates. Free and private.",
  },
  mortgage: {
    title: "Mortgage extra repayment and offset calculator",
    description:
      "How much sooner could you own your home? Try extra repayments, offset savings, lump sums and rate changes, and see your new payoff date and interest saved. Built for Australian home loans.",
  },
  rates: {
    title: "Am I paying too much? Home loan rate check",
    description:
      "Compare your home loan rate with the Reserve Bank's average rates for new and existing loans, and see what the gap costs you each month and over the loan.",
  },
  refinance: {
    title: "Refinance calculator: is switching home loans worth it?",
    description:
      "Is switching home loans worth it after fees and cashback? See when a lower rate pays for itself and how far ahead you'd be. Built for Australian home loans.",
  },
  fixed: {
    title: "Fixed vs variable home loan calculator",
    description:
      "Should you fix your home loan, stay variable or split it? Test a path for interest rates and see what fixing all or part of your loan saves or costs. Built for Australian home loans.",
  },
  split: {
    title: "Co-borrower home loan split calculator",
    description:
      "Sharing a home loan? Split it by share, see what each borrower pays, what extra repayments do for the person who makes them, and who owns how much. Free and private, built for Australian home loans.",
  },
  borrow: {
    title: "Borrowing power calculator: how much can I borrow?",
    description:
      "An estimate of what an Australian lender would lend you: take-home pay after tax, living costs, card limits and other debts, tested at your rate plus APRA's 3% buffer. Shows the range across lenders. Free and private.",
  },
  buying: {
    title: "Stamp duty calculator and home buying costs, every state",
    description:
      "Stamp duty, first home buyer concessions, mortgage insurance and fees for every Australian state, and the cash you need by settlement. Updated for 2026-27.",
  },
  debt: {
    title: "Debt payoff calculator: avalanche vs snowball",
    description:
      "Credit cards, car and personal loans: see which debt to pay first, compare avalanche and snowball, and find your debt-free date. Free, private, built for Australians.",
  },
  help: {
    title: "HELP (HECS) debt calculator: should I pay it off early?",
    description:
      "Should you make a voluntary HELP or HECS repayment or keep the money in your offset or savings? Uses the ATO's indexation rates and repayment thresholds. Free and private.",
  },
  super: {
    title: "Super calculator: how much super at retirement?",
    description:
      "How much super will you have at retirement, and what income could it pay? Add your whole household and every fund. Uses this year's ATO super guarantee rate and caps. Free and private.",
  },
  "super-mortgage": {
    title: "Super or mortgage calculator: where should spare cash go?",
    description:
      "Should spare cash go on the home loan or into super through salary sacrifice? Compare both for your whole household, at retirement and every year before. Uses this year's ATO tax and super rules. Free and private.",
  },
  lease: {
    title: "Novated lease calculator: the real cost after tax",
    description:
      "What a novated lease really costs out of your pay, with the EV FBT exemption, GST savings and the employee contribution method, compared with a car loan or paying cash. Uses the ATO's current rates. Free and private.",
  },
};

/** The trailing-slash form every page is exported at, so canonicals match the served URL. */
export function pagePath(href: string): string {
  return href === "/" ? "/" : `${href.replace(/\/$/, "")}/`;
}

/**
 * Metadata for one page: its title and description, and a canonical URL plus
 * Open Graph and Twitter tags that all agree with them. Next.js replaces the
 * layout's openGraph object rather than merging it, so every field is set here.
 */
export function pageMetadata(p: {
  path: string;
  title: string;
  description: string;
  /** Use the title as is, without the "· budgy" suffix. */
  absoluteTitle?: boolean;
}): Metadata {
  const path = pagePath(p.path);
  const shareTitle = p.absoluteTitle ? p.title : `${p.title} · budgy`;
  return {
    title: p.absoluteTitle ? { absolute: p.title } : p.title,
    description: p.description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      url: path,
      siteName: SITE_NAME,
      locale: "en_AU",
      title: shareTitle,
      description: p.description,
      images: [SHARE_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description: p.description,
      images: [SHARE_IMAGE],
    },
  };
}

export function toolMetadata(key: ToolKey): Metadata {
  return pageMetadata({ path: tool(key).href, ...TOOL_SEO[key] });
}

type JsonLd = Record<string, unknown>;

/** schema.org data for a tool page: the calculator itself, and where it sits on the site. */
export function toolJsonLd(key: ToolKey): JsonLd {
  const t = tool(key);
  const url = `${SITE_URL}${pagePath(t.href)}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": `${url}#app`,
        name: t.name,
        url,
        description: TOOL_SEO[key].description,
        applicationCategory: "FinanceApplication",
        operatingSystem: "Any",
        browserRequirements: "Requires JavaScript",
        inLanguage: "en-AU",
        isAccessibleForFree: true,
        areaServed: { "@type": "Country", name: "Australia" },
        offers: { "@type": "Offer", price: "0", priceCurrency: "AUD" },
        isPartOf: { "@id": `${SITE_URL}/#website` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE_NAME, item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: t.name, item: url },
        ],
      },
    ],
  };
}

/** schema.org data for the home page: the site, and who runs it. */
export function siteJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    alternateName: "budgy money tools",
    url: `${SITE_URL}/`,
    description: SITE_DESCRIPTION,
    inLanguage: "en-AU",
  };
}

/** JSON for a <script type="application/ld+json">, safe to inline in HTML. */
export function jsonLdString(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
