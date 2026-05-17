"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Car,
  ChevronDown,
  Database,
  Download,
  Moon,
  Plus,
  Sun,
  SunMoon,
  Upload,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { estimateFortnightlyNet } from "@/features/budgets/utils/au-tax";
import { CHANGELOG } from "@/lib/changelog";
import { downloadJSON, exportData, importData, resetAllData } from "@/lib/data/export-import";
import type { Cents } from "@/lib/money/cents";
import { formatAUDCompact, parseAUDInput } from "@/lib/money/format";
import { loadDemoData } from "@/lib/seed/demo-data";
import type { NovatedLease } from "@/lib/state/prefs-store";
import { usePrefs } from "@/lib/state/prefs-store";
import { cn } from "@/lib/utils";

export function SettingsPageClient() {
  const { theme, setTheme } = useTheme();
  const prefs = usePrefs();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [importMode, setImportMode] = useState<"replace" | "merge">("replace");

  async function handleExport() {
    try {
      const data = await exportData();
      downloadJSON(data);
      toast.success("Export downloaded");
    } catch {
      toast.error("Export failed");
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const counts = await importData(raw, importMode);
      await qc.invalidateQueries();
      toast.success(
        `Imported: ${counts.accounts} accounts, ${counts.transactions} transactions, ${counts.categories} categories`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed — check the file format");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleLoadDemo() {
    setLoadingDemo(true);
    try {
      await loadDemoData();
      await qc.invalidateQueries();
      toast.success("Demo data loaded — explore the app!");
    } catch {
      toast.error("Failed to load demo data");
    } finally {
      setLoadingDemo(false);
    }
  }

  async function handleReset() {
    try {
      await resetAllData();
      prefs.reset();
      await qc.invalidateQueries();
      toast.success("All data cleared");
    } catch {
      toast.error("Reset failed");
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      {/* Appearance */}
      <Section title="Appearance">
        <Row label="Theme" description="Light, dark, or follow system preference">
          <div className="flex gap-2">
            {(
              [
                { value: "light", icon: Sun, label: "Light" },
                { value: "dark", icon: Moon, label: "Dark" },
                { value: "system", icon: SunMoon, label: "System" },
              ] as const
            ).map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors
                  ${
                    theme === value
                      ? "border-primary bg-muted text-foreground"
                      : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </Row>
      </Section>

      <Separator />

      {/* Preferences */}
      <Section title="Preferences">
        <Row label="First day of month" description="Used for monthly period boundaries">
          <Select
            value={String(prefs.firstDayOfMonth)}
            onValueChange={(v) => prefs.setPref("firstDayOfMonth", Number(v))}
          >
            <SelectTrigger className="w-24 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 15, 20, 25].map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d}th
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>

        <Row label="Hide archived" description="Don't show archived accounts in lists">
          <Switch
            checked={prefs.hideArchived}
            onCheckedChange={(v) => prefs.setPref("hideArchived", v)}
          />
        </Row>
      </Section>

      <Separator />

      {/* Salary & Tax */}
      <SalaryTaxSection />

      <Separator />

      {/* Data */}
      <Section title="Data">
        <Row label="Export" description="Download all your data as a JSON file">
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> Export JSON
          </Button>
        </Row>

        <Row
          label="Import"
          description={`Upload a previously exported JSON file. Mode: ${importMode === "replace" ? "replace everything" : "merge with existing"}`}
        >
          <div className="flex items-center gap-2">
            <Select
              value={importMode}
              onValueChange={(v) => setImportMode(v as "replace" | "merge")}
            >
              <SelectTrigger className="w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="replace">Replace</SelectItem>
                <SelectItem value="merge">Merge</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" />
              {importing ? "Importing…" : "Import JSON"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImport}
            />
          </div>
        </Row>

        <Row
          label="Demo data"
          description="Load 3 months of sample transactions to explore the app"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadDemo}
            disabled={loadingDemo}
            className="gap-1.5"
          >
            <Database className="h-3.5 w-3.5" />
            {loadingDemo ? "Loading…" : "Load demo data"}
          </Button>
        </Row>
      </Section>

      <Separator />

      {/* Danger zone */}
      <Section title="Danger zone">
        <Row
          label="Reset all data"
          description="Permanently delete all accounts, transactions, categories, budgets, super plans, mortgage plans, novated leases and salary settings. This cannot be undone."
          danger
        >
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Reset
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset all data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete every account, transaction, category, budget, super plan,
                  mortgage plan, novated lease and salary setting. Your exported JSON files will
                  still work for re-import. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={handleReset}
                >
                  Delete everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Row>
      </Section>

      <Separator />

      {/* Changelog */}
      <ChangelogSection />

      <Separator />

      {/* About */}
      <Section title="About">
        <Row label="Budgy" description="Personal finance app — local-first, no login required">
          <span className="text-xs text-muted-foreground">v0.11.0</span>
        </Row>
      </Section>
    </div>
  );
}

// ── Changelog section ────────────────────────────────────────────────────────

function ChangelogSection() {
  const [expanded, setExpanded] = useState<string | null>(CHANGELOG[0].version);
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs uppercase tracking-wider text-muted-foreground">What&apos;s new</h2>
      <div className="flex flex-col gap-2">
        {CHANGELOG.map((entry) => (
          <div
            key={entry.version}
            className="rounded-xl border border-border/60 bg-surface/60 backdrop-blur-md overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setExpanded(expanded === entry.version ? null : entry.version)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/20 transition-colors"
            >
              <span className="shrink-0 rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[10px] font-mono font-medium text-violet-400">
                v{entry.version}
              </span>
              <span className="flex-1 text-sm font-medium">{entry.title}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">{entry.date}</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  expanded === entry.version && "rotate-180",
                )}
              />
            </button>
            {expanded === entry.version && (
              <ul className="border-t border-border/40 px-4 pb-4 pt-3 flex flex-col gap-1.5">
                {entry.changes.map((change) => (
                  <li key={change} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-violet-400" />
                    {change}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Salary & Tax section ──────────────────────────────────────────────────────

const FBT_PRESETS = [
  { label: "0% — EV / exempt", value: 0 },
  { label: "20% — Statutory", value: 0.2 },
  { label: "47% — Full rate", value: 0.47 },
];

function SalaryTaxSection() {
  const prefs = usePrefs();
  const [salaryRaw, setSalaryRaw] = useState(
    prefs.annualSalary ? String(Math.round(prefs.annualSalary / 100)) : "",
  );
  const [editingSalary, setEditingSalary] = useState(false);
  const [addingLease, setAddingLease] = useState(false);

  // New lease form state
  const [leaseName, setLeaseName] = useState("");
  const [leaseAmount, setLeaseAmount] = useState("");
  const [leaseFbtRate, setLeaseFbtRate] = useState<number>(0);
  const [leaseFbtCustom, setLeaseFbtCustom] = useState("");
  const [leaseFbtMode, setLeaseFbtMode] = useState<"preset" | "custom">("preset");

  const leases = prefs.novatedLeases ?? [];

  function saveSalary() {
    const parsed = parseAUDInput(salaryRaw);
    if (parsed && parsed > 0) prefs.setPref("annualSalary", parsed);
    setEditingSalary(false);
  }

  function addLease() {
    const amount = parseAUDInput(leaseAmount);
    if (!leaseName.trim() || !amount || amount <= 0) return;
    const rate =
      leaseFbtMode === "custom"
        ? Math.max(0, Math.min(1, (parseFloat(leaseFbtCustom) || 0) / 100))
        : leaseFbtRate;
    const newLease: NovatedLease = {
      id: crypto.randomUUID(),
      name: leaseName.trim(),
      annualPreTaxAmount: amount,
      fbtRate: rate,
    };
    prefs.setPref("novatedLeases", [...leases, newLease]);
    setLeaseName("");
    setLeaseAmount("");
    setLeaseFbtRate(0);
    setLeaseFbtCustom("");
    setLeaseFbtMode("preset");
    setAddingLease(false);
  }

  function removeLease(id: string) {
    prefs.setPref(
      "novatedLeases",
      leases.filter((l) => l.id !== id),
    );
  }

  const annualSalary = prefs.annualSalary ?? (0 as Cents);
  const hasPrivateHealth = prefs.hasPrivateHealth ?? false;
  const estimatedNet =
    annualSalary > 0 ? estimateFortnightlyNet(annualSalary, hasPrivateHealth, leases) : null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs uppercase tracking-wider text-muted-foreground">Salary &amp; Tax</h2>
      <Card className="border-border/60 bg-surface/60 backdrop-blur-md">
        <CardContent className="divide-y divide-border/40 p-0">
          {/* Annual salary */}
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">Annual salary (gross)</div>
              <div className="text-[11px] text-muted-foreground">
                Used to estimate take-home pay for budget pre-fill and super projector
              </div>
            </div>
            <div className="shrink-0">
              {editingSalary ? (
                <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface px-2 py-1 focus-within:border-violet-500/70">
                  <span className="text-xs text-muted-foreground">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={salaryRaw}
                    onChange={(e) => setSalaryRaw(e.target.value)}
                    onBlur={saveSalary}
                    onKeyDown={(e) => e.key === "Enter" && saveSalary()}
                    className="w-24 bg-transparent text-sm tabular-nums outline-none"
                  />
                  <span className="text-xs text-muted-foreground">/yr</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingSalary(true)}
                  className="rounded-lg border border-border/60 bg-surface px-3 py-1.5 text-sm tabular-nums hover:border-violet-500/50"
                >
                  {annualSalary > 0
                    ? `$${Math.round(annualSalary / 100).toLocaleString("en-AU")}/yr`
                    : "Set salary"}
                </button>
              )}
            </div>
          </div>

          {/* Private health */}
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">Private hospital cover</div>
              <div className="text-[11px] text-muted-foreground">
                Avoids Medicare Levy Surcharge (up to 1.5% of taxable income)
              </div>
            </div>
            <Switch
              checked={hasPrivateHealth}
              onCheckedChange={(v) => prefs.setPref("hasPrivateHealth", v)}
            />
          </div>

          {/* Novated leases */}
          <div className="flex flex-col gap-3 px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Novated leases</div>
                <div className="text-[11px] text-muted-foreground">
                  Pre-tax salary sacrifice — reduces taxable income
                </div>
              </div>
              {!addingLease && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAddingLease(true)}
                  className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </Button>
              )}
            </div>

            {leases.length === 0 && !addingLease && (
              <p className="text-xs text-muted-foreground">No novated leases added.</p>
            )}

            {/* Existing leases */}
            {leases.map((lease) => (
              <div
                key={lease.id}
                className="flex items-center gap-3 rounded-lg border border-border/50 bg-surface/40 px-3 py-2"
              >
                <Car className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{lease.name}</div>
                  <div className="text-[11px] text-muted-foreground tabular-nums">
                    ${Math.round(lease.annualPreTaxAmount / 100).toLocaleString("en-AU")}/yr pre-tax
                    {lease.fbtRate > 0 && ` · ${(lease.fbtRate * 100).toFixed(0)}% FBT`}
                    {lease.fbtRate === 0 && " · EV/exempt"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeLease(lease.id)}
                  aria-label={`Remove ${lease.name}`}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {/* Add lease form */}
            {addingLease && (
              <div className="flex flex-col gap-3 rounded-lg border border-violet-500/30 bg-surface/60 p-3">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  New novated lease
                </div>

                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Name</span>
                  <input
                    type="text"
                    value={leaseName}
                    onChange={(e) => setLeaseName(e.target.value)}
                    placeholder="e.g. Tesla Model 3"
                    className="rounded-lg border border-border/60 bg-surface px-3 py-1.5 text-sm outline-none focus:border-violet-500/70"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Annual pre-tax amount</span>
                  <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface px-3 py-1.5 focus-within:border-violet-500/70">
                    <span className="text-sm text-muted-foreground">$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={leaseAmount}
                      onChange={(e) => setLeaseAmount(e.target.value)}
                      placeholder="e.g. 15000"
                      className="min-w-0 flex-1 bg-transparent text-sm tabular-nums outline-none"
                    />
                    <span className="text-xs text-muted-foreground">/yr</span>
                  </div>
                </label>

                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">FBT rate</span>
                  <div className="flex flex-wrap gap-1.5">
                    {FBT_PRESETS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => {
                          setLeaseFbtRate(p.value);
                          setLeaseFbtMode("preset");
                        }}
                        className={cn(
                          "rounded-lg border px-2.5 py-1 text-xs transition-colors",
                          leaseFbtMode === "preset" && leaseFbtRate === p.value
                            ? "border-violet-500/70 bg-violet-500/20 text-violet-300"
                            : "border-border/60 text-muted-foreground hover:border-border",
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setLeaseFbtMode("custom")}
                        className={cn(
                          "rounded-lg border px-2.5 py-1 text-xs transition-colors",
                          leaseFbtMode === "custom"
                            ? "border-violet-500/70 bg-violet-500/20 text-violet-300"
                            : "border-border/60 text-muted-foreground hover:border-border",
                        )}
                      >
                        Custom
                      </button>
                      {leaseFbtMode === "custom" && (
                        <div className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-surface px-2 py-1 focus-within:border-violet-500/70">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={leaseFbtCustom}
                            onChange={(e) => setLeaseFbtCustom(e.target.value)}
                            placeholder="0"
                            className="w-10 bg-transparent text-xs tabular-nums outline-none text-right"
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAddingLease(false);
                      setLeaseName("");
                      setLeaseAmount("");
                    }}
                    className="flex-1 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={!leaseName.trim() || !leaseAmount}
                    onClick={addLease}
                    className="flex-1 bg-gradient-accent text-xs text-primary-foreground hover:opacity-90"
                  >
                    Add lease
                  </Button>
                </div>
              </div>
            )}

            {/* Live net estimate */}
            {estimatedNet && (
              <div className="rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Estimated fortnightly take-home:{" "}
                <strong className="text-foreground tabular-nums">
                  {formatAUDCompact(estimatedNet)}/fn
                </strong>
                {leases.length > 0 && (
                  <span>
                    {" "}
                    (saving{" "}
                    {formatAUDCompact(
                      (estimateFortnightlyNet(annualSalary, hasPrivateHealth, []) -
                        estimatedNet) as Cents,
                    )}{" "}
                    in tax via leases)
                  </span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs uppercase tracking-wider text-muted-foreground">{title}</h2>
      <Card className="border-border/60 bg-surface/60 backdrop-blur-md">
        <CardContent className="divide-y divide-border/40 p-0">{children}</CardContent>
      </Card>
    </section>
  );
}

function Row({
  label,
  description,
  children,
  danger = false,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <div className={`text-sm font-medium ${danger ? "text-destructive" : ""}`}>{label}</div>
        {description && <div className="text-[11px] text-muted-foreground">{description}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
