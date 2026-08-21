import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Agentprint — Proof of work with agents",
    template: "%s · Agentprint"
  },
  description:
    "A private-by-default, public proof-of-work profile for developers who build with AI agents.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://agentprint.tech")
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
      </body>
    </html>
  );
}
