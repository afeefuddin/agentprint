package claude

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestMapsClaudeUsage(t *testing.T) {
	root := t.TempDir()
	body := `{"uuid":"message-1","timestamp":"2026-07-29T09:30:00Z","message":{"model":"claude-opus-4-1","usage":{"input_tokens":100,"output_tokens":25,"cache_creation_input_tokens":10,"cache_read_input_tokens":15},"content":"ignored"}}` + "\n"
	if err := os.WriteFile(filepath.Join(root, "session.jsonl"), []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
	adapter := &Adapter{Root: root, Location: time.UTC}
	records, _, err := adapter.Collect(context.Background(), "")
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 1 {
		t.Fatalf("expected 1 record, got %d", len(records))
	}
	if records[0].TotalTokens != 150 || records[0].ModelID != "claude-opus-4-1" {
		t.Fatalf("unexpected mapping: %+v", records[0])
	}
}
