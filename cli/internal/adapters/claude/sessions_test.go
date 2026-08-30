package claude

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"
)

const sessionFixture = `{"type":"mode","mode":"normal","sessionId":"abc"}
{"type":"user","uuid":"1","timestamp":"2026-08-01T10:00:00.000Z","version":"2.1.0","cwd":"/Users/dana/work/api","message":{"role":"user","content":[{"type":"text","text":"why is the build failing"}]}}
{"type":"assistant","uuid":"2","timestamp":"2026-08-01T10:00:05.000Z","message":{"role":"assistant","model":"claude-opus-5","usage":{"input_tokens":120,"output_tokens":40,"cache_read_input_tokens":10},"content":[{"type":"thinking","thinking":"Check the CI log."},{"type":"tool_use","id":"t1","name":"Bash","input":{"command":"npm run build"}}]}}
{"type":"user","uuid":"3","timestamp":"2026-08-01T10:00:09.000Z","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"t1","is_error":true,"content":"error TS2345"}]}}
{"type":"assistant","uuid":"4","timestamp":"2026-08-01T10:00:12.000Z","isSidechain":true,"message":{"role":"assistant","content":[{"type":"text","text":"sub-agent chatter"}]}}
{"type":"assistant","uuid":"5","timestamp":"2026-08-01T10:00:15.000Z","message":{"role":"assistant","model":"claude-opus-5","content":[{"type":"text","text":"A type argument is wrong."}]}}
{"type":"ai-title","aiTitle":"Fix the failing build","sessionId":"abc"}
`

func fixtureAdapter(t *testing.T) *Adapter {
	t.Helper()
	home := t.TempDir()
	directory := filepath.Join(home, ".claude", "projects", "-Users-dana-work-api")
	if err := os.MkdirAll(directory, 0o755); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(directory, "11111111-2222-3333-4444-555555555555.jsonl")
	if err := os.WriteFile(path, []byte(sessionFixture), 0o644); err != nil {
		t.Fatal(err)
	}
	return New(home, time.UTC)
}

func TestListSessionsSummarisesWithoutContent(t *testing.T) {
	sessions, err := fixtureAdapter(t).ListSessions(context.Background(), time.Time{})
	if err != nil {
		t.Fatal(err)
	}
	if len(sessions) != 1 {
		t.Fatalf("expected 1 session, got %d", len(sessions))
	}
	session := sessions[0]
	if session.Title != "Fix the failing build" {
		t.Errorf("expected the harness title, got %q", session.Title)
	}
	if session.Project != "api" {
		t.Errorf("expected the project name, got %q", session.Project)
	}
	if session.WorkingDirectory != "/Users/dana/work/api" {
		t.Errorf("expected local project context, got %q", session.WorkingDirectory)
	}
	if session.Tokens != 170 {
		t.Errorf("expected 170 tokens, got %d", session.Tokens)
	}
}

func TestReadSessionBuildsTranscript(t *testing.T) {
	transcript, err := fixtureAdapter(t).ReadSession(
		context.Background(), "11111111-2222-3333-4444-555555555555")
	if err != nil {
		t.Fatal(err)
	}
	if transcript.Title != "Fix the failing build" {
		t.Errorf("unexpected title %q", transcript.Title)
	}
	if transcript.HarnessVersion != "2.1.0" {
		t.Errorf("unexpected version %q", transcript.HarnessVersion)
	}
	if transcript.WorkingDirectory != "/Users/dana/work/api" {
		t.Errorf("the working directory is needed for path redaction, got %q", transcript.WorkingDirectory)
	}
	// The sidechain turn belongs to a sub-agent and must not be published.
	if len(transcript.Turns) != 4 {
		t.Fatalf("expected 4 turns, got %d", len(transcript.Turns))
	}
	for position, turn := range transcript.Turns {
		if turn.Index != position {
			t.Fatalf("turn indexes must be contiguous, got %d at %d", turn.Index, position)
		}
	}
	kinds := map[string]int{}
	for _, turn := range transcript.Turns {
		for _, block := range turn.Blocks {
			kinds[block.Kind]++
		}
	}
	if kinds["thinking"] != 1 || kinds["tool_use"] != 1 || kinds["tool_result"] != 1 || kinds["text"] != 2 {
		t.Fatalf("unexpected block mix: %v", kinds)
	}
	if transcript.Totals.TotalTokens != 170 {
		t.Errorf("expected 170 total tokens, got %d", transcript.Totals.TotalTokens)
	}
	if len(transcript.ModelIDs) != 1 || transcript.ModelIDs[0] != "claude-opus-5" {
		t.Errorf("unexpected models %v", transcript.ModelIDs)
	}
}

func TestReadSessionRejectsUnknownKey(t *testing.T) {
	if _, err := fixtureAdapter(t).ReadSession(context.Background(), "nope"); err == nil {
		t.Fatal("expected an error for an unknown session id")
	}
}
