"use client";

import Link from "next/link";
import { ArrowRight, Check, CheckCircle2, Clipboard, Laptop, RefreshCw, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";

const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export function OnboardingFlow({ handle, hasDevice, profileComplete, appUrl }: { handle: string; hasDevice: boolean; profileComplete: boolean; appUrl: string }) {
  const local = appUrl.includes("localhost") || appUrl.includes("127.0.0.1");
  const installCommands = {
    macOS: local
      ? `curl -fsSL ${appUrl}/install.sh | AGENTPRINT_DOWNLOAD_BASE=${appUrl}/releases/latest sh`
      : `curl -fsSL ${appUrl}/install.sh | sh`,
    Linux: local
      ? `curl -fsSL ${appUrl}/install.sh | AGENTPRINT_DOWNLOAD_BASE=${appUrl}/releases/latest sh`
      : `curl -fsSL ${appUrl}/install.sh | sh`,
    Windows: local
      ? `$env:AGENTPRINT_DOWNLOAD_BASE="${appUrl}/releases/latest"; irm ${appUrl}/install.ps1 | iex`
      : `irm ${appUrl}/install.ps1 | iex`
  };
  const [platform, setPlatform] = useState<keyof typeof installCommands>("macOS");
  const [copied, setCopied] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [profileHandle, setProfileHandle] = useState("");
  const steps = [
    { label: "Choose your profile", complete: profileComplete },
    { label: "Agent installed", complete: hasDevice },
    { label: "First sync", complete: hasDevice },
    { label: "Review & publish", complete: false }
  ];
  const currentStep = !profileComplete ? 0 : !hasDevice ? 1 : 3;
  const previewName = displayName.trim() || "Your name";
  const previewHandle = profileHandle || "your-handle";
  const initials = displayName.trim()
    ? displayName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")
    : "YN";

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/v1/me/onboarding/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        display_name: String(form.get("display_name")),
        handle: String(form.get("handle")).toLowerCase(),
        timezone
      })
    });
    const result = await response.json();
    if (!response.ok) {
      const handleIssue = result.issues?.find((issue: { path?: string }) => issue.path === "handle");
      setProfileError(handleIssue?.message ?? result.message ?? "Your profile could not be saved.");
      setSavingProfile(false);
      return;
    }
    window.location.reload();
  }

  async function copy() {
    await navigator.clipboard.writeText(installCommands[platform]);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="onboarding-workbench">
      <header className="onboarding-progress">
        <div>
          <span className="onboarding-kicker">Agentprint / setup</span>
          <strong>{String(currentStep + 1).padStart(2, "0")} <i>of 04</i></strong>
        </div>
        <ol aria-label="Setup progress">
          {steps.map((step, index) => (
            <li key={step.label} data-complete={step.complete} data-current={!step.complete && index === currentStep}>
              <span>{step.complete ? <Check size={12} /> : index + 1}</span>
              <b>{step.label}</b>
            </li>
          ))}
        </ol>
      </header>
      <section className="onboarding-stage">
        {!profileComplete ? (
          <div className="identity-setup">
            <div className="identity-editor">
              <div className="identity-heading">
                <span className="eyebrow">Start with your identity</span>
                <h1>Put your name<br />on the record.</h1>
                <p>Your agents do the work. Agentprint gives that work a clear, privacy-safe signature. This is how yours will appear.</p>
              </div>
              <form className="profile-setup-form" onSubmit={saveProfile}>
                <div className="profile-fields">
                  <label>
                    <span>Name</span>
                    <input name="display_name" autoComplete="name" placeholder="Maya Chen" required maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
                  </label>
                  <label>
                    <span>Profile address</span>
                    <div className="input-prefix">
                      <b>agentprint.tech/</b>
                      <input name="handle" autoComplete="username" aria-label="Username" placeholder="maya-builds" required minLength={3} maxLength={30} pattern="[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?" value={profileHandle} onChange={(event) => setProfileHandle(event.target.value.toLowerCase())} />
                    </div>
                    <small>Lowercase letters, numbers, and hyphens.</small>
                  </label>
                </div>
                <div className="profile-submit-row">
                  <p><ShieldCheck size={15} /> Private until you choose to publish</p>
                  <button className="button" aria-label="Claim profile and continue" disabled={savingProfile}>{savingProfile ? "Saving…" : <>Create my record <ArrowRight size={16} /></>}</button>
                </div>
                {profileError && <p className="form-error" role="alert">{profileError}</p>}
              </form>
            </div>
            <aside className="identity-preview" aria-label="Profile preview">
              <div className="identity-card">
                <div className="identity-preview-bar"><span>AP / 001</span><b><i /> Private draft</b></div>
                <div className="identity-preview-person">
                  <div className="identity-preview-avatar" aria-hidden="true">{initials}</div>
                  <div><span>Agent record of</span><h2>{previewName}</h2><p>agentprint.tech/{previewHandle}</p></div>
                </div>
                <div className="identity-preview-trace" aria-hidden="true">
                  <div><span>Contribution field</span><b>Awaiting first sync</b></div>
                  <div className="identity-preview-cells">{Array.from({ length: 56 }, (_, index) => <i key={index} data-active={index % 9 === 0 || index % 13 === 0 || undefined} />)}</div>
                </div>
                <div className="identity-card-footer"><span>Codex</span><span>Claude Code</span><span>OpenCode</span><span>Kimi Code</span></div>
              </div>
              <p className="preview-caption"><span>Live preview</span> Your first sync will replace this sample field.</p>
            </aside>
          </div>
        ) : !hasDevice ? (
          <div className="install-setup">
            <div className="install-copy">
              <span className="eyebrow">Connect this machine</span>
              <h1>One command.<br />Then forget it.</h1>
              <p>The local agent finds supported tools, queues usage offline, and keeps your record current in the background.</p>
              <div className="install-details">
                <div><Laptop size={16} /><span><b>Native binary</b>No runtime dependencies</span></div>
                <div><RefreshCw size={16} /><span><b>Quiet by design</b>Automatic background sync</span></div>
                <div><ShieldCheck size={16} /><span><b>Metadata only</b>Never prompts or source code</span></div>
              </div>
            </div>
            <div className="terminal-card">
              <div className="terminal-bar"><span><i /><i /><i /></span><b>Install Agentprint</b></div>
              <div className="platform-tabs" role="tablist" aria-label="Operating system">
                {(Object.keys(installCommands) as (keyof typeof installCommands)[]).map((name) => (
                  <button key={name} role="tab" aria-selected={platform === name} onClick={() => setPlatform(name)}>{name}</button>
                ))}
              </div>
              <div className="install-command">
                <code><span>$</span> {installCommands[platform]}</code>
                <button onClick={copy} aria-label="Copy install command">{copied ? <CheckCircle2 size={16} /> : <Clipboard size={16} />}</button>
              </div>
              <div className="next-command"><span><i>2</i> Then connect this machine</span><code>agentprint login</code></div>
              <p className="onboarding-help"><i /> Waiting for a device to connect…</p>
            </div>
          </div>
        ) : (
          <div className="first-sync-success">
            <div className="success-seal"><Check size={30} /></div>
            <span className="step-number">First sync complete</span>
            <h1>Your record is alive.</h1>
            <p>Your connected device is healthy. Review the private profile, choose which metrics are visible, and publish when it feels right.</p>
            <div className="onboarding-actions">
              <Link className="button" href={`/${handle}`}>Preview private profile <ArrowRight size={16} /></Link>
              <Link className="button button-secondary" href="/dashboard#visibility">Choose visibility</Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
