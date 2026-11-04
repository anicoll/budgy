"use client";

import type { SavedControls } from "@/lib/useSavedState";

const btn = "font-medium text-accent hover:underline";

/** One line under a tool's heading saying what this device remembers. */
export function SavedBar({ saved }: { saved: SavedControls }) {
  const { mode, hasOwn } = saved;
  return (
    <p
      className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted"
      aria-live="polite"
    >
      {mode === "saved" && (
        <>
          <span>Saved on this device only, across every tool, so it's here next time.</span>
          <button type="button" className={btn} onClick={saved.forget}>
            Forget everything
          </button>
        </>
      )}
      {mode === "link" && (
        <>
          <span>You're looking at a shared link. Your own saved inputs aren't changed.</span>
          <button type="button" className={btn} onClick={saved.keepLink}>
            Save these as mine
          </button>
          {hasOwn && (
            <button type="button" className={btn} onClick={saved.backToMine}>
              Back to mine
            </button>
          )}
        </>
      )}
      {mode === "off" && (
        <>
          <span>Not remembering your inputs on this device.</span>
          <button type="button" className={btn} onClick={saved.remember}>
            Remember them
          </button>
        </>
      )}
    </p>
  );
}
