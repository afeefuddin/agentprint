"use client";

import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, Check, Copy, Download, ExternalLink, Globe, Laptop, Terminal, Trash2, Users } from "lucide-react";
import { compactTokens, harnessBrand, harnessLabels, modelBrand } from "@/lib/brands";
import { useState } from "react";

type Model = { id: string; tokens: number };

type Harness = {
  id: string;
  tokens: number;
  share: number;
  version: string | null;
  lastCollected: string | null;
  live: boolean;
};

type Device = {
  id: string;
  name: string;
  platform: string;
  agent_version: string;
  last_sync_at: string | null;
  revoked_at: string | null;
  sources: { harness_id: string; status: string; version: string | null; last_collected_at: string | null }[];
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

type FieldKey = "show_tokens" | "show_cost" | "show_harnesses" | "show_models" | "show_streaks";

// Two audience switches decide whether anyone can see the profile at all; the field
// switches below decide which metrics those audiences get. The old flat grid of seven
// identical toggles hid that distinction.
const audiences: { key: "is_public" | "friends_can_compare"; label: string; description: string }[] = [
  { key: "is_public", label: "Public profile", description: "Anyone holding your profile address can open it." },
  { key: "friends_can_compare", label: "Friend comparisons", description: "Accepted friends can compare their trace against yours." }
];

const fields: { key: FieldKey; label: string }[] = [
  { key: "show_tokens", label: "Token totals" },
  { key: "show_cost", label: "Estimated spend" },
  { key: "show_harnesses", label: "Harness mix" },
  { key: "show_models", label: "Model mix" },
  { key: "show_streaks", label: "Streaks" }
];

function stamp(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function audienceNote(privacy: Privacy) {
  if (privacy.is_public && privacy.friends_can_compare) {
    return "Anyone with your address, plus accepted friends, can see the fields marked visible.";
  }
  if (privacy.is_public) return "Anyone with your address can see the fields marked visible.";
  if (privacy.friends_can_compare) return "Only accepted friends can see the fields marked visible.";
  return "Nothing is shared right now. These fields apply the moment you turn on an audience.";
}

export function SettingsControls({
  initialPrivacy,
  initialDevices,
  harnesses,
  models,
  profileUrl
}: {
  initialPrivacy: Privacy;
  initialDevices: Device[];
  harnesses: Harness[];
  models: Model[];
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

  const shared = fields.filter((field) => privacy[field.key]).length;

  return (
    <>
      <section className="settings-row" id="visibility">
        <div className="settings-rail">
          <h2>Audience</h2>
          <p>Who is allowed to see your trace at all.</p>
        </div>
        <div className="settings-body">
          {audiences.map((audience) => (
            <div className="audience-row" data-on={privacy[audience.key] || undefined} key={audience.key}>
              <span className="audience-icon">
                {audience.key === "is_public" ? <Globe size={17} /> : <Users size={17} />}
              </span>
              <span className="audience-copy">
                <b>{audience.label}</b>
                <small>{audience.description}</small>
              </span>
              <button
                className="switch"
                role="switch"
                aria-checked={privacy[audience.key]}
                aria-label={audience.label}
                onClick={() => toggle(audience.key)}
              ><i /></button>
            </div>
          ))}
          <div className="share-url">
            <span>{profileUrl}</span>
            <button onClick={copyProfile}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied" : "Copy"}</button>
            <a href={profileUrl}><ExternalLink size={15} /> Preview</a>
          </div>
        </div>
      </section>

      <section className="settings-row">
        <div className="settings-rail">
          <h2>Shared fields</h2>
          <p>Each one is enforced at the profile query boundary, not hidden in the client.</p>
        </div>
        <div className="settings-body">
          <div className="field-ledger-head">
            <span>{shared} of {fields.length} fields visible</span>
            <span className="saved-indicator" data-visible={saved || undefined}><Check size={14} /> Saved</span>
          </div>
          <div className="field-ledger">
            {fields.map((field) => (
              <div className="field-row" data-on={privacy[field.key] || undefined} key={field.key}>
                <b className="field-copy">{field.label}</b>
                <span className="field-state" aria-hidden="true">{privacy[field.key] ? "Visible" : "Hidden"}</span>
                <button
                  className="switch"
                  role="switch"
                  aria-checked={privacy[field.key]}
                  aria-label={field.label}
                  onClick={() => toggle(field.key)}
                ><i /></button>
              </div>
            ))}
          </div>
          <p className="audience-note">{audienceNote(privacy)}</p>
        </div>
      </section>

      <section className="settings-row">
        <div className="settings-rail">
          <h2>Harnesses</h2>
          <p>What each agent has contributed, and whether it is still reporting.</p>
        </div>
        <div className="settings-body">
          {harnesses.length === 0 ? (
            <p className="harness-empty">No harness activity yet. Agents appear here after their first sync.</p>
          ) : (
            <div className="harness-table">
              <div className="harness-head">
                <span>Agent</span>
                <span />
                <span>Share</span>
                <span>Tokens</span>
                <span>Last seen</span>
              </div>
              {harnesses.map((harness) => (
                <div className="harness-row" data-idle={!harness.live || undefined} key={harness.id}>
                  <span className="harness-name">
                    <span className="harness-mark">
                      {harnessBrand(harness.id).logo
                        ? <Image src={harnessBrand(harness.id).logo!} alt="" width={18} height={18} />
                        : <Terminal size={15} />}
                    </span>
                    <b>{harnessLabels[harness.id] ?? harness.id}</b>
                    {harness.version ? <em>{harness.version}</em> : null}
                    {!harness.live ? <i>not reporting</i> : null}
                  </span>
                  <span className="harness-track">
                    <i style={{
                      width: `${Math.max(harness.share * 100, harness.tokens > 0 ? 1.5 : 0)}%`,
                      background: harness.live ? harnessBrand(harness.id).color : undefined
                    }} />
                  </span>
                  <span className="harness-share">{Math.round(harness.share * 100)}%</span>
                  <span className="harness-tokens">{compactTokens(harness.tokens)}</span>
                  <span className="harness-seen">
                    {harness.lastCollected ? stamp(harness.lastCollected) : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="settings-row">
        <div className="settings-rail">
          <h2>Models</h2>
          <p>Token volume by model, coloured by the provider behind it.</p>
        </div>
        <div className="settings-body">
          {models.length === 0 ? (
            <p className="harness-empty">No model activity yet.</p>
          ) : (
            <div className="model-chart" role="img" aria-label={`Token volume by model: ${models.map((model) => `${model.id} ${compactTokens(model.tokens)}`).join(", ")}`}>
              {models.map((model) => {
                const brand = modelBrand(model.id);
                return (
                  <div className="model-column" key={model.id}>
                    <span className="model-value">{compactTokens(model.tokens)}</span>
                    <span className="model-bar-wrap">
                      <i
                        className="model-bar"
                        style={{
                          height: `${Math.max((model.tokens / models[0].tokens) * 100, 2)}%`,
                          background: brand.color
                        }}
                      />
                    </span>
                    <span className="model-mark" style={{ borderColor: `${brand.color}59` }}>
                      {brand.logo
                        ? <Image src={brand.logo} alt="" width={15} height={15} />
                        : <em style={{ background: brand.color }} />}
                    </span>
                    <span className="model-name">{model.id}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="settings-row">
        <div className="settings-rail">
          <h2>Devices</h2>
          <p>Revoking a credential stops ingestion immediately.</p>
        </div>
        <div className="settings-body">
          <div className="device-list">
            {devices.length === 0 && (
              <div className="empty-device">
                <Laptop size={22} />
                <span><b>No connected devices</b><small>Install the agent to start your first sync.</small></span>
                <Link href="/onboarding">Install agent</Link>
              </div>
            )}
            {devices.map((device) => (
              <div className="device-row" data-revoked={device.revoked_at ? "true" : undefined} key={device.id}>
                <span className="device-icon"><Laptop size={18} /></span>
                <span className="device-name">
                  <b>{device.name}</b>
                  <small>{device.platform} · agent {device.agent_version}</small>
                </span>
                <span className="device-sources">
                  {device.sources.map((source) => <span key={source.harness_id}>{source.harness_id}</span>)}
                </span>
                <span className="device-status">
                  <i />
                  <span>
                    <b>{device.revoked_at ? "Revoked" : "Healthy"}</b>
                    <small>{device.revoked_at
                      ? `Revoked ${stamp(device.revoked_at)}`
                      : device.last_sync_at
                        ? `Synced ${stamp(device.last_sync_at)}`
                        : "Awaiting first sync"}</small>
                  </span>
                </span>
                {device.revoked_at
                  ? <span className="revoked-mark">—</span>
                  : <button className="icon-button danger" onClick={() => revoke(device.id)} aria-label={`Revoke ${device.name}`}><Trash2 size={15} /></button>}
              </div>
            ))}
          </div>
          <Link className="button button-secondary button-small device-add" href="/onboarding"><Laptop size={15} /> Add device</Link>
        </div>
      </section>

      <section className="settings-row">
        <div className="settings-rail">
          <h2>Your data</h2>
          <p>Everything held server-side is yours to take or destroy.</p>
        </div>
        <div className="settings-body">
          <div className="data-panel">
            <span>
              <b>Export personal data</b>
              <small>JSON · normalized records and settings</small>
            </span>
            <a className="button button-secondary button-small" href="/v1/me/export" download><Download size={15} /> Download</a>
          </div>
          <div className="data-panel">
            <span>
              <b>Delete account</b>
              <small><AlertTriangle size={14} /> Permanent and immediate. Removes every server-side record.</small>
            </span>
            <button className="button button-danger button-small" onClick={async () => {
              if (!window.confirm("Permanently delete your account and all server-side data? This cannot be undone.")) return;
              const response = await fetch("/v1/me/account", { method: "DELETE" });
              if (response.ok) window.location.assign("/");
            }}><Trash2 size={15} /> Delete</button>
          </div>
        </div>
      </section>
    </>
  );
}
