import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "KASI | Solomon Tech Solutions",
    short_name: "KASI",
    description: "Solomon Tech Solutions internal operating system",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f2647",
    theme_color: "#0f2647",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Decisions", url: "/boardroom/decisions" },
      { name: "Meetings", url: "/meetings" },
      { name: "Collections", url: "/finance/collections" },
    ],
  };
}
