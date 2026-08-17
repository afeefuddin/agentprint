"use client";

import Link from "next/link";
import { AlertTriangle, Check, Copy, Download, ExternalLink, Laptop, ShieldCheck, Trash2, Users } from "lucide-react";
import { useState } from "react";

type Device = {
  id: string;
  name: string;
  platform: string;
  agent_version: string;
  last_sync_at: string | null;
  revoked_at: string | null;
  sources: { harness_id: string; status: string }[];
};

type Privacy = {
  is_public: boolean;
  show_tokens: boolean;
  show_cost: boolean;
  show_harnesses: boolean;
  show_models: boolean;
  show_streaks: boolean;
  friends_can_compare: boolean;
};

const privacyLabels: Record<keyof Privacy, { label: string; description: string }> = {
  is_public: { label: "Public profile", description: "Allow anyone with your profile URL to see selected metrics." },
  show_tokens: { label: "Token totals", description: "Show lifetime and daily input + output token totals." },
  show_cost: { label: "Estimated spend", description: "Show cost estimates with their calculation provenance." },
  show_harnesses: { label: "Harness mix", description: "Show the tools that make up your activity." },
  show_models: { label: "Model mix", description: "Show model identifiers and relative usage." },
  show_streaks: { label: "Streaks", description: "Show current and longest active-day streaks." },
  friends_can_compare: { label: "Friend comparisons", description: "Let accepted friends compare the metrics you have chosen to show." }
};

export function DashboardControls({
  initialPrivacy,
  initialDevices,
  profileUrl
}: {
  initialPrivacy: Privacy;
  initialDevices: Device[];
  profileUrl: string;
}) {
  const [privacy, setPrivacy] = useState(initialPrivacy);
  const [devices, setDevices] = useState(initialDevices);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  async function toggle(key: keyof Privacy) {
    const next = { ...privacy, [key]: !privacy[key] };
    setPrivacy(next);
    const response = await fetch("/v1/me/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [key]: next[key] })
    });
    if (!response.ok) {
      setPrivacy(privacy);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1400);
  }

  async function revoke(id: string) {
    if (!window.confirm("Revoke this device? It will stop syncing immediately.")) return;
    const response = await fetch(`/v1/me/devices/${id}`, { method: "DELETE" });
    if (response.ok) setDevices((items) => items.filter((device) => device.id !== id));
  }

  async function copyProfile() {
    await navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      <section className="dashboard-section" id="visibility">
        <div className="dashboard-heading">
          <div><span className="eyebrow">Public by choice</span><h2>Profile visibility</h2><p>Each metric is enforced at the profile query boundary.</p></div>
          <span className="saved-indicator" data-visible={saved || undefined}><Check size={13} /> Saved</span>
        </div>
        <div className="privacy-controls">
          {(Object.keys(privacyLabels) as (keyof Privacy)[]).map((key) => {
            const item = privacyLabels[key];
            return (
              <div className={key === "is_public" ? "privacy-control primary" : "privacy-control"} key={key}>
                <div>
                  {key === "is_public" && <ShieldCheck size={17} />}
                  {key === "friends_can_compare" && <Users size={17} />}
                  <span><b>{item.label}</b><small>{item.description}</small></span>
                </div>
                <button
                  className="switch"
                  role="switch"
                  aria-checked={privacy[key]}
                  aria-label={item.label}
                  onClick={() => toggle(key)}
                ><i /></button>
              </div>
            );
          })}
        </div>
        <div className="share-url">
          <span>{profileUrl}</span>
          <button onClick={copyProfile}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy"}</button>
          <a href={profileUrl}><ExternalLink size={14} /> Preview</a>
        </div>
      </section>

      <section className="dashboard-section">
        <div className="dashboard-heading">
          <div><span className="eyebrow">Agent access</span><h2>Connected devices</h2><p>Revoked credentials stop ingestion immediately.</p></div>
          <Link className="button button-secondary button-small" href="/onboarding"><Laptop size={14} /> Add device</Link>
        </div>
        <div className="device-list">
          {devices.length === 0 && <div className="empty-device"><Laptop size={23} /><span><b>No connected devices</b><small>Install the agent to start your first sync.</small></span><Link href="/onboarding">Install agent →</Link></div>}
          {devices.map((device) => (
            <div className="device-row" data-revoked={device.revoked_at ? "true" : undefined} key={device.id}>
              <div className="device-icon"><Laptop size={19} /></div>
              <div className="device-name"><b>{device.name}</b><span>{device.platform} · agent {device.agent_version}</span></div>
              <div className="device-sources">{device.sources.map((source) => <span key={source.harness_id}>{source.harness_id}</span>)}</div>
              <div className="device-status"><i /><span><b>{device.revoked_at ? "Revoked" : "Healthy"}</b><small>{device.revoked_at ? `Revoked ${new Date(device.revoked_at).toLocaleString()}` : device.last_sync_at ? `Synced ${new Date(device.last_sync_at).toLocaleString()}` : "Awaiting first sync"}</small></span></div>
              {device.revoked_at
                ? <span className="revoked-mark">—</span>
                : <button className="icon-button danger" onClick={() => revoke(device.id)} aria-label={`Revoke ${device.name}`}><Trash2 size={15} /></button>}
            </div>
          ))}
        </div>
      </section>

      <section className="data-zone" aria-labelledby="data-zone-title">
        <h2 id="data-zone-title">Your data</h2>
        <div className="data-panel">
          <div>
            <b>Export personal data</b>
            <small>JSON · normalized records and settings</small>
          </div>
          <a className="button button-secondary button-small" href="/v1/me/export" download><Download size={14} /> Download</a>
        </div>
        <div className="data-panel danger">
          <div>
            <b><AlertTriangle size={15} /> Delete account</b>
            <small>Permanent and immediate. Removes every server-side record.</small>
          </div>
          <button className="button button-danger button-small" onClick={async () => {
            if (!window.confirm("Permanently delete your account and all server-side data? This cannot be undone.")) return;
            const response = await fetch("/v1/me/account", { method: "DELETE" });
            if (response.ok) window.location.assign("/");
          }}><Trash2 size={14} /> Delete</button>
        </div>
      </section>
    </>
  );
}
