/**
 * Cloudflare Web Analytics site token. The deploy workflow sets it from the
 * CF_BEACON_TOKEN repository variable. It is not a secret: it ships in every
 * page, like any analytics ID. Left unset (local dev, forks), the beacon is off.
 */
export const CF_BEACON_TOKEN = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN ?? "";

/** Only the production site reports, so localhost and forks stay out of the numbers. */
export const ANALYTICS_HOST = "budgy.nicoll.dev";
