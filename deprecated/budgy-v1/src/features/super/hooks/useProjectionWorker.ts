"use client";

import { useEffect, useRef, useState } from "react";
import type {
  SuperWorkerInput,
  SuperWorkerOutput,
  WorkerResponse,
} from "../utils/project.worker-types";

export function useProjectionWorker(input: SuperWorkerInput | null) {
  const [result, setResult] = useState<SuperWorkerOutput | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    const w = new Worker(new URL("../utils/project.worker.ts", import.meta.url));
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
