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
		{"url password without username", "redis://:shortsecret@cache.example.com/0", "shortsecret"},
		{"url password containing at", "postgresql://owner:p@ssword@db.example.com/app", "p@ssword"},
		{"authorization", "Authorization: Bearer abcdef123456ghijkl", "abcdef123456ghijkl"},
		{"custom authorization", "Authorization: ApiKey keep-this-secret", "keep-this-secret"},
		{"assignment", `DATABASE_PASSWORD="hunter2hunter2"`, "hunter2hunter2"},
		{"short assignment", `password="cat"`, "cat"},
		{"nested json", `{"database":{"password":"two words"}}`, "two words"},
		{"sensitive header", "X-Api-Key: short-value", "short-value"},
		{"cookie header", "Cookie: session=private", "session=private"},
		{"command argument", "deploy --password short-value", "short-value"},
		{"gitlab", "token glpat-abcdefghijklmnopqrst", "glpat-abcdefghijklmnopqrst"},
		{"onepassword", "token ops_eyJabcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJ", "ops_eyJ"},
		{"age", "AGE-SECRET-KEY-1QQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ", "AGE-SECRET-KEY-1"},
		{"pgp private key", "-----BEGIN PGP PRIVATE KEY BLOCK-----\nMIIabc\n-----END PGP PRIVATE KEY BLOCK-----", "MIIabc"},
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

func TestStringRemovesUpstreamDeveloperTokenCorpus(t *testing.T) {
	cases := []struct {
		name  string
		value string
	}{
		{"databricks", "dapi" + strings.Repeat("a1", 16)},
		{"twilio", "SK" + strings.Repeat("a1", 16)},
		{"stripe test", "sk_test_abcdefghijklmnop1234"},
		{"slack app", "xapp-1-ABCDEFGHIJ-1234567890-abcdefghijklmnop"},
		{"slack webhook", "https://hooks.slack.com/services/" + strings.Repeat("A", 43)},
		{"digitalocean", "dop_v1_" + strings.Repeat("a1", 32)},
		{"sentry", "sntryu_" + strings.Repeat("a1", 32)},
		{"rubygems", "rubygems_" + strings.Repeat("a1", 24)},
		{"pypi", "pypi-AgEIcHlwaS5vcmc" + strings.Repeat("a", 49) + "-"},
		{"huggingface", "hf_" + strings.Repeat("a", 34)},
		{"pulumi", "pul-" + strings.Repeat("a1", 20)},
		{"postman", "PMAK-" + strings.Repeat("a1", 12) + "-" + strings.Repeat("b2", 17)},
		{"linear", "lin_api_" + strings.Repeat("a1", 20)},
		{"grafana", "glc_" + strings.Repeat("a", 32)},
		{"square", "sq0csp-" + strings.Repeat("a", 42) + "-"},
		{"terraform", strings.Repeat("a1", 7) + ".atlasv1." + strings.Repeat("b", 59) + "="},
		{"onepassword secret key", "A3-ABCDEF-ABCDEFGHIJK-ABCDE-ABCDE-ABCDE"},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			redactor := New(DefaultOptions(LevelBalanced, "", ""))
			result := redactor.String(testCase.value)
			if strings.Contains(result, testCase.value) || !strings.Contains(result, "[redacted:") {
				t.Fatalf("credential survived redaction: %q", result)
			}
			if found := credentialsIn(testCase.value); len(found) == 0 {
				t.Fatal("server-equivalent audit did not recognize the credential")
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
		"session_timeout=30",
		"cookie_domain=.example.com",
		"authentication_mode=oauth",
		"oidc_token_endpoint=https://example.com/oauth/token",
		"public_token=example-value",
		"client_secret_name=production-secret",
		"credentials_id=credential-record-123",
	}
	for _, input := range cases {
		redactor := New(DefaultOptions(LevelBalanced, "", ""))
		if result := redactor.String(input); result != input {
			t.Errorf("ordinary content was altered:\n  in:  %s\n  out: %s", input, result)
		}
	}
}

func TestLongOrdinaryStringDoesNotTriggerAssignmentBacktracking(t *testing.T) {
	for _, input := range []string{strings.Repeat("A", 120_000), strings.Repeat("a=", 60_000)} {
		redactor := New(DefaultOptions(LevelBalanced, "", ""))
		if result := redactor.String(input); result != input {
			t.Fatal("long ordinary content was altered")
		}
	}
}

func TestSensitiveAssignmentAliases(t *testing.T) {
	for _, input := range []string{"creds=shortsecret", "otp=123456", "two_factor=123456"} {
		redactor := New(DefaultOptions(LevelBalanced, "", ""))
		if result := redactor.String(input); !strings.Contains(result, "[redacted:assignment]") {
			t.Errorf("sensitive assignment survived: %q", result)
		}
	}
}

func TestCommandAssignmentCountsOneCredentialOnce(t *testing.T) {
	redactor := New(DefaultOptions(LevelBalanced, "", ""))
	result := redactor.String("deploy --password=short-value")
	if strings.Contains(result, "short-value") {
		t.Fatalf("credential survived redaction: %q", result)
	}
	if redactor.Stats().SecretsRemoved != 1 {
		t.Fatalf("expected one removal, got %d", redactor.Stats().SecretsRemoved)
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
	redacted := adapters.Transcript{Turns: []adapters.Turn{{Blocks: []adapters.Block{
		{Kind: adapters.BlockToolResult, Output: "Cookie: [redacted:header]\nPASSWORD=[redacted:assignment]"},
	}}}}
	if found := Audit(redacted); len(found) != 0 {
		t.Fatalf("visible redaction markers must not be reported as live credentials: %v", found)
	}
	mixed := adapters.Transcript{Turns: []adapters.Turn{{Blocks: []adapters.Block{
		{Kind: adapters.BlockToolResult, Output: "Cookie: [redacted:header]\nPASSWORD=still-live"},
	}}}}
	if found := Audit(mixed); !strings.Contains(strings.Join(found, " "), "assigned-secret") {
		t.Fatalf("a marker must not hide another credential in the same field: %v", found)
	}
}

func TestTranscriptRedactsEveryUploadedStringField(t *testing.T) {
	secret := "glpat-abcdefghijklmnopqrst"
	source := adapters.Transcript{
		HarnessID:      "codex",
		HarnessVersion: secret,
		Title:          secret,
		Summary:        secret,
		ModelIDs:       []string{secret},
		Turns: []adapters.Turn{{
			Index: 0, Role: "assistant", ModelID: secret,
			Blocks: []adapters.Block{{
				Kind: adapters.BlockToolUse, ID: secret, Name: secret, Input: secret,
			}, {
				Kind: adapters.BlockToolResult, ToolUseID: secret,
				OK: adapters.Truthy(true), Output: secret,
			}},
		}},
	}

	result := New(DefaultOptions(LevelBalanced, "", "")).Transcript(source)
	encoded := strings.Join([]string{
		result.HarnessVersion, result.Title, result.Summary,
		strings.Join(result.ModelIDs, " "), result.Turns[0].ModelID,
		result.Turns[0].Blocks[0].ID, result.Turns[0].Blocks[0].Name,
		result.Turns[0].Blocks[0].Input, result.Turns[0].Blocks[1].ToolUseID,
		result.Turns[0].Blocks[1].Output,
	}, " ")
	if strings.Contains(encoded, secret) {
		t.Fatalf("an uploaded string field was not redacted: %s", encoded)
	}
	if found := Audit(result); len(found) != 0 {
		t.Fatalf("redacted transcript still has findings: %v", found)
	}
}

func TestAuditScansMetadataAndGenericCredentialShapes(t *testing.T) {
	transcript := adapters.Transcript{
		Title:    "Cookie: session=private",
		ModelIDs: []string{"glpat-abcdefghijklmnopqrst"},
	}
	found := strings.Join(Audit(transcript), " ")
	for _, expected := range []string{"sensitive-header", "gitlab-token"} {
		if !strings.Contains(found, expected) {
			t.Errorf("expected %s finding, got %q", expected, found)
		}
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
