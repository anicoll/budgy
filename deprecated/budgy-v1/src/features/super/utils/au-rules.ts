import type { Cents } from "@/lib/money/cents";

// AU Superannuation Guarantee rate — 12% from FY2025-26 (legislated max reached)
export const AU_SG_RATE = 0.12;

// Concessional contributions cap FY2024-25 = $30,000 (employer SG + salary sacrifice)
// Indexed to AWOTE in $2,500 increments; $30,000 used as the standing cap here.
export const CONCESSIONAL_CAP = 3_000_000 as Cents; // $30,000 in cents

// Non-concessional cap = 4 × concessional cap = $120,000
export const NON_CONCESSIONAL_CAP = 12_000_000 as Cents; // $120,000 in cents

// Preservation age (from 1 July 2024 all cohorts)
export const PRESERVATION_AGE = 60;

// Default retirement age = age pension eligibility age
export const DEFAULT_RETIREMENT_AGE = 67;

// Assumed post-retirement drawdown period (years) for monthly income estimate
export const DRAWDOWN_YEARS = 25;
