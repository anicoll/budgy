const aud0 = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});
const aud2 = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

/** Whole dollars from cents: "$187,420". */
export const money = (cents: number) => aud0.format(Math.round(cents / 100));

/** Dollars and cents from cents: "$2,997.76". */
export const moneyExact = (cents: number) => aud2.format(cents / 100);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "March 2049" */
export const monthYear = (iso: string) =>
  `${MONTHS_LONG[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

/** "Mar 2049" */
export const monthYearShort = (iso: string) =>
  `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

/** "6 years 4 months" from a number of days. */
export function duration(days: number): string {
  const months = Math.round(Math.abs(days) / 30.4375);
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts = [];
  if (y) parts.push(`${y} year${y === 1 ? "" : "s"}`);
  if (m || !y) parts.push(`${m} month${m === 1 ? "" : "s"}`);
  return parts.join(" ");
}

export const perPeriod = { weekly: "a week", fortnightly: "a fortnight", monthly: "a month" };
