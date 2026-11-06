import type { Metadata, Viewport } from "next";
import { Analytics } from "@/components/Analytics";
import { BottomNav, SideNav, TopBar } from "@/components/AppNav";
import { SiteFooter } from "@/components/SiteFooter";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  // Absolute URLs for share images and canonical links.
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: "%s · budgy" },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_AU",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
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
        <div className="lg:flex">
          <SideNav />
          <div className="min-w-0 flex-1 pb-[var(--bottom-nav-h)]">
            <TopBar />
            {children}
            <SiteFooter />
          </div>
        </div>
        <BottomNav />
        <Analytics />
      </body>
    </html>
  );
}
