import { describe, expect, it } from "vitest";
import { parseBankCsv } from "./csv-import";

// ANZ sample rows
const ANZ_DEBIT = `13/05/2026,"-130.74",MEDIBANK PHI DEBIT        MELBOURNE,,,,,`;
const ANZ_CREDIT = `12/05/2026,"1900.00",PAYMENT - THANK YOU,,,,,`;
const ANZ_LAST_ROW = `12/05/2026,"-98.00",ORBLE.COM`;

// CommBank sample rows
const CBA_CREDIT = `13/05/2026,"+19.90","Direct Credit 067596 NAVAN LABS AUSTR 4EDBBDAB0B0142C6","+293.06"`;
const CBA_DEBIT = `10/05/2026,"-20.00","Wdl ATM CBA ATM WEST LAKES B SA 515102 AUS","+273.16"`;
const CBA_LARGE = `07/05/2026,"-18000.00","Transfer To Andrew Nicoll CommBank App DD745H","+63.16"`;

describe("parseBankCsv — ANZ format", () => {
  it("parses a debit row correctly", () => {
    const { rows, errors } = parseBankCsv(ANZ_DEBIT);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      date: "2026-05-13",
      amount: 13074, // $130.74
      type: "debit",
      payee: "MEDIBANK PHI DEBIT        MELBOURNE",
    });
  });

  it("parses a credit row (unquoted positive amount)", () => {
    const { rows, errors } = parseBankCsv(ANZ_CREDIT);
    expect(errors).toHaveLength(0);
    expect(rows[0]).toMatchObject({
      date: "2026-05-12",
      amount: 190000, // $1,900.00
      type: "credit",
      payee: "PAYMENT - THANK YOU",
    });
  });

  it("parses the last row without trailing commas", () => {
    const { rows, errors } = parseBankCsv(ANZ_LAST_ROW);
    expect(errors).toHaveLength(0);
    expect(rows[0]).toMatchObject({ date: "2026-05-12", amount: 9800, type: "debit" });
  });

  it("ignores trailing empty columns", () => {
    const { rows } = parseBankCsv(ANZ_DEBIT);
    expect(rows[0].payee).toBe("MEDIBANK PHI DEBIT        MELBOURNE");
  });
});

describe("parseBankCsv — CommBank format", () => {
  it("parses a credit row with + prefix", () => {
    const { rows, errors } = parseBankCsv(CBA_CREDIT);
    expect(errors).toHaveLength(0);
    expect(rows[0]).toMatchObject({
      date: "2026-05-13",
      amount: 1990, // $19.90
      type: "credit",
      payee: "Direct Credit 067596 NAVAN LABS AUSTR 4EDBBDAB0B0142C6",
    });
  });

  it("parses a debit row with quoted description", () => {
    const { rows, errors } = parseBankCsv(CBA_DEBIT);
    expect(errors).toHaveLength(0);
    expect(rows[0]).toMatchObject({
      date: "2026-05-10",
      amount: 2000,
      type: "debit",
      payee: "Wdl ATM CBA ATM WEST LAKES B SA 515102 AUS",
    });
  });

  it("ignores the 4th balance column", () => {
    const { rows } = parseBankCsv(CBA_DEBIT);
    expect(rows[0].payee).toBe("Wdl ATM CBA ATM WEST LAKES B SA 515102 AUS");
  });

  it("parses large amounts correctly ($18,000)", () => {
    const { rows } = parseBankCsv(CBA_LARGE);
    expect(rows[0]).toMatchObject({ amount: 1_800_000, type: "debit" });
  });
});

describe("parseBankCsv — multi-row and edge cases", () => {
  it("parses a full ANZ block", () => {
    const csv = [
      `13/05/2026,"-130.74",MEDIBANK PHI DEBIT        MELBOURNE,,,,,`,
      `13/05/2026,"-15.13",ALDI STORES               PORT ADELAIDE,,,,,`,
      `12/05/2026,"1900.00",PAYMENT - THANK YOU,,,,,`,
    ].join("\n");
    const { rows, errors, skipped } = parseBankCsv(csv);
    expect(errors).toHaveLength(0);
    expect(skipped).toBe(0);
    expect(rows).toHaveLength(3);
    expect(rows[0].amount).toBe(13074);
    expect(rows[1].amount).toBe(1513);
    expect(rows[2].type).toBe("credit");
  });

  it("parses a full CommBank block", () => {
    const csv = [CBA_CREDIT, CBA_DEBIT, CBA_LARGE].join("\n");
    const { rows, errors } = parseBankCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(3);
  });

  it("skips blank lines and counts them", () => {
    const csv = `\n${ANZ_DEBIT}\n\n${ANZ_CREDIT}\n`;
    const { rows, skipped } = parseBankCsv(csv);
    expect(rows).toHaveLength(2);
    expect(skipped).toBe(3); // leading, middle, trailing
  });

  it("pushes invalid date to errors and continues", () => {
    const csv = [`32/13/2026,"-10.00",BAD DATE`, ANZ_DEBIT].join("\n");
    const { rows, errors } = parseBankCsv(csv);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("Invalid date");
    expect(rows).toHaveLength(1);
  });

  it("pushes non-numeric amount to errors and continues", () => {
    const csv = [`13/05/2026,"N/A",SOME PAYEE`, ANZ_CREDIT].join("\n");
    const { rows, errors } = parseBankCsv(csv);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("Invalid amount");
    expect(rows).toHaveLength(1);
  });

  it("includes rawLine and lineNumber in errors", () => {
    const csv = `13/05/2026,"bad",PAYEE`;
    const { errors } = parseBankCsv(csv);
    expect(errors[0].lineNumber).toBe(1);
    expect(errors[0].rawLine).toBe(csv);
  });

  it("includes lineNumber in rows", () => {
    const csv = `\n${ANZ_DEBIT}`;
    const { rows } = parseBankCsv(csv);
    expect(rows[0].lineNumber).toBe(2); // line 1 was blank
  });

  it("handles Windows line endings (CRLF)", () => {
    const csv = `${ANZ_DEBIT}\r\n${ANZ_CREDIT}`;
    const { rows } = parseBankCsv(csv);
    expect(rows).toHaveLength(2);
  });
});
