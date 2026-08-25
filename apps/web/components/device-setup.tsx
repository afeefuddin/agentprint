"use client";

import { CheckCircle2, Clipboard, Laptop, RefreshCw } from "lucide-react";
import { FaApple, FaLinux, FaWindows } from "react-icons/fa";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { installCommandsFor } from "@/lib/install-commands";
import { cx } from "@/lib/ui";

const platformOptions = [
  { value: "macOS", icon: FaApple },
  { value: "Linux", icon: FaLinux },
  { value: "Windows", icon: FaWindows }
] as const;
type Platform = (typeof platformOptions)[number]["value"];

type CommandBlockProps = {
  label: string;
  command: string;
  name: string;
};

export function CommandBlock({ label, command, name }: CommandBlockProps) {
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
      <pre className="m-0 max-w-full whitespace-pre-wrap break-words px-4 py-4 text-left [overflow-wrap:anywhere]"><code className="font-mono text-xs leading-6 text-ink-strong"><span className="select-none text-blue" aria-hidden="true">$ </span>{command}</code></pre>
    </div>
  );
}

type DeviceSetupProps = {
  appUrl: string;
  title?: string;
  description?: string;
  className?: string;
};

export function DeviceSetup({
  appUrl,
  title = "Connect your machine.",
  description = "Install Agentprint once. It finds supported coding tools and keeps your activity current automatically.",
  className
}: DeviceSetupProps) {
  const commands = installCommandsFor(appUrl);
  const [platform, setPlatform] = useState<Platform>("macOS");

  return (
    <div className={cx("flex flex-col justify-center", className)}>
      <div>
        <h1 className="m-0 text-center text-6xl font-medium leading-[.98] tracking-[-.045em] text-ink-strong max-tablet:text-4xl">{title}</h1>
        <p className="mx-auto mb-0 mt-4 max-w-[480px] text-center text-sm leading-[1.65] text-muted">{description}</p>
      </div>

      <div className="mt-9 grid gap-3">
        <div className="grid grid-cols-2 gap-2 max-tablet:grid-cols-[1fr]">
          {[
            { icon: Laptop, title: "Simple setup", copy: "Nothing else to install" },
            { icon: RefreshCw, title: "Automatic updates", copy: "Keeps your activity current" }
          ].map(({ icon: Icon, title: featureTitle, copy }) => (
            <div key={featureTitle} className="flex items-start gap-3 rounded-sm border border-line bg-panel-raised p-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-sm border border-steel-1 bg-accent-soft text-blue"><Icon size={15} /></span>
              <span><b className="block text-xs font-semibold text-ink-strong">{featureTitle}</b><small className="mt-0.5 block text-2xs text-muted">{copy}</small></span>
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
              <CommandBlock label="Install command" command={commands.install[value]} name={`${value} install`} />
            </TabsContent>
          ))}
          <div className="grid gap-3 border-t border-line pt-5">
            <CommandBlock label="Then connect this machine" command={commands.login} name="Login" />
            <p className="m-0 flex items-center justify-end gap-2 pb-2.5 text-xs text-muted max-tablet:justify-start"><i className="size-1.5 rounded-full bg-blue shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-blue)_9%,transparent)] animate-[status-pulse_1.8s_infinite]" /> Waiting for a device to connect…</p>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
