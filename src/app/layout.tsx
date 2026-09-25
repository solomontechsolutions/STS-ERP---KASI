import type { Metadata, Viewport } from "next";
import { Inter, Tinos } from "next/font/google";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import "./globals.css";

// KASI uses Apple's San Francisco, the system font of iPhone, iPad and Mac
// (see --font-sans in globals.css). Apple's licence does not allow serving
// SF as a web font, so other devices fall back to Inter, the closest open
// match, loaded here.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Fallback for Times New Roman in formal documents (see .legal-doc).
const tinos = Tinos({
  variable: "--font-tinos",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "KASI",
  description: "Solomon Tech Solutions internal operating system",
  applicationName: "KASI",
  // iOS reads these (not the manifest) when KASI is added to the home screen.
  appleWebApp: { capable: true, title: "KASI", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0f2647",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${tinos.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <InstallPrompt />
      </body>
    </html>
  );
}
