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
          <header>
            <div>
              <span className={eyebrowClass}>Session sharing</span>
              <h1 className="mt-2 text-[32px] font-[weight:560] tracking-[-.03em] text-ink-strong">Shared sessions</h1>
              <p className="mb-8 mt-2.5 max-w-[560px] text-sm text-muted">
                Each of these is one session you chose to publish. Background sync never
                uploads transcript content — only these do, and you can delete any of them.
              </p>
            </div>
          </header>
          <SharesWorkspace initialShares={shares} baseUrl={baseUrl} />
        </div>
      </main>
    </>
  );
}
