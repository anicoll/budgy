"use client";

import {
  type CarKind,
  calculateNovatedLease,
  compareLeases,
  type NovatedLeaseResult,
  validateLease,
} from "@budgy/engine";
import { useMemo } from "react";
import { MoneyField, SelectField } from "@/components/fields";
import { money, moneyExact } from "@/lib/format";
import {
  type AltCar,
  altCar,
  type LeasePer,
  type LeaseState,
  toLeaseInput,
  withAltCar,
} from "@/lib/leaseState";

const card = "rounded-xl border border-border bg-surface p-4 sm:p-5";
const KINDS: { value: CarKind; label: string }[] = [
  { value: "ev", label: "Electric" },
  { value: "phev", label: "Plug-in hybrid" },
  { value: "ice", label: "Petrol or diesel" },
];
const KIND_NAME: Record<CarKind, string> = {
  ev: "electric",
  phev: "plug-in hybrid",
  ice: "petrol or diesel",
};
const PER: Record<LeasePer, { text: string; pays: number }> = {
  weekly: { text: "week", pays: 52 },
  fortnightly: { text: "fortnight", pays: 26 },
  monthly: { text: "month", pays: 12 },
};

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}

function fbtCell(r: NovatedLeaseResult) {
  if (r.fbt.treatment === "exempt") return "$0, exempt";
  if (r.fbt.reason === "ev-over-cap") return "Over the EV price limit, so taxed";
  if (r.fbt.treatment === "discounted") return "Part paid from after-tax pay";
  return "Paid from after-tax pay";
}

/** One live line for the "Compare a second car" idea card. */
export function compareLine(state: LeaseState, result: NovatedLeaseResult): string | null {
  const alt = altCar(state);
  const second = (() => {
    const input = toLeaseInput(withAltCar(state));
    return validateLease(input).length ? null : safe(() => calculateNovatedLease(input));
  })();
  if (!second) return null;
  const per = PER[state.show];
  const cmp = compareLeases(result, second, per.pays, [
    toLeaseInput(state).price,
    toLeaseInput(withAltCar(state)).price,
  ]);
  if (cmp.cheaper === null || cmp.cheaper === undefined) return "Both cars cost about the same.";
  const same = state.car === alt.car;
  const name = same
    ? cmp.cheaper === 0
      ? "Car 1"
      : "Car 2"
    : `The ${KIND_NAME[cmp.cheaper === 0 ? state.car : alt.car]} car`;
  return `${name} costs about ${money(cmp.perPaySaving)} less each ${per.text}.`;
}

/**
 * Two cars side by side on the same pay, term and rate: the lease above and a
 * second car. Self-contained: it reads the lease form and runs the same engine.
 */
export function LeaseCompare({
  state,
  set,
  result,
}: {
  state: LeaseState;
  set: (patch: Partial<LeaseState>) => void;
  result: NovatedLeaseResult;
}) {
  const alt = altCar(state);
  const setAlt = (patch: Partial<AltCar>) => set({ alt: { ...alt, ...patch } });
  const second = useMemo(() => {
    const input = toLeaseInput(withAltCar(state));
    return validateLease(input).length ? null : safe(() => calculateNovatedLease(input));
  }, [state]);

  const per = PER[state.show];
  const unit = state.quoteAmounts ? "a month, without GST" : "a year";
  const cmp = second
    ? compareLeases(result, second, per.pays, [
        toLeaseInput(state).price,
        toLeaseInput(withAltCar(state)).price,
      ])
    : null;
  const same = state.car === alt.car;
  const names: [string, string] = same
    ? ["Car 1", "Car 2"]
    : [
        KINDS.find((k) => k.value === state.car)?.label ?? "",
        KINDS.find((k) => k.value === alt.car)?.label ?? "",
      ];
  const years = state.termYears;

  const rows: { k: string; cells: [React.ReactNode, React.ReactNode]; bold?: boolean }[] = second
    ? [
        {
          k: "Car price",
          cells: [money(toLeaseInput(state).price), money(toLeaseInput(withAltCar(state)).price)],
        },
        { k: "Fringe benefits tax", cells: [fbtCell(result), fbtCell(second)] },
        {
          k: `Charging or fuel ${unit}`,
          cells: [money(state.energy * 100), money(alt.energy * 100)],
        },
        {
          k: `Servicing ${unit}`,
          cells: [money(state.servicing * 100), money(alt.servicing * 100)],
        },
        {
          k: `Comes out of pay each ${per.text}`,
          cells: [result, second].map((r) => {
            const p = r.perPay[state.show];
            return p.postTax > 0
              ? `${moneyExact(p.preTax)} pre-tax + ${moneyExact(p.postTax)} after`
              : `${moneyExact(p.preTax)} pre-tax`;
          }) as [string, string],
        },
        {
          k: `Cost to your take-home pay a ${per.text}`,
          cells: [result, second].map((r) => moneyExact(r.perPay[state.show].cost)) as [
            string,
            string,
          ],
          bold: true,
        },
        {
          k: "Residual at the end",
          cells: [money(result.residualWithGst), money(second.residualWithGst)],
        },
        {
          k: `Total over ${years} year${years === 1 ? "" : "s"}, incl. residual`,
          cells: [money(result.lease.total), money(second.lease.total)],
          bold: true,
        },
      ]
    : [];

  const cheaper = cmp?.cheaper;
  const dearer = cheaper === null || cheaper === undefined ? null : ((1 - cheaper) as 0 | 1);
  const results = [result, second];

  return (
    <section className={`${card} space-y-4`} aria-label="Compare two cars">
      <div>
        <h2 className="font-semibold">Two cars side by side</h2>
        <p className="mt-1 text-sm text-muted">
          The lease above, beside a second car. Same pay, term, rate and fees. Try an electric car
          against a petrol one. The running costs below are rough examples; swap in your own.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SelectField
          label="Second car"
          value={alt.car}
          options={KINDS}
          onChange={(car) => setAlt({ car })}
        />
        <MoneyField label="Price" value={alt.price} onChange={(v) => setAlt({ price: v ?? 0 })} />
        <MoneyField
          label={`Charging or fuel ${state.quoteAmounts ? "a month" : "a year"}`}
          value={alt.energy}
          onChange={(v) => setAlt({ energy: v ?? 0 })}
        />
        <MoneyField
          label={`Servicing ${state.quoteAmounts ? "a month" : "a year"}`}
          value={alt.servicing}
          onChange={(v) => setAlt({ servicing: v ?? 0 })}
        />
      </div>
      {!second || !cmp ? (
        <p className="text-sm text-warn">Check the second car&apos;s price and running costs.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="num w-full text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="w-[34%] py-2 pr-3 font-medium">Over a {years} year lease</th>
                  <th className="py-2 pr-3 text-right font-medium text-accent">{names[0]}</th>
                  <th className="py-2 text-right font-medium text-tertiary">{names[1]}</th>
                </tr>
              </thead>
              <tbody className="[&_td]:border-t [&_td]:border-border [&_td]:py-2.5 [&_td]:pr-3 [&_td:not(:first-child)]:text-right [&_td:last-child]:pr-0">
                {rows.map((r) => (
                  <tr key={r.k} className={r.bold ? "font-semibold" : undefined}>
                    <td>{r.k}</td>
                    <td>{r.cells[0]}</td>
                    <td>{r.cells[1]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div
            className="rounded-xl bg-primary-container p-4 text-on-primary-container"
            aria-live="polite"
            data-testid="car-takeaway"
          >
            {cheaper === null || cheaper === undefined || dearer === null ? (
              <p className="font-medium">
                The two cars cost about the same out of your take-home pay.
              </p>
            ) : (
              <>
                <p className="font-medium">
                  {cheaper === 0 && same
                    ? "Car 1"
                    : `The ${KIND_NAME[cheaper === 0 ? state.car : alt.car]} car`}{" "}
                  costs about {money(cmp.perPaySaving)} less each {per.text} after tax
                  {cmp.priceGap > 0 ? (
                    <>, even though it&apos;s {money(cmp.priceGap)} dearer</>
                  ) : null}
                  .
                </p>
                {results[cheaper]?.fbt.treatment === "exempt" &&
                  results[dearer]?.fbt.treatment !== "exempt" && (
                    <p className="mt-1 text-sm">
                      That&apos;s because an eligible electric car is exempt from fringe benefits
                      tax, so the whole lease comes out of your pre-tax pay.
                    </p>
                  )}
              </>
            )}
          </div>
        </>
      )}
      <p className="text-xs text-muted">
        An electric car only gets the FBT exemption when its price is under the luxury car tax limit
        for fuel-efficient cars ({money(result.carRules.lctFuelEfficient)} in {result.carRules.year}
        ). The exemption rules are changing, so check them when you sign. General information only,
        not financial advice.
      </p>
    </section>
  );
}
