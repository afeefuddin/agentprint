"use client";

import { Check, Copy } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { AGENTPRINT_CLOUD_ORIGIN, installCommandsFor } from "@/lib/install-commands";

const installCommands = installCommandsFor(AGENTPRINT_CLOUD_ORIGIN).install;
type Platform = keyof typeof installCommands;

const platforms: Platform[] = ["macOS", "Linux", "Windows"];

function commandParts(command: string) {
  const leadEnd = command.indexOf(" ");
  const pathStart = command.indexOf(" https://");
  const script = command.includes("install.ps1") ? "install.ps1" : "install.sh";
  const scriptStart = command.indexOf(script);
  return {
    lead: command.slice(0, leadEnd),
    flag: command.slice(leadEnd, pathStart),
    path: command.slice(pathStart, scriptStart),
    script,
    tail: command.slice(scriptStart + script.length)
  };
}

type CommandParts = ReturnType<typeof commandParts>;

function CascadeCommand({ parts }: { parts: CommandParts }) {
  const tokens = [
    { text: "$ ", className: "select-none text-white/40" },
    { text: parts.lead, className: "text-[#ffa657]" },
    { text: parts.flag, className: "text-[#d2a8ff]" },
    { text: parts.path, className: "text-white/60" },
    { text: parts.script, className: "font-medium text-[#a5d6ff]" },
    { text: parts.tail, className: "text-white/90" }
  ];
  let characterIndex = 0;

  return (
    <>
      {tokens.map((token, tokenIndex) => (
        <span key={tokenIndex} className={token.className}>
          {token.text.split("").map((character) => {
            const index = characterIndex++;
            return (
              <span
                key={`${index}-${character}`}
                className="install-cascade-character inline-block whitespace-pre"
                style={{ animationDelay: `${index * 5}ms` }}
              >
                {character}
              </span>
            );
          })}
        </span>
      ))}
    </>
  );
}

export function LandingInstallCommand() {
  const [platform, setPlatform] = useState<Platform>("macOS");
  const [copied, setCopied] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<Platform, HTMLButtonElement>());
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const command = installCommands[platform];
  const parts = commandParts(command);

  useLayoutEffect(() => {
    const tabs = tabsRef.current;
    const tab = tabRefs.current.get(platform);
    if (!tabs || !tab) return;

    const measure = () => {
      const tabsBox = tabs.getBoundingClientRect();
      const tabBox = tab.getBoundingClientRect();
      setIndicator({ left: tabBox.left - tabsBox.left, width: tabBox.width });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(tabs);
    return () => observer.disconnect();
  }, [platform]);

  async function copyCommand() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="relative mx-auto max-w-[820px] text-center">
      <div className="mx-auto max-w-[672px] overflow-hidden rounded-sm border border-white/[.12] bg-[#1b1d1a] text-left shadow-[0_24px_70px_rgb(0_0_0_/_0.28),inset_0_1px_rgb(255_255_255_/_0.04)]">
        <div className="flex items-center gap-2 border-b border-white/[.09] px-3 py-1.5">
          <div ref={tabsRef} className="relative flex items-center gap-0.5" role="tablist" aria-label="Operating system">
            <span
              data-testid="install-tab-indicator"
              className="install-tab-indicator pointer-events-none absolute inset-y-0 rounded-xs border border-white/[.09] bg-white/[.07]"
              style={{
                opacity: indicator.width ? 1 : 0,
                transform: `translateX(${indicator.left}px)`,
                width: indicator.width
              }}
              aria-hidden="true"
            />
            {platforms.map((option) => (
              <button
                key={option}
                ref={(node) => {
                  if (node) tabRefs.current.set(option, node);
                  else tabRefs.current.delete(option);
                }}
                type="button"
                role="tab"
                aria-selected={platform === option}
                onClick={() => {
                  setPlatform(option);
                  setCopied(false);
                }}
                className="relative z-[1] inline-flex h-7 items-center rounded-xs px-2.5 text-xs font-medium text-white/45 transition-[color,transform] duration-150 hover:text-white/75 active:scale-[.97] aria-selected:text-white max-tablet:px-2"
              >
                {option}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={copyCommand}
            className="ml-auto grid size-7 shrink-0 place-items-center rounded-full border border-white/[.09] bg-white/[.035] text-white/45 transition-[background-color,color,transform] duration-150 hover:bg-white/[.07] hover:text-white active:scale-[.85] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
            aria-label={copied ? `${platform} install command copied` : `Copy ${platform} install command`}
          >
            <span key={copied ? "check" : "copy"} className="install-copy-icon inline-grid place-items-center">
              {copied ? <Check size={14} className="text-signal" aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            </span>
          </button>
        </div>
        <div className="overflow-x-auto" role="tabpanel" aria-label={`${platform} install command`}>
          <code key={platform} className="block min-w-max whitespace-nowrap px-5 py-4 font-mono text-xs text-white/90">
            <CascadeCommand parts={parts} />
          </code>
        </div>
      </div>

      <span className="sr-only" role="status" aria-live="polite">{copied ? "Install command copied" : ""}</span>
    </div>
  );
}
