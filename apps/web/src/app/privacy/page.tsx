import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What budgy collects: anonymous page visit counts, and nothing you type. Your numbers stay on your device.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 pt-6 pb-24 sm:pt-10">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy</h1>
      <div className="mt-6 space-y-4 text-[15px] leading-relaxed">
        <p>
          <strong>Your numbers never leave your device.</strong> Every calculation runs in your
          browser. Nothing you type is sent to us or anyone else, and there is no sign-up.
        </p>
        <p>
          If you let a tool remember your inputs, they are saved in your browser&apos;s local
          storage on this device only. You can clear them any time with &ldquo;Forget everything on
          this device&rdquo; on the home page.
        </p>
        <h2 className="pt-2 text-xl font-semibold">Visit counts</h2>
        <p>
          We use Cloudflare Web Analytics to count visits, so we know which tools people find
          useful. It sets no cookies, does not track you across sites, and does not build a profile
          of you. It records the page, the referring site, your country, device type and how fast
          the page loaded. It never sees what you type into a tool.
        </p>
        <p>
          Read more in{" "}
          <a
            className="text-accent hover:underline"
            href="https://www.cloudflare.com/web-analytics/"
            rel="noopener"
          >
            Cloudflare&apos;s Web Analytics overview
          </a>
          .
        </p>
        <h2 className="pt-2 text-xl font-semibold">Hosting</h2>
        <p>
          The site is hosted on GitHub Pages, which keeps standard server logs (such as IP
          addresses) for security. See{" "}
          <a
            className="text-accent hover:underline"
            href="https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages#data-collection"
            rel="noopener"
          >
            GitHub&apos;s note on Pages data collection
          </a>
          .
        </p>
      </div>
    </main>
  );
}
