package kimi

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func writeWire(t *testing.T, root string, lines ...string) string {
	t.Helper()
	directory := filepath.Join(root, "wd_projects_abc123", "session_1", "agents", "main")
	if err := os.MkdirAll(directory, 0o700); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(directory, "wire.jsonl")
	if err := os.WriteFile(path, []byte(strings.Join(lines, "\n")+"\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestMapsKimiTurnUsage(t *testing.T) {
	root := t.TempDir()
	writeWire(t, root,
		`{"type":"turn.prompt","time":1785842706000,"text":"ignored prompt content"}`,
		`{"type":"usage.record","model":"kimi-code/k3","usage":{"inputOther":7099,"output":187,"inputCacheRead":18944,"inputCacheCreation":256},"usageScope":"turn","time":1785842706627}`,
	)
	adapter := &Adapter{Root: root, Location: time.UTC}
	records, cursor, err := adapter.Collect(context.Background(), "")
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 1 {
		t.Fatalf("expected 1 record, got %d", len(records))
	}
	record := records[0]
	if record.HarnessID != "kimi-code" || record.ProviderID != "moonshot" || record.ModelID != "kimi-code/k3" {
		t.Fatalf("unexpected attribution: %+v", record)
	}
	if record.InputTokens != 7099 || record.OutputTokens != 187 {
		t.Fatalf("unexpected token split: %+v", record)
	}
	if record.CachedInputTokens == nil || *record.CachedInputTokens != 19200 {
		t.Fatalf("expected cache read + creation to be summed: %+v", record.CachedInputTokens)
	}
	if record.TotalTokens != 26486 {
		t.Fatalf("expected total 26486, got %d", record.TotalTokens)
	}
	if record.OccurredAt != "2026-08-04T11:25:06.627Z" {
		t.Fatalf("unexpected timestamp: %s", record.OccurredAt)
	}
	if record.LocalDate != "2026-08-04" {
		t.Fatalf("unexpected local date: %s", record.LocalDate)
	}
	if cursor == "" || cursor == "0" {
		t.Fatalf("expected a modification cursor, got %q", cursor)
	}
}

func TestSkipsSessionScopedTotals(t *testing.T) {
	root := t.TempDir()
	writeWire(t, root,
		`{"type":"usage.record","model":"kimi-code/k3","usage":{"inputOther":100,"output":10,"inputCacheRead":0,"inputCacheCreation":0},"usageScope":"turn","time":1785842706627}`,
		`{"type":"usage.record","model":"kimi-code/k3","usage":{"inputOther":9000,"output":900,"inputCacheRead":0,"inputCacheCreation":0},"usageScope":"session","time":1785842706900}`,
	)
	adapter := &Adapter{Root: root, Location: time.UTC}
	records, _, err := adapter.Collect(context.Background(), "")
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 1 || records[0].TotalTokens != 110 {
		t.Fatalf("cumulative session totals must be skipped, got %+v", records)
	}
}

func TestSkipsNonUsageAndEmptyRecords(t *testing.T) {
	root := t.TempDir()
	writeWire(t, root,
		`{"type":"llm.request","time":1785842706000}`,
		`{"type":"usage.record","model":"kimi-code/k3","usage":{"inputOther":0,"output":0,"inputCacheRead":0,"inputCacheCreation":0},"usageScope":"turn","time":1785842706627}`,
		`{"type":"usage.record","model":"kimi-code/k3","usageScope":"turn","time":1785842706700}`,
		`not json at all`,
		`{"type":"usage.record","model":"kimi-code/k3","usage":{"inputOther":5,"output":5,"inputCacheRead":0,"inputCacheCreation":0},"usageScope":"turn","time":0}`,
	)
	adapter := &Adapter{Root: root, Location: time.UTC}
	records, _, err := adapter.Collect(context.Background(), "")
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 0 {
		t.Fatalf("expected no records, got %+v", records)
	}
}

func TestSkipsOversizedLineWithoutDroppingLaterRecords(t *testing.T) {
	root := t.TempDir()
	writeWire(t, root,
		`{"type":"context.append_message","text":"`+strings.Repeat("x", maxMetadataLineBytes+64)+`"}`,
		`{"type":"usage.record","model":"kimi-code/k3","usage":{"inputOther":40,"output":2,"inputCacheRead":0,"inputCacheCreation":0},"usageScope":"turn","time":1785842706627}`,
	)
	adapter := &Adapter{Root: root, Location: time.UTC}
	records, _, err := adapter.Collect(context.Background(), "")
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 1 || records[0].TotalTokens != 42 {
		t.Fatalf("records after an oversized line must survive, got %+v", records)
	}
}

func TestEventIDsAreStableAcrossRuns(t *testing.T) {
	root := t.TempDir()
	writeWire(t, root,
		`{"type":"usage.record","model":"kimi-code/k3","usage":{"inputOther":1,"output":1,"inputCacheRead":0,"inputCacheCreation":0},"usageScope":"turn","time":1785842706627}`,
		`{"type":"usage.record","model":"kimi-code/k3","usage":{"inputOther":2,"output":1,"inputCacheRead":0,"inputCacheCreation":0},"usageScope":"turn","time":1785842706900}`,
	)
	adapter := &Adapter{Root: root, Location: time.UTC}
	first, _, err := adapter.Collect(context.Background(), "")
	if err != nil {
		t.Fatal(err)
	}
	second, _, err := adapter.Collect(context.Background(), "")
	if err != nil {
		t.Fatal(err)
	}
	if len(first) != 2 || len(second) != 2 {
		t.Fatalf("expected 2 records per pass, got %d and %d", len(first), len(second))
	}
	if first[0].EventID == first[1].EventID {
		t.Fatal("distinct turns must not collide")
	}
	for index := range first {
		if first[index].EventID != second[index].EventID {
			t.Fatal("event ids must be stable so a re-read cannot inflate totals")
		}
	}
}

func TestEventIDsSurviveALineShift(t *testing.T) {
	original := t.TempDir()
	writeWire(t, original,
		`{"type":"usage.record","model":"kimi-code/k3","usage":{"inputOther":12,"output":3,"inputCacheRead":4,"inputCacheCreation":5},"usageScope":"turn","time":1785842706627}`,
	)
	rewritten := t.TempDir()
	writeWire(t, rewritten,
		`{"type":"metadata","protocol_version":"1.4"}`,
		`{"type":"turn.prompt","time":1785842706000}`,
		`{"type":"usage.record","model":"kimi-code/k3","usage":{"inputOther":12,"output":3,"inputCacheRead":4,"inputCacheCreation":5},"usageScope":"turn","time":1785842706627}`,
	)
	before, _, err := (&Adapter{Root: original, Location: time.UTC}).Collect(context.Background(), "")
	if err != nil {
		t.Fatal(err)
	}
	after, _, err := (&Adapter{Root: rewritten, Location: time.UTC}).Collect(context.Background(), "")
	if err != nil {
		t.Fatal(err)
	}
	if len(before) != 1 || len(after) != 1 {
		t.Fatalf("expected 1 record each, got %d and %d", len(before), len(after))
	}
	if before[0].EventID != after[0].EventID {
		t.Fatal("a moved root or a shifted line must not re-mint the event id")
	}
}

func TestReadsFinalLineWithoutTrailingNewline(t *testing.T) {
	root := t.TempDir()
	directory := filepath.Join(root, "wd_a", "session_1", "agents", "main")
	if err := os.MkdirAll(directory, 0o700); err != nil {
		t.Fatal(err)
	}
	body := `{"type":"usage.record","model":"kimi-code/k3","usage":{"inputOther":9,"output":1,"inputCacheRead":0,"inputCacheCreation":0},"usageScope":"turn","time":1785842706627}`
	if err := os.WriteFile(filepath.Join(directory, "wire.jsonl"), []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
	records, _, err := (&Adapter{Root: root, Location: time.UTC}).Collect(context.Background(), "")
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 1 || records[0].TotalTokens != 10 {
		t.Fatalf("an unterminated final line must still be read, got %+v", records)
	}
}

func TestIgnoresEmptyLogsAndOtherFiles(t *testing.T) {
	root := t.TempDir()
	directory := filepath.Join(root, "wd_a", "session_1", "agents", "main")
	if err := os.MkdirAll(directory, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(directory, "wire.jsonl"), nil, 0o600); err != nil {
		t.Fatal(err)
	}
	logs := filepath.Join(root, "wd_a", "session_1", "logs")
	if err := os.MkdirAll(logs, 0o700); err != nil {
		t.Fatal(err)
	}
	decoy := `{"type":"usage.record","model":"kimi-code/k3","usage":{"inputOther":500,"output":500,"inputCacheRead":0,"inputCacheCreation":0},"usageScope":"turn","time":1785842706627}`
	if err := os.WriteFile(filepath.Join(logs, "kimi-code.log"), []byte(decoy), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "wd_a", "session_1", "state.json"), []byte(`{"title":"x"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	records, _, err := (&Adapter{Root: root, Location: time.UTC}).Collect(context.Background(), "")
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 0 {
		t.Fatalf("only wire.jsonl should be read, got %+v", records)
	}
}

func TestCollectStopsOnCancelledContext(t *testing.T) {
	root := t.TempDir()
	writeWire(t, root,
		`{"type":"usage.record","model":"kimi-code/k3","usage":{"inputOther":9,"output":1,"inputCacheRead":0,"inputCacheCreation":0},"usageScope":"turn","time":1785842706627}`,
	)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, _, err := (&Adapter{Root: root, Location: time.UTC}).Collect(ctx, ""); err == nil {
		t.Fatal("expected a cancelled context to stop the walk")
	}
}

func TestMissingRootIsNotAnError(t *testing.T) {
	adapter := &Adapter{Root: filepath.Join(t.TempDir(), "absent"), Location: time.UTC}
	records, cursor, err := adapter.Collect(context.Background(), "")
	if err == nil {
		t.Log("walk returned no error for a missing root")
	}
	if len(records) != 0 || cursor != "0" {
		t.Fatalf("expected an empty result for a missing root, got %d records and cursor %q", len(records), cursor)
	}
}

func TestCursorSkipsUnchangedFiles(t *testing.T) {
	root := t.TempDir()
	writeWire(t, root,
		`{"type":"usage.record","model":"kimi-code/k3","usage":{"inputOther":10,"output":1,"inputCacheRead":0,"inputCacheCreation":0},"usageScope":"turn","time":1785842706627}`,
	)
	adapter := &Adapter{Root: root, Location: time.UTC}
	_, cursor, err := adapter.Collect(context.Background(), "")
	if err != nil {
		t.Fatal(err)
	}
	records, _, err := adapter.Collect(context.Background(), cursor)
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 0 {
		t.Fatalf("expected the cursor to skip unchanged files, got %d records", len(records))
	}
}

func TestDetectAndLocalDateUseConfiguredZone(t *testing.T) {
	root := t.TempDir()
	adapter := &Adapter{Root: filepath.Join(root, "missing"), Location: time.UTC}
	if adapter.Detect(context.Background()).Detected {
		t.Fatal("expected no detection for a missing root")
	}
	if adapter.ID() != "kimi-code" {
		t.Fatalf("unexpected id %s", adapter.ID())
	}
	capabilities := adapter.Capabilities()
	if !capabilities.Tokens || !capabilities.Model {
		t.Fatalf("unexpected capabilities: %+v", capabilities)
	}

	zone := time.FixedZone("UTC-12", -12*60*60)
	writeWire(t, root,
		`{"type":"usage.record","model":"kimi-code/k3","usage":{"inputOther":10,"output":1,"inputCacheRead":0,"inputCacheCreation":0},"usageScope":"turn","time":1785842706627}`,
	)
	local := &Adapter{Root: root, Location: zone}
	records, _, err := local.Collect(context.Background(), "")
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 1 || records[0].LocalDate != "2026-08-03" {
		t.Fatalf("expected the local calendar date to follow the configured zone, got %+v", records)
	}
}
