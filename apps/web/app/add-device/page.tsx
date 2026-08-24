import type { Metadata } from "next";
import { DeviceSetup } from "@/components/device-setup";
import { SiteHeader } from "@/components/site-header";
import { requireViewer } from "@/lib/auth";
import { appMainClass } from "@/lib/ui";

export const metadata: Metadata = { title: "Add a device" };

export default async function AddDevicePage() {
  const current = await requireViewer();

  return (
    <>
      <SiteHeader current={current} />
      <main id="main" className={appMainClass}>
        <div className="shell">
          <DeviceSetup
            appUrl={process.env.NEXT_PUBLIC_APP_URL ?? "https://agentprint.tech"}
            title="Connect another machine."
            description="Install Agentprint on another machine, then sign in to connect it to your profile."
            className="mx-auto min-h-[680px] w-full max-w-[620px] pb-16 max-tablet:min-h-0 max-tablet:justify-start max-tablet:pb-10"
          />
        </div>
      </main>
    </>
  );
}
