package redact

import (
	"strings"
	"testing"

	"github.com/agentprint/agentprint/cli/internal/adapters"
)

func TestStringRemovesCredentialShapes(t *testing.T) {
	cases := []struct {
		name  string
		input string
		leak  string
	}{
		{"anthropic", "export KEY=sk-ant-api03-AbCdEfGhIjKlMnOpQrSt", "sk-ant-api03"},
		{"github", "token ghp_abcdefghijklmnopqrstuvwxyz0123456789", "ghp_abcdef"},
		{"aws", "id AKIAIOSFODNN7EXAMPLE here", "AKIAIOSFODNN7EXAMPLE"},
		{"slack", "xoxb-1234567890-abcdefghijkl", "xoxb-1234567890"},
		{"stripe", "sk_live_abcdefghijklmnop1234", "sk_live_abcdef"},
		{"jwt", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r", "eyJhbGciOiJ"},
		{"url password", "postgresql://owner:sup3rs3cret@db.example.com/app", "sup3rs3cret"},
		{"authorization", "Authorization: Bearer abcdef123456ghijkl", "abcdef123456ghijkl"},
		{"assignment", `DATABASE_PASSWORD="hunter2hunter2"`, "hunter2hunter2"},
		{"private key", "-----BEGIN RSA PRIVATE KEY-----\nMIIabc\n-----END RSA PRIVATE KEY-----", "MIIabc"},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			redactor := New(DefaultOptions(LevelBalanced, "", ""))
			result := redactor.String(testCase.input)
			if strings.Contains(result, testCase.leak) {
				t.Fatalf("credential survived redaction: %q", result)
			}
			if !strings.Contains(result, "[redacted:") {
				t.Fatalf("expected a redaction marker, got %q", result)
			}
			if redactor.Stats().SecretsRemoved == 0 {
				t.Fatal("expected the removal to be counted")
			}
		})
	}
}

// A redactor that mangles ordinary content is its own failure: the user
// publishes a transcript that no longer says what they said.
func TestStringLeavesOrdinaryContentAlone(t *testing.T) {
	cases := []string{
		"rollout-2026-05-02T21-03-20-019de952-a215-7de3-a1ba-d24342a7bc29.jsonl",
		"9b9faeb2-c934-43b9-bfd5-fa42691a971e",
		"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
		"The quick brown fox jumped over the lazy dog and then kept running.",
		"https://github.com/agentprint/agentprint/blob/main/packages/contracts/src/index.ts",
		"import { calculateStreaks, intensityFor, intensityThresholds } from \"@agentprint/analytics\";",
	}
	for _, input := range cases {
		redactor := New(DefaultOptions(LevelBalanced, "", ""))
		if result := redactor.String(input); result != input {
			t.Errorf("ordinary content was altered:\n  in:  %s\n  out: %s", input, result)
		}
	}
}

func TestPathsAreRewritten(t *testing.T) {
	redactor := New(DefaultOptions(LevelBalanced, "/Users/dana", "/Users/dana/work/api"))
	result := redactor.String("edited /Users/dana/work/api/src/main.go and /Users/dana/.zshrc")
	if strings.Contains(result, "/Users/dana") {
		t.Fatalf("home directory survived: %q", result)
	}
	if !strings.Contains(result, "<project>/src/main.go") || !strings.Contains(result, "~/.zshrc") {
		t.Fatalf("unexpected rewrite: %q", result)
	}
	if redactor.Stats().PathsRewritten != 2 {
		t.Fatalf("expected 2 rewrites, got %d", redactor.Stats().PathsRewritten)
	}
}

func sampleTranscript() adapters.Transcript {
	return adapters.Transcript{
		HarnessID: "claude-code",
		Title:     "Fix the failing test",
		Turns: []adapters.Turn{
			{Index: 0, Role: "user", Blocks: []adapters.Block{
				{Kind: adapters.BlockText, Text: "the suite is red"},
			}},
			{Index: 1, Role: "assistant", Blocks: []adapters.Block{
				{Kind: adapters.BlockThinking, Text: "I should read the failure first."},
				{Kind: adapters.BlockToolUse, Name: "Bash", Input: `{"command":"npm test"}`},
			}},
			{Index: 2, Role: "user", Blocks: []adapters.Block{
				{Kind: adapters.BlockToolResult, OK: adapters.Truthy(false), Output: "1 failing"},
			}},
			{Index: 3, Role: "assistant", Blocks: []adapters.Block{
				{Kind: adapters.BlockText, Text: "One assertion is inverted."},
			}},
		},
	}
}

func TestStrictDropsThinkingAndToolResults(t *testing.T) {
	redactor := New(DefaultOptions(LevelStrict, "", ""))
	result := redactor.Transcript(sampleTranscript())
	for _, turn := range result.Turns {
		for _, block := range turn.Blocks {
			switch block.Kind {
			case adapters.BlockThinking:
				t.Error("strict should not publish thinking")
			case adapters.BlockToolResult:
				t.Error("strict should not publish tool results")
			case adapters.BlockToolUse:
				if block.Input != "" {
					t.Error("strict should not publish tool arguments")
				}
			}
		}
	}
}

func TestBalancedKeepsThinkingAndResults(t *testing.T) {
	redactor := New(DefaultOptions(LevelBalanced, "", ""))
	result := redactor.Transcript(sampleTranscript())
	var thinking, results int
	for _, turn := range result.Turns {
		for _, block := range turn.Blocks {
			if block.Kind == adapters.BlockThinking {
				thinking++
			}
			if block.Kind == adapters.BlockToolResult {
				results++
			}
		}
	}
	if thinking != 1 || results != 1 {
		t.Fatalf("expected thinking and results to survive, got %d and %d", thinking, results)
	}
}

func TestExcludedTurnsAreDroppedAndReindexed(t *testing.T) {
	options := DefaultOptions(LevelBalanced, "", "")
	options.Exclude = map[int]bool{1: true}
	redactor := New(options)
	result := redactor.Transcript(sampleTranscript())
	if len(result.Turns) != 3 {
		t.Fatalf("expected 3 turns after exclusion, got %d", len(result.Turns))
	}
	for position, turn := range result.Turns {
		if turn.Index != position {
			t.Fatalf("turn indexes must stay contiguous: %d at position %d", turn.Index, position)
		}
	}
	if redactor.Stats().TurnsExcluded != 1 {
		t.Fatalf("expected 1 exclusion, got %d", redactor.Stats().TurnsExcluded)
	}
}

func TestOversizeBlocksAreTruncated(t *testing.T) {
	options := DefaultOptions(LevelBalanced, "", "")
	options.MaxBlockRunes = 20
	redactor := New(options)
	result := redactor.Transcript(adapters.Transcript{
		Turns: []adapters.Turn{{Index: 0, Role: "user", Blocks: []adapters.Block{
			{Kind: adapters.BlockText, Text: strings.Repeat("long line\n", 40)},
		}}},
	})
	block := result.Turns[0].Blocks[0]
	if !block.Truncated || !strings.Contains(block.Text, "lines hidden") {
		t.Fatalf("expected a truncation notice, got %q", block.Text)
	}
	if redactor.Stats().BlocksTruncated != 1 {
		t.Fatal("expected the truncation to be counted")
	}
}

func TestAuditCatchesSurvivingCredentials(t *testing.T) {
	clean := adapters.Transcript{Turns: []adapters.Turn{{Blocks: []adapters.Block{
		{Kind: adapters.BlockText, Text: "nothing sensitive here"},
	}}}}
	if found := Audit(clean); len(found) != 0 {
		t.Fatalf("expected no findings, got %v", found)
	}
	leaky := adapters.Transcript{Turns: []adapters.Turn{{Blocks: []adapters.Block{
		{Kind: adapters.BlockToolResult, Output: "AKIAIOSFODNN7EXAMPLE"},
	}}}}
	if found := Audit(leaky); len(found) == 0 {
		t.Fatal("expected the audit to catch an AWS key")
	}
}

// The redactor must never mutate the caller's transcript: the CLI still shows
// the original when a publish is abandoned.
func TestTranscriptDoesNotMutateSource(t *testing.T) {
	source := sampleTranscript()
	original := source.Turns[0].Blocks[0].Text
	options := DefaultOptions(LevelStrict, "", "")
	New(options).Transcript(source)
	if source.Turns[0].Blocks[0].Text != original || len(source.Turns) != 4 {
		t.Fatal("the source transcript was modified")
	}
}
