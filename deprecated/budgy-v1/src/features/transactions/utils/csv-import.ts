import type { Cents } from "@/lib/money/cents";

export interface ParsedRow {
  date: string; // ISO "YYYY-MM-DD"
  amount: Cents; // absolute value in cents
  type: "debit" | "credit";
  payee: string; // trimmed
  rawLine: string;
  lineNumber: number;
}

export interface ParseError {
  lineNumber: number;
  rawLine: string;
  message: string;
}

export interface CsvParseResult {
  rows: ParsedRow[];
  errors: ParseError[];
  skipped: number; // blank lines
}

/** Minimal quoted-field CSV splitter. Handles ANZ (unquoted description) and
 *  CommBank (quoted description + trailing balance column) without issue. */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuote = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === "," && !inQuote) {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

/** Parse "DD/MM/YYYY" → "YYYY-MM-DD", or null if invalid. */
function parseDDMMYYYY(s: string): string | null {
  const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const month = parseInt(mm, 10);
  const day = parseInt(dd, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${yyyy}-${mm}-${dd}`;
}

/** Parse amount string (handles "-130.74", "+19.90", "1900.00"). */
function parseAmount(s: string): { amount: Cents; type: "debit" | "credit" } | null {
  const clean = s.replace(/["\s]/g, "");
  const num = parseFloat(clean);
  if (!Number.isFinite(num)) return null;
  return {
    amount: Math.round(Math.abs(num) * 100) as Cents,
    type: num < 0 ? "debit" : "credit",
  };
}

/**
 * Parse AU bank CSV exports (ANZ, CommBank, and similar headerless formats).
 *
 * Expected columns: date (DD/MM/YYYY), amount, description[, balance, ...]
 * No header row. Trailing columns (CommBank running balance, ANZ empty cols) are ignored.
 */
export function parseBankCsv(csvText: string): CsvParseResult {
  const lines = csvText.split(/\r?\n/);
  const rows: ParsedRow[] = [];
  const errors: ParseError[] = [];
  let skipped = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const lineNumber = i + 1;

    if (!rawLine.trim()) {
      skipped++;
      continue;
    }

    const fields = splitCsvLine(rawLine);

    const dateStr = fields[0]?.trim() ?? "";
    const amountStr = fields[1]?.trim() ?? "";
    const descriptionStr = fields[2]?.trim() ?? "";

    const date = parseDDMMYYYY(dateStr);
    if (!date) {
      errors.push({ lineNumber, rawLine, message: `Invalid date: "${dateStr}"` });
      continue;
    }

    const parsed = parseAmount(amountStr);
    if (!parsed) {
      errors.push({ lineNumber, rawLine, message: `Invalid amount: "${amountStr}"` });
      continue;
    }

    rows.push({
      date,
      amount: parsed.amount,
      type: parsed.type,
      payee: descriptionStr,
      rawLine,
      lineNumber,
    });
  }

  return { rows, errors, skipped };
}
