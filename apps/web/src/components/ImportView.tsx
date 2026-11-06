"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { decodeMoveFragment, describeSaved, isEmpty } from "@/lib/moveLink";
import { HOME_HREF, SAVED_CHANGED } from "@/lib/nav";
import { readSaved, replaceSaved, type SavedData } from "@/lib/saved";
import { tool } from "@/lib/tools";

const primary =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-6 text-[15px] font-medium text-on-accent hover:opacity-90";
const secondary =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-outline px-6 text-[15px] font-medium hover:bg-surface-container";

type State =
  | { kind: "reading" }
  | { kind: "broken" }
  | { kind: "ready"; data: SavedData; replaces: boolean }
  | { kind: "failed" };

/**
 * The page a move link opens. It reads the record from the # part, says what
 * it holds and asks before replacing anything saved on this device.
 */
export function ImportView() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "reading" });

  useEffect(() => {
    decodeMoveFragment(window.location.hash).then((data) => {
      // Keep the numbers out of the address bar and history from here on.
      window.history.replaceState(null, "", window.location.pathname);
      setState(
        data ? { kind: "ready", data, replaces: !isEmpty(readSaved()) } : { kind: "broken" },
      );
    });
  }, []);

  const bringIn = (data: SavedData) => {
    if (!replaceSaved(data)) return setState({ kind: "failed" });
    window.dispatchEvent(new Event(SAVED_CHANGED));
    router.push(HOME_HREF.dashboard);
  };

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 pt-10 pb-24">
      <h1 className="text-[28px] font-semibold tracking-tight">Bring your numbers across</h1>
      {state.kind === "reading" && <p className="text-muted">Reading the link…</p>}
      {state.kind === "broken" && (
        <>
          <p className="text-[15px]">
            This link doesn&apos;t carry any numbers we can read. It may have been cut short when it
            was copied. Try copying it again from Settings on your other device.
          </p>
          <Link href={HOME_HREF.dashboard} className={`${primary} self-start`}>
            Go to budgy
          </Link>
        </>
      )}
      {state.kind === "failed" && (
        <p className="text-[15px]">
          This browser isn&apos;t letting us save anything, so the numbers couldn&apos;t be brought
          in. Private browsing often blocks saving.
        </p>
      )}
      {state.kind === "ready" && (
        <>
          <p className="text-[15px]">This link carries:</p>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px]">
            {describeSaved(state.data, (t) => tool(t).name).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="text-[15px] text-muted">
            {state.replaces
              ? "Bringing these in replaces what's already saved on this device."
              : "They'll be saved in this browser only, like everything else on budgy."}
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => bringIn(state.data)} className={primary}>
              {state.replaces ? "Replace with these" : "Bring them in"}
            </button>
            <Link href={HOME_HREF.dashboard} className={secondary}>
              Not now
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
