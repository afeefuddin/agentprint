import type { Metadata } from "next";
import { getProfile, listDevices } from "@agentprint/database";
import { formatTokens } from "@agentprint/analytics";
import { requireViewer } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { SettingsControls } from "@/components/settings-controls";
import { appMainClass } from "@/lib/ui";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const current = await requireViewer();
  const [data, devices] = await Promise.all([
    getProfile(current.handle, current.id),
    listDevices(current.id)
  ]);
  if (!data) return null;
  const active = devices.filter((device) => !device.revoked_at);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://agentprint.tech";
  return (
    <>
      <SiteHeader current={current} />
      <main id="main" className={appMainClass}>
        <div className="shell">
          <header className="mb-9">
            <h1 className="m-0 text-3xl font-medium tracking-[-.04em] max-tablet:text-3xl">Settings</h1>
          </header>
          <section
            className="grid grid-cols-3 overflow-hidden rounded-md border border-line-strong bg-panel max-tablet:grid-cols-1"
            aria-label="Collection summary"
          >
            <div className="flex min-h-[92px] flex-col justify-center gap-1.5 border-r border-line px-[22px] py-[18px] max-tablet:border-b max-tablet:border-r-0">
              <span className="text-xs text-faint">Devices</span>
              <b className="text-2xl font-semibold leading-none text-ink-strong [font-variant-numeric:tabular-nums]">{active.length}</b>
            </div>
            <div className="flex min-h-[92px] flex-col justify-center gap-1.5 border-r border-line px-[22px] py-[18px] max-tablet:border-b max-tablet:border-r-0">
              <span className="text-xs text-faint">Trailing tokens</span>
              <b className="text-2xl font-semibold leading-none text-ink-strong [font-variant-numeric:tabular-nums]">{formatTokens(data.summary.totalTokens)}</b>
            </div>
            <div className="flex min-h-[92px] flex-col justify-center gap-1.5 px-[22px] py-[18px]">
              <span className="text-xs text-faint">Records accepted</span>
              <b className="text-2xl font-semibold leading-none text-ink-strong [font-variant-numeric:tabular-nums]">
                {data.activity.reduce((sum, day) => sum + day.events, 0).toLocaleString()}
              </b>
            </div>
          </section>
          <SettingsControls
            identity={{
              handle: current.handle,
              displayName: current.display_name,
              avatarUpdatedAt: current.avatar_updated_at?.toISOString() ?? null
            }}
            initialPrivacy={{
              is_public: current.is_public,
              show_tokens: current.show_tokens,
              show_harnesses: current.show_harnesses,
              show_models: current.show_models,
              show_streaks: current.show_streaks
            }}
            initialDevices={devices}
            profileUrl={`${baseUrl}/${current.handle}`}
          />
        </div>
      </main>
    </>
  );
}
