import { getProfile } from "@agentprint/database";
import { formatTokens, intensityFor } from "@agentprint/analytics";
import { notFound } from "@/lib/http";

function escape(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
  }[character]!));
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ handle: string }> }
) {
  const { handle } = await context.params;
  const data = await getProfile(handle);
  if (!data) return notFound();
  const days = data.activity.slice(-84);
  const colors = ["#151a1e", "#1b2832", "#254157", "#316281", "#4d92b8"];
  const cells = days.map((day, index) => {
    const x = 30 + Math.floor(index / 7) * 13;
    const y = 114 + (index % 7) * 13;
    return `<rect x="${x}" y="${y}" width="9" height="9" rx="1" fill="${colors[intensityFor(day.tokens, data.thresholds)]}"/>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="236" viewBox="0 0 600 236" role="img" aria-labelledby="title desc">
  <style>
    @font-face { font-family: "Intertight"; src: url("https://cdn.prod.website-files.com/693a7ff7f8662142a99517e0/693a8922bd34651a7a959434_InterTight-Medium.woff2") format("woff2"); font-style: normal; font-weight: 100 900; }
    text { font-family: "Intertight", sans-serif; font-style: normal; }
  </style>
  <title id="title">${escape(data.profile.display_name)} on Agentprint</title>
  <desc id="desc">${formatTokens(data.summary.totalTokens)} tokens across ${data.summary.activeDays} active days.</desc>
  <rect width="600" height="236" rx="10" fill="#0b0d0f"/>
  <rect x=".5" y=".5" width="599" height="235" rx="9.5" fill="none" stroke="#343c44"/>
  <g transform="translate(28 23)">
    <g transform="scale(.68)" fill="none" stroke="#f8f4e9" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 13.5v-.25C3 7.04 8.04 2 14.25 2h2.5C24.07 2 30 7.93 30 15.25V30"/>
      <path d="M9 13.5c0-3.04 2.46-5.5 5.5-5.5h1.75A7.75 7.75 0 0 1 24 15.75V25a5 5 0 0 0 5 5h1"/>
      <path d="M15 13.5a2 2 0 0 1 4 0V30"/>
    </g>
    <g transform="scale(.68)" fill="#2868f6">
      <rect x="2" y="17" width="4" height="4" rx="1"/><rect x="8" y="17" width="4" height="4" rx="1"/>
      <rect x="8" y="23" width="4" height="4" rx="1"/><rect x="14" y="23" width="4" height="4" rx="1"/>
      <rect x="2" y="23" width="4" height="4" rx="1" fill="#c8ff58"/>
    </g>
    <text x="29" y="16" fill="#f8f4e9" font-size="14" font-weight="650" letter-spacing="-.35">agentprint</text>
  </g>
  <text x="30" y="79" fill="#f8f4e9" font-size="22" font-weight="600">${escape(data.profile.display_name)}</text>
  <text x="30" y="99" fill="#75b9dd" font-size="12">@${escape(data.profile.handle)}</text>
  ${cells}
  <line x1="210" y1="113" x2="210" y2="207" stroke="#242a30"/>
  <text x="235" y="131" fill="#626b75" font-size="12">Lifetime tokens</text>
  <text x="235" y="157" fill="#f8f4e9" font-size="25">${formatTokens(data.summary.totalTokens)}</text>
  <text x="410" y="131" fill="#626b75" font-size="12">Active days</text>
  <text x="410" y="157" fill="#f8f4e9" font-size="25">${data.summary.activeDays}</text>
  <text x="235" y="192" fill="#626b75" font-size="12">Most used coding tool</text>
  <text x="235" y="208" fill="#929ba4" font-size="12">${escape(data.summary.mostUsedHarness ?? "—")}</text>
  <circle cx="568" cy="32" r="3" fill="#6dba97"/>
</svg>`;
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
