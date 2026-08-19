import type { Metadata } from "next";
import { getProfile, listDevices } from "@agentprint/database";
import { formatTokens } from "@agentprint/analytics";
import { requireViewer } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { SettingsControls } from "@/components/settings-controls";

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
      <main id="main" className="settings-main">
        <div className="shell">
          <header className="settings-head">
            <h1>Settings</h1>
            <p>What your profile discloses, the devices allowed to report, and the data you can take with you.</p>
          </header>
          <section className="sync-readout" aria-label="Collection summary">
            <div className="sync-state" data-tone={state.tone}>
              <span className="sync-pulse"><i /></span>
              <span><b>{state.title}</b><small>{state.detail}</small></span>
            </div>
            <div><span>Devices</span><b>{active.length}</b></div>
            <div><span>Trailing tokens</span><b>{formatTokens(data.summary.totalTokens)}</b></div>
            <div><span>Records accepted</span><b>{data.activity.reduce((sum, day) => sum + day.events, 0).toLocaleString()}</b></div>
          </section>
          <SettingsControls
            initialPrivacy={{
              is_public: current.is_public,
              show_tokens: current.show_tokens,
              show_cost: current.show_cost,
              show_harnesses: current.show_harnesses,
              show_models: current.show_models,
              show_streaks: current.show_streaks,
              friends_can_compare: current.friends_can_compare
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
