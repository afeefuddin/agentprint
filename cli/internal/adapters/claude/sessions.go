package claude

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/agentprint/agentprint/cli/internal/adapters"
)

/*
Claude Code stores one JSONL file per session under
~/.claude/projects/<encoded-cwd>/<session-uuid>.jsonl. Alongside the message
records it writes bookkeeping records (mode, permission-mode, file-history,
ai-title, last-prompt); only the message-bearing ones are read here.
*/

type sessionEnvelope struct {
	Type        string          `json:"type"`
	UUID        string          `json:"uuid"`
	SessionID   string          `json:"sessionId"`
	Timestamp   string          `json:"timestamp"`
	Version     string          `json:"version"`
	CWD         string          `json:"cwd"`
	AITitle     string          `json:"aiTitle"`
	IsSidechain bool            `json:"isSidechain"`
	Message     json.RawMessage `json:"message"`
}

type sessionMessage struct {
	Role    string          `json:"role"`
	Model   string          `json:"model"`
	Content json.RawMessage `json:"content"`
	Usage   *struct {
		Input         int64 `json:"input_tokens"`
		Output        int64 `json:"output_tokens"`
		CacheCreation int64 `json:"cache_creation_input_tokens"`
		CacheRead     int64 `json:"cache_read_input_tokens"`
	} `json:"usage"`
}

type contentBlock struct {
	Type      string          `json:"type"`
	Text      string          `json:"text"`
	Thinking  string          `json:"thinking"`
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Input     json.RawMessage `json:"input"`
	ToolUseID string          `json:"tool_use_id"`
	IsError   bool            `json:"is_error"`
	Content   json.RawMessage `json:"content"`
}

func (adapter *Adapter) sessionFiles() ([]string, error) {
	var files []string
	err := filepath.WalkDir(adapter.Root, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			// A single unreadable project directory should not hide the rest.
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

func (adapter *Adapter) ListSessions(ctx context.Context, since time.Time) ([]adapters.SessionSummary, error) {
	files, err := adapter.sessionFiles()
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
		summary, err := adapter.summarize(path)
		if err != nil || summary.Turns == 0 {
			continue
		}
		summaries = append(summaries, summary)
	}
	sort.Slice(summaries, func(first, second int) bool {
		return summaries[first].EndedAt.After(summaries[second].EndedAt)
	})
	return summaries, nil
}

// summarize reads a session for its listing entry only. It intentionally keeps
// no message text, so `agentprint sessions` never holds transcript content.
func (adapter *Adapter) summarize(path string) (adapters.SessionSummary, error) {
	file, err := os.Open(path)
	if err != nil {
		return adapters.SessionSummary{}, err
	}
	defer file.Close()

	summary := adapters.SessionSummary{
		HarnessID: adapter.ID(),
		Key:       strings.TrimSuffix(filepath.Base(path), ".jsonl"),
	}
	var firstPrompt string
	scanner := newScanner(file)
	for scanner.Scan() {
		var envelope sessionEnvelope
		if json.Unmarshal(scanner.Bytes(), &envelope) != nil {
			continue
		}
		if envelope.AITitle != "" && summary.Title == "" {
			summary.Title = envelope.AITitle
		}
		if envelope.CWD != "" && summary.Project == "" {
			summary.Project = filepath.Base(envelope.CWD)
		}
		if envelope.Type != "user" && envelope.Type != "assistant" {
			continue
		}
		if envelope.IsSidechain {
			continue
		}
		var message sessionMessage
		if len(envelope.Message) == 0 || json.Unmarshal(envelope.Message, &message) != nil {
			continue
		}
		when, err := time.Parse(time.RFC3339Nano, envelope.Timestamp)
		if err == nil {
			if summary.StartedAt.IsZero() {
				summary.StartedAt = when
			}
			summary.EndedAt = when
		}
		if message.Usage != nil {
			summary.Tokens += message.Usage.Input + message.Usage.Output +
				message.Usage.CacheCreation + message.Usage.CacheRead
		}
		if envelope.Type == "user" && firstPrompt == "" {
			firstPrompt = firstText(message.Content)
		}
		summary.Turns++
	}
	if err := scanner.Err(); err != nil {
		return adapters.SessionSummary{}, err
	}
	if summary.Title == "" {
		summary.Title = titleFrom(firstPrompt, summary.Key)
	}
	return summary, nil
}

func (adapter *Adapter) ReadSession(ctx context.Context, key string) (adapters.Transcript, error) {
	files, err := adapter.sessionFiles()
	if err != nil {
		return adapters.Transcript{}, err
	}
	path := ""
	for _, candidate := range files {
		if strings.TrimSuffix(filepath.Base(candidate), ".jsonl") == key {
			path = candidate
			break
		}
	}
	if path == "" {
		return adapters.Transcript{}, errors.New("no Claude Code session with that id")
	}
	file, err := os.Open(path)
	if err != nil {
		return adapters.Transcript{}, err
	}
	defer file.Close()

	transcript := adapters.Transcript{HarnessID: adapter.ID(), Key: key}
	models := map[string]bool{}
	var cached int64
	var firstPrompt string
	var startedAt, endedAt time.Time

	scanner := newScanner(file)
	for scanner.Scan() {
		if ctx.Err() != nil {
			return transcript, ctx.Err()
		}
		var envelope sessionEnvelope
		if json.Unmarshal(scanner.Bytes(), &envelope) != nil {
			continue
		}
		if envelope.Version != "" && transcript.HarnessVersion == "" {
			transcript.HarnessVersion = envelope.Version
		}
		if envelope.CWD != "" && transcript.WorkingDirectory == "" {
			transcript.WorkingDirectory = envelope.CWD
		}
		if envelope.AITitle != "" && transcript.Title == "" {
			transcript.Title = envelope.AITitle
		}
		if envelope.Type != "user" && envelope.Type != "assistant" {
			continue
		}
		// Sub-agent transcripts belong to the agent, not the session the user
		// chose to publish, and routinely contain unrelated work.
		if envelope.IsSidechain {
			continue
		}
		var message sessionMessage
		if len(envelope.Message) == 0 || json.Unmarshal(envelope.Message, &message) != nil {
			continue
		}
		blocks := decodeBlocks(message.Content)
		if len(blocks) == 0 {
			continue
		}
		when, err := time.Parse(time.RFC3339Nano, envelope.Timestamp)
		if err == nil {
			if startedAt.IsZero() {
				startedAt = when
			}
			endedAt = when
		}
		if message.Model != "" {
			models[message.Model] = true
		}
		if message.Usage != nil {
			transcript.Totals.InputTokens += message.Usage.Input
			transcript.Totals.OutputTokens += message.Usage.Output
			cached += message.Usage.CacheCreation + message.Usage.CacheRead
		}
		role := envelope.Type
		if message.Role != "" {
			role = message.Role
		}
		if role != "user" && role != "assistant" {
			role = "system"
		}
		if role == "user" && firstPrompt == "" {
			firstPrompt = firstText(message.Content)
		}
		timestamp := ""
		if err == nil {
			timestamp = when.UTC().Format(time.RFC3339)
		}
		transcript.Turns = append(transcript.Turns, adapters.Turn{
			Index:   len(transcript.Turns),
			Role:    role,
			At:      timestamp,
			ModelID: message.Model,
			Blocks:  blocks,
		})
	}
	if err := scanner.Err(); err != nil {
		return adapters.Transcript{}, err
	}
	if len(transcript.Turns) == 0 {
		return adapters.Transcript{}, errors.New("that session has no shareable messages")
	}
	if transcript.Title == "" {
		transcript.Title = titleFrom(firstPrompt, key)
	}
	if cached > 0 {
		transcript.Totals.CachedInputTokens = &cached
	}
	transcript.Totals.TotalTokens = transcript.Totals.InputTokens + transcript.Totals.OutputTokens + cached
	transcript.ModelIDs = sortedKeys(models)
	if startedAt.IsZero() {
		startedAt = time.Now().UTC()
	}
	if endedAt.IsZero() || endedAt.Before(startedAt) {
		endedAt = startedAt
	}
	transcript.StartedAt = startedAt.UTC().Format(time.RFC3339)
	transcript.EndedAt = endedAt.UTC().Format(time.RFC3339)
	return transcript, nil
}

func decodeBlocks(raw json.RawMessage) []adapters.Block {
	if len(raw) == 0 {
		return nil
	}
	// A user turn may carry a bare string instead of a content array.
	var plain string
	if json.Unmarshal(raw, &plain) == nil {
		if strings.TrimSpace(plain) == "" {
			return nil
		}
		return []adapters.Block{{Kind: adapters.BlockText, Text: plain}}
	}
	var items []contentBlock
	if json.Unmarshal(raw, &items) != nil {
		return nil
	}
	var blocks []adapters.Block
	for _, item := range items {
		switch item.Type {
		case "text":
			if strings.TrimSpace(item.Text) == "" {
				continue
			}
			blocks = append(blocks, adapters.Block{Kind: adapters.BlockText, Text: item.Text})
		case "thinking":
			if strings.TrimSpace(item.Thinking) == "" {
				continue
			}
			blocks = append(blocks, adapters.Block{Kind: adapters.BlockThinking, Text: item.Thinking})
		case "tool_use":
			blocks = append(blocks, adapters.Block{
				Kind: adapters.BlockToolUse, ID: item.ID, Name: item.Name,
				Input: prettyJSON(item.Input),
			})
		case "tool_result":
			blocks = append(blocks, adapters.Block{
				Kind: adapters.BlockToolResult, ToolUseID: item.ToolUseID,
				OK: adapters.Truthy(!item.IsError), Output: flattenResult(item.Content),
			})
		case "image":
			// Screenshots are the highest-risk, lowest-value payload in a
			// transcript, so v1 records their absence rather than shipping them.
			blocks = append(blocks, adapters.Block{Kind: adapters.BlockOmitted, Reason: "image"})
		default:
			blocks = append(blocks, adapters.Block{Kind: adapters.BlockOmitted, Reason: "attachment"})
		}
	}
	return blocks
}

// flattenResult renders a tool result, which may be a string, an array of
// content blocks, or an object, into the plain text a reader would see.
func flattenResult(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	var plain string
	if json.Unmarshal(raw, &plain) == nil {
		return plain
	}
	var items []contentBlock
	if json.Unmarshal(raw, &items) == nil {
		var parts []string
		for _, item := range items {
			if item.Type == "image" {
				parts = append(parts, "[image omitted]")
				continue
			}
			if item.Text != "" {
				parts = append(parts, item.Text)
			}
		}
		return strings.Join(parts, "\n")
	}
	return prettyJSON(raw)
}

func prettyJSON(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	var value any
	if json.Unmarshal(raw, &value) != nil {
		return string(raw)
	}
	encoded, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return string(raw)
	}
	return string(encoded)
}

func firstText(raw json.RawMessage) string {
	for _, block := range decodeBlocks(raw) {
		if block.Kind == adapters.BlockText {
			return block.Text
		}
	}
	return ""
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

func newScanner(file *os.File) *bufio.Scanner {
	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 64*1024), 16*1024*1024)
	return scanner
}
