package opencode

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestMapsOpenCodeUsageAndReportedCost(t *testing.T) {
	root := t.TempDir()
	directory := filepath.Join(root, "session")
	if err := os.MkdirAll(directory, 0o700); err != nil {
		t.Fatal(err)
	}
	body := `{"id":"message-1","role":"assistant","providerID":"openai","modelID":"gpt-5.4","cost":0.42,"time":{"created":1785317400000},"tokens":{"input":100,"output":25,"reasoning":5,"cache":{"read":10,"write":2}},"path":{"cwd":"ignored"}}`
	if err := os.WriteFile(filepath.Join(directory, "message.json"), []byte(body), 0o600); err != nil {
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
	record := records[0]
	if record.TotalTokens != 142 || record.EstimatedCostMicros == nil || *record.EstimatedCostMicros != 420000 {
		t.Fatalf("unexpected mapping: %+v", record)
	}
	if record.CostBasis != "reported" {
		t.Fatalf("expected reported cost basis")
	}
}
