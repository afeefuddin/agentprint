import type { Metadata } from "next";
import { listShares } from "@agentprint/database";
import { requireViewer } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { SharesWorkspace } from "@/components/shares-workspace";
import { appMainClass, eyebrowClass } from "@/lib/ui";

export const metadata: Metadata = { title: "Shared sessions" };

export default async function SessionsPage() {
  const current = await requireViewer();
  const shares = await listShares(current.id);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://agentprint.tech";
  return (
    <>
      <SiteHeader current={current} />
      <main id="main" className={appMainClass}>
        <div className="shell">
          <header className="mb-8 flex items-end justify-between gap-8 border-b border-line pb-7 max-tablet:items-start">
            <div>
              <span className={eyebrowClass}>Published work</span>
              <h1 className="mt-2 text-4xl font-semibold tracking-[-.035em] text-ink-strong max-tablet:text-3xl">Your shared sessions</h1>
            </div>
            <p className="shrink-0 text-right text-xs text-faint max-tablet:hidden">
              <b className="block text-3xl font-semibold leading-none text-ink-strong [font-variant-numeric:tabular-nums]">{shares.length}</b>
              <span className="mt-1.5 block">{shares.length === 1 ? "session" : "sessions"} published</span>
            </p>
          </header>
          <SharesWorkspace initialShares={shares} baseUrl={baseUrl} />
        </div>
      </main>
    </>
  );
}
