"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Database, Download, Moon, Sun, SunMoon, Upload } from "lucide-react";
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
import { downloadJSON, exportData, importData, resetAllData } from "@/lib/data/export-import";
import { loadDemoData } from "@/lib/seed/demo-data";
import { usePrefs } from "@/lib/state/prefs-store";

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
          description="Permanently delete all accounts, transactions, categories and budgets. This cannot be undone."
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
                  This will delete every account, transaction, category and budget. Your exported
                  JSON files will still work for re-import. This cannot be undone.
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

      {/* About */}
      <Section title="About">
        <Row label="Budgy" description="Personal finance app — local-first, no login required">
          <span className="text-xs text-muted-foreground">v0.5.0</span>
        </Row>
      </Section>
    </div>
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
