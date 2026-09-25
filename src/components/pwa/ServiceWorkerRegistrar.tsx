"use client";

import { useEffect } from "react";

/** Registers the push-only service worker once per page load. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((error) => console.error("Service worker registration failed", error));
  }, []);
  return null;
}
