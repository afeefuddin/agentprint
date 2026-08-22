"use client";

import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, Check, Copy, Download, ExternalLink, Globe, Laptop, Terminal, Trash2, Users } from "lucide-react";
import { compactTokens, harnessBrand, harnessLabels, modelBrand } from "@/lib/brands";
import { buttonClass, iconButtonDangerClass, modelChart, switchClass, switchKnobClass } from "@/lib/ui";
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

const ROW = "mt-9 grid grid-cols-[248px_minmax(0,1fr)] gap-12 border-t border-line-strong pt-9 max-desktop:grid-cols-[1fr] max-desktop:gap-5";
const RAIL = "sticky top-[calc(var(--header-h)+26px)] self-start max-desktop:static";
const RAIL_TITLE = "mb-1.5 text-md font-[weight:560] tracking-[-.015em] text-ink-strong";
const RAIL_COPY = "m-0 text-xs leading-normal text-muted";
const PANEL = "overflow-hidden rounded-sm border border-line bg-panel";
const CELL_LABEL = "block text-base font-[weight:530] text-ink-strong";
const CELL_META = "mt-[3px] block text-xs text-faint";
const NUMERIC = "text-right text-xs [font-variant-numeric:tabular-nums]";

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
      <section className={ROW} id="visibility">
        <div className={RAIL}>
          <h2 className={RAIL_TITLE}>Audience</h2>
          <p className={RAIL_COPY}>Who is allowed to see your trace at all.</p>
        </div>
        <div className="min-w-0">
          {audiences.map((audience) => (
            <div
              className="group grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-[15px] rounded-sm border border-line bg-panel px-[19px] py-[17px] transition-[border-color,background-color] duration-[160ms] not-first:mt-2.5 data-[on]:border-steel-2 data-[on]:bg-[color-mix(in_srgb,var(--color-accent-soft)_45%,var(--color-panel))] max-tablet:grid-cols-[minmax(0,1fr)_auto]"
              data-on={privacy[audience.key] || undefined}
              key={audience.key}
            >
              <span className="grid size-[42px] place-items-center rounded-sm border border-line bg-canvas text-faint group-data-[on]:border-steel-2 group-data-[on]:bg-panel-raised group-data-[on]:text-accent max-tablet:hidden">
                {audience.key === "is_public" ? <Globe size={17} /> : <Users size={17} />}
              </span>
              <span>
                <b className="block text-base font-[weight:540] text-ink-strong">{audience.label}</b>
                <small className="mt-[3px] block text-xs text-muted">{audience.description}</small>
              </span>
              <button
                className={switchClass}
                role="switch"
                aria-checked={privacy[audience.key]}
                aria-label={audience.label}
                onClick={() => toggle(audience.key)}
              ><i className={switchKnobClass} /></button>
            </div>
          ))}
          <div className="mt-3 flex items-center overflow-hidden rounded-sm border border-line bg-canvas-deep max-tablet:flex-wrap">
            <span className="min-w-0 flex-1 truncate px-4 py-3 text-xs text-muted max-tablet:basis-full max-tablet:border-b max-tablet:border-line">
              {profileUrl}
            </span>
            <button
              className="flex cursor-pointer items-center gap-[7px] self-stretch border-y-0 border-l border-r-0 border-line bg-transparent px-[15px] text-xs text-muted transition-[background-color,color] duration-150 hover:bg-panel hover:text-ink-strong max-tablet:min-h-[38px] max-tablet:border-l-0 max-tablet:border-r"
              onClick={copyProfile}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied" : "Copy"}
            </button>
            <a
              className="flex items-center gap-[7px] self-stretch border-y-0 border-l border-r-0 border-line bg-transparent px-[15px] text-xs text-muted transition-[background-color,color] duration-150 hover:bg-panel hover:text-ink-strong max-tablet:min-h-[38px] max-tablet:border-l-0 max-tablet:border-r"
              href={profileUrl}
            >
              <ExternalLink size={15} /> Preview
            </a>
          </div>
        </div>
      </section>

      <section className={ROW}>
        <div className={RAIL}>
          <h2 className={RAIL_TITLE}>Shared fields</h2>
          <p className={RAIL_COPY}>Each one is enforced at the profile query boundary, not hidden in the client.</p>
        </div>
        <div className="min-w-0">
          <div className="mb-[11px] flex items-center justify-between gap-4 text-xs text-muted">
            <span>{shared} of {fields.length} fields visible</span>
            <span
              className="flex items-center gap-[5px] text-xs text-accent opacity-0 transition-opacity duration-150 data-[visible]:opacity-100"
              data-visible={saved || undefined}
            ><Check size={14} /> Saved</span>
          </div>
          <div className={PANEL}>
            {fields.map((field) => (
              <div
                className="group grid grid-cols-[minmax(0,1fr)_66px_42px] items-center gap-5 border-b border-line px-[19px] py-[13px] last:border-b-0 max-tablet:grid-cols-[minmax(0,1fr)_34px] max-tablet:gap-3.5"
                data-on={privacy[field.key] || undefined}
                key={field.key}
              >
                <b className="text-base font-[weight:530] text-ink-strong">{field.label}</b>
                <span
                  className="text-right text-xs font-medium text-faint group-data-[on]:font-[weight:550] group-data-[on]:text-ink-strong max-tablet:hidden"
                  aria-hidden="true"
                >
                  {privacy[field.key] ? "Visible" : "Hidden"}
                </span>
                <button
                  className={switchClass}
                  role="switch"
                  aria-checked={privacy[field.key]}
                  aria-label={field.label}
                  onClick={() => toggle(field.key)}
                ><i className={switchKnobClass} /></button>
              </div>
            ))}
          </div>
          <p className="mt-3.5 text-xs leading-[1.55] text-muted">{audienceNote(privacy)}</p>
        </div>
      </section>

      <section className={ROW}>
        <div className={RAIL}>
          <h2 className={RAIL_TITLE}>Harnesses</h2>
          <p className={RAIL_COPY}>What each agent has contributed, and whether it is still reporting.</p>
        </div>
        <div className="min-w-0">
          {harnesses.length === 0 ? (
            <p className="m-0 rounded-sm border border-line bg-panel p-[22px] text-xs text-faint">
              No harness activity yet. Agents appear here after their first sync.
            </p>
          ) : (
            <div className={PANEL}>
              <div className="grid min-h-[38px] grid-cols-[minmax(0,1.15fr)_minmax(96px,1.5fr)_46px_74px_82px] items-center gap-[18px] border-b border-line bg-canvas px-[18px] text-xs text-faint max-tablet:grid-cols-[minmax(0,1fr)_46px_68px] max-tablet:gap-3 max-tablet:px-3.5">
                <span>Agent</span>
                <span className="max-tablet:hidden" />
                <span className="text-right">Share</span>
                <span className="text-right">Tokens</span>
                <span className="text-right max-tablet:hidden">Last seen</span>
              </div>
              {harnesses.map((harness) => (
                <div
                  className="group grid min-h-[58px] grid-cols-[minmax(0,1.15fr)_minmax(96px,1.5fr)_46px_74px_82px] items-center gap-[18px] border-b border-line px-[18px] last:border-b-0 max-tablet:grid-cols-[minmax(0,1fr)_46px_68px] max-tablet:gap-3 max-tablet:px-3.5"
                  data-idle={!harness.live || undefined}
                  key={harness.id}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="grid size-7 flex-[0_0_28px] place-items-center rounded-xs border border-line bg-canvas text-faint">
                      {harnessBrand(harness.id).logo
                        ? <Image src={harnessBrand(harness.id).logo!} alt="" width={18} height={18} className="size-[18px] object-contain" />
                        : <Terminal size={15} />}
                    </span>
                    <b className="truncate text-base font-[weight:530] text-ink-strong group-data-[idle]:text-muted">
                      {harnessLabels[harness.id] ?? harness.id}
                    </b>
                    {harness.version ? (
                      <em className="flex-none rounded-xs border border-line px-[7px] py-0.5 text-xs not-italic text-faint max-tablet:hidden">{harness.version}</em>
                    ) : null}
                    {!harness.live ? <i className="flex-none text-xs not-italic text-amber">not reporting</i> : null}
                  </span>
                  <span className="h-2 overflow-hidden rounded-full bg-canvas-deep max-tablet:hidden">
                    <i
                      className="block h-full rounded-full bg-steel-3 group-data-[idle]:bg-line-strong"
                      style={{
                        width: `${Math.max(harness.share * 100, harness.tokens > 0 ? 1.5 : 0)}%`,
                        background: harness.live ? harnessBrand(harness.id).color : undefined
                      }}
                    />
                  </span>
                  <span className={`${NUMERIC} font-[weight:550] text-ink-strong`}>{Math.round(harness.share * 100)}%</span>
                  <span className={`${NUMERIC} text-ink-strong`}>{compactTokens(harness.tokens)}</span>
                  <span className={`${NUMERIC} text-faint max-tablet:hidden`}>
                    {harness.lastCollected ? stamp(harness.lastCollected) : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className={ROW}>
        <div className={RAIL}>
          <h2 className={RAIL_TITLE}>Models</h2>
          <p className={RAIL_COPY}>Token volume by model, coloured by the provider behind it.</p>
        </div>
        <div className="min-w-0">
          {models.length === 0 ? (
            <p className="m-0 rounded-sm border border-line bg-panel p-[22px] text-xs text-faint">No model activity yet.</p>
          ) : (
            <div
              className={modelChart.root}
              role="img"
              aria-label={`Token volume by model: ${models.map((model) => `${model.id} ${compactTokens(model.tokens)}`).join(", ")}`}
            >
              {models.map((model) => {
                const brand = modelBrand(model.id);
                return (
                  <div className={modelChart.column} key={model.id}>
                    <span className={modelChart.value}>{compactTokens(model.tokens)}</span>
                    <span className={modelChart.barWrap}>
                      <i
                        className={modelChart.bar}
                        style={{
                          height: `${Math.max((model.tokens / models[0].tokens) * 100, 2)}%`,
                          background: brand.color
                        }}
                      />
                    </span>
                    <span className={modelChart.mark} style={{ borderColor: `${brand.color}59` }}>
                      {brand.logo
                        ? <Image src={brand.logo} alt="" width={15} height={15} className={modelChart.markImage} />
                        : <em className={modelChart.markDot} style={{ background: brand.color }} />}
                    </span>
                    <span className={modelChart.name}>{model.id}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className={ROW}>
        <div className={RAIL}>
          <h2 className={RAIL_TITLE}>Devices</h2>
          <p className={RAIL_COPY}>Revoking a credential stops ingestion immediately.</p>
        </div>
        <div className="min-w-0">
          <div className={PANEL}>
            {devices.length === 0 && (
              <div className="flex items-center gap-4 px-[22px] py-[26px] text-faint">
                <Laptop size={22} />
                <span className="flex-1">
                  <b className="block text-base font-[weight:530] text-ink-strong">No connected devices</b>
                  <small className="mt-[3px] block text-xs">Install the agent to start your first sync.</small>
                </span>
                <Link className="text-xs text-accent" href="/onboarding">Install agent</Link>
              </div>
            )}
            {devices.map((device) => (
              <div
                className="group grid min-h-[78px] grid-cols-[40px_minmax(0,1.3fr)_minmax(0,1fr)_168px_36px] items-center gap-4 border-b border-line px-[18px] py-3.5 last:border-b-0 data-[revoked=true]:bg-canvas-deep max-desktop:grid-cols-[40px_minmax(0,1fr)_150px_36px] max-tablet:grid-cols-[minmax(0,1fr)_36px] max-tablet:gap-x-3 max-tablet:gap-y-[11px]"
                data-revoked={device.revoked_at ? "true" : undefined}
                key={device.id}
              >
                <span className="grid size-10 place-items-center rounded-sm border border-line bg-canvas text-accent max-tablet:hidden">
                  <Laptop size={18} />
                </span>
                <span>
                  <b className={`${CELL_LABEL} truncate group-data-[revoked=true]:text-muted`}>{device.name}</b>
                  <small className={CELL_META}>{device.platform} · agent {device.agent_version}</small>
                </span>
                <span className="flex flex-wrap gap-[5px] max-desktop:hidden">
                  {device.sources.map((source) => (
                    <span
                      key={source.harness_id}
                      className="rounded-xs border border-line bg-canvas px-[9px] py-1 text-xs text-muted"
                    >
                      {source.harness_id}
                    </span>
                  ))}
                </span>
                <span className="flex items-center gap-[9px] max-desktop:col-start-2 max-tablet:col-[1_/_-1]">
                  <i className="size-[7px] flex-[0_0_7px] rounded-full bg-accent group-data-[revoked=true]:bg-red" />
                  <span>
                    <b className="block truncate text-xs font-[weight:540] text-ink-strong">
                      {device.revoked_at ? "Revoked" : "Healthy"}
                    </b>
                    <small className={CELL_META}>{device.revoked_at
                      ? `Revoked ${stamp(device.revoked_at)}`
                      : device.last_sync_at
                        ? `Synced ${stamp(device.last_sync_at)}`
                        : "Awaiting first sync"}</small>
                  </span>
                </span>
                {device.revoked_at
                  ? (
                    <span className="text-center text-xs text-faint max-tablet:col-start-2 max-tablet:row-start-1 max-tablet:self-start">—</span>
                  )
                  : (
                    <button
                      className={`${iconButtonDangerClass} max-tablet:col-start-2 max-tablet:row-start-1 max-tablet:self-start`}
                      onClick={() => revoke(device.id)}
                      aria-label={`Revoke ${device.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
              </div>
            ))}
          </div>
          <Link className={buttonClass({ variant: "secondary", size: "small", className: "mt-3" })} href="/onboarding">
            <Laptop size={15} /> Add device
          </Link>
        </div>
      </section>

      <section className={ROW}>
        <div className={RAIL}>
          <h2 className={RAIL_TITLE}>Your data</h2>
          <p className={RAIL_COPY}>Everything held server-side is yours to take or destroy.</p>
        </div>
        <div className="min-w-0">
          <div className="flex min-h-[84px] items-center justify-between gap-6 rounded-sm border border-line bg-panel px-[22px] py-[19px] max-tablet:flex-col max-tablet:items-start max-tablet:gap-4 max-tablet:p-5">
            <span>
              <b className="block text-base font-[weight:540] text-ink-strong">Export personal data</b>
              <small className="mt-1 flex items-center gap-1.5 text-xs text-muted">JSON · normalized records and settings</small>
            </span>
            <a
              className={buttonClass({ variant: "secondary", size: "small", className: "flex-none max-tablet:w-full" })}
              href="/v1/me/export"
              download
            >
              <Download size={15} /> Download
            </a>
          </div>
          <div className="mt-2.5 flex min-h-[84px] items-center justify-between gap-6 rounded-sm border border-line bg-panel px-[22px] py-[19px] max-tablet:flex-col max-tablet:items-start max-tablet:gap-4 max-tablet:p-5">
            <span>
              <b className="block text-base font-[weight:540] text-ink-strong">Delete account</b>
              <small className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                <AlertTriangle size={14} className="shrink-0 text-red" /> Permanent and immediate. Removes every server-side record.
              </small>
            </span>
            <button
              className={buttonClass({ variant: "danger", size: "small", className: "flex-none max-tablet:w-full" })}
              onClick={async () => {
                if (!window.confirm("Permanently delete your account and all server-side data? This cannot be undone.")) return;
                const response = await fetch("/v1/me/account", { method: "DELETE" });
                if (response.ok) window.location.assign("/");
              }}
            >
              <Trash2 size={15} /> Delete
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
