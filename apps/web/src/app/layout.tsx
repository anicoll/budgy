import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Analytics } from "@/components/Analytics";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  // Absolute URLs for share images and canonical links.
  metadataBase: new URL("https://budgy.nicoll.dev"),
  title: { default: "Budgy: free Australian money tools", template: "%s · Budgy" },
  description:
    "Free, private financial calculators for Australians. No sign-up, and your numbers never leave your device.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5fafb" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1415" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-AU">
      <body className="min-h-dvh">
        <Suspense>
          <SiteHeader />
        </Suspense>
        {children}
        <SiteFooter />
        <Analytics />
      </body>
    </html>
  );
}
