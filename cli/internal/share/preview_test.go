package share

import (
	"html"
	"strings"
	"testing"

	"github.com/agentprint/agentprint/cli/internal/adapters"
	"github.com/agentprint/agentprint/cli/internal/redact"
)

func TestPreviewIncludesTheExactPayloadAndCallsItAccurately(t *testing.T) {
	payload := []byte(`{
  "visibility": "unlisted",
  "model_ids": ["model-safe"],
  "turns": []
}`)
	page := renderPreview(adapters.Transcript{Title: "Preview", HarnessID: "codex"}, redact.Stats{}, "strict", payload)
	for _, expected := range []string{
		"This page renders the transcript preview.",
		"Exact JSON payload",
		html.EscapeString(string(payload)),
	} {
		if !strings.Contains(page, expected) {
			t.Errorf("preview missing %q", expected)
		}
	}
	if strings.Contains(page, "This is the exact payload") {
		t.Fatal("the transcript rendering must not be described as the exact payload")
	}
}
