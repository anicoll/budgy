"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateAccount } from "@/features/accounts/hooks";
import {
  ACCOUNT_COLORS,
  ACCOUNT_DEFAULT_COLOR,
  ACCOUNT_TYPE_LABEL,
  ACCOUNT_TYPE_ORDER,
  type AccountType,
} from "@/features/accounts/types";
import { estimateFortnightlyNet } from "@/features/budgets/utils/au-tax";
import { seedDefaultCategories } from "@/features/categories/repository";
import { useCreateTransaction } from "@/features/transactions/hooks";
import { isoDateAU } from "@/lib/date/au-locale";
import type { Cents } from "@/lib/money/cents";
import { parseAUDInput } from "@/lib/money/format";
import { usePrefs } from "@/lib/state/prefs-store";
import { cn } from "@/lib/utils";

const STEPS = ["Welcome", "Salary", "Account", "Categories", "Done"] as const;
type Step = (typeof STEPS)[number];

const VARIANTS = {
  enter: { opacity: 0, x: 40 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
};

export function OnboardingWizard() {
  const router = useRouter();
  const { setTheme, theme } = useTheme();
  const { setPref } = usePrefs();
  const createAccount = useCreateAccount();
  const createTransaction = useCreateTransaction();

  const [step, setStep] = useState<Step>("Welcome");
  const [acct, setAcct] = useState({
    name: "Everyday account",
    type: "checking" as AccountType,
    balance: "",
    color: ACCOUNT_DEFAULT_COLOR.checking,
  });
  const [createdAccountId, setCreatedAccountId] = useState<string | null>(null);
  const [txn, setTxn] = useState({ payee: "", amount: "", type: "debit" as "debit" | "credit" });
  const [busy, setBusy] = useState(false);

  const stepIdx = STEPS.indexOf(step);

  async function handleWelcomeNext() {
    await seedDefaultCategories();
    setStep("Salary");
  }

  function handleSalaryNext(salary: Cents | null, hasPrivateHealth: boolean) {
    if (salary && salary > 0) setPref("annualSalary", salary);
    setPref("hasPrivateHealth", hasPrivateHealth);
    setStep("Account");
  }

  async function handleAccountNext() {
    setBusy(true);
    try {
      const opening = parseAUDInput(acct.balance) ?? 0;
      const created = await createAccount.mutateAsync({
        name: acct.name,
        type: acct.type,
        institution: "",
        openingBalance: Math.abs(opening),
        color: acct.color,
      });
      setCreatedAccountId(created.id);
      setStep("Categories");
    } finally {
      setBusy(false);
    }
  }

  async function handleSkipTxn() {
    finish();
  }

  async function handleAddTxn() {
    if (!createdAccountId || !txn.amount) {
      finish();
      return;
    }
    setBusy(true);
    try {
      const amount = parseAUDInput(txn.amount);
      if (amount && amount > 0) {
        await createTransaction.mutateAsync({
          date: isoDateAU(),
          type: txn.type,
          accountId: createdAccountId,
          amount: Math.abs(amount),
          categoryId: null,
          payee: txn.payee || undefined,
          tags: [],
          cleared: false,
        });
      }
    } finally {
      setBusy(false);
      finish();
    }
  }

  function finish() {
    setPref("onboarded", true);
    router.replace("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-app-radial p-4">
      <div className="w-full max-w-md">
        {/* Progress dots */}
        <div className="mb-6 flex justify-center gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i <= stepIdx ? "w-8 bg-gradient-accent" : "w-1.5 bg-border",
              )}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            variants={VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2 }}
          >
            {step === "Welcome" && (
              <WelcomeStep theme={theme ?? "dark"} onTheme={setTheme} onNext={handleWelcomeNext} />
            )}
            {step === "Salary" && <SalaryStep onNext={handleSalaryNext} />}
            {step === "Account" && (
              <AccountStep acct={acct} onChange={setAcct} onNext={handleAccountNext} busy={busy} />
            )}
            {step === "Categories" && (
              <CategoriesStep
                txn={txn}
                onChange={setTxn}
                onSkip={handleSkipTxn}
                onAdd={handleAddTxn}
                busy={busy}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function SalaryStep({
  onNext,
}: {
  onNext: (salary: Cents | null, hasPrivateHealth: boolean) => void;
}) {
  const [raw, setRaw] = useState("");
  const [privateHealth, setPrivateHealth] = useState(false);
  const parsed = parseAUDInput(raw);
  const netFn = parsed && parsed > 0 ? estimateFortnightlyNet(parsed, privateHealth) : null;

  return (
    <Card className="border-border/60 bg-surface/80 backdrop-blur-xl">
      <CardHeader className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/20 text-3xl shadow-lg">
          💼
        </div>
        <CardTitle>What&apos;s your annual salary?</CardTitle>
        <CardDescription>
          Used to pre-fill your super projector and income budget. You can update this any time in
          Settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Salary input */}
        <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-surface px-4 py-3 focus-within:border-violet-500/70">
          <span className="text-muted-foreground">$</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder="e.g. 95000"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-lg tabular-nums outline-none"
          />
          <span className="text-sm text-muted-foreground">/yr gross</span>
        </div>

        {/* Private hospital cover */}
        <button
          type="button"
          onClick={() => setPrivateHealth((v) => !v)}
          className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface px-4 py-3 text-left transition-colors hover:border-violet-500/50"
        >
          <div
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
              privateHealth ? "border-violet-500 bg-violet-500 text-white" : "border-border",
            )}
          >
            {privateHealth && <span className="text-[10px] leading-none">✓</span>}
          </div>
          <div>
            <div className="text-sm font-medium">I have private hospital cover</div>
            <div className="text-xs text-muted-foreground">
              Avoids the Medicare Levy Surcharge (up to 1.5%)
            </div>
          </div>
        </button>

        {/* Live net estimate */}
        {netFn && netFn > 0 && (
          <div className="rounded-lg bg-muted/30 px-3 py-2 text-center text-xs text-muted-foreground">
            Estimated take-home:{" "}
            <strong className="text-foreground tabular-nums">
              ${Math.round(netFn / 100).toLocaleString("en-AU")}/fn
            </strong>{" "}
            after tax (FY2024-25 estimate — adjust to your payslip)
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <Button
          onClick={() => onNext(parsed, privateHealth)}
          disabled={!parsed || parsed <= 0}
          className="w-full bg-gradient-accent text-primary-foreground hover:opacity-90"
        >
          Continue
        </Button>
        <button
          type="button"
          onClick={() => onNext(null, privateHealth)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Skip for now
        </button>
      </CardFooter>
    </Card>
  );
}

function WelcomeStep({
  theme,
  onTheme,
  onNext,
}: {
  theme: string;
  onTheme: (t: string) => void;
  onNext: () => void;
}) {
  return (
    <Card className="border-border/60 bg-surface/80 backdrop-blur-xl">
      <CardHeader className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-accent text-white text-2xl shadow-lg">
          💰
        </div>
        <CardTitle className="text-2xl">Welcome to Budgy</CardTitle>
        <CardDescription>
          Local-first budgeting — your data never leaves your device. Let&apos;s get you set up in
          under a minute.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">
            Pick a theme
          </Label>
          <div className="grid grid-cols-3 gap-2">
            {(["dark", "light", "system"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onTheme(t)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm capitalize transition-colors",
                  theme === t
                    ? "border-primary bg-muted font-medium"
                    : "border-border/60 text-muted-foreground hover:border-border",
                )}
              >
                {t === "dark" ? "🌙 Dark" : t === "light" ? "☀️ Light" : "🔄 System"}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button
          onClick={onNext}
          className="w-full bg-gradient-accent text-primary-foreground hover:opacity-90"
        >
          Get started
        </Button>
      </CardFooter>
    </Card>
  );
}

function AccountStep({
  acct,
  onChange,
  onNext,
  busy,
}: {
  acct: { name: string; type: AccountType; balance: string; color: string };
  onChange: React.Dispatch<React.SetStateAction<typeof acct>>;
  onNext: () => void;
  busy: boolean;
}) {
  return (
    <Card className="border-border/60 bg-surface/80 backdrop-blur-xl">
      <CardHeader>
        <CardTitle>Add your first account</CardTitle>
        <CardDescription>
          This could be your everyday checking account, savings, or credit card.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Name</Label>
          <Input
            value={acct.name}
            onChange={(e) => onChange((a) => ({ ...a, name: e.target.value }))}
            placeholder="Everyday account"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Type</Label>
            <Select
              value={acct.type}
              onValueChange={(v) =>
                onChange((a) => ({
                  ...a,
                  type: v as AccountType,
                  color: ACCOUNT_DEFAULT_COLOR[v as AccountType],
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPE_ORDER.map((t) => (
                  <SelectItem key={t} value={t}>
                    {ACCOUNT_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Balance</Label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={acct.balance}
              onChange={(e) => onChange((a) => ({ ...a, balance: e.target.value }))}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Colour</Label>
          <div className="flex flex-wrap gap-2">
            {ACCOUNT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Pick colour ${c}`}
                onClick={() => onChange((a) => ({ ...a, color: c }))}
                className={cn(
                  "h-7 w-7 rounded-full ring-2 ring-transparent transition",
                  acct.color === c && "ring-foreground ring-offset-2 ring-offset-surface",
                )}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button
          onClick={onNext}
          disabled={busy || !acct.name.trim()}
          className="w-full bg-gradient-accent text-primary-foreground hover:opacity-90"
        >
          {busy ? "Creating…" : "Next"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function CategoriesStep({
  txn,
  onChange,
  onSkip,
  onAdd,
  busy,
}: {
  txn: { payee: string; amount: string; type: "debit" | "credit" };
  onChange: React.Dispatch<React.SetStateAction<typeof txn>>;
  onSkip: () => void;
  onAdd: () => void;
  busy: boolean;
}) {
  return (
    <Card className="border-border/60 bg-surface/80 backdrop-blur-xl">
      <CardHeader>
        <CardTitle>Add a sample transaction</CardTitle>
        <CardDescription>
          A set of default categories has been added. Record your first transaction, or skip to go
          straight to the dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Type</Label>
            <Select
              value={txn.type}
              onValueChange={(v) => onChange((t) => ({ ...t, type: v as "debit" | "credit" }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="debit">Expense</SelectItem>
                <SelectItem value="credit">Income</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Amount</Label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={txn.amount}
              onChange={(e) => onChange((t) => ({ ...t, amount: e.target.value }))}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Payee (optional)</Label>
          <Input
            placeholder="Coles, employer, etc."
            value={txn.payee}
            onChange={(e) => onChange((t) => ({ ...t, payee: e.target.value }))}
          />
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button variant="ghost" onClick={onSkip} disabled={busy} className="flex-1">
          Skip
        </Button>
        <Button
          onClick={onAdd}
          disabled={busy || !txn.amount}
          className="flex-1 bg-gradient-accent text-primary-foreground hover:opacity-90"
        >
          {busy ? "Saving…" : "Add & go to dashboard"}
        </Button>
      </CardFooter>
    </Card>
  );
}
