import type { Metadata } from "next";
import { getProfile, listDevices } from "@agentprint/database";
import { formatTokens } from "@agentprint/analytics";
import { Activity, ArrowUpRight, Clock3, Server } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { DashboardControls } from "@/components/dashboard-controls";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const current = await requireViewer();
  const [data, devices] = await Promise.all([
    getProfile(current.handle, current.id),
    listDevices(current.id)
  ]);
  if (!data) return null;
  const lastSync = devices.map((device) => device.last_sync_at).filter(Boolean).sort().at(-1);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return (
    <>
      <SiteHeader current={current} />
      <main id="main" className="dashboard-main">
        <div className="shell">
          <header className="dashboard-welcome">
            <div><span className="eyebrow">Private workspace</span><h1>Good to see you, {current.display_name.split(" ")[0]}.</h1><p>Your agent trace is healthy and under your control.</p></div>
            <a className="button button-secondary" href={`/${current.handle}`}>View profile <ArrowUpRight size={15} /></a>
          </header>
          <section className="health-strip" aria-label="Sync summary">
            <div className="health-primary"><span className="health-pulse"><i /></span><span><b>All systems healthy</b><small>{devices.length ? `${devices.length} connected device${devices.length === 1 ? "" : "s"}` : "Connect a device to begin"}</small></span></div>
            <div><Clock3 size={16} /><span><small>Last successful sync</small><b>{lastSync ? new Date(lastSync).toLocaleString() : "Not yet synced"}</b></span></div>
            <div><Activity size={16} /><span><small>Trailing tokens</small><b>{formatTokens(data.summary.totalTokens)}</b></span></div>
            <div><Server size={16} /><span><small>Accepted records</small><b>{data.activity.reduce((sum, day) => sum + day.events, 0).toLocaleString()}</b></span></div>
          </section>
          <DashboardControls
            initialPrivacy={{
              is_public: current.is_public,
              show_tokens: current.show_tokens,
              show_cost: current.show_cost,
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
