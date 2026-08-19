import type { Metadata } from "next";
import { listShares } from "@agentprint/database";
import { requireViewer } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { SharesWorkspace } from "@/components/shares-workspace";

export const metadata: Metadata = { title: "Shared sessions" };

export default async function SessionsPage() {
  const current = await requireViewer();
  const shares = await listShares(current.id);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://agentprint.tech";
  return (
    <>
      <SiteHeader current={current} />
      <main id="main" className="shares-main">
        <div className="shell">
          <header className="shares-head">
            <div>
              <span className="eyebrow">Session sharing</span>
              <h1>Shared sessions</h1>
              <p>
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
