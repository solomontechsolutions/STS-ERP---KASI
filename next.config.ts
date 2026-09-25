import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Camera and microphone stay at the browser default ("self"), which
          // lets the meeting room's iframe receive them through its `allow`
          // attribute whichever Jitsi host is configured.
          { key: "Permissions-Policy", value: "geolocation=(), payment=()" },
        ],
      },
      {
        // The service worker must never be served stale, or a fix to push
        // handling would not reach installed phones.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
