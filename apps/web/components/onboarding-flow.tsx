"use client";

import Link from "next/link";
import { ArrowRight, Check, CheckCircle2, Clipboard, Laptop, RefreshCw, X } from "lucide-react";
import { FaApple, FaLinux, FaWindows } from "react-icons/fa";
import { useEffect, useState, type FormEvent } from "react";
import { buttonClass, cx, formErrorClass } from "@/lib/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

const HEADING =
  "m-0 text-center text-[clamp(42px,4.4vw,58px)] font-[weight:520] leading-[.98] tracking-[-.045em] text-ink-strong max-tablet:text-[40px]";
const LEAD = "mx-auto mb-0 mt-4 max-w-[480px] text-center text-sm leading-[1.65] text-muted";
const FIELD_LABEL = "mb-2 block text-xs font-[weight:560] text-muted";
const FIELD_INPUT =
  "h-[58px] w-full rounded-md border border-line bg-panel-raised px-[18px] text-sm text-ink-strong shadow-[0_5px_16px_rgb(40_46_35_/_0.035)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-faint hover:border-line-strong focus:border-blue focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-blue)_10%,transparent)]";
type HandleAvailability = "idle" | "checking" | "available" | "taken";
const platformOptions = [
  { value: "macOS", icon: FaApple },
  { value: "Linux", icon: FaLinux },
  { value: "Windows", icon: FaWindows }
] as const;
type Platform = (typeof platformOptions)[number]["value"];

type OnboardingFlowProps = {
  handle: string;
  hasDevice: boolean;
  hasCompletedSync: boolean;
  profileComplete: boolean;
  appUrl: string;
};

type CommandBlockProps = {
  label: string;
  command: string;
  name: string;
};

function CommandBlock({ label, command, name }: CommandBlockProps) {
  const [copied, setCopied] = useState(false);

  async function copyCommand() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-md border border-line-strong bg-panel-raised shadow-[0_6px_20px_rgb(40_46_35_/_0.06)]" aria-label={`${name} command`}>
      <div className="flex min-h-10 items-center justify-between border-b border-line bg-canvas px-3.5">
        <span className="text-2xs text-muted">{label}</span>
        <button type="button" onClick={copyCommand} aria-label={copied ? `${name} command copied` : `Copy ${name.toLowerCase()} command`} className="grid size-7 shrink-0 place-items-center rounded-sm border border-line bg-panel-raised text-muted shadow-[0_1px_2px_rgb(40_46_35_/_0.06)] transition-[color,background-color,border-color] hover:border-line-strong hover:bg-accent-soft hover:text-ink-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue">
          {copied ? <CheckCircle2 size={14} className="text-blue" /> : <Clipboard size={14} />}
        </button>
      </div>
      <pre className="m-0 max-w-full whitespace-pre-wrap break-words px-4 py-4 text-left [overflow-wrap:anywhere]"><code className="font-[ui-monospace,SFMono-Regular,Menlo,monospace] text-xs leading-6 text-ink-strong"><span className="select-none text-blue" aria-hidden="true">$ </span>{command}</code></pre>
    </div>
  );
}

function currentOnboardingStep(profileComplete: boolean, hasDevice: boolean, hasCompletedSync: boolean) {
  if (!profileComplete) return 0;
  if (!hasDevice) return 1;
  if (!hasCompletedSync) return 2;
  return 3;
}

export function OnboardingFlow({ handle, hasDevice, hasCompletedSync, profileComplete, appUrl }: OnboardingFlowProps) {
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
  const [platform, setPlatform] = useState<Platform>("macOS");
  const [profileError, setProfileError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [profileHandle, setProfileHandle] = useState("");
  const [handleAvailability, setHandleAvailability] = useState<HandleAvailability>("idle");
  const steps = [
    { label: "Profile", complete: profileComplete },
    { label: "Install", complete: hasDevice },
    { label: "First sync", complete: hasCompletedSync },
    { label: "Review", complete: false }
  ];
  const currentStep = currentOnboardingStep(profileComplete, hasDevice, hasCompletedSync);

  useEffect(() => {
    const candidate = profileHandle.trim().toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/.test(candidate)) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setHandleAvailability("checking");
      try {
        const response = await fetch(`/v1/me/onboarding/profile?handle=${encodeURIComponent(candidate)}`, {
          signal: controller.signal
        });
        if (!response.ok) throw new Error("Availability check failed");
        const result = await response.json() as { available: boolean };
        setHandleAvailability(result.available ? "available" : "taken");
      } catch (error) {
        if ((error as Error).name !== "AbortError") setHandleAvailability("idle");
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [profileHandle]);

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
      if (result.error === "handle_taken" || handleIssue) {
        setHandleAvailability("taken");
      } else {
        setProfileError(result.message ?? "Your profile could not be saved.");
      }
      setSavingProfile(false);
      return;
    }
    window.location.reload();
  }

  return (
    <div className="relative min-h-[760px] animate-[settle-in_500ms_both] max-tablet:grid max-tablet:min-h-0 max-tablet:grid-cols-[64px_minmax(0,1fr)] max-tablet:gap-4">
      <aside className="absolute left-0 top-1/2 w-[240px] -translate-y-1/2 max-tablet:relative max-tablet:left-auto max-tablet:top-auto max-tablet:w-auto max-tablet:translate-y-0 max-tablet:pt-14">
        <div className="hidden w-full border-b border-line-strong pb-6 text-center max-tablet:block">
          <span className="text-md font-[weight:560] text-ink-strong">{currentStep + 1}/4</span>
        </div>
        <ol aria-label="Setup progress" className="relative m-0 flex w-full list-none flex-col gap-3 p-0 before:absolute before:bottom-7 before:left-[22px] before:top-7 before:w-[2px] before:bg-line-strong before:content-[''] max-tablet:mt-7 max-tablet:items-center max-tablet:before:left-1/2 max-tablet:before:-translate-x-1/2">
          {steps.map((step, index) => (
            <li
              key={step.label}
              data-complete={step.complete}
              data-current={!step.complete && index === currentStep}
              className="group relative z-[1] flex min-h-14 w-full items-center gap-4 rounded-sm px-1.5 text-sm text-faint data-[complete=true]:text-muted data-[current=true]:text-ink-strong max-tablet:size-12 max-tablet:justify-center max-tablet:px-0"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line-strong bg-panel-raised text-xs font-[weight:560] shadow-[0_2px_8px_rgb(40_46_35_/_0.06)] group-data-[complete=true]:border-blue group-data-[complete=true]:text-blue group-data-[current=true]:border-blue group-data-[current=true]:bg-blue group-data-[current=true]:text-white">
                {step.complete ? <Check size={15} /> : index + 1}
              </span>
              <b className="font-[weight:540] max-tablet:hidden">{step.label}</b>
            </li>
          ))}
        </ol>
      </aside>

      <section className="mx-auto min-h-[720px] w-full max-w-[620px] max-tablet:mx-0 max-tablet:min-h-0">
        {!profileComplete ? (
          <div className="flex min-h-[720px] flex-col justify-center pb-16 pt-10 max-tablet:min-h-0 max-tablet:justify-start max-tablet:pb-12 max-tablet:pt-14">
            <div>
              <h1 className={HEADING}>Create your Agentprint.</h1>
              <p className={LEAD}>Choose the name and address people will recognize when you share your agent work.</p>
            </div>

            <div className="mx-auto mt-9 w-full max-w-[520px]">
              <form className="flex flex-col" onSubmit={saveProfile}>
                <label>
                  <span className={FIELD_LABEL}>Name</span>
                  <input className={FIELD_INPUT} name="display_name" autoComplete="name" placeholder="Maya Chen" required maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
                </label>
                <label className="mt-5">
                  <span className={FIELD_LABEL}>Profile address</span>
                  <div
                    data-availability={handleAvailability}
                    className="flex h-[58px] items-center overflow-hidden rounded-md border border-line bg-panel-raised shadow-[0_5px_16px_rgb(40_46_35_/_0.035)] transition-[border-color,box-shadow] duration-150 hover:border-line-strong focus-within:border-blue focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-blue)_10%,transparent)] data-[availability=taken]:border-red data-[availability=taken]:hover:border-red data-[availability=taken]:focus-within:border-red data-[availability=taken]:focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-red)_10%,transparent)]"
                  >
                    <b className="pl-[18px] text-xs font-normal text-faint">agentprint.tech/</b>
                    <input
                      className="h-[56px] w-full min-w-0 border-0 bg-transparent pl-0 pr-2 text-sm text-ink-strong outline-none placeholder:text-faint"
                      name="handle"
                      autoComplete="username"
                      aria-label="Username"
                      placeholder="maya-builds"
                      required
                      minLength={3}
                      maxLength={30}
                      pattern="[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?"
                      value={profileHandle}
                      onChange={(event) => {
                        setProfileHandle(event.target.value.toLowerCase());
                        setHandleAvailability("idle");
                      }}
                    />
                    <span className={cx("mr-4 grid size-6 shrink-0 place-items-center", handleAvailability === "idle" || handleAvailability === "checking" ? "invisible" : "visible")} role="status" aria-live="polite" aria-label={handleAvailability === "available" ? "Handle available" : handleAvailability === "taken" ? "Handle unavailable" : undefined}>
                      {handleAvailability === "available" ? <Check size={18} className="text-blue" strokeWidth={2.5} /> : handleAvailability === "taken" ? <X size={18} className="text-red" strokeWidth={2.5} /> : null}
                    </span>
                  </div>
                  <small className="mt-2 block text-2xs text-faint">Lowercase letters, numbers, and hyphens.</small>
                </label>

                <div className="pt-8 text-center">
                  {profileError && <p className={formErrorClass} role="alert">{profileError}</p>}
                  <button className={buttonClass({ className: "min-w-[220px] max-tablet:w-full" })} aria-label="Claim profile and continue" disabled={savingProfile || handleAvailability === "checking" || handleAvailability === "taken"}>
                    {savingProfile ? "Saving…" : <>Continue to installation <ArrowRight size={16} /></>}
                  </button>
                </div>
              </form>

            </div>
          </div>
        ) : !hasDevice ? (
          <div className="flex min-h-[720px] flex-col justify-center pb-16 pt-10 max-tablet:min-h-0 max-tablet:justify-start max-tablet:pb-12 max-tablet:pt-14">
            <div>
              <h1 className={HEADING}>Connect your machine.</h1>
              <p className={LEAD}>Install the local collector once. It finds supported tools and keeps your Agentprint current in the background.</p>
            </div>

            <div className="mt-9 grid gap-3">
              <div className="grid grid-cols-2 gap-2 max-tablet:grid-cols-[1fr]">
                {[
                  { icon: Laptop, title: "Native binary", copy: "No runtime dependencies" },
                  { icon: RefreshCw, title: "Quiet sync", copy: "Runs in the background" },
                ].map(({ icon: Icon, title, copy }) => (
                  <div key={title} className="flex items-start gap-3 rounded-sm border border-line bg-panel-raised p-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-sm border border-steel-1 bg-accent-soft text-blue"><Icon size={15} /></span>
                    <span><b className="block text-xs font-[weight:560] text-ink-strong">{title}</b><small className="mt-0.5 block text-2xs text-muted">{copy}</small></span>
                  </div>
                ))}
              </div>

              <Tabs value={platform} onValueChange={(value) => setPlatform(value as Platform)} className="gap-3">
                <TabsList className="mx-auto grid w-full max-w-[380px] grid-cols-3 border-line-strong bg-canvas-deep p-1 shadow-[inset_0_1px_2px_rgb(40_46_35_/_0.05)]" aria-label="Operating system">
                  {platformOptions.map(({ value, icon: Icon }) => (
                    <TabsTrigger key={value} value={value} className="min-h-8 gap-1.5 rounded-full px-3 data-[state=active]:border-steel-1 [&_svg]:size-3.5">
                      <Icon aria-hidden="true" />
                      {value}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {platformOptions.map(({ value }) => (
                  <TabsContent key={value} value={value} className="m-0">
                    <CommandBlock label="Install command" command={installCommands[value]} name={`${value} install`} />
                  </TabsContent>
                ))}
                <div className="grid gap-3 border-t border-line pt-5">
                  <CommandBlock label="Then connect this machine" command="agentprint login" name="Login" />
                  <p className="m-0 flex items-center justify-end gap-2 pb-2.5 text-xs text-muted max-tablet:justify-start"><i className="size-1.5 rounded-full bg-blue shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-blue)_9%,transparent)] animate-[status-pulse_1.8s_infinite]" /> Waiting for a device to connect…</p>
                </div>
              </Tabs>
            </div>
          </div>
        ) : !hasCompletedSync ? (
          <div className="flex min-h-[720px] flex-col justify-center pb-16 pt-10 max-tablet:min-h-0 max-tablet:justify-start max-tablet:pb-12 max-tablet:pt-14">
            <div>
              <h1 className={HEADING}>Run your first sync.</h1>
              <p className={LEAD}>Your machine is connected. Run one sync to bring your agent activity into Agentprint.</p>
            </div>

            <div className="mt-9 grid gap-3">
              <CommandBlock label="Start your first sync" command="agentprint sync" name="Sync" />
              <p className="m-0 flex items-center justify-end gap-2 pb-2.5 text-xs text-muted max-tablet:justify-start"><i className="size-1.5 rounded-full bg-blue shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-blue)_9%,transparent)] animate-[status-pulse_1.8s_infinite]" /> Waiting for your first sync…</p>
            </div>
          </div>
        ) : (
          <div className="m-auto flex min-h-[720px] max-w-[620px] flex-col items-center justify-center px-6 py-16 text-center max-tablet:min-h-[620px]">
            <div className="grid size-[68px] place-items-center rounded-full border border-steel-2 bg-accent-soft text-blue shadow-[0_0_0_12px_color-mix(in_srgb,var(--color-blue)_5%,transparent)]"><Check size={28} /></div>
            <span className="mb-3 mt-8 block text-xs font-[weight:560] text-blue">First sync complete</span>
            <h1 className={HEADING}>Your record is live.</h1>
            <p className="mt-5 max-w-[560px] text-base leading-[1.65] text-muted">Review your profile, choose what you want to share, and publish when it feels right.</p>
            <div className="mt-9 flex justify-center gap-2.5 max-tablet:w-full max-tablet:flex-col">
              <Link className={buttonClass({ className: "max-tablet:w-full" })} href={`/${handle}`}>Open your profile <ArrowRight size={16} /></Link>
              <Link className={buttonClass({ variant: "secondary", className: "max-tablet:w-full" })} href="/settings#visibility">Choose visibility</Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
