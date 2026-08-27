"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Camera, Check, Copy, ExternalLink, Globe, Laptop, LogOut, Trash2 } from "lucide-react";
import { buttonClass, iconButtonDangerClass, spinnerClass, switchClass, switchKnobClass } from "@/lib/ui";
import { ProfileAvatar } from "@/components/profile-avatar";
import { useRef, useState } from "react";

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
  show_harnesses: boolean;
  show_models: boolean;
  show_streaks: boolean;
};

type FieldKey = "show_tokens" | "show_harnesses" | "show_models" | "show_streaks";

type Identity = {
  handle: string;
  displayName: string;
  avatarUpdatedAt: string | null;
};

type IdentityState = "idle" | "saving-name" | "uploading-avatar" | "removing-avatar" | "saved";

const fields: { key: FieldKey; label: string }[] = [
  { key: "show_tokens", label: "Token totals" },
  { key: "show_harnesses", label: "Coding-tool mix" },
  { key: "show_models", label: "Model mix" },
  { key: "show_streaks", label: "Streaks" }
];

const ROW = "mt-9 grid grid-cols-[248px_minmax(0,1fr)] gap-12 border-t border-line-strong pt-9 max-desktop:grid-cols-[1fr] max-desktop:gap-5";
const RAIL = "sticky top-[calc(var(--header-h)+26px)] self-start max-desktop:static";
const RAIL_TITLE = "mb-1.5 text-md font-semibold tracking-[-.015em] text-ink-strong";
const RAIL_COPY = "m-0 text-xs leading-normal text-muted";
const PANEL = "overflow-hidden rounded-sm border border-line bg-panel";
const CELL_LABEL = "block text-base font-medium text-ink-strong";
const CELL_META = "mt-[3px] block text-xs text-faint";
function stamp(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function audienceNote(privacy: Privacy) {
  if (privacy.is_public) return "Anyone with your address can see these fields. Accepted friends can also compare them.";
  return "Your public profile is private. Accepted friends can still compare the fields marked visible.";
}

function identityStatusMessage(identityState: IdentityState, error: string) {
  if (error) return error;
  if (identityState === "uploading-avatar") return "Uploading your profile picture…";
  if (identityState === "removing-avatar") return "Removing your profile picture…";
  if (identityState === "saving-name") return "Saving your display name…";
  if (identityState === "saved") return "Saved";
  return "";
}

function identityStatusClass(identityState: IdentityState, error: string) {
  if (error) return "text-red";
  if (identityState === "saved") return "text-accent";
  return undefined;
}

export function SettingsControls({
  identity,
  initialPrivacy,
  initialDevices,
  profileUrl
}: {
  identity: Identity;
  initialPrivacy: Privacy;
  initialDevices: Device[];
  profileUrl: string;
}) {
  const router = useRouter();
  const avatarInput = useRef<HTMLInputElement>(null);
  const [privacy, setPrivacy] = useState(initialPrivacy);
  const [devices, setDevices] = useState(initialDevices);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [displayName, setDisplayName] = useState(identity.displayName);
  const [savedDisplayName, setSavedDisplayName] = useState(identity.displayName);
  const [avatarUpdatedAt, setAvatarUpdatedAt] = useState(identity.avatarUpdatedAt);
  const [identityState, setIdentityState] = useState<IdentityState>("idle");
  const [identityError, setIdentityError] = useState("");
  const identityBusy = identityState === "saving-name"
    || identityState === "uploading-avatar"
    || identityState === "removing-avatar";
  const identityStatus = identityStatusMessage(identityState, identityError);
  const identityStatusTone = identityStatusClass(identityState, identityError);

  async function saveName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = displayName.trim();
    if (!nextName || nextName === savedDisplayName) return;

    setIdentityError("");
    setIdentityState("saving-name");
    try {
      const response = await fetch("/v1/me/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ display_name: nextName })
      });
      if (!response.ok) throw new Error("save failed");
    } catch {
      setIdentityError("Your name could not be saved. Try again.");
      setIdentityState("idle");
      return;
    }
    setDisplayName(nextName);
    setSavedDisplayName(nextName);
    setIdentityState("saved");
    router.refresh();
    setTimeout(() => setIdentityState("idle"), 1400);
  }

  async function uploadAvatar(file: File) {
    setIdentityError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setIdentityError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5_242_880) {
      setIdentityError("Choose an image up to 5 MB.");
      return;
    }

    setIdentityState("uploading-avatar");
    try {
      const reservationResponse = await fetch("/v1/me/avatar/uploads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content_type: file.type, content_length: file.size })
      });
      const reservation = await reservationResponse.json().catch(() => ({})) as {
        message?: string;
        upload_id?: string;
        upload_url?: string;
        fields?: Record<string, string>;
      };
      if (
        !reservationResponse.ok ||
        !reservation.upload_id ||
        !reservation.upload_url ||
        !reservation.fields
      ) {
        throw new Error(reservation.message ?? "Your profile picture could not be uploaded. Try again.");
      }

      const form = new FormData();
      for (const [name, value] of Object.entries(reservation.fields)) form.set(name, value);
      form.set("file", file);
      const uploadResponse = await fetch(reservation.upload_url, { method: "POST", body: form });
      if (!uploadResponse.ok) {
        throw new Error("Your profile picture could not be uploaded. Try again.");
      }

      const finalizeResponse = await fetch(
        `/v1/me/avatar/uploads/${encodeURIComponent(reservation.upload_id)}/finalize`,
        { method: "POST" }
      );
      const result = await finalizeResponse.json().catch(() => ({})) as {
        message?: string;
        updated_at?: string;
      };
      if (!finalizeResponse.ok || !result.updated_at) {
        throw new Error(result.message ?? "Your profile picture could not be saved. Try again.");
      }
      setAvatarUpdatedAt(result.updated_at);
    } catch (error) {
      setIdentityError(error instanceof Error ? error.message : "Your profile picture could not be saved. Try again.");
      setIdentityState("idle");
      return;
    }
    setIdentityState("saved");
    router.refresh();
    setTimeout(() => setIdentityState("idle"), 1400);
  }

  async function removeAvatar() {
    setIdentityError("");
    setIdentityState("removing-avatar");
    try {
      const response = await fetch("/v1/me/avatar", { method: "DELETE" });
      if (!response.ok) throw new Error("remove failed");
    } catch {
      setIdentityError("Your profile picture could not be removed. Try again.");
      setIdentityState("idle");
      return;
    }
    setAvatarUpdatedAt(null);
    if (avatarInput.current) avatarInput.current.value = "";
    setIdentityState("saved");
    router.refresh();
    setTimeout(() => setIdentityState("idle"), 1400);
  }

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
      <section className={ROW} id="identity">
        <div className={RAIL}>
          <h2 className={RAIL_TITLE}>Profile</h2>
          <p className={RAIL_COPY}>Your public identity and what people are allowed to see.</p>
        </div>
        <div className={PANEL} data-testid="profile-settings-card">
          <div className="px-[22px] py-4 max-tablet:px-[18px]">
            <h3 className="m-0 text-base font-semibold text-ink-strong">Identity</h3>
            <p className="mb-0 mt-1 text-xs text-muted">Your public name and picture on Agentprint.</p>
          </div>
          <div className="flex items-center gap-5 px-[22px] py-5 max-tablet:items-start max-tablet:px-[18px]">
            <ProfileAvatar
              handle={identity.handle}
              name={displayName}
              updatedAt={avatarUpdatedAt}
              className="size-20 flex-[0_0_80px]"
            />
            <div className="min-w-0 flex-1">
              <b className={CELL_LABEL}>Profile picture</b>
              <small className={CELL_META}>JPEG, PNG, or WebP up to 5 MB.</small>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  ref={avatarInput}
                  className="sr-only"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label="Profile picture file"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void uploadAvatar(file);
                  }}
                />
                <button
                  className={buttonClass({ variant: "secondary", size: "small" })}
                  type="button"
                  disabled={identityBusy}
                  onClick={() => avatarInput.current?.click()}
                >
                  {identityState === "uploading-avatar" ? <i className={spinnerClass} aria-hidden="true" /> : <Camera size={15} />}
                  {identityState === "uploading-avatar" ? "Uploading…" : avatarUpdatedAt ? "Change image" : "Choose image"}
                </button>
                {avatarUpdatedAt ? (
                  <button
                    className={buttonClass({ variant: "secondary", size: "small" })}
                    type="button"
                    disabled={identityBusy}
                    onClick={() => void removeAvatar()}
                  >
                    {identityState === "removing-avatar" ? <i className={spinnerClass} aria-hidden="true" /> : <Trash2 size={15} />}
                    {identityState === "removing-avatar" ? "Removing…" : "Remove"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
          <form
            className="flex items-end gap-3 border-t border-line px-[22px] py-5 max-tablet:flex-col max-tablet:items-stretch max-tablet:px-[18px]"
            onSubmit={saveName}
          >
            <label className="min-w-0 flex-1 text-xs font-medium text-muted">
              Display name
              <input
                className="mt-2 block min-h-[43px] w-full rounded-sm border border-line-strong bg-canvas-deep px-3.5 text-base text-ink-strong outline-none transition-[border-color,box-shadow] placeholder:text-faint focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-soft)]"
                name="display_name"
                autoComplete="name"
                maxLength={80}
                required
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>
            <button
              className={buttonClass({ size: "small", className: "flex-none max-tablet:w-full" })}
              type="submit"
              disabled={identityBusy || !displayName.trim() || displayName.trim() === savedDisplayName}
            >
              {identityState === "saving-name" ? <i className={spinnerClass} aria-hidden="true" /> : null}
              {identityState === "saving-name" ? "Saving…" : "Save name"}
            </button>
          </form>
          <p
            className="m-0 min-h-0 px-[22px] text-xs data-[visible=true]:border-t data-[visible=true]:border-line data-[visible=true]:py-3 max-tablet:px-[18px]"
            data-visible={Boolean(identityError || identityState !== "idle")}
            role="status"
            aria-live="polite"
          >
            <span className={identityStatusTone}>
              {identityStatus}
            </span>
          </p>
          <div className="border-t border-line" id="visibility">
            <div
              className="group grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-[15px] border-line px-[19px] py-[17px] max-tablet:grid-cols-[minmax(0,1fr)_auto]"
              data-on={privacy.is_public || undefined}
            >
              <span className="grid size-[42px] place-items-center rounded-sm border border-line text-faint group-data-[on]:border-steel-2 group-data-[on]:text-accent max-tablet:hidden">
                <Globe size={17} />
              </span>
              <span>
                <b className="block text-base font-medium text-ink-strong">Public profile</b>
                <small className="mt-[3px] block text-xs text-muted">Anyone with your profile address can open it.</small>
              </span>
              <button
                className={switchClass}
                role="switch"
                aria-checked={privacy.is_public}
                aria-label="Public profile"
                onClick={() => toggle("is_public")}
              ><i className={switchKnobClass} /></button>
            </div>
            <div className="flex items-center border-t border-line max-tablet:flex-wrap">
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
                <b className="text-base font-medium text-ink-strong">{field.label}</b>
                <span
                  className="text-right text-xs font-medium text-faint group-data-[on]:font-semibold group-data-[on]:text-ink-strong max-tablet:hidden"
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
          <h2 className={RAIL_TITLE}>Devices</h2>
          <p className={RAIL_COPY}>Removing a device stops future activity updates from it immediately.</p>
        </div>
        <div className="min-w-0">
          <div className={PANEL}>
            {devices.length === 0 && (
              <div className="flex items-center gap-4 px-[22px] py-[26px] text-faint">
                <Laptop size={22} />
                <span className="flex-1">
                  <b className="block text-base font-medium text-ink-strong">No connected devices</b>
                  <small className="mt-[3px] block text-xs">Install the agent to start your first sync.</small>
                </span>
                <Link className="text-xs text-accent" href="/add-device">Install agent</Link>
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
                    <b className="block truncate text-xs font-medium text-ink-strong">
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
          <Link className={buttonClass({ variant: "secondary", size: "small", className: "mt-3" })} href="/add-device">
            <Laptop size={15} /> Add device
          </Link>
        </div>
      </section>

      <section className={ROW}>
        <div className={RAIL}>
          <h2 className={RAIL_TITLE}>Your data</h2>
          <p className={RAIL_COPY}>Manage your current session or permanently delete your account.</p>
        </div>
        <div className={PANEL} data-testid="data-settings-card">
          <div className="flex min-h-[84px] items-center justify-between gap-6 px-[22px] py-[19px] max-tablet:flex-col max-tablet:items-start max-tablet:gap-4 max-tablet:p-5">
            <span>
              <b className="block text-base font-medium text-ink-strong">Current session</b>
              <small className="mt-1 flex items-center gap-1.5 text-xs text-muted">Sign out of Agentprint on this browser.</small>
            </span>
            <form action="/api/auth/logout" method="post" className="flex-none max-tablet:w-full">
              <button
                className={buttonClass({ variant: "secondary", size: "small", className: "max-tablet:w-full" })}
                type="submit"
              >
                <LogOut size={15} /> Log out
              </button>
            </form>
          </div>
          <div className="flex min-h-[84px] items-center justify-between gap-6 border-t border-line px-[22px] py-[19px] max-tablet:flex-col max-tablet:items-start max-tablet:gap-4 max-tablet:p-5">
            <span>
              <b className="block text-base font-medium text-ink-strong">Delete account</b>
              <small className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                <AlertTriangle size={14} className="shrink-0 text-red" /> Permanently deletes your Agentprint account and all its data.
              </small>
            </span>
            <button
              className={buttonClass({ variant: "danger", size: "small", className: "flex-none max-tablet:w-full" })}
              onClick={async () => {
                if (!window.confirm("Permanently delete your Agentprint account and all its data? This cannot be undone.")) return;
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
