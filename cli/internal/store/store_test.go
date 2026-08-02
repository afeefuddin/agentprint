package store

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/agentprint/agentprint/cli/internal/adapters"
)

func TestQueueDeduplicatesAndAcknowledges(t *testing.T) {
	local, err := Open(filepath.Join(t.TempDir(), "queue.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer local.Close()
	record := adapters.UsageRecord{
		EventID: "stable-event", SchemaVersion: 1,
		OccurredAt: "2026-07-29T09:30:00Z", LocalDate: "2026-07-29",
		HarnessID: "synthetic", InputTokens: 10, OutputTokens: 5, TotalTokens: 15,
		SourceFingerprint: "source",
	}
	inserted, err := local.Queue(context.Background(), "synthetic", []adapters.UsageRecord{record, record}, "one")
	if err != nil {
		t.Fatal(err)
	}
	if inserted != 1 {
		t.Fatalf("expected one inserted record, got %d", inserted)
	}
	pending, err := local.Pending(context.Background(), 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(pending) != 1 {
		t.Fatalf("expected one pending record")
	}
	if err := local.Acknowledge(context.Background(), "batch", []int64{pending[0].ID}, "{}"); err != nil {
		t.Fatal(err)
	}
	count, _ := local.PendingCount()
	if count != 0 {
		t.Fatalf("expected empty queue, got %d", count)
	}
}
