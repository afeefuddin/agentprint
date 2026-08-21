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
      <main
        id="main"
        className="relative min-h-[calc(100vh-var(--header-h))] bg-[#eceee8] pb-[90px] pt-[34px] before:absolute before:inset-x-0 before:bottom-full before:h-[var(--header-h)] before:bg-[#eceee8] before:content-[''] max-tablet:pb-[60px] max-tablet:pt-6"
      >
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
