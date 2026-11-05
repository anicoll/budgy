"use client";

import { useEffect } from "react";
import { ANALYTICS_HOST, CF_BEACON_TOKEN } from "@/lib/analytics";

/**
 * Loads the Cloudflare Web Analytics beacon on the production host only.
 * It sets no cookies and records page views and load times, never the
 * numbers people type into a tool.
 */
export function Analytics() {
  useEffect(() => {
    if (!CF_BEACON_TOKEN || window.location.hostname !== ANALYTICS_HOST) return;
    const s = document.createElement("script");
    s.defer = true;
    s.src = "https://static.cloudflareinsights.com/beacon.min.js";
    s.dataset.cfBeacon = JSON.stringify({ token: CF_BEACON_TOKEN });
    document.body.appendChild(s);
  }, []);
  return null;
}
