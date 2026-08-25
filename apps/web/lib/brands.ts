// Brand colours for harness and model bars. Values that exist in our own SVG
// assets are taken from those files so the bar matches the mark beside it.
import { assetUrl } from "./assets";

export type Brand = { label: string; color: string; logo?: string };

const providers: Record<string, Brand> = {
  anthropic: { label: "Anthropic", color: "#d97757", logo: assetUrl("/brands/claude.svg") },
  openai: { label: "OpenAI", color: "#10a37f", logo: assetUrl("/brands/codex.svg") },
  opencode: { label: "OpenCode", color: "#211e1e", logo: assetUrl("/brands/opencode.svg") },
  moonshot: { label: "Moonshot", color: "#2b5ce6", logo: assetUrl("/brands/kimi.svg") },
  google: { label: "Google", color: "#4285f4" },
  deepseek: { label: "DeepSeek", color: "#4d6bfe" },
  zhipu: { label: "Zhipu", color: "#3859ff", logo: assetUrl("/brands/glm.svg") },
  alibaba: { label: "Alibaba", color: "#615ced", logo: assetUrl("/brands/qwen.svg") },
  xai: { label: "xAI", color: "#4a4a57" },
  meta: { label: "Meta", color: "#0668e1" },
  unknown: { label: "Unknown", color: "#7898db" }
};

const harnessProvider: Record<string, string> = {
  "claude-code": "anthropic",
  codex: "openai",
  opencode: "opencode",
  "kimi-code": "moonshot",
  synthetic: "unknown"
};

export const harnessLabels: Record<string, string> = {
  codex: "Codex",
  "claude-code": "Claude Code",
  opencode: "OpenCode",
  "kimi-code": "Kimi Code",
  synthetic: "Synthetic"
};

export function harnessBrand(harnessId: string): Brand {
  return providers[harnessProvider[harnessId] ?? "unknown"] ?? providers.unknown;
}

// daily_usage stores model_id but not provider_id, so the provider is inferred
// from the identifier. Order matters: longest/most specific prefixes first.
const modelPrefixes: [string, string][] = [
  ["claude", "anthropic"],
  ["gpt", "openai"],
  ["o1", "openai"],
  ["o3", "openai"],
  ["gemini", "google"],
  ["gemma", "google"],
  ["deepseek", "deepseek"],
  ["kimi", "moonshot"],
  ["glm", "zhipu"],
  ["qwen", "alibaba"],
  ["grok", "xai"],
  ["llama", "meta"]
];

export function modelBrand(modelId: string): Brand {
  const id = modelId.toLowerCase();
  for (const [prefix, provider] of modelPrefixes) {
    if (id.startsWith(prefix)) return providers[provider];
  }
  return providers.unknown;
}

export function compactTokens(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
}
