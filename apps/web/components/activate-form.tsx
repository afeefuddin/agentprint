"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Laptop, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";

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
      <div className="activation-success" role="status">
        <CheckCircle2 size={31} />
        <h2>Device connected</h2>
        <p>You can close this tab. The CLI is discovering local harnesses and preparing the first private sync.</p>
        <Link className="button" href="/onboarding">Continue onboarding <ArrowRight size={16} /></Link>
      </div>
    );
  }

  return (
    <form className="activate-form" onSubmit={submit}>
      <div className="activate-icon"><Laptop size={24} /></div>
      <h1>Connect your device</h1>
      <p>Enter the one-time code shown by the Agentprint CLI.</p>
      <label>
        <span>Device code</span>
        <input
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="A1B2C3-D4E5F6"
          pattern="[A-Fa-f0-9]{6}-[A-Fa-f0-9]{6}"
          maxLength={13}
          autoFocus
          required
        />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-wide" disabled={state === "pending"}>
        {state === "pending" ? "Approving…" : "Approve device"} <ArrowRight size={16} />
      </button>
      <div className="activate-boundary"><ShieldCheck size={15} /><span>This gives the agent permission to upload numeric usage metadata. It cannot upload prompts, code, paths, or credentials.</span></div>
    </form>
  );
}
