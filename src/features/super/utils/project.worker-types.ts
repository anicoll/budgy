import type { SuperPlan, SuperSettings } from "../types";
import type { DrawdownResult, SuperProjectionResult } from "./project";

export const FUND_COLORS = [
  "hsl(262 83% 65%)",
  "hsl(190 95% 55%)",
  "hsl(152 65% 50%)",
  "hsl(38 92% 55%)",
  "hsl(330 80% 65%)",
];

export interface SuperWorkerInput {
  plans: SuperPlan[];
  settings: SuperSettings;
  prefsSalary: number; // cents
}

export interface FundProjectionResult {
  plan: SuperPlan;
  isIndependent: boolean;
  effectiveCurrentAge: number;
  projection: SuperProjectionResult;
  color: string;
}

export interface SuperWorkerOutput {
  fundProjections: FundProjectionResult[];
  chartSeries: { name: string; data: { x: string; y: number }[]; color: string }[];
  totalNominal: number;
  totalReal: number;
  totalDrawdown: number;
  yearsToRetirement: number;
  hasMultipleOwners: boolean;
  capBreaches: FundProjectionResult[];
  drawdownProjection: DrawdownResult | null;
  depletionAge: number | null;
  longevityColour: string;
  topUpFortnightly: number | null;
  maxSustainableWithdrawal: number;
}

export interface WorkerMessage {
  id: number;
  payload: SuperWorkerInput;
}

export interface WorkerResponse {
  id: number;
  payload: SuperWorkerOutput;
}
