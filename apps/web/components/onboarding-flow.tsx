"use client";

import Link from "next/link";
import { ArrowRight, Check, CheckCircle2, Clipboard, Laptop, RefreshCw, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { buttonClass, eyebrowClass, formErrorClass } from "@/lib/ui";

const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

const HEADING =
  "mt-[17px] text-[clamp(50px,5.2vw,74px)] font-normal leading-[.88] tracking-[-.055em] text-ink-strong max-desktop:text-[54px] max-tablet:text-[47px]";
const LEAD = "m-0 max-w-[470px] text-sm leading-[1.65] text-muted";
const FIELD_LABEL = "mb-2 block text-xs font-bold text-muted";
const FIELD_INPUT =
  "h-[54px] w-full rounded-sm border border-[#cfd3c8] bg-white px-[15px] text-sm text-ink-strong outline-none transition-[border-color,box-shadow] duration-150 focus:border-blue focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-blue)_11%,transparent)]";

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
    <div className="overflow-hidden rounded-lg border border-[#cfd3c8] bg-[#f8f8f4] shadow-[0_28px_70px_rgb(40_46_35_/_0.09)] animate-[settle-in_500ms_both]">
      <header className="grid min-h-[92px] grid-cols-[210px_1fr] border-b border-[#daddd4] max-desktop:grid-cols-[180px_1fr] max-tablet:min-h-0 max-tablet:grid-cols-[1fr]">
        <div className="flex items-center justify-between border-r border-[#daddd4] px-[25px] py-5 max-tablet:border-b max-tablet:border-r-0 max-tablet:px-[18px] max-tablet:py-4">
          <span className="text-xs font-bold text-muted">Agentprint / setup</span>
          <strong className="whitespace-nowrap text-md font-bold text-ink-strong">
            {String(currentStep + 1).padStart(2, "0")} <i className="text-xs font-medium text-faint">of 04</i>
          </strong>
        </div>
        <ol aria-label="Setup progress" className="m-0 grid list-none grid-cols-4 p-0 max-tablet:min-h-[56px]">
          {steps.map((step, index) => (
            <li
              key={step.label}
              data-complete={step.complete}
              data-current={!step.complete && index === currentStep}
              className="group relative flex items-center gap-2.5 p-5 text-xs text-[#9b9f95] data-[complete=true]:text-ink data-[current=true]:text-ink-strong not-last:after:absolute not-last:after:right-0 not-last:after:h-6 not-last:after:w-px not-last:after:bg-[#daddd4] not-last:after:content-[''] max-desktop:justify-center max-desktop:px-2 max-desktop:py-4 max-tablet:px-1 max-tablet:py-3 max-tablet:not-last:after:h-5"
            >
              <span className="grid size-6 flex-[0_0_24px] place-items-center rounded-full border border-[#cfd3c8] text-2xs group-data-[complete=true]:border-blue group-data-[complete=true]:text-blue group-data-[current=true]:border-ink-strong group-data-[current=true]:bg-ink-strong group-data-[current=true]:text-signal max-tablet:size-[23px] max-tablet:flex-[0_0_23px]">
                {step.complete ? <Check size={12} /> : index + 1}
              </span>
              <b className="font-semibold max-desktop:hidden">{step.label}</b>
            </li>
          ))}
        </ol>
      </header>
      <section className="min-h-[610px] max-tablet:min-h-0">
        {!profileComplete ? (
          <div className="grid min-h-[610px] grid-cols-[minmax(0,1.06fr)_minmax(430px,.94fr)] max-desktop:grid-cols-[1fr_380px] max-tablet:min-h-0 max-tablet:grid-cols-[1fr]">
            <div className="flex flex-col justify-between px-14 pb-[45px] pt-[65px] max-desktop:px-[35px] max-desktop:pb-[38px] max-desktop:pt-12 max-tablet:px-[22px] max-tablet:pb-[34px] max-tablet:pt-[42px]">
              <div className="mb-[52px] max-tablet:mb-[38px]">
                <span className={eyebrowClass}>Start with your identity</span>
                <h1 className={`${HEADING} mb-5`}>Put your name<br />on the record.</h1>
                <p className={LEAD}>Your agents do the work. Agentprint gives that work a clear, privacy-safe signature. This is how yours will appear.</p>
              </div>
              <form className="w-full" onSubmit={saveProfile}>
                <div className="grid grid-cols-[.72fr_1.28fr] gap-3.5 max-desktop:grid-cols-[1fr]">
                  <label>
                    <span className={FIELD_LABEL}>Name</span>
                    <input className={FIELD_INPUT} name="display_name" autoComplete="name" placeholder="Maya Chen" required maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
                  </label>
                  <label>
                    <span className={FIELD_LABEL}>Profile address</span>
                    <div className="flex h-[54px] items-center overflow-hidden rounded-sm border border-[#cfd3c8] bg-white focus-within:border-blue">
                      <b className="pl-[13px] text-xs font-normal text-faint">agentprint.tech/</b>
                      <input
                        className="h-[52px] w-full min-w-0 border-0 bg-transparent pl-0 pr-[15px] text-sm text-ink-strong outline-none"
                        name="handle"
                        autoComplete="username"
                        aria-label="Username"
                        placeholder="maya-builds"
                        required
                        minLength={3}
                        maxLength={30}
                        pattern="[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?"
                        value={profileHandle}
                        onChange={(event) => setProfileHandle(event.target.value.toLowerCase())}
                      />
                    </div>
                    <small className="mt-1.5 block text-xs text-faint">Lowercase letters, numbers, and hyphens.</small>
                  </label>
                </div>
                <div className="mt-[25px] flex items-center justify-between gap-6 border-t border-[#daddd4] pt-[22px] max-tablet:flex-col max-tablet:items-stretch max-tablet:gap-4">
                  <p className="m-0 flex items-center gap-[7px] text-xs text-muted">
                    <ShieldCheck size={15} className="text-blue" /> Private until you choose to publish
                  </p>
                  <button
                    className={buttonClass({ className: "min-w-[190px] max-tablet:w-full" })}
                    aria-label="Claim profile and continue"
                    disabled={savingProfile}
                  >
                    {savingProfile ? "Saving…" : <>Create my record <ArrowRight size={16} /></>}
                  </button>
                </div>
                {profileError && <p className={formErrorClass} role="alert">{profileError}</p>}
              </form>
            </div>
            <aside
              aria-label="Profile preview"
              className="group relative grid place-items-center overflow-hidden border-l border-[#daddd4] bg-[#dfe3db] bg-[linear-gradient(rgb(81_89_75_/_0.07)_1px,transparent_1px),linear-gradient(90deg,rgb(81_89_75_/_0.07)_1px,transparent_1px)] bg-[length:28px_28px] px-[45px] pb-[35px] pt-[55px] before:absolute before:size-[520px] before:rounded-full before:border before:border-white/70 before:shadow-[0_0_0_72px_rgb(255_255_255_/_0.2),0_0_0_144px_rgb(255_255_255_/_0.12)] before:content-[''] max-tablet:min-h-[500px] max-tablet:border-l-0 max-tablet:border-t max-tablet:border-[#daddd4] max-tablet:px-[22px] max-tablet:py-[50px]"
            >
              <div className="relative z-[1] w-[min(100%,445px)] rotate-[-1.4deg] rounded-md border border-[rgb(47_55_43_/_0.19)] bg-[rgb(253_253_249_/_0.93)] p-6 shadow-[16px_18px_0_rgb(91_100_83_/_0.11),0_30px_60px_rgb(41_48_36_/_0.13)] transition-transform duration-300 group-hover:translate-y-[-4px] group-hover:rotate-0 max-tablet:rotate-0 max-tablet:p-5 max-tablet:shadow-[9px_11px_0_rgb(91_100_83_/_0.11)]">
                <div className="flex items-center justify-between border-b border-line pb-5 text-2xs font-bold text-faint">
                  <span>AP / 001</span>
                  <b className="inline-flex items-center gap-1.5 text-2xs text-ink">
                    <i className="size-1.5 rounded-full bg-blue shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-blue)_12%,transparent)]" /> Private draft
                  </b>
                </div>
                <div className="grid grid-cols-[62px_1fr] items-center gap-4 pb-7 pt-[30px] max-tablet:grid-cols-[52px_1fr]">
                  <div className="grid size-[62px] place-items-center rounded-full bg-ink-strong text-base font-bold text-signal max-tablet:size-[52px]" aria-hidden="true">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <span className="text-2xs text-faint">Agent record of</span>
                    <h2 className="mb-px mt-0.5 truncate text-[28px] font-medium tracking-[-.035em] text-ink-strong max-tablet:text-[24px]">{previewName}</h2>
                    <p className="m-0 truncate text-xs text-muted">agentprint.tech/{previewHandle}</p>
                  </div>
                </div>
                <div className="border-t border-line pt-5" aria-hidden="true">
                  <div className="flex justify-between gap-[15px] text-2xs font-bold text-faint">
                    <span>Contribution field</span><b className="text-2xs text-blue">Awaiting first sync</b>
                  </div>
                  <div className="mt-3.5 grid grid-cols-14 gap-1">
                    {Array.from({ length: 56 }, (_, index) => (
                      <i
                        key={index}
                        data-active={index % 9 === 0 || index % 13 === 0 || undefined}
                        className="aspect-square rounded-[2px] bg-[#e5e8e1] data-[active=true]:bg-steel-2"
                      />
                    ))}
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-x-3 gap-y-1.5 border-t border-line pt-3.5 text-2xs font-bold text-faint">
                  <span>Codex</span><span>Claude Code</span><span>OpenCode</span><span>Kimi Code</span>
                </div>
              </div>
              <p className="absolute inset-x-5 bottom-[15px] z-[1] m-0 flex justify-center gap-[7px] justify-self-stretch text-center text-2xs text-[#747a6f] max-tablet:inset-x-3.5 max-tablet:bottom-3">
                <span className="whitespace-nowrap font-bold text-ink">Live preview</span> Your first sync will replace this sample field.
              </p>
            </aside>
          </div>
        ) : !hasDevice ? (
          <div className="grid min-h-[610px] grid-cols-[minmax(0,.85fr)_minmax(500px,1.15fr)] items-center gap-[68px] px-[58px] py-[65px] max-desktop:grid-cols-[1fr] max-desktop:gap-[45px] max-desktop:p-[55px] max-tablet:min-h-0 max-tablet:gap-[38px] max-tablet:px-[22px] max-tablet:pb-[55px] max-tablet:pt-[44px]">
            <div>
              <span className={eyebrowClass}>Connect this machine</span>
              <h1 className={`${HEADING} mb-6`}>One command.<br />Then forget it.</h1>
              <p className={LEAD}>The local agent finds supported tools, queues usage offline, and keeps your record current in the background.</p>
              <div className="mt-[45px] grid gap-[18px] max-tablet:mt-8">
                <div className="flex gap-3 text-blue">
                  <Laptop size={16} />
                  <span className="block text-xs text-faint"><b className="mb-0.5 block text-xs text-ink">Native binary</b>No runtime dependencies</span>
                </div>
                <div className="flex gap-3 text-blue">
                  <RefreshCw size={16} />
                  <span className="block text-xs text-faint"><b className="mb-0.5 block text-xs text-ink">Quiet by design</b>Automatic background sync</span>
                </div>
                <div className="flex gap-3 text-blue">
                  <ShieldCheck size={16} />
                  <span className="block text-xs text-faint"><b className="mb-0.5 block text-xs text-ink">Metadata only</b>Never prompts or source code</span>
                </div>
              </div>
            </div>
            <div className="overflow-hidden rounded-md border border-[#10140e] bg-[#171b15] text-[#e9ece4] shadow-[18px_20px_0_#dfe2d9,0_32px_65px_rgb(31_36_27_/_0.19)] max-tablet:shadow-[8px_10px_0_#dfe2d9]">
              <div className="flex items-center justify-between border-b border-[#30362d] px-[17px] py-[15px] text-xs text-[#81887b]">
                <span className="flex gap-[5px]">
                  <i className="size-[7px] rounded-full bg-[#454c41]" />
                  <i className="size-[7px] rounded-full bg-[#454c41]" />
                  <i className="size-[7px] rounded-full bg-[#454c41]" />
                </span>
                <b className="font-medium">Install Agentprint</b>
              </div>
              <div className="flex gap-1.5 border-b border-[#30362d] bg-[#1b2019] p-2.5" role="tablist" aria-label="Operating system">
                {(Object.keys(installCommands) as (keyof typeof installCommands)[]).map((name) => (
                  <button
                    key={name}
                    role="tab"
                    aria-selected={platform === name}
                    onClick={() => setPlatform(name)}
                    className="min-w-20 cursor-pointer rounded-sm border border-transparent bg-transparent px-3.5 py-2.5 text-xs text-[#92998d] transition-[color,background-color,border-color] duration-[140ms] hover:border-[#3b4237] hover:text-[#d5d9d1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal aria-selected:border-signal aria-selected:bg-signal aria-selected:font-bold aria-selected:text-[#11150f] aria-selected:shadow-[0_0_0_3px_rgb(200_255_88_/_0.09)]"
                  >
                    {name}
                  </button>
                ))}
              </div>
              <div className="flex min-h-[118px] items-center border-b border-[#30362d] py-6 pl-6 pr-[17px] max-tablet:min-h-[132px] max-tablet:items-start">
                <code className="flex-1 break-all pr-3 text-xs leading-[1.65] text-[#f0f2ed]">
                  <span className="text-signal">$</span> {installCommands[platform]}
                </code>
                <button
                  onClick={copy}
                  aria-label="Copy install command"
                  className="grid size-[38px] flex-[0_0_38px] cursor-pointer place-items-center rounded-sm border border-[#3b4237] bg-[#22271f] text-[#bec4b8]"
                >
                  {copied ? <CheckCircle2 size={16} /> : <Clipboard size={16} />}
                </button>
              </div>
              <div className="grid gap-3.5 border-b border-[#30362d] px-6 py-[22px] text-xs text-[#858d80]">
                <span className="flex items-center gap-2">
                  <i className="grid size-[18px] place-items-center rounded-full border border-[#41483d] text-2xs">2</i> Then connect this machine
                </span>
                <code className="w-fit rounded-sm bg-[#22271f] px-[13px] py-2.5 text-signal">agentprint login</code>
              </div>
              <p className="m-0 flex items-center gap-2 px-6 py-[15px] text-xs text-[#788074]">
                <i className="size-1.5 rounded-full bg-signal shadow-[0_0_0_4px_rgb(200_255_88_/_0.08)] animate-[status-pulse_1.8s_infinite]" /> Waiting for a device to connect…
              </p>
            </div>
          </div>
        ) : (
          <div className="m-auto flex min-h-[610px] max-w-[620px] flex-col items-center justify-center px-6 py-[60px] text-center max-tablet:min-h-[540px]">
            <div className="grid size-[74px] place-items-center rounded-full bg-ink-strong text-signal shadow-[0_0_0_12px_#e6e9e1]">
              <Check size={30} />
            </div>
            <span className="mb-2.5 mt-7 block text-xs font-bold text-blue">First sync complete</span>
            <h1 className="m-0 text-[58px] font-normal tracking-[-.05em] text-ink-strong max-tablet:text-[46px]">Your record is alive.</h1>
            <p className="mt-4 max-w-[520px] leading-[1.7] text-muted">
              Your connected device is healthy. Review the private profile, choose which metrics are visible, and publish when it feels right.
            </p>
            <div className="mt-8 flex justify-center gap-2.5 max-tablet:flex-col">
              <Link className={buttonClass()} href={`/${handle}`}>Preview private profile <ArrowRight size={16} /></Link>
              <Link className={buttonClass({ variant: "secondary" })} href="/settings#visibility">Choose visibility</Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
