"use client";

import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import type { SavedControls } from "@/lib/useSavedState";

/**
 * The shared answer-first layout for every tool: a short header with a ⋯
 * menu, the answer, your numbers as rows that open an edit sheet, ideas as
 * cards that open, and the rest folded into "The detail".
 */

export const toolCard = "rounded-xl border border-border bg-surface p-4 sm:p-5";
export const filledBtn =
  "min-h-11 rounded-full bg-accent px-5 text-sm font-semibold text-on-accent hover:opacity-90";
export const tonalBtn =
  "min-h-10 rounded-full border border-border px-4 text-sm font-medium text-accent hover:border-accent";

const menuItem =
  "flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm hover:bg-surface-container-high";

/** The page's `<main>` with the usual width and padding. */
export function ToolPage({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-6xl px-4 pt-6 pb-10 sm:pt-10">{children}</main>;
}

/** Title, one line on what the tool answers, and the ⋯ menu. */
export function ToolHeader({
  title,
  intro,
  saved,
  actions,
}: {
  title: string;
  intro: React.ReactNode;
  saved: SavedControls;
  /** Buttons shown beside the menu, such as "Edit your details". */
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-1 max-w-2xl text-muted">{intro}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 print:hidden">
          {actions}
          <ToolMenu saved={saved} />
        </div>
      </div>
      <LinkNotice saved={saved} />
    </header>
  );
}

/** A shared link changes what's shown, so say so on the page, not only in the menu. */
function LinkNotice({ saved }: { saved: SavedControls }) {
  if (saved.mode !== "link") return null;
  return (
    <p
      className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-surface-container px-4 py-2.5 text-sm print:hidden"
      aria-live="polite"
    >
      <span>You&apos;re looking at a shared link. Your own saved inputs aren&apos;t changed.</span>
      <button
        type="button"
        className="font-medium text-accent hover:underline"
        onClick={saved.keepLink}
      >
        Save these as mine
      </button>
      {saved.hasOwn && (
        <button
          type="button"
          className="font-medium text-accent hover:underline"
          onClick={saved.backToMine}
        >
          Back to mine
        </button>
      )}
    </p>
  );
}

/** Save, forget, copy link and print, out of the way behind one button. */
export function ToolMenu({ saved }: { saved: SavedControls }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setConfirming(false);
  }, [open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the address bar still has the link */
    }
  };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-label="Save, share or print"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-accent hover:border-accent"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="currentColor">
          <circle cx="4.5" cy="10" r="1.7" />
          <circle cx="10" cy="10" r="1.7" />
          <circle cx="15.5" cy="10" r="1.7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-12 right-0 z-30 w-72 rounded-2xl border border-border bg-surface p-2 shadow-lg">
          <p className="px-3 pt-2 pb-2 text-xs text-muted" aria-live="polite">
            {saved.mode === "saved" &&
              "Saved on this device only, across every tool. Your numbers never leave it."}
            {saved.mode === "link" && "Showing a shared link. Your own inputs aren't changed."}
            {saved.mode === "off" && "Not remembering your inputs on this device."}
          </p>
          <button type="button" className={menuItem} onClick={copy}>
            {copied ? "Link copied" : "Copy a link to these numbers"}
          </button>
          <button
            type="button"
            className={menuItem}
            onClick={() => {
              setOpen(false);
              window.print();
            }}
          >
            Print or save as PDF
          </button>
          {saved.mode === "off" && (
            <button type="button" className={menuItem} onClick={saved.remember}>
              Remember my inputs
            </button>
          )}
          {saved.mode === "saved" && !confirming && (
            <button
              type="button"
              className={`${menuItem} text-warn`}
              onClick={() => setConfirming(true)}
            >
              Forget everything
            </button>
          )}
          {saved.mode === "saved" && confirming && (
            <div className="space-y-2 px-3 py-2 text-sm">
              <p>
                Forget what you&apos;ve entered in every tool on this device? This can&apos;t be
                undone.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="min-h-10 rounded-full bg-warn px-4 font-semibold text-white"
                  onClick={() => {
                    setOpen(false);
                    saved.forget();
                  }}
                >
                  Forget
                </button>
                <button type="button" className={tonalBtn} onClick={() => setConfirming(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** The big answer card. Put the one number people came for first. */
export function AnswerCard({
  label,
  children,
  className = "",
}: {
  /** A short line above the answer, such as "Avalanche, $850 a month". */
  label?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-3 rounded-3xl bg-primary-container p-5 text-on-primary-container sm:p-7 ${className}`}
    >
      {label && <p className="text-sm font-semibold">{label}</p>}
      <div className="flex flex-col gap-3 text-text">{children}</div>
    </div>
  );
}

/** The answer, then a chart beside it on wide screens and under it on phones. */
export function AnswerRow({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-label="Your answer"
      aria-live="polite"
      className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
    >
      {children}
    </section>
  );
}

/** A section with a heading, used for "Your numbers", "Ideas to try" and "The detail". */
export function ToolSection({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="text-xl font-semibold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A box of summary rows. Each row opens the edit sheet at its fields. */
export function SummaryRows({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {children}
    </div>
  );
}

export function SummaryRow({
  title,
  hint,
  value,
  onClick,
  color,
}: {
  title: React.ReactNode;
  /** The numbers in short, so the row says what's set without opening it. */
  hint?: React.ReactNode;
  /** A number shown on the right, such as a balance. */
  value?: React.ReactNode;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-container sm:px-5"
    >
      <span className="min-w-0">
        <strong style={color ? { color } : undefined}>{title}</strong>
        {hint && <span className="num block text-sm text-muted sm:inline"> {hint}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-3">
        {value !== undefined && <span className="num font-semibold">{value}</span>}
        <span className="text-sm font-semibold text-accent">Edit</span>
      </span>
    </button>
  );
}

/** A card that opens an idea in place: a "what if" with its own inputs and answer. */
export function IdeaCard({
  title,
  open,
  onClick,
  children,
}: {
  title: string;
  open: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onClick}
      className={`flex flex-col gap-2 rounded-xl border bg-surface p-4 text-left transition sm:p-5 ${
        open ? "border-2 border-accent" : "border-border hover:border-accent"
      }`}
    >
      <span className="text-xs font-semibold tracking-wide text-accent uppercase">{title}</span>
      <span className="leading-snug">{children}</span>
      <span className="mt-auto text-sm text-muted">{open ? "Close" : "Open"}</span>
    </button>
  );
}

/** Which idea card is open, one at a time. */
export function useIdea<T extends string>() {
  const [idea, setIdea] = useState<T | null>(null);
  const toggle = useCallback((k: T) => setIdea((v) => (v === k ? null : k)), []);
  return { idea, toggle, setIdea };
}

/** The idea cards in a grid, with whichever one is open shown underneath. */
export function Ideas({
  cards,
  children,
}: {
  cards: React.ReactNode;
  /** The open idea's content. */
  children?: React.ReactNode;
}) {
  return (
    <ToolSection id="ideas-h" title="Ideas to try">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{cards}</div>
      {children}
    </ToolSection>
  );
}

/** "The detail": folded rows for tables, explainers, tips and the method. */
export function Detail({ children }: { children: React.ReactNode }) {
  return (
    <ToolSection id="detail-h" title="The detail">
      <div className="divide-y divide-border rounded-xl border border-border bg-surface">
        {children}
      </div>
    </ToolSection>
  );
}

export function Disclosure({
  id,
  title,
  hint,
  children,
}: {
  id?: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <details id={id} className="group scroll-mt-4">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span>
          <strong>{title}</strong>
          {hint && <span className="text-sm text-muted"> · {hint}</span>}
        </span>
        <span aria-hidden="true" className="text-muted transition group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="min-w-0 px-4 pb-4 sm:px-5 sm:pb-5">{children}</div>
    </details>
  );
}

/** Open a disclosure by id and scroll to it, for "Change" links in an answer. */
export function openDisclosure(id: string) {
  const d = document.getElementById(id);
  if (d instanceof HTMLDetailsElement) d.open = true;
  d?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** The edit sheet: a panel from the right on wide screens, full screen on phones. */
export const EditSheet = forwardRef<
  HTMLDialogElement,
  { title: string; children: React.ReactNode; onDone?: () => void }
>(function EditSheet({ title, children, onDone }, ref) {
  return (
    <dialog
      ref={ref}
      aria-labelledby="edit-h"
      className="fixed inset-0 m-0 ml-auto h-dvh max-h-none w-full max-w-xl overflow-y-auto bg-bg p-0 text-text backdrop:bg-black/40 sm:rounded-l-2xl"
      onClose={onDone}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-bg px-4 py-3 sm:px-5">
        <h2 id="edit-h" className="text-lg font-semibold">
          {title}
        </h2>
        <form method="dialog">
          <button type="submit" className={filledBtn}>
            Done
          </button>
        </form>
      </div>
      <div className="space-y-4 p-4 sm:p-5">{children}</div>
    </dialog>
  );
});

/** A ref for the edit sheet and a function that opens it, scrolled to one part when given. */
export function useEditSheet() {
  const ref = useRef<HTMLDialogElement>(null);
  const open = useCallback((focusId?: string) => {
    ref.current?.showModal();
    if (focusId)
      requestAnimationFrame(() =>
        document.getElementById(focusId)?.scrollIntoView({ block: "start" }),
      );
  }, []);
  return { ref, open };
}
