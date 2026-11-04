import type { Cents } from "../money/cents";
import {
  ACT_INVESTOR,
  ACT_OWNER_OCCUPIER,
  AU_STATES,
  type AuState,
  DUTY_RULES_YEAR,
  DUTY_SOURCES,
  type DutyScale,
  FOREIGN_SURCHARGE,
  NSW_FIRST_HOME,
  NSW_GENERAL,
  QLD_FIRST_HOME_DEDUCTION,
  QLD_GENERAL,
  QLD_HOME,
  SA_GENERAL,
  STATE_NAMES,
  TAS_GENERAL,
  VIC_FIRST_HOME,
  VIC_GENERAL,
  VIC_PPR,
  VIC_PPR_CAP,
  WA_FIRST_HOME,
  WA_GENERAL,
  WA_PPR,
  WA_PPR_CAP,
} from "./rules";

/** Who is buying: a first home buyer who'll live in it, someone else who'll live in it, or an investor. */
export type BuyerType = "firstHome" | "ownerOccupier" | "investor";
/** An existing home, a new home (never lived in), or vacant land to build a home on. */
export type PropertyKind = "existing" | "new" | "land";

export interface DutyInput {
  state: AuState;
  price: Cents;
  buyer: BuyerType;
  property: PropertyKind;
  /** A buyer is not an Australian citizen or permanent resident. */
  foreign?: boolean;
}

export interface DutyStep {
  label: string;
  amount: Cents;
}

export interface DutyResult {
  state: AuState;
  /** Duty at the general rate, before any concession or surcharge. */
  generalDuty: Cents;
  /** Duty after concessions, before any foreign purchaser surcharge. */
  duty: Cents;
  /** generalDuty − duty. */
  saving: Cents;
  /** Name of the concession that applied, if any. */
  concession?: string;
  foreignSurcharge: Cents;
  /** What you pay: duty + foreignSurcharge. */
  total: Cents;
  /** How the duty was worked out, in order, for display. */
  steps: DutyStep[];
  /** Plain-English caveats worth showing next to the result. */
  notes: string[];
  rulesYear: string;
  sources: string[];
}

const dollars = (c: Cents) => c / 100;
const toC = (d: number) => Math.round(d * 100) as Cents;
const fmt = (d: number) => `$${d.toLocaleString("en-AU", { maximumFractionDigits: 2 })}`;

/** Duty in cents on `price` under a published scale. */
export function scaleDuty(scale: DutyScale, price: Cents): Cents {
  if (price <= 0) return 0 as Cents;
  const band = [...scale.bands].reverse().find((b) => price > b.from * 100) ?? scale.bands[0];
  let duty: number;
  if (band.flat) {
    const units = scale.rounding === "per100OrPart" ? Math.ceil(price / 10_000) : price / 10_000;
    duty = units * band.per100 * 100;
  } else {
    const excess = price - band.from * 100;
    const units = scale.rounding === "per100OrPart" ? Math.ceil(excess / 10_000) : excess / 10_000;
    duty = band.base * 100 + units * band.per100 * 100;
  }
  if (scale.min !== undefined) duty = Math.max(duty, scale.min * 100);
  return Math.round(duty) as Cents;
}

/** Northern Territory: a formula up to $525,000, then a flat rate on the whole value. */
export function ntDuty(price: Cents): Cents {
  const value = dollars(price);
  if (value <= 0) return 0 as Cents;
  if (value <= 525_000) {
    const v = value / 1000;
    return toC(0.06571441 * v * v + 15 * v);
  }
  const rate = value < 3_000_000 ? 0.0495 : value < 5_000_000 ? 0.0575 : 0.0595;
  return toC(value * rate);
}

function generalDuty(state: AuState, price: Cents): Cents {
  switch (state) {
    case "NSW":
      return scaleDuty(NSW_GENERAL, price);
    case "VIC":
      return scaleDuty(VIC_GENERAL, price);
    case "QLD":
      return scaleDuty(QLD_GENERAL, price);
    case "SA":
      return scaleDuty(SA_GENERAL, price);
    case "WA":
      return scaleDuty(WA_GENERAL, price);
    case "TAS":
      return scaleDuty(TAS_GENERAL, price);
    case "ACT":
      return scaleDuty(ACT_INVESTOR, price);
    case "NT":
      return ntDuty(price);
  }
}

/** Duty phasing linearly from nil at `exempt` to the full general duty at `upper`, per $100 or part. */
function phaseIn(scale: DutyScale, price: Cents, exempt: number, upper: number): Cents {
  const atUpper = scaleDuty(scale, (upper * 100) as Cents);
  const per100 = atUpper / ((upper - exempt) / 100); // cents per $100
  const units = Math.ceil((price - exempt * 100) / 10_000);
  return Math.round(units * per100) as Cents;
}

interface Concession {
  duty: Cents;
  name?: string;
  steps: DutyStep[];
  notes: string[];
}

function concessional(input: DutyInput, general: Cents): Concession {
  const { state, price, buyer, property } = input;
  const value = dollars(price);
  const first = buyer === "firstHome";
  const livingIn = buyer !== "investor";
  const none: Concession = { duty: general, steps: [], notes: [] };

  switch (state) {
    case "NSW": {
      if (!first) return none;
      const t = property === "land" ? NSW_FIRST_HOME.land : NSW_FIRST_HOME.home;
      const name = "First Home Buyers Assistance Scheme";
      if (value <= t.exempt) {
        return {
          duty: 0 as Cents,
          name,
          steps: [
            { label: `First home buyer: no duty up to ${fmt(t.exempt)}`, amount: 0 as Cents },
          ],
          notes: [],
        };
      }
      if (value < t.upper) {
        const duty = phaseIn(NSW_GENERAL, price, t.exempt, t.upper);
        return {
          duty,
          name,
          steps: [
            {
              label: `First home buyer: concessional duty between ${fmt(t.exempt)} and ${fmt(t.upper)}`,
              amount: duty,
            },
          ],
          notes: [],
        };
      }
      return { ...none, notes: [`The first home buyer concession stops at ${fmt(t.upper)}.`] };
    }

    case "VIC": {
      if (first && value <= VIC_FIRST_HOME.upper) {
        const name = "First home buyer duty exemption or concession";
        if (value <= VIC_FIRST_HOME.exempt) {
          return {
            duty: 0 as Cents,
            name,
            steps: [
              {
                label: `First home buyer: no duty up to ${fmt(VIC_FIRST_HOME.exempt)}`,
                amount: 0 as Cents,
              },
            ],
            notes: [],
          };
        }
        const base =
          value <= VIC_PPR_CAP && property !== "land" ? scaleDuty(VIC_PPR, price) : general;
        const reduction = Math.round(
          (base * (VIC_FIRST_HOME.upper - value)) / (VIC_FIRST_HOME.upper - VIC_FIRST_HOME.exempt),
        );
        const duty = (base - reduction) as Cents;
        return {
          duty,
          name,
          steps: [
            {
              label: `First home buyer: duty reduced on a sliding scale to ${fmt(VIC_FIRST_HOME.upper)}`,
              amount: duty,
            },
          ],
          notes: [],
        };
      }
      if (livingIn && property !== "land" && value <= VIC_PPR_CAP) {
        const duty = scaleDuty(VIC_PPR, price);
        return {
          duty,
          name: "Principal place of residence concession",
          steps: [{ label: "Principal place of residence rate", amount: duty }],
          notes: [],
        };
      }
      const notes = first
        ? [`The first home buyer concession stops at ${fmt(VIC_FIRST_HOME.upper)}.`]
        : [];
      return { ...none, notes };
    }

    case "QLD": {
      if (first && property !== "existing") {
        const what = property === "land" ? "vacant land to build a home" : "a new home";
        return {
          duty: 0 as Cents,
          name: "First home (new home) concession",
          steps: [
            { label: `First home buyer buying ${what}: no duty at any price`, amount: 0 as Cents },
          ],
          notes: [],
        };
      }
      if (!livingIn || property === "land") return none;
      const home = scaleDuty(QLD_HOME, price);
      const steps: DutyStep[] = [{ label: "Home concession rate", amount: home }];
      if (first) {
        const row = QLD_FIRST_HOME_DEDUCTION.find(([below]) => value < below);
        if (row) {
          const duty = Math.max(0, home - row[1] * 100) as Cents;
          steps.push({ label: `First home concession: less ${fmt(row[1])}`, amount: duty });
          return { duty, name: "First home concession", steps, notes: [] };
        }
        return {
          duty: home,
          name: "Home concession",
          steps,
          notes: ["The first home concession on an existing home stops at $800,000."],
        };
      }
      return { duty: home, name: "Home concession", steps, notes: [] };
    }

    case "SA": {
      if (first && property !== "existing") {
        return {
          duty: 0 as Cents,
          name: "First home buyer relief",
          steps: [
            {
              label: "First home buyer buying a new home or land to build on: no duty",
              amount: 0 as Cents,
            },
          ],
          notes: [],
        };
      }
      return {
        ...none,
        notes: first
          ? ["South Australia's first home relief is for new homes and land to build on."]
          : [],
      };
    }

    case "WA": {
      if (first) {
        const t = property === "land" ? WA_FIRST_HOME.land : WA_FIRST_HOME.home;
        const name = "First home owner rate";
        if (value <= t.exempt) {
          return {
            duty: 0 as Cents,
            name,
            steps: [
              { label: `First home buyer: no duty up to ${fmt(t.exempt)}`, amount: 0 as Cents },
            ],
            notes: [],
          };
        }
        if (value <= t.upper) {
          const duty = Math.round(
            Math.ceil((price - t.exempt * 100) / 10_000) * t.per100 * 100,
          ) as Cents;
          const capped = Math.min(duty, general) as Cents;
          return {
            duty: capped,
            name,
            steps: [
              {
                label: `First home owner rate: $${t.per100} per $100 over ${fmt(t.exempt)}`,
                amount: capped,
              },
            ],
            notes: [],
          };
        }
        return { ...none, notes: [`The first home owner rate stops at ${fmt(t.upper)}.`] };
      }
      if (livingIn && property !== "land" && value <= WA_PPR_CAP) {
        const duty = Math.min(scaleDuty(WA_PPR, price), general) as Cents;
        return {
          duty,
          name: "Residential rate",
          steps: [{ label: "Residential rate for a home up to $200,000", amount: duty }],
          notes: [],
        };
      }
      return none;
    }

    case "TAS":
      return {
        ...none,
        notes: first
          ? ["Tasmania's first home buyer exemption on existing homes ended on 30 June 2026."]
          : [],
      };

    case "ACT": {
      if (first) {
        return {
          duty: 0 as Cents,
          name: "Home Buyer Concession Scheme",
          steps: [
            {
              label: "First home buyer: no duty at any price from 1 July 2026",
              amount: 0 as Cents,
            },
          ],
          notes: [
            "You must live in it for at least 12 months, starting within a year of settlement.",
          ],
        };
      }
      if (!livingIn) return none;
      const duty = scaleDuty(ACT_OWNER_OCCUPIER, price);
      return {
        duty,
        name: "Owner-occupier rate",
        steps: [{ label: "Owner-occupier rate", amount: duty }],
        notes: [],
      };
    }

    case "NT":
      return {
        ...none,
        notes: first
          ? [
              "The NT has no first home duty concession, but a $50,000 HomeGrown Territory Grant applies to new homes.",
            ]
          : [],
      };
  }
}

/** Transfer duty on a residential purchase, with concessions and any foreign purchaser surcharge. */
export function stampDuty(input: DutyInput): DutyResult {
  const { state, price } = input;
  const general = generalDuty(state, price);
  const steps: DutyStep[] = [{ label: `General rate on ${fmt(dollars(price))}`, amount: general }];
  const notes: string[] = [];

  let duty = general;
  let concession: string | undefined;
  if (input.foreign) {
    if (input.buyer !== "investor")
      notes.push("Concessions are generally only for Australian citizens and permanent residents.");
  } else {
    const c = concessional(input, general);
    if (c.duty < general) {
      duty = c.duty;
      concession = c.name;
      steps.push(...c.steps);
    }
    notes.push(...c.notes);
  }

  const rate = input.foreign ? FOREIGN_SURCHARGE[state] : 0;
  const foreignSurcharge = toC(dollars(price) * rate);
  if (foreignSurcharge > 0) {
    steps.push({
      label: `Foreign purchaser surcharge (${Math.round(rate * 100)}%)`,
      amount: foreignSurcharge,
    });
  }
  const total = (duty + foreignSurcharge) as Cents;
  if (steps.length > 1) steps.push({ label: "You pay", amount: total });

  return {
    state,
    generalDuty: general,
    duty,
    saving: (general - duty) as Cents,
    concession,
    foreignSurcharge,
    total,
    steps,
    notes,
    rulesYear: DUTY_RULES_YEAR,
    sources: DUTY_SOURCES[state],
  };
}

/** The same purchase in every state and territory, cheapest first. */
export function dutyByState(input: Omit<DutyInput, "state">): (DutyResult & { name: string })[] {
  return AU_STATES.map((state) => ({
    ...stampDuty({ ...input, state }),
    name: STATE_NAMES[state],
  })).sort((a, b) => a.total - b.total);
}
