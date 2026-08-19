package codex

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/agentprint/agentprint/cli/internal/adapters"
)

/*
Codex writes one rollout JSONL per session under
~/.codex/sessions/YYYY/MM/DD/rollout-<timestamp>-<uuid>.jsonl. Each line is an
envelope whose payload is either a session_meta header, a response_item
(message, function_call, function_call_output, reasoning) or an event_msg
(token accounting). The transcript is built from response_item records.
*/

type sessionEnvelope struct {
	Timestamp string          `json:"timestamp"`
	Type      string          `json:"type"`
	Payload   json.RawMessage `json:"payload"`
}

type sessionPayload struct {
	Type string `json:"type"`

	// session_meta
	ID         string `json:"id"`
	CWD        string `json:"cwd"`
	CLIVersion string `json:"cli_version"`

	// response_item / message
	Role    string          `json:"role"`
	Content json.RawMessage `json:"content"`

	// response_item / function_call and custom_tool_call
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
	Input     string `json:"input"`
	CallID    string `json:"call_id"`

	// response_item / function_call_output and custom_tool_call_output
	Output json.RawMessage `json:"output"`

	// response_item / reasoning
	Summary []struct {
		Text string `json:"text"`
	} `json:"summary"`

	// event_msg / token_count
	Info *struct {
		TotalTokenUsage struct {
			InputTokens     int64 `json:"input_tokens"`
			CachedInput     int64 `json:"cached_input_tokens"`
			OutputTokens    int64 `json:"output_tokens"`
			ReasoningOutput int64 `json:"reasoning_output_tokens"`
			TotalTokens     int64 `json:"total_tokens"`
		} `json:"total_token_usage"`
	} `json:"info"`

	// turn_context
	Model string `json:"model"`
}

type contentPart struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

func (adapter *Adapter) rolloutFiles() ([]string, error) {
	var files []string
	err := filepath.WalkDir(adapter.Root, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			if entry != nil && entry.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		if !entry.IsDir() && strings.HasSuffix(path, ".jsonl") {
			files = append(files, path)
		}
		return nil
	})
	return files, err
}

func sessionKey(path string, metaID string) string {
	if metaID != "" {
		return metaID
	}
	base := strings.TrimSuffix(filepath.Base(path), ".jsonl")
	if index := strings.LastIndex(base, "-"); index >= 0 && len(base)-index > 30 {
		return base[index+1:]
	}
	return base
}

func (adapter *Adapter) ListSessions(ctx context.Context, since time.Time) ([]adapters.SessionSummary, error) {
	files, err := adapter.rolloutFiles()
	if err != nil {
		return nil, err
	}
	var summaries []adapters.SessionSummary
	for _, path := range files {
		if ctx.Err() != nil {
			return summaries, ctx.Err()
		}
		info, err := os.Stat(path)
		if err != nil || (!since.IsZero() && info.ModTime().Before(since)) {
			continue
		}
		transcript, err := adapter.readFile(ctx, path)
		if err != nil || len(transcript.Turns) == 0 {
			continue
		}
		started, _ := time.Parse(time.RFC3339, transcript.StartedAt)
		ended, _ := time.Parse(time.RFC3339, transcript.EndedAt)
		summaries = append(summaries, adapters.SessionSummary{
			HarnessID: adapter.ID(),
			Key:       transcript.Key,
			Title:     transcript.Title,
			StartedAt: started,
			EndedAt:   ended,
			Turns:     len(transcript.Turns),
			Tokens:    transcript.Totals.TotalTokens,
			Project:   filepath.Base(transcript.WorkingDirectory),
		})
	}
	sort.Slice(summaries, func(first, second int) bool {
		return summaries[first].EndedAt.After(summaries[second].EndedAt)
	})
	return summaries, nil
}

func (adapter *Adapter) ReadSession(ctx context.Context, key string) (adapters.Transcript, error) {
	files, err := adapter.rolloutFiles()
	if err != nil {
		return adapters.Transcript{}, err
	}
	for _, path := range files {
		if strings.Contains(filepath.Base(path), key) {
			return adapter.readFile(ctx, path)
		}
	}
	// The key may be a session_meta id that does not appear in the filename.
	for _, path := range files {
		transcript, err := adapter.readFile(ctx, path)
		if err == nil && transcript.Key == key {
			return transcript, nil
		}
	}
	return adapters.Transcript{}, errors.New("no Codex session with that id")
}

func (adapter *Adapter) readFile(ctx context.Context, path string) (adapters.Transcript, error) {
	file, err := os.Open(path)
	if err != nil {
		return adapters.Transcript{}, err
	}
	defer file.Close()

	transcript := adapters.Transcript{HarnessID: adapter.ID()}
	models := map[string]bool{}
	var metaID, firstPrompt string
	var startedAt, endedAt time.Time

	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 64*1024), 16*1024*1024)
	for scanner.Scan() {
		if ctx.Err() != nil {
			return transcript, ctx.Err()
		}
		var envelope sessionEnvelope
		if json.Unmarshal(scanner.Bytes(), &envelope) != nil || len(envelope.Payload) == 0 {
			continue
		}
		var payload sessionPayload
		if json.Unmarshal(envelope.Payload, &payload) != nil {
			continue
		}
		when, timeErr := time.Parse(time.RFC3339Nano, envelope.Timestamp)

		switch envelope.Type {
		case "session_meta":
			metaID = payload.ID
			transcript.WorkingDirectory = payload.CWD
			transcript.HarnessVersion = payload.CLIVersion
			continue
		case "turn_context":
			if payload.Model != "" {
				models[payload.Model] = true
			}
			continue
		case "event_msg":
			// The final token_count carries the authoritative session total.
			if payload.Type == "token_count" && payload.Info != nil {
				usage := payload.Info.TotalTokenUsage
				transcript.Totals.InputTokens = usage.InputTokens
				transcript.Totals.OutputTokens = usage.OutputTokens
				transcript.Totals.TotalTokens = usage.TotalTokens
				if usage.CachedInput > 0 {
					cached := usage.CachedInput
					transcript.Totals.CachedInputTokens = &cached
				}
				if usage.ReasoningOutput > 0 {
					reasoning := usage.ReasoningOutput
					transcript.Totals.ReasoningTokens = &reasoning
				}
			}
			continue
		case "response_item":
		default:
			continue
		}

		role, blocks := responseBlocks(payload)
		if len(blocks) == 0 {
			continue
		}
		if timeErr == nil {
			if startedAt.IsZero() {
				startedAt = when
			}
			endedAt = when
		}
		if role == "user" && firstPrompt == "" {
			for _, block := range blocks {
				if block.Kind == adapters.BlockText {
					firstPrompt = block.Text
					break
				}
			}
		}
		timestamp := ""
		if timeErr == nil {
			timestamp = when.UTC().Format(time.RFC3339)
		}
		transcript.Turns = append(transcript.Turns, adapters.Turn{
			Index: len(transcript.Turns), Role: role, At: timestamp, Blocks: blocks,
		})
	}
	if err := scanner.Err(); err != nil {
		return adapters.Transcript{}, err
	}
	transcript.Key = sessionKey(path, metaID)
	if len(transcript.Turns) == 0 {
		return transcript, nil
	}
	transcript.Title = titleFrom(firstPrompt, transcript.Key)
	transcript.ModelIDs = sortedKeys(models)
	if startedAt.IsZero() {
		startedAt = time.Now().UTC()
	}
	if endedAt.IsZero() || endedAt.Before(startedAt) {
		endedAt = startedAt
	}
	transcript.StartedAt = startedAt.UTC().Format(time.RFC3339)
	transcript.EndedAt = endedAt.UTC().Format(time.RFC3339)
	if transcript.Totals.TotalTokens == 0 {
		transcript.Totals.TotalTokens = transcript.Totals.InputTokens + transcript.Totals.OutputTokens
	}
	return transcript, nil
}

func responseBlocks(payload sessionPayload) (string, []adapters.Block) {
	switch payload.Type {
	case "message":
		// Codex replays its own system prompt and environment header as
		// messages. They are harness scaffolding, not the user's conversation.
		if payload.Role == "developer" || payload.Role == "system" {
			return "", nil
		}
		var parts []contentPart
		if json.Unmarshal(payload.Content, &parts) != nil {
			return "", nil
		}
		var blocks []adapters.Block
		for _, part := range parts {
			if part.Type == "input_image" || part.Type == "output_image" {
				blocks = append(blocks, adapters.Block{Kind: adapters.BlockOmitted, Reason: "image"})
				continue
			}
			text := part.Text
			if strings.TrimSpace(text) == "" || isScaffolding(text) {
				continue
			}
			blocks = append(blocks, adapters.Block{Kind: adapters.BlockText, Text: text})
		}
		role := payload.Role
		if role != "user" && role != "assistant" {
			role = "system"
		}
		return role, blocks
	case "function_call", "custom_tool_call":
		arguments := payload.Arguments
		if arguments == "" {
			arguments = payload.Input
		}
		return "assistant", []adapters.Block{{
			Kind: adapters.BlockToolUse, ID: payload.CallID,
			Name: payload.Name, Input: prettyArguments(arguments),
		}}
	case "function_call_output", "custom_tool_call_output":
		return "user", []adapters.Block{{
			Kind: adapters.BlockToolResult, ToolUseID: payload.CallID,
			OK: adapters.Truthy(true), Output: flattenOutput(payload.Output),
		}}
	case "reasoning":
		// Codex encrypts reasoning content; only the plaintext summary, when
		// present, can be published.
		var parts []string
		for _, item := range payload.Summary {
			if strings.TrimSpace(item.Text) != "" {
				parts = append(parts, item.Text)
			}
		}
		if len(parts) == 0 {
			return "", nil
		}
		return "assistant", []adapters.Block{{
			Kind: adapters.BlockThinking, Text: strings.Join(parts, "\n\n"),
		}}
	}
	return "", nil
}

// isScaffolding drops the instruction and environment blobs Codex injects as
// user messages. They are identical on every session, are not the user's words,
// and otherwise become the session title.
//
// Codex wraps each of them in a lowercase snake-case tag
// (<environment_context>, <recommended_plugins>, <user_instructions>, …), which
// prose effectively never starts with, so the tag shape is the reliable test
// rather than an ever-growing list of names.
var scaffoldTag = regexp.MustCompile(`^<[a-z][a-z0-9_]*( [a-z ]+)?>`)

func isScaffolding(text string) bool {
	trimmed := strings.TrimSpace(text)
	if scaffoldTag.MatchString(trimmed) {
		return true
	}
	for _, marker := range []string{"<INSTRUCTIONS>", "# AGENTS.md instructions"} {
		if strings.HasPrefix(trimmed, marker) {
			return true
		}
	}
	return false
}

func prettyArguments(raw string) string {
	if raw == "" {
		return ""
	}
	var value any
	if json.Unmarshal([]byte(raw), &value) != nil {
		return raw
	}
	encoded, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return raw
	}
	return string(encoded)
}

func flattenOutput(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	var plain string
	if json.Unmarshal(raw, &plain) == nil {
		return plain
	}
	var structured struct {
		Output string `json:"output"`
	}
	if json.Unmarshal(raw, &structured) == nil && structured.Output != "" {
		return structured.Output
	}
	return string(raw)
}

func titleFrom(prompt, fallback string) string {
	prompt = strings.TrimSpace(strings.ReplaceAll(prompt, "\n", " "))
	if prompt == "" {
		return "Session " + fallback[:min(8, len(fallback))]
	}
	runes := []rune(prompt)
	if len(runes) > 90 {
		return strings.TrimSpace(string(runes[:90])) + "…"
	}
	return prompt
}

func sortedKeys(values map[string]bool) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}
