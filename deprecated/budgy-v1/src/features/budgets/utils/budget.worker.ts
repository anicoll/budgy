/// <reference lib="webworker" />

import type { BudgetWorkerOutput, WorkerMessage, WorkerResponse } from "./budget.worker-types";
import { computeEnvelopeStates } from "./envelope";
import { computeForecast } from "./forecast";
import { computeBalanceHistory } from "./history";

const HISTORY_PERIODS = 12;

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

  // Decorate envelope-mode rows with forecast + balance history
  for (const state of [...bundle.income, ...bundle.expense]) {
    if (state.mode !== "envelope") continue;
    const forecast = computeForecast(state.target, transactions, state.balance, nowISO);
    if (forecast) {
      state.nextDueOn = forecast.nextDueOn;
      state.fundedByNextDue = forecast.fundedByNextDue;
      state.forecastConfidence = forecast.confidence;
    }
    state.balanceHistory = computeBalanceHistory(
      state.target,
      transactions,
      nowISO,
      HISTORY_PERIODS,
      viewPeriod,
    );
  }

  const response: WorkerResponse = {
    id,
    payload: { bundle } satisfies BudgetWorkerOutput,
  };
  self.postMessage(response);
};
