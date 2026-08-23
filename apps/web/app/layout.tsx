import type { Metadata } from "next";
import "./globals.css";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: {
    default: "Agentprint – Coding agent activity tracker",
    template: "%s · Agentprint"
  },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "Agentprint – Coding agent activity tracker",
    description: SITE_DESCRIPTION,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Agentprint coding agent activity field" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Agentprint – Coding agent activity tracker",
    description: SITE_DESCRIPTION,
    images: ["/opengraph-image"]
  },
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: SITE_NAME,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "macOS, Linux, Windows",
      description: SITE_DESCRIPTION,
      url: SITE_URL,
      codeRepository: "https://github.com/afeefuddin/agentprint",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Free during beta" }
    }
  ]
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a
          className="fixed left-2 top-2 z-[100] -translate-y-[150%] bg-ink-strong px-3 py-2 text-canvas focus:translate-y-0"
          href="#main"
        >
          Skip to content
        </a>
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
        />
      </body>
    </html>
  );
}
