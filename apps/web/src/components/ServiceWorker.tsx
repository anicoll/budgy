"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js on the built site, so tools you've opened work with
 * no signal. Not in `next dev`, where a cached page would hide your changes.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const base = process.env.BUDGY_BASE_PATH ?? "";
    navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` }).catch(() => {
      /* no offline support, the site still works */
    });
  }, []);
  return null;
}
