// Package share renders a redacted transcript locally so the user can read
// exactly what a publish would upload, before anything is uploaded.
//
// This preview is the whole trust mechanic of session sharing. Agentprint's
// usage pipeline can promise "no content leaves this machine" structurally.
// Sharing cannot, so it promises something checkable instead: you see the
// payload first, byte for byte, in your own browser, offline.
package share

import (
	"fmt"
	"html"
	"os"
	"strings"

	"github.com/agentprint/agentprint/cli/internal/adapters"
	"github.com/agentprint/agentprint/cli/internal/redact"
)

func WritePreview(path string, transcript adapters.Transcript, stats redact.Stats, level string) error {
	return os.WriteFile(path, []byte(renderPreview(transcript, stats, level)), 0o600)
}

func renderPreview(transcript adapters.Transcript, stats redact.Stats, level string) string {
	var page strings.Builder
	page.WriteString(`<!doctype html><html lang="en"><head><meta charset="utf-8">`)
	page.WriteString(`<meta name="viewport" content="width=device-width,initial-scale=1">`)
	page.WriteString(`<meta name="robots" content="noindex">`)
	fmt.Fprintf(&page, `<title>%s — Agentprint share preview</title>`, html.EscapeString(transcript.Title))
	page.WriteString(`<style>
:root{--ink:#383a35;--ink-strong:#171914;--muted:#6f736b;--canvas:#f7f7f4;--panel:#fff;--line:#e3e5de;--accent:#2868f6}
*{box-sizing:border-box}
body{margin:0;padding:40px 20px 80px;background:var(--canvas);color:var(--ink);
  font:16px/1.55 ui-sans-serif,system-ui,-apple-system,sans-serif}
main{max-width:820px;margin:0 auto}
h1{margin:0 0 6px;color:var(--ink-strong);font-size:26px;font-weight:600;letter-spacing:-.02em}
.meta{margin:0 0 24px;color:var(--muted);font-size:14px}
.notice{margin-bottom:28px;padding:16px 18px;border:1px solid var(--line);
  border-left:3px solid var(--accent);border-radius:12px;background:var(--panel);font-size:15px}
.notice b{color:var(--ink-strong)}
.notice ul{margin:8px 0 0;padding-left:20px;color:var(--muted)}
.turn{margin-bottom:18px;padding:18px 20px;border:1px solid var(--line);border-radius:14px;background:var(--panel)}
.turn.user{background:#f2f5fb;border-color:#dbe4f5}
.role{margin-bottom:10px;color:var(--muted);font-size:13px}
pre{margin:0;white-space:pre-wrap;word-break:break-word;font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
.text{white-space:pre-wrap;word-break:break-word}
details{margin-top:10px;border:1px solid var(--line);border-radius:10px;background:#fbfbf9}
details[open]{padding-bottom:10px}
summary{padding:9px 12px;color:var(--muted);font-size:14px;cursor:pointer}
details pre{padding:0 12px;color:#4a4d46}
.tool summary{color:var(--ink-strong)}
.omitted{margin-top:10px;color:var(--muted);font-size:14px;font-style:italic}
mark{background:#ffe9c9;color:#7a4a12;padding:0 3px;border-radius:3px}
</style></head><body><main>`)

	fmt.Fprintf(&page, `<h1>%s</h1>`, html.EscapeString(transcript.Title))
	fmt.Fprintf(&page,
		`<p class="meta">%s · %d turns · %s to %s</p>`,
		html.EscapeString(transcript.HarnessID), len(transcript.Turns),
		html.EscapeString(transcript.StartedAt), html.EscapeString(transcript.EndedAt))

	page.WriteString(`<div class="notice"><b>Nothing has been uploaded.</b> This is the exact payload `)
	page.WriteString(`a publish would send, rendered locally from a file on this machine.<ul>`)
	fmt.Fprintf(&page, `<li>Redaction level: %s</li>`, html.EscapeString(level))
	fmt.Fprintf(&page, `<li>%d credential values removed</li>`, stats.SecretsRemoved)
	fmt.Fprintf(&page, `<li>%d local paths rewritten</li>`, stats.PathsRewritten)
	fmt.Fprintf(&page, `<li>%d blocks truncated</li>`, stats.BlocksTruncated)
	fmt.Fprintf(&page, `<li>%d turns excluded</li>`, stats.TurnsExcluded)
	page.WriteString(`</ul></div>`)

	for _, turn := range transcript.Turns {
		class := "turn"
		if turn.Role == "user" {
			class += " user"
		}
		fmt.Fprintf(&page, `<section class="%s"><div class="role">%s · turn %d</div>`,
			class, html.EscapeString(turn.Role), turn.Index)
		for _, block := range turn.Blocks {
			page.WriteString(renderBlock(block))
		}
		page.WriteString(`</section>`)
	}
	page.WriteString(`</main></body></html>`)
	return page.String()
}

// highlight makes the redaction markers visible, so a reader can see where
// something was removed rather than having to trust that it was.
func highlight(value string) string {
	escaped := html.EscapeString(value)
	for _, marker := range redactionMarkers {
		escaped = strings.ReplaceAll(escaped, marker, `<mark>`+marker+`</mark>`)
	}
	return escaped
}

var redactionMarkers = []string{
	"[redacted:private-key]", "[redacted:authorization]", "[redacted:assignment]",
	"[redacted:high-entropy]", "[redacted:anthropic-key]", "[redacted:openai-key]",
	"[redacted:github-token]", "[redacted:github-pat]", "[redacted:aws-access-key]",
	"[redacted:google-key]", "[redacted:slack-token]", "[redacted:stripe-key]",
	"[redacted:npm-token]", "[redacted:jwt]", "[redacted:url-password]", "&lt;project&gt;",
}

func renderBlock(block adapters.Block) string {
	switch block.Kind {
	case adapters.BlockText:
		return `<div class="text">` + highlight(block.Text) + `</div>`
	case adapters.BlockThinking:
		return `<details><summary>Thinking</summary><pre>` + highlight(block.Text) + `</pre></details>`
	case adapters.BlockToolUse:
		return fmt.Sprintf(
			`<details class="tool"><summary>%s</summary><pre>%s</pre></details>`,
			html.EscapeString(block.Name), highlight(block.Input))
	case adapters.BlockToolResult:
		label := "Result"
		if block.OK != nil && !*block.OK {
			label = "Result (error)"
		}
		return fmt.Sprintf(
			`<details><summary>%s</summary><pre>%s</pre></details>`,
			label, highlight(block.Output))
	case adapters.BlockOmitted:
		return fmt.Sprintf(`<p class="omitted">%s omitted</p>`, html.EscapeString(block.Reason))
	}
	return ""
}
