import type { Metadata } from "next";
import { listDevices } from "@agentprint/database";
import { requireViewer } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { OnboardingFlow } from "@/components/onboarding-flow";

export const metadata: Metadata = { title: "Set up your agent" };

export default async function OnboardingPage() {
  const current = await requireViewer({ allowIncomplete: true });
  const devices = await listDevices(current.id);
  return (
    <>
      <SiteHeader current={current} variant="minimal" />
      <main id="main" className={`onboarding-main${current.onboarding_complete ? "" : " profile-claim-main"}`}>
        <div className="shell">
          <OnboardingFlow
            handle={current.handle}
            hasDevice={devices.some((device) => !device.revoked_at)}
            profileComplete={current.onboarding_complete}
            appUrl={process.env.NEXT_PUBLIC_APP_URL ?? "https://agentprint.tech"}
          />
        </div>
      </main>
    </>
  );
}
