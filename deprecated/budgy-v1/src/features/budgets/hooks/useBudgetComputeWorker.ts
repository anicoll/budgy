"use client";

import { useEffect, useRef, useState } from "react";
import type {
  BudgetWorkerInput,
  BudgetWorkerOutput,
  WorkerResponse,
} from "../utils/budget.worker-types";

export function useBudgetComputeWorker(input: BudgetWorkerInput | null) {
  const [result, setResult] = useState<BudgetWorkerOutput | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    const w = new Worker(new URL("../utils/budget.worker.ts", import.meta.url));
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      // Drop stale responses — only accept the latest request
      if (e.data.id === reqId.current) {
        setResult(e.data.payload);
        setIsComputing(false);
      }
    };
    w.onerror = () => setIsComputing(false);
    workerRef.current = w;
    return () => w.terminate();
  }, []);

  useEffect(() => {
    if (!input || !workerRef.current) return;
    const id = ++reqId.current;
    setIsComputing(true);
    workerRef.current.postMessage({ id, payload: input });
  }, [input]);

  return { result, isComputing };
}
