/**
 * The summary bar pinned above the bottom menu on phones. Phones show the
 * inputs first, so this keeps the answer in view and jumps to the results.
 */
export function ResultsBar({ children }: { children: React.ReactNode }) {
  return (
    <a
      href="#results"
      className="fixed inset-x-0 bottom-[var(--bottom-nav-h)] z-10 flex items-center justify-between gap-3 border-t border-border bg-surface/95 px-4 py-3 text-sm backdrop-blur lg:hidden"
    >
      <span className="num min-w-0">{children}</span>
      <span className="shrink-0 text-accent">See results ↓</span>
    </a>
  );
}
