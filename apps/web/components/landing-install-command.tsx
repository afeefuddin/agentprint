"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { AGENTPRINT_CLOUD_ORIGIN, installCommandsFor } from "@/lib/install-commands";

const installCommands = installCommandsFor(AGENTPRINT_CLOUD_ORIGIN).install;
type Platform = keyof typeof installCommands;

const platforms: Platform[] = ["macOS", "Linux", "Windows"];

export function LandingInstallCommand() {
  const [platform, setPlatform] = useState<Platform>("macOS");
  const [copied, setCopied] = useState(false);
  const command = installCommands[platform];

  async function copyCommand() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="relative mx-auto max-w-[820px] text-center">
      <p className="m-0 text-xs font-semibold text-signal">Agentprint CLI</p>
      <h2
        id="install-agentprint-title"
        className="mx-auto mt-3 max-w-[620px] text-5xl font-bold leading-[1.04] tracking-[-.045em] text-white max-tablet:text-3xl"
      >
        Start tracking in one command.
      </h2>
      <p className="mx-auto mt-4 max-w-[550px] text-sm leading-6 text-white/55 max-tablet:px-3">
        Install Agentprint, sign in, and it finds your supported coding tools automatically.
      </p>

      <div className="mx-auto mt-8 max-w-[760px] overflow-hidden rounded-md border border-white/[.13] bg-[#1b1e1a] text-left shadow-[0_24px_70px_rgb(0_0_0_/_0.28),inset_0_1px_rgb(255_255_255_/_0.04)] max-tablet:mt-7">
        <div className="flex items-center border-b border-white/10 px-2 py-2">
          <div className="flex items-center gap-1" role="tablist" aria-label="Operating system">
            {platforms.map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={platform === option}
                onClick={() => {
                  setPlatform(option);
                  setCopied(false);
                }}
                className="rounded-sm px-4 py-2 text-xs font-semibold text-white/45 transition-[background-color,color,transform] duration-150 hover:text-white/75 active:scale-[.97] aria-selected:bg-white/[.09] aria-selected:text-white max-tablet:px-3"
              >
                {option}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-stretch" role="tabpanel" aria-label={`${platform} install command`}>
          <code className="flex min-h-[62px] min-w-0 items-center overflow-x-auto whitespace-nowrap px-5 font-mono text-xs text-[#f0f2ec] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-tablet:min-h-[58px] max-tablet:px-4">
            <span className="mr-3 select-none text-signal" aria-hidden="true">$</span>
            {command}
          </code>
          <button
            type="button"
            onClick={copyCommand}
            className="inline-flex min-w-[92px] items-center justify-center gap-2 border-l border-white/10 px-4 text-xs font-semibold text-white/65 transition-[background-color,color,transform] duration-150 hover:bg-white/[.06] hover:text-white active:scale-[.97] focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-signal max-tablet:min-w-12 max-tablet:px-3"
            aria-label={copied ? `${platform} install command copied` : `Copy ${platform} install command`}
          >
            {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
            <span className="max-tablet:hidden">{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>

      <p className="mt-4 text-xs text-white/38">One install keeps your activity up to date.</p>
      <span className="sr-only" role="status" aria-live="polite">{copied ? "Install command copied" : ""}</span>
    </div>
  );
}
