"use client";

import { type Cents, type CoBorrowResult, calculateBuyOut, validateBuyOut } from "@budgy/engine";
import Link from "next/link";
import { useMemo } from "react";
import { MoneyField, NumberField, SelectField } from "@/components/fields";
import {
  AnswerCard,
  AnswerRow,
  Detail,
  Disclosure,
  EditSheet,
  SummaryRow,
  SummaryRows,
  ToolSection,
  useEditSheet,
} from "@/components/tool";
import { money, moneyExact, perPeriod } from "@/lib/format";
import { objectName, possessive, verb } from "@/lib/names";
import { type BuyOutState, leaverSharePrefill, type SplitState } from "@/lib/splitState";

const card = "rounded-xl border border-border bg-surface p-4 sm:p-5";
const toCents = (dollars: number) => Math.round(dollars * 100) as Cents;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * "Buy out a partner": roughly what changes hands, and the new loan in the
 * keeper's name. Blank inputs follow what the tool already knows.
 */
export function SplitBuyOut({
  state,
  setState,
  result,
}: {
  state: SplitState;
  setState: (f: (s: SplitState) => SplitState) => void;
  result: CoBorrowResult;
}) {
  const { ref: sheet, open: edit } = useEditSheet();
  const { loan, borrowers } = state;
  const two = borrowers.length === 2;
  const keeperId =
    state.buyout && borrowers.some((b) => b.id === state.buyout?.keeperId)
      ? state.buyout.keeperId
      : borrowers[0].id;
  const keeperIdx = Math.max(
    0,
    borrowers.findIndex((b) => b.id === keeperId),
  );
  const leaverIdx = keeperIdx === 0 ? 1 : 0;
  const keeper = borrowers[keeperIdx].name || "Borrower";
  const leaver = borrowers[leaverIdx]?.name || "Borrower";

  const prefill = leaverSharePrefill(result.ownership[0]?.shares, leaverIdx);
  const b = state.buyout;
  const value = b?.value ?? loan.propertyValue;
  const owing = b?.owing ?? loan.balance;
  const share = b?.sharePct ?? prefill ?? 50;

  const set = (patch: Partial<BuyOutState>) =>
    setState((s) => ({ ...s, buyout: { ...s.buyout, keeperId, ...patch } }));

  const input = useMemo(
    () => ({
      value: toCents(value ?? 0),
      loanOwing: toCents(owing),
      leaverSharePct: share,
      annualRate: loan.ratePct / 100,
      termMonths: Math.round(loan.termYears * 12),
      frequency: loan.frequency,
      fortnightlyMethod: loan.fortnightlyMethod,
    }),
    [value, owing, share, loan],
  );
  const errors = validateBuyOut(input);
  const out = errors.length ? null : calculateBuyOut(input);

  const options = borrowers.map((p) => ({
    value: p.id,
    label: `${p.name} ${verb(p.name, "keeps", "keep")} the home, ${verb(p.name, "buys", "buy")} out ${objectName(borrowers.find((q) => q.id !== p.id)?.name ?? "")}`,
  }));
  const per = perPeriod[loan.frequency];

  if (!two) {
    return (
      <div className={card}>
        <p className="text-sm text-muted">
          This works for two borrowers. Remove the others to try a buy-out.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AnswerRow>
        <AnswerCard
          label={`${cap(keeper)} ${verb(keeper, "pays", "pay")} ${objectName(leaver)} about`}
        >
          {!out ? (
            <p className="text-warn">{errors.join(" ")}</p>
          ) : (
            <>
              <p className="num -mt-1 text-4xl leading-none font-bold tracking-tight sm:text-5xl">
                <span data-testid="payout">{money(out.payout)}</span>
              </p>
              <p className="text-lg">
                That&apos;s {share}% of the <strong className="num">{money(out.equity)}</strong>{" "}
                equity. {cap(keeper)} {verb(keeper, "takes", "take")} over a loan of{" "}
                <strong className="num">{money(out.loanTakenOver)}</strong>.
              </p>
              {out.underwater && (
                <p className="text-sm text-warn">
                  The loan is bigger than the home&apos;s value, so there&apos;s no equity to share.
                </p>
              )}
            </>
          )}
        </AnswerCard>
        {out && (
          <div className={`${card} min-w-0 space-y-3 rounded-3xl`}>
            <h2 className="font-semibold">The new loan</h2>
            <dl className="num space-y-2 text-sm">
              <Row k={`Loan ${objectName(keeper)} ${verb(keeper, "takes", "take")} over`}>
                {money(out.loanTakenOver)}
              </Row>
              <Row k={`Plus paying ${objectName(leaver)}`}>{money(out.payout)}</Row>
              <Row k={`New loan in ${possessive(keeper)} name`}>{money(out.newLoan)}</Row>
              <Row k={`Repayment at ${loan.ratePct.toFixed(1)}% over ${loan.termYears} years`}>
                {moneyExact(out.repayment)} {per}
              </Row>
            </dl>
            <div className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm">
              {cap(objectName(keeper))} would need to borrow{" "}
              <strong className="num">{money(out.newLoan)}</strong> alone. Check that against
              &ldquo;How much can I borrow&rdquo; before agreeing a price.
            </div>
            <Link href="/borrow" className="inline-block text-accent underline">
              Check {possessive(keeper)} borrowing power →
            </Link>
          </div>
        )}
      </AnswerRow>

      <ToolSection id="buyout-h" title="Your numbers">
        <SummaryRows>
          <SummaryRow
            title="Who keeps the home"
            hint={`${keeper} ${verb(keeper, "keeps", "keep")} it and ${verb(keeper, "buys", "buy")} out ${objectName(leaver)}`}
            onClick={() => edit("buyout-keeper")}
          />
          <SummaryRow
            title="The home and the equity"
            hint={`${value ? `${money(Math.round(value * 100))} home` : "no value yet"} · ${money(Math.round(owing * 100))} owing · ${share}% share`}
            onClick={() => edit("buyout-home")}
          />
        </SummaryRows>
      </ToolSection>

      <Detail>
        <Disclosure title="What this leaves out" hint="stamp duty, fees and advice">
          <p className="text-sm text-muted">
            Stamp duty on a transfer between co-owners varies by state; some states exempt
            separating couples. Legal and lender fees aren&apos;t included. General information
            only, not financial or legal advice.
          </p>
        </Disclosure>
      </Detail>

      <EditSheet ref={sheet} title="Buy out a partner">
        <div id="buyout-keeper" className="scroll-mt-20">
          <SelectField
            label="Who keeps the home"
            value={keeperId}
            options={options}
            onChange={(id) => set({ keeperId: id })}
          />
        </div>
        <div id="buyout-home" className="scroll-mt-20 space-y-3">
          <MoneyField
            label="What the home is worth now"
            hint="A valuation or recent sales nearby."
            optional
            value={value}
            onChange={(v) => set({ value: v })}
          />
          <MoneyField
            label="Loan owing now"
            hint={b?.owing === undefined ? "From the loan on the Share the loan tab." : undefined}
            value={owing}
            onChange={(v) => set({ owing: v ?? 0 })}
          />
          <NumberField
            label={`${cap(possessive(leaver))} share of the equity`}
            hint={
              b?.sharePct === undefined && prefill !== undefined
                ? "From the split on the Share the loan tab. You can change it."
                : "Agree this between you."
            }
            suffix="%"
            min={0}
            max={100}
            step={0.5}
            value={share}
            onChange={(v) => v !== undefined && set({ sharePct: v })}
          />
        </div>
      </EditSheet>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt>{k}</dt>
      <dd>{children}</dd>
    </div>
  );
}
