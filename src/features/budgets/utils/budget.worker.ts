/// <reference lib="webworker" />

import type { BudgetWorkerOutput, WorkerMessage, WorkerResponse } from "./budget.worker-types";
import { computeEnvelopeStates } from "./envelope";

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const {
    id,
    payload: { budget, transactions, categories, nowISO, viewRange, viewPeriod },
  } = e.data;

  const bundle = computeEnvelopeStates({
    budget,
    transactions,
    categories,
    nowISO,
    viewRange,
    viewPeriod,
  });

  const response: WorkerResponse = {
    id,
    payload: {
      bundle,
      forecasts: {},
      balanceHistory: {},
    } satisfies BudgetWorkerOutput,
  };
  self.postMessage(response);
};
