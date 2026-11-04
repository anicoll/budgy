"use client";

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  forgetAll,
  readSaved,
  rememberAgain,
  type SavedMode,
  type SharedLoan,
  saveTool,
  startingPoint,
  type ToolKey,
} from "./saved";

export interface SavedConfig<T> {
  tool: ToolKey;
  initial: () => T;
  decode: (query: string) => T;
  encode: (state: T) => string;
  /** How this tool's state maps onto the shared loan. Leave out if it has none. */
  loan?: {
    read: (state: T) => Partial<SharedLoan>;
    apply: (state: T, loan: Partial<SharedLoan>) => T;
  };
}

/** What the "remembered on this device" line needs. */
export interface SavedControls {
  mode: SavedMode;
  /** Something is saved for this tool, so "back to mine" has somewhere to go. */
  hasOwn: boolean;
  keepLink: () => void;
  backToMine: () => void;
  forget: () => void;
  remember: () => void;
}

export interface Saved<T> extends SavedControls {
  state: T;
  setState: Dispatch<SetStateAction<T>>;
}

/**
 * A tool's inputs, kept in step with the URL (for sharing) and with this
 * device's saved inputs (so the person doesn't type them again). `cfg` must be
 * a stable object, defined outside the component.
 */
export function useSavedState<T>(cfg: SavedConfig<T>): Saved<T> {
  const [state, setState] = useState<T>(cfg.initial);
  const [mode, setMode] = useState<SavedMode>("saved");
  const [hasOwn, setHasOwn] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const open = useCallback(
    (search: string) => {
      const data = readSaved();
      const start = startingPoint(cfg.tool, search, data);
      let s = start.query ? cfg.decode(start.query) : cfg.initial();
      if (start.mode === "saved" && cfg.loan) s = cfg.loan.apply(s, data.loan);
      setState(s);
      setMode(start.mode);
      setHasOwn(Boolean(data.tools[cfg.tool]));
    },
    [cfg],
  );

  // Work out where to start once, in the browser.
  useEffect(() => {
    open(window.location.search);
    setLoaded(true);
  }, [open]);

  // Save straight away, so following a link right after an edit keeps it.
  useEffect(() => {
    if (!loaded || mode !== "saved") return;
    saveTool(cfg.tool, cfg.encode(state), cfg.loan?.read(state));
    setHasOwn(true);
  }, [state, loaded, mode, cfg]);

  // Keep the URL in step too, a little behind, so it can be shared.
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (!loaded) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      window.history.replaceState(null, "", `?${cfg.encode(state)}`);
    }, 300);
    return () => clearTimeout(timer.current);
  }, [state, loaded, cfg]);

  return {
    state,
    setState,
    mode,
    hasOwn,
    keepLink: () => {
      rememberAgain();
      setMode("saved"); // the save effect stores what's on screen
    },
    backToMine: () => open(""),
    forget: () => {
      forgetAll();
      setHasOwn(false);
      setMode("off");
      setState(cfg.initial());
    },
    remember: () => {
      rememberAgain();
      setMode("saved");
    },
  };
}
