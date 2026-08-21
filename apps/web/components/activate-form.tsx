"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Laptop, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { buttonClass, formErrorClass } from "@/lib/ui";

const CARD =
  "m-auto w-[min(100%,480px)] rounded-md border border-line-strong bg-panel p-[42px] text-center max-tablet:px-5 max-tablet:py-[30px]";
const TITLE = "mb-1.5 mt-5 text-[27px] font-[weight:530] tracking-[-.03em]";
const BODY = "my-4 text-sm text-muted";

export function ActivateForm({ initialCode = "" }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [state, setState] = useState<"idle" | "pending" | "approved">("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setState("pending");
    setError("");
    const response = await fetch("/api/device/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_code: code })
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.message ?? "That code could not be approved.");
      setState("idle");
      return;
    }
    setState("approved");
  }

  if (state === "approved") {
    return (
      <div className={CARD} role="status">
        <CheckCircle2 size={31} className="mx-auto text-green" />
        <h2 className={TITLE}>Device connected</h2>
        <p className={BODY}>You can close this tab. The CLI is discovering local harnesses and preparing the first private sync.</p>
        <Link className={buttonClass({ className: "mt-5" })} href="/onboarding">
          Continue onboarding <ArrowRight size={16} />
        </Link>
      </div>
    );
  }

  return (
    <form className={CARD} onSubmit={submit}>
      <div className="mx-auto grid size-[52px] place-items-center rounded-sm border border-steel-3 text-blue">
        <Laptop size={24} />
      </div>
      <h1 className={TITLE}>Connect your device</h1>
      <p className={BODY}>Enter the one-time code shown by the Agentprint CLI.</p>
      <label className="mb-4 mt-[30px] block text-left">
        <span className="mb-[7px] block text-xs font-medium text-faint">Device code</span>
        <input
          className="h-[58px] w-full rounded-sm border border-line-strong bg-panel px-[13px] text-center text-[22px] font-[weight:520] tracking-[.1em] text-ink-strong outline-none focus:border-blue focus:shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-blue)_12%,transparent)]"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="A1B2C3-D4E5F6"
          pattern="[A-Fa-f0-9]{6}-[A-Fa-f0-9]{6}"
          maxLength={13}
          autoFocus
          required
        />
      </label>
      {error && <p className={formErrorClass} role="alert">{error}</p>}
      <button className={buttonClass({ className: "w-full" })} disabled={state === "pending"}>
        {state === "pending" ? "Approving…" : "Approve device"} <ArrowRight size={16} />
      </button>
      <div className="mt-[22px] flex gap-2.5 border-t border-line pt-5 text-left text-xs text-faint">
        <ShieldCheck size={15} className="shrink-0 text-green" />
        <span>
          This gives the agent permission to upload numeric usage metadata. It cannot upload prompts, code, paths, or credentials.
        </span>
      </div>
    </form>
  );
}
