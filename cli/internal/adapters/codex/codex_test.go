package codex

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestCollectsOnlyNumericTokenMetadata(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "session.jsonl")
	body := `{"timestamp":"2026-07-29T09:30:00Z","type":"event_msg","payload":{"type":"token_count","info":{"last_token_usage":{"input_tokens":100,"cached_input_tokens":20,"output_tokens":30,"reasoning_output_tokens":5,"total_tokens":155}}}}` + "\n"
	body += `{"timestamp":"2026-07-29T09:31:00Z","type":"response_item","payload":{"type":"message","content":"must never be collected"}}` + "\n"
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
	adapter := &Adapter{Root: root, Location: time.UTC}
	records, cursor, err := adapter.Collect(context.Background(), "")
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 1 {
		t.Fatalf("expected 1 record, got %d", len(records))
	}
	record := records[0]
	if record.TotalTokens != 155 || record.InputTokens != 100 || record.OutputTokens != 30 {
		t.Fatalf("unexpected token mapping: %+v", record)
	}
	if record.LocalDate != "2026-07-29" {
		t.Fatalf("unexpected local date %s", record.LocalDate)
	}
	second, _, err := adapter.Collect(context.Background(), cursor)
	if err != nil {
		t.Fatal(err)
	}
	if len(second) != 0 {
		t.Fatalf("cursor should prevent unchanged file replay, got %d", len(second))
	}
}

func TestCollectSkipsOversizedMetadataLines(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "session.jsonl")
	oversized := strings.Repeat("x", maxMetadataLineBytes+1) + "\n"
	usage := `{"timestamp":"2026-07-29T09:30:00Z","payload":{"type":"token_count","info":{"last_token_usage":{"input_tokens":100,"cached_input_tokens":20,"output_tokens":30,"reasoning_output_tokens":5,"total_tokens":155}}}}` + "\n"
	if err := os.WriteFile(path, []byte(oversized+usage), 0o600); err != nil {
		t.Fatal(err)
	}

	adapter := &Adapter{Root: root, Location: time.UTC}
	records, _, err := adapter.Collect(context.Background(), "")
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 1 {
		t.Fatalf("expected 1 record after oversized line, got %d", len(records))
	}
	if records[0].TotalTokens != 155 {
		t.Fatalf("unexpected token mapping: %+v", records[0])
	}
}
