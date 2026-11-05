/**
 * Cloudflare Web Analytics site token for budgy.nicoll.dev. It is public (it
 * ships in every page), so it lives here, not in a secret. Empty turns the
 * beacon off, which is what local dev and preview builds want.
 */
export const CF_BEACON_TOKEN = "";

/** Only the production site reports, so localhost and forks stay out of the numbers. */
export const ANALYTICS_HOST = "budgy.nicoll.dev";
