"use client";

import { AlertCircle, ChevronDown, ChevronUp, FileUp, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAccounts } from "@/features/accounts/hooks";
import { formatAUDate } from "@/lib/date/au-locale";
import { ulid } from "@/lib/id/ulid";
import { formatAUD } from "@/lib/money/format";
import { cn } from "@/lib/utils";
import { useBulkImportTransactions } from "../hooks";
import type { Transaction } from "../types";
import { type CsvParseResult, parseBankCsv } from "../utils/csv-import";

const MAX_PREVIEW_ROWS = 200;

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CsvImportSheet({ open, onClose }: Props) {
  const { data: accounts = [] } = useAccounts();
  const importMutation = useBulkImportTransactions();

  const [accountId, setAccountId] = useState<string>("");
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [errorsOpen, setErrorsOpen] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const step = parseResult ? 2 : 1;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setParseResult(parseBankCsv(text));
      setErrorsOpen(false);
    };
    reader.readAsText(file);
    // Reset input so same file can be re-selected after "Back"
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setParseResult(parseBankCsv(text));
      setErrorsOpen(false);
    };
    reader.readAsText(file);
  }

  function handleBack() {
    setParseResult(null);
    setFileName("");
  }

  async function handleImport() {
    if (!parseResult || !accountId) return;
    const now = new Date().toISOString();
    const transactions: Transaction[] = parseResult.rows.map((row) => ({
      id: ulid(),
      accountId,
      date: row.date,
      amount: row.amount,
      type: row.type,
      categoryId: null,
      payee: row.payee,
      tags: [],
      cleared: false,
      createdAt: now,
      updatedAt: now,
    }));
    await importMutation.mutateAsync(transactions);
    // Reset and close
    setParseResult(null);
    setFileName("");
    setAccountId("");
    onClose();
  }

  function handleClose() {
    setParseResult(null);
    setFileName("");
    setAccountId("");
    onClose();
  }

  const previewRows = parseResult?.rows.slice(0, MAX_PREVIEW_ROWS) ?? [];
  const hiddenCount = (parseResult?.rows.length ?? 0) - previewRows.length;

  return (
    <Sheet open={open} onOpenChange={(o) => (!o ? handleClose() : undefined)}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Import transactions from CSV</SheetTitle>
          <SheetDescription>
            Supports ANZ and CommBank CSV exports. No header row required.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto py-2">
          {step === 1 ? (
            <>
              {/* Account selector */}
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Import into account</span>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account…" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Drop zone */}
              <button
                type="button"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                className="flex w-full cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border/60 bg-surface/40 px-6 py-10 text-center transition-colors hover:border-violet-500/50 hover:bg-muted/30"
              >
                <FileUp className="h-10 w-10 text-muted-foreground/60" />
                <div>
                  <p className="text-sm font-medium">Click to choose a CSV file</p>
                  <p className="text-xs text-muted-foreground">or drag and drop here</p>
                </div>
                <p className="text-xs text-muted-foreground/60">
                  ANZ · CommBank · any headerless DD/MM/YYYY format
                </p>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={handleFileChange}
              />
            </>
          ) : (
            parseResult && (
              <>
                {/* Summary */}
                <div className="rounded-xl border border-border/60 bg-surface/60 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{fileName}</span>
                    <button
                      type="button"
                      onClick={handleBack}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Change file
                    </button>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    <span className="text-foreground font-semibold">{parseResult.rows.length}</span>{" "}
                    transactions found
                    {parseResult.skipped > 0 && ` · ${parseResult.skipped} blank lines skipped`}
                    {parseResult.errors.length > 0 && (
                      <span className="text-destructive">
                        {" "}
                        · {parseResult.errors.length} errors
                      </span>
                    )}
                  </div>
                </div>

                {/* Account selector (compact, if not already selected in step 1) */}
                {!accountId && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">Import into account</span>
                    <Select value={accountId} onValueChange={setAccountId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select account…" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Errors (collapsible) */}
                {parseResult.errors.length > 0 && (
                  <div className="rounded-xl border border-destructive/40 bg-destructive/10">
                    <button
                      type="button"
                      onClick={() => setErrorsOpen((v) => !v)}
                      className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                      <span className="flex-1 font-medium text-destructive">
                        {parseResult.errors.length} line{parseResult.errors.length > 1 ? "s" : ""}{" "}
                        could not be parsed
                      </span>
                      {errorsOpen ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    {errorsOpen && (
                      <div className="border-t border-destructive/30 px-4 pb-3 pt-2">
                        {parseResult.errors.map((e) => (
                          <div key={e.lineNumber} className="py-1 text-xs">
                            <span className="text-muted-foreground">Line {e.lineNumber}: </span>
                            <span className="text-destructive">{e.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Preview table */}
                {previewRows.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Preview
                    </p>
                    <div className="overflow-x-auto rounded-xl border border-border/60">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border/60 bg-surface/80 text-left text-muted-foreground">
                            <th className="px-3 py-2">Date</th>
                            <th className="px-3 py-2">Payee</th>
                            <th className="px-3 py-2 text-right">Amount</th>
                            <th className="px-3 py-2">Type</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {previewRows.map((row) => (
                            <tr key={row.lineNumber} className="hover:bg-muted/20">
                              <td className="px-3 py-1.5 tabular-nums text-muted-foreground">
                                {formatAUDate(row.date)}
                              </td>
                              <td className="max-w-[200px] truncate px-3 py-1.5">{row.payee}</td>
                              <td
                                className={cn(
                                  "px-3 py-1.5 text-right tabular-nums",
                                  row.type === "debit" ? "text-expense" : "text-income",
                                )}
                              >
                                {formatAUD(row.amount)}
                              </td>
                              <td className="px-3 py-1.5 capitalize text-muted-foreground">
                                {row.type}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {hiddenCount > 0 && (
                      <p className="text-xs text-muted-foreground">
                        …and {hiddenCount} more (all will be imported)
                      </p>
                    )}
                  </div>
                )}
              </>
            )
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-border/40 pt-4">
          {step === 2 ? (
            <>
              <Button variant="ghost" onClick={handleBack} className="flex-1">
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={!accountId || !parseResult?.rows.length || importMutation.isPending}
                className="flex-1 bg-gradient-accent text-primary-foreground hover:opacity-90"
              >
                <Upload className="mr-1.5 h-4 w-4" />
                {importMutation.isPending
                  ? "Importing…"
                  : `Import ${parseResult?.rows.length ?? 0} transactions`}
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
