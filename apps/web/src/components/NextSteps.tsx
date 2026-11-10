import Link from "next/link";
import type { ToolKey } from "@/lib/saved";
import { tool } from "@/lib/tools";

/**
 * Where people often go next from each tool, and why. Two or three each, so
 * the list stays a suggestion rather than a menu.
 */
export const NEXT: Partial<Record<ToolKey, { to: ToolKey; why: string }[]>> = {
  pay: [
    { to: "budget", why: "Plan where your take-home pay goes." },
    { to: "sacrifice", why: "See what extra super would cost out of each pay." },
    { to: "help", why: "Check whether paying your HELP debt off early is worth it." },
  ],
  budget: [
    { to: "debt", why: "Put what's left over to work on your debts." },
    { to: "mortgage", why: "See what extra on the home loan does." },
    { to: "super-mortgage", why: "Weigh spare cash in super against the mortgage." },
  ],
  sacrifice: [
    { to: "super", why: "See what it adds up to by the time you retire." },
    { to: "super-mortgage", why: "Compare it with extra mortgage repayments." },
  ],
  mortgage: [
    { to: "rates", why: "Check your rate against what lenders offer now." },
    { to: "refinance", why: "See whether switching lenders pays for itself." },
    { to: "super-mortgage", why: "Compare extra repayments with salary sacrifice." },
  ],
  rates: [
    { to: "refinance", why: "Work out if a switch pays back its costs." },
    { to: "fixed", why: "Weigh a fixed rate against staying variable." },
  ],
  refinance: [
    { to: "fixed", why: "Compare fixing with the new lender's variable rate." },
    { to: "mortgage", why: "See how the new rate moves your payoff date." },
  ],
  fixed: [
    { to: "mortgage", why: "Play with extra repayments, which fixed loans often limit." },
    { to: "refinance", why: "See what it costs to switch lenders." },
  ],
  split: [
    { to: "mortgage", why: "See how extra repayments shorten the loan." },
    { to: "budget", why: "Plan the household budget around your shares." },
  ],
  borrow: [
    { to: "buying", why: "Add up stamp duty and the other costs of buying." },
    { to: "mortgage", why: "See what the repayments look like over the loan." },
  ],
  buying: [
    { to: "borrow", why: "Check how much a lender might let you borrow." },
    { to: "mortgage", why: "See the repayments on the loan you'd need." },
  ],
  debt: [
    { to: "budget", why: "Find more each month to put towards your debts." },
    { to: "help", why: "HELP works differently: see if paying it early is worth it." },
  ],
  help: [
    { to: "debt", why: "Plan your other debts, which usually cost more." },
    { to: "pay", why: "See how HELP repayments come out of your pay." },
  ],
  super: [
    { to: "sacrifice", why: "See what extra super costs in take-home pay." },
    { to: "super-mortgage", why: "Compare putting extra into super with the mortgage." },
  ],
  "super-mortgage": [
    { to: "sacrifice", why: "Check the cap and the tax on salary sacrifice." },
    { to: "super", why: "See your whole super balance at retirement." },
  ],
  lease: [
    { to: "pay", why: "See your take-home pay with the lease taken out." },
    { to: "budget", why: "Fit the car into your budget." },
  ],
};

export function NextSteps({ tool: key }: { tool: ToolKey }) {
  const next = NEXT[key];
  if (!next?.length) return null;
  return (
    <div className="mt-4 border-t border-border pt-3">
      <h3 className="mb-2 text-sm font-semibold">Where to next</h3>
      <ul className="space-y-1.5 text-sm">
        {next.map(({ to, why }) => (
          <li key={to}>
            <Link
              href={`${tool(to).href}/`}
              className="font-medium text-accent underline-offset-2 hover:underline"
            >
              {tool(to).name}
            </Link>{" "}
            <span className="text-muted">{why}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
