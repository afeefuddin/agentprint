import type { Metadata } from "next";
import { getProfile, listDevices } from "@agentprint/database";
import { formatTokens } from "@agentprint/analytics";
import { requireViewer } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { SettingsControls } from "@/components/settings-controls";
import { appMainClass } from "@/lib/ui";

export const metadata: Metadata = { title: "Settings" };

function syncStamp(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export default async function SettingsPage() {
  const current = await requireViewer();
  const [data, devices] = await Promise.all([
    getProfile(current.handle, current.id),
    listDevices(current.id)
  ]);
  if (!data) return null;
  const active = devices.filter((device) => !device.revoked_at);
  const lastSync = active.map((device) => device.last_sync_at).filter(Boolean).sort().at(-1);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://agentprint.tech";

  // Volume comes from daily_usage (user-level); detection, version and last-collected
  // come from device_sources (per device). Neither alone answers "is this still
  // reporting?", so the harness table joins them.
  const detected = new Map<string, { version: string | null; lastCollected: string | null; live: boolean }>();
  for (const device of devices) {
    for (const source of device.sources) {
      const seen = detected.get(source.harness_id);
      detected.set(source.harness_id, {
        version: source.version ?? seen?.version ?? null,
        lastCollected: [seen?.lastCollected, source.last_collected_at]
          .filter(Boolean).sort().at(-1) ?? null,
        live: (seen?.live ?? false) || !device.revoked_at
      });
    }
  }
  const harnessTotal = Object.values(data.harnesses).reduce((sum, value) => sum + value, 0);
  const harnesses = [...new Set([...Object.keys(data.harnesses), ...detected.keys()])]
    .map((id) => ({
      id,
      tokens: data.harnesses[id] ?? 0,
      share: harnessTotal > 0 ? (data.harnesses[id] ?? 0) / harnessTotal : 0,
      version: detected.get(id)?.version ?? null,
      lastCollected: detected.get(id)?.lastCollected ?? null,
      live: detected.get(id)?.live ?? false
    }))
    .sort((left, right) => right.tokens - left.tokens || left.id.localeCompare(right.id))
    .slice(0, 10);

  const models = Object.entries(data.models)
    .map(([id, tokens]) => ({ id, tokens }))
    .sort((left, right) => right.tokens - left.tokens || left.id.localeCompare(right.id))
    .slice(0, 10);
  // The strip claimed "All systems healthy" even with nothing connected. Report the real state.
  const state = active.length === 0
    ? { tone: "idle", title: "No devices reporting", detail: "Connect a device to begin collecting." }
    : lastSync
      ? { tone: "healthy", title: "Collection healthy", detail: `Last sync ${syncStamp(lastSync)}` }
      : { tone: "waiting", title: "Awaiting first sync", detail: `${active.length} device${active.length === 1 ? "" : "s"} registered` };
  return (
    <>
      <SiteHeader current={current} />
      <main id="main" className={appMainClass}>
        <div className="shell">
          <header className="mb-9">
            <h1 className="mb-1.5 text-3xl font-medium tracking-[-.04em] max-tablet:text-3xl">Settings</h1>
            <p className="m-0 max-w-[62ch] text-base text-muted">
              What your profile discloses, the devices allowed to report, and the data you can take with you.
            </p>
          </header>
          <section
            className="grid grid-cols-[1.5fr_repeat(3,1fr)] overflow-hidden rounded-md border border-line-strong bg-panel max-desktop:grid-cols-2"
            aria-label="Collection summary"
          >
            <div
              className="group flex min-h-[92px] flex-row items-center gap-[13px] border-r border-line bg-canvas-deep px-[22px] py-[18px] max-desktop:border-b max-tablet:col-span-full"
              data-tone={state.tone}
            >
              <span className="grid size-8 flex-[0_0_32px] place-items-center rounded-full border border-line-strong group-data-[tone=healthy]:border-[color-mix(in_srgb,var(--color-accent)_32%,var(--color-line))]">
                <i className="size-2 rounded-full bg-faint group-data-[tone=healthy]:bg-accent group-data-[tone=waiting]:bg-amber" />
              </span>
              <span>
                <b className="block text-base font-medium text-ink-strong">{state.title}</b>
                <small className="mt-[3px] block text-xs text-muted">{state.detail}</small>
              </span>
            </div>
            <div className="flex min-h-[92px] flex-col justify-center gap-1.5 border-r border-line px-[22px] py-[18px] max-desktop:border-b max-desktop:border-r-0">
              <span className="text-xs text-faint">Devices</span>
              <b className="text-2xl font-semibold leading-none text-ink-strong [font-variant-numeric:tabular-nums]">{active.length}</b>
            </div>
            <div className="flex min-h-[92px] flex-col justify-center gap-1.5 border-r border-line px-[22px] py-[18px] max-tablet:border-b">
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
            harnesses={harnesses}
            models={models}
            profileUrl={`${baseUrl}/${current.handle}`}
          />
        </div>
      </main>
    </>
  );
}
