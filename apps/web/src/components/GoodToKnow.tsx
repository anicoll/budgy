import { IdeasIcon } from "@/components/Icons";
import { NextSteps } from "@/components/NextSteps";
import type { ToolKey } from "@/lib/saved";

const ext = "text-accent underline-offset-2 hover:underline";

const NDH = (
  <a href="https://ndh.org.au/" target="_blank" rel="noopener noreferrer" className={ext}>
    National Debt Helpline
  </a>
);
const MONEYSMART = (
  <a href="https://moneysmart.gov.au/" target="_blank" rel="noopener noreferrer" className={ext}>
    Moneysmart
  </a>
);

/**
 * General tips shown under each tool's results: what the tool leaves out and
 * things worth knowing or checking. General information, never advice about
 * what a person should do with their money.
 */
export const TIPS: Partial<Record<ToolKey, React.ReactNode[]>> = {
  debt: [
    <>
      This planner works on the numbers you enter. It doesn&apos;t model annual fees, interest-free
      days on purchases or a debt consolidation loan. A balance transfer card often charges a higher
      rate on new purchases, so many people avoid using it for spending.
    </>,
    <>
      Avalanche usually costs the least interest. Snowball gives you quicker wins. The plan that
      works is the one you keep up, so pick the order you&apos;ll stick with.
    </>,
    <>
      Lenders count your whole credit card limit when you apply for a loan, even if the balance is
      $0. Lowering or closing a card you&apos;ve cleared can lift your borrowing power.
    </>,
    <>
      Finding repayments hard? Your lender has to consider a hardship request, and the {NDH} (1800
      007 007) offers free, confidential financial counselling.
    </>,
  ],
  mortgage: [
    <>
      This compares the numbers only. It doesn&apos;t include fees, or limits your loan may put on
      extra repayments. Most variable loans allow unlimited extras; fixed loans often cap them.
    </>,
    <>
      Money in an offset saves about the same interest as an extra repayment, and stays easy to take
      out. Extra repayments usually sit in redraw, which some lenders can limit or charge for.
    </>,
    <>
      When your rate drops, your lender may lower your repayment. Asking to keep it the same is a
      simple way to pay the loan off sooner.
    </>,
    <>
      Interest saved in an offset isn&apos;t taxed, so it&apos;s worth more than the same rate in a
      savings account.
    </>,
  ],
  rates: [
    <>
      Averages cover every lender and every borrower. Your deposit, loan size and whether
      you&apos;re on a package can all move the rate you&apos;re offered.
    </>,
    <>
      Before you call your lender, have your balance, your rate and a rate from another lender
      handy. Asking for a rate review is common, and you don&apos;t have to switch to ask.
    </>,
    <>
      The rate isn&apos;t everything. Compare fees, an offset account and how extra repayments work
      too.
    </>,
  ],
  refinance: [
    <>
      Before you apply, check your discharge fee, the government fees to register the new mortgage,
      and break costs if any of your loan is fixed.
    </>,
    <>
      A new loan means a new credit check. If you&apos;re borrowing more than 80% of the home&apos;s
      value, you may pay lenders mortgage insurance again.
    </>,
    <>
      Cashback offers often come with conditions, like a minimum loan size or settling by a set
      date. Read them before you count the cashback.
    </>,
    <>
      Resetting to a new 30-year term lowers your repayment but can add years and interest. Keeping
      your repayment the same avoids that.
    </>,
    <>Your current lender may match the offer, so it can be worth asking them first.</>,
  ],
  fixed: [
    <>Nobody knows where rates will go. The paths here are what-ifs to test, not a forecast.</>,
    <>
      Fixed loans often cap extra repayments each year and usually don&apos;t have an offset. Check
      the limits on the loan you&apos;re offered.
    </>,
    <>
      The fixed rate you&apos;re quoted can change before your loan settles. Some lenders offer a
      rate lock for a fee.
    </>,
    <>
      Splitting the loan is one way to get some certainty on repayments while keeping an offset and
      extra repayments on the variable part.
    </>,
  ],
  split: [
    <>
      To the bank, co-borrowers are usually each responsible for the whole loan, whatever you agree
      between yourselves.
    </>,
    <>
      How you hold the title (joint tenants or tenants in common) changes what happens to each
      share. A conveyancer or lawyer can explain the difference.
    </>,
    <>
      A written agreement on who paid what, and what happens if you sell or split up, can save a lot
      of stress later. Keep records of extra repayments and offset money too.
    </>,
  ],
  borrow: [
    <>
      This is what a lender might lend, not what&apos;s comfortable. Think about the repayment
      you&apos;d be happy with if rates rose or your income changed.
    </>,
    <>
      Lenders check your real spending in recent bank statements, so the months before you apply
      matter.
    </>,
    <>
      Each loan application is recorded on your credit file. Getting a clear idea of what you can
      borrow first can mean fewer applications.
    </>,
    <>
      With less than a 20% deposit you&apos;ll usually pay lenders mortgage insurance, unless you
      qualify for the government&apos;s Home Guarantee Scheme.
    </>,
  ],
  buying: [
    <>
      Duty and concessions change often and differ by state. Check with your state revenue office or
      conveyancer before you sign.
    </>,
    <>
      Leave room for moving costs, connecting utilities and the council and water rates you pay back
      to the seller at settlement.
    </>,
    <>
      First home concessions and grants often require you to move in within a set time and live
      there for a while.
    </>,
    <>
      Sales at auction are usually unconditional, with no cooling-off period. Get finance approval
      and inspections done before auction day.
    </>,
  ],
  pay: [
    <>
      Your pay slip tax is an estimate. What you actually owe is settled when you lodge your tax
      return.
    </>,
    <>
      Work-related deductions aren&apos;t included here. They can lower your tax and lift your
      refund at tax time.
    </>,
    <>
      Got two jobs? Usually you claim the tax-free threshold from only one employer, or you could
      end up with a tax bill.
    </>,
    <>You can check your employer is paying your super in your fund&apos;s app or through myGov.</>,
  ],
  budget: [
    <>
      The 50/30/20 split is a rule of thumb, not a target. What matters is that what goes out fits
      what comes in.
    </>,
    <>
      Setting aside a little each pay for quarterly and yearly bills, in a separate account, stops
      them catching you out.
    </>,
    <>Many people aim to build a buffer of a few months&apos; essential spending for surprises.</>,
    <>Subscriptions and small regular costs add up. Check them every few months.</>,
    <>{MONEYSMART}, from ASIC, has free guides on budgeting and saving.</>,
  ],
  sacrifice: [
    <>
      Your employer&apos;s contributions count towards the same cap. Going over it means the extra
      is taxed at your marginal rate.
    </>,
    <>
      Super is locked away until you reach preservation age (60) and meet a condition of release,
      like retiring.
    </>,
    <>
      If your super balance was under $500,000 on 30 June, you may be able to use cap you
      didn&apos;t use in the last five years.
    </>,
    <>
      Your employer can&apos;t cut their super guarantee because you salary sacrifice. It&apos;s
      worked out on your pay before the sacrifice.
    </>,
  ],
  "super-mortgage": [
    <>
      Super returns go up and down. Paying off the loan saves its interest rate, which is known
      while your rate stays the same.
    </>,
    <>
      Money in super is locked away until preservation age. Money in an offset or redraw is there if
      you need it.
    </>,
    <>
      Everyone&apos;s employer contributions count towards their concessional cap, so check how much
      room is left before you sacrifice more.
    </>,
  ],
  super: [
    <>
      Fees and your investment option make a big difference over decades. The ATO&apos;s YourSuper
      comparison tool compares MySuper products.
    </>,
    <>
      Several funds can mean several sets of fees and insurance. You can find and combine super in
      myGov, but check what insurance you&apos;d lose first.
    </>,
    <>
      The return you enter is an assumption. Real returns rise and fall, sometimes a lot, from year
      to year.
    </>,
    <>
      The Age Pension estimate is a rough guide. Services Australia&apos;s own estimator, or a free
      chat with their Financial Information Service, can look at your situation in more detail.
    </>,
  ],
  help: [
    <>
      Lenders count HELP repayments when working out how much you can borrow, so clearing it can
      lift your borrowing power.
    </>,
  ],
  lease: [
    <>
      If you leave your job, the lease usually passes to you, and the payments come out of your
      after-tax pay. Check what your employer&apos;s scheme does.
    </>,
    <>At the end of the lease you pay the residual to keep the car, or refinance or sell it.</>,
    <>
      Quotes often bundle everything into one payment. Ask for the interest rate, fees and running
      cost budgets separately so you can compare.
    </>,
    <>
      Reportable fringe benefits show on your income statement and can count for things like HELP
      repayments, the Medicare levy surcharge and some government payments.
    </>,
  ],
};

/** A "Good to know" card of general tips for a tool, plus the general-information line. */
export function GoodToKnow({
  tool,
  extra = [],
}: {
  tool: ToolKey;
  /** Tips that depend on the inputs, shown before the general ones. */
  extra?: React.ReactNode[];
}) {
  const tips = [...extra, ...(TIPS[tool] ?? [])];
  if (!tips.length) return null;
  return (
    <section
      aria-labelledby={`tips-${tool}`}
      className="rounded-xl border border-border bg-surface p-4 sm:p-5"
    >
      <h2 id={`tips-${tool}`} className="mb-2 flex items-center gap-2 font-semibold">
        <IdeasIcon size={20} className="text-accent" />
        Good to know
      </h2>
      <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed">
        {tips.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">
        General information only, not financial advice. It doesn&apos;t take your circumstances into
        account.
      </p>
      <NextSteps tool={tool} />
    </section>
  );
}
