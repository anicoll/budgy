export const AU_TZ = "Australia/Sydney";
export const AU_LOCALE = "en-AU";

const DATE_FORMATTER = new Intl.DateTimeFormat(AU_LOCALE, {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: AU_TZ,
});

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat(AU_LOCALE, {
  day: "2-digit",
  month: "short",
  timeZone: AU_TZ,
});

const ISO_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: AU_TZ,
});

export function formatAUDate(value: string | Date): string {
  return DATE_FORMATTER.format(toDate(value));
}

export function formatAUDateShort(value: string | Date): string {
  return SHORT_DATE_FORMATTER.format(toDate(value));
}

export function isoDateAU(value: string | Date = new Date()): string {
  return ISO_DATE_FORMATTER.format(toDate(value));
}

function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00${tzOffset()}`);
  }
  return new Date(value);
}

function tzOffset(): string {
  return "+10:00";
}
