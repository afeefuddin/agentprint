"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function ShareButton({ title, label = "Share profile" }: { title: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button className="button button-secondary share-button" type="button" onClick={share}>
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? "Copied" : label}
    </button>
  );
}
