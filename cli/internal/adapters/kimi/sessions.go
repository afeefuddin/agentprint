package kimi

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/agentprint/agentprint/cli/internal/adapters"
)

/*
Kimi Code keeps a wire log per agent at
~/.kimi-code/sessions/<workdir>/<session>/agents/<agent>/wire.jsonl. The main
agent's log is the session a user would recognise; sub-agent logs belong to
work the session delegated and are not published.

Turns are reconstructed from turn.prompt (the user's message) and the
content.part / tool.call / tool.result loop events the agent emits in reply,
grouped by the step they belong to.
*/

const mainAgentLog = "agents/main/wire.jsonl"

type wireEnvelope struct {
	Type  string          `json:"type"`
	Time  int64           `json:"time"`
	Model string          `json:"model"`
	Input []wireContent   `json:"input"`
	Event json.RawMessage `json:"event"`
	Usage *struct {
		InputOther         int64 `json:"inputOther"`
		Output             int64 `json:"output"`
		InputCacheRead     int64 `json:"inputCacheRead"`
		InputCacheCreation int64 `json:"inputCacheCreation"`
	} `json:"usage"`
	UsageScope string `json:"usageScope"`
	Origin     struct {
		Kind string `json:"kind"`
	} `json:"origin"`
}

type wireContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type loopEvent struct {
	Type       string          `json:"type"`
	StepUUID   string          `json:"stepUuid"`
	ToolCallID string          `json:"toolCallId"`
	Name       string          `json:"name"`
	Args       json.RawMessage `json:"args"`
	Part       *struct {
		Type  string `json:"type"`
		Text  string `json:"text"`
		Think string `json:"think"`
	} `json:"part"`
	Result *struct {
		Output string `json:"output"`
		Error  string `json:"error"`
	} `json:"result"`
}

// sessionLogs maps a session key to its main-agent wire log.
func (adapter *Adapter) sessionLogs() (map[string]string, error) {
	logs := map[string]string{}
	err := filepath.WalkDir(adapter.Root, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			if entry != nil && entry.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		if entry.IsDir() || filepath.Base(path) != "wire.jsonl" {
			return nil
		}
		relative, relErr := filepath.Rel(adapter.Root, path)
		if relErr != nil {
			return nil
		}
		relative = filepath.ToSlash(relative)
		if !strings.HasSuffix(relative, mainAgentLog) {
			return nil
		}
		logs[strings.TrimSuffix(relative, "/"+mainAgentLog)] = path
		return nil
	})
	return logs, err
}

func (adapter *Adapter) ListSessions(ctx context.Context, since time.Time) ([]adapters.SessionSummary, error) {
	logs, err := adapter.sessionLogs()
	if err != nil {
		return nil, err
	}
	var summaries []adapters.SessionSummary
	for key, path := range logs {
		if ctx.Err() != nil {
			return summaries, ctx.Err()
		}
		info, err := os.Stat(path)
		if err != nil || (!since.IsZero() && info.ModTime().Before(since)) {
			continue
		}
		transcript, err := adapter.readLog(ctx, key, path)
		if err != nil || len(transcript.Turns) == 0 {
			continue
		}
		started, _ := time.Parse(time.RFC3339, transcript.StartedAt)
		ended, _ := time.Parse(time.RFC3339, transcript.EndedAt)
		summaries = append(summaries, adapters.SessionSummary{
			HarnessID: adapter.ID(), Key: key, Title: transcript.Title,
			StartedAt: started, EndedAt: ended, Turns: len(transcript.Turns),
			Tokens:  transcript.Totals.TotalTokens,
			Project: projectFrom(key),
		})
	}
	sort.Slice(summaries, func(first, second int) bool {
		return summaries[first].EndedAt.After(summaries[second].EndedAt)
	})
	return summaries, nil
}

func (adapter *Adapter) ReadSession(ctx context.Context, key string) (adapters.Transcript, error) {
	logs, err := adapter.sessionLogs()
	if err != nil {
		return adapters.Transcript{}, err
	}
	path, found := logs[key]
	if !found {
		// Accept the bare session segment as well as the full workdir/session key.
		for candidate, candidatePath := range logs {
			if strings.HasSuffix(candidate, "/"+key) {
				path, found = candidatePath, true
				break
			}
		}
	}
	if !found {
		return adapters.Transcript{}, errors.New("no Kimi Code session with that id")
	}
	return adapter.readLog(ctx, key, path)
}

func (adapter *Adapter) readLog(ctx context.Context, key, path string) (adapters.Transcript, error) {
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
	currentStep := ""

	// appendAssistant adds a block to the open assistant turn, starting a new
	// one whenever the agent moves to a new step.
	appendAssistant := func(step string, timestamp string, block adapters.Block) {
		last := len(transcript.Turns) - 1
		if step == "" || step != currentStep || last < 0 || transcript.Turns[last].Role != "assistant" {
			transcript.Turns = append(transcript.Turns, adapters.Turn{
				Index: len(transcript.Turns), Role: "assistant", At: timestamp,
			})
			currentStep = step
			last = len(transcript.Turns) - 1
		}
		transcript.Turns[last].Blocks = append(transcript.Turns[last].Blocks, block)
	}

	reader := bufio.NewReader(file)
	for {
		if ctx.Err() != nil {
			return transcript, ctx.Err()
		}
		body, oversized, readErr := readMetadataLine(reader)
		if readErr != nil && readErr != io.EOF {
			return adapters.Transcript{}, readErr
		}
		if len(body) == 0 && !oversized && readErr == io.EOF {
			break
		}
		if oversized {
			if readErr == io.EOF {
				break
			}
			continue
		}
		var envelope wireEnvelope
		if json.Unmarshal(body, &envelope) != nil {
			if readErr == io.EOF {
				break
			}
			continue
		}
		timestamp := ""
		if envelope.Time > 0 {
			when := time.UnixMilli(envelope.Time)
			if startedAt.IsZero() {
				startedAt = when
			}
			endedAt = when
			timestamp = when.UTC().Format(time.RFC3339)
		}

		switch envelope.Type {
		case "turn.prompt":
			if envelope.Origin.Kind != "user" {
				break
			}
			var blocks []adapters.Block
			for _, part := range envelope.Input {
				if part.Type != "text" || strings.TrimSpace(part.Text) == "" {
					if part.Type == "image" {
						blocks = append(blocks, adapters.Block{Kind: adapters.BlockOmitted, Reason: "image"})
					}
					continue
				}
				blocks = append(blocks, adapters.Block{Kind: adapters.BlockText, Text: part.Text})
				if firstPrompt == "" {
					firstPrompt = part.Text
				}
			}
			if len(blocks) > 0 {
				transcript.Turns = append(transcript.Turns, adapters.Turn{
					Index: len(transcript.Turns), Role: "user", At: timestamp, Blocks: blocks,
				})
				currentStep = ""
			}
		case "context.append_loop_event":
			var event loopEvent
			if len(envelope.Event) == 0 || json.Unmarshal(envelope.Event, &event) != nil {
				break
			}
			switch event.Type {
			case "content.part":
				if event.Part == nil {
					break
				}
				if event.Part.Type == "think" && strings.TrimSpace(event.Part.Think) != "" {
					appendAssistant(event.StepUUID, timestamp, adapters.Block{
						Kind: adapters.BlockThinking, Text: event.Part.Think,
					})
				}
				if event.Part.Type == "text" && strings.TrimSpace(event.Part.Text) != "" {
					appendAssistant(event.StepUUID, timestamp, adapters.Block{
						Kind: adapters.BlockText, Text: event.Part.Text,
					})
				}
			case "tool.call":
				appendAssistant(event.StepUUID, timestamp, adapters.Block{
					Kind: adapters.BlockToolUse, ID: event.ToolCallID,
					Name: event.Name, Input: prettyJSON(event.Args),
				})
			case "tool.result":
				if event.Result == nil {
					break
				}
				output := event.Result.Output
				if output == "" {
					output = event.Result.Error
				}
				appendAssistant(currentStep, timestamp, adapters.Block{
					Kind: adapters.BlockToolResult, ToolUseID: event.ToolCallID,
					OK: adapters.Truthy(event.Result.Error == ""), Output: output,
				})
			}
		case "usage.record":
			if envelope.Usage == nil || !strings.EqualFold(envelope.UsageScope, "turn") {
				break
			}
			if envelope.Model != "" {
				models[envelope.Model] = true
			}
			transcript.Totals.InputTokens += envelope.Usage.InputOther
			transcript.Totals.OutputTokens += envelope.Usage.Output
			cached += envelope.Usage.InputCacheRead + envelope.Usage.InputCacheCreation
		}
		if readErr == io.EOF {
			break
		}
	}

	transcript.Turns = dropEmptyTurns(transcript.Turns)
	if len(transcript.Turns) == 0 {
		return transcript, nil
	}
	transcript.Title = titleFrom(firstPrompt, key)
	transcript.ModelIDs = sortedKeys(models)
	if cached > 0 {
		transcript.Totals.CachedInputTokens = &cached
	}
	transcript.Totals.TotalTokens = transcript.Totals.InputTokens + transcript.Totals.OutputTokens + cached
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

func dropEmptyTurns(turns []adapters.Turn) []adapters.Turn {
	var result []adapters.Turn
	for _, turn := range turns {
		if len(turn.Blocks) == 0 {
			continue
		}
		turn.Index = len(result)
		result = append(result, turn)
	}
	return result
}

// projectFrom recovers a readable project name from the workdir segment Kimi
// uses for its session directories, for example wd_portfolio_2dc9ca -> portfolio.
func projectFrom(key string) string {
	segment := strings.SplitN(key, "/", 2)[0]
	segment = strings.TrimPrefix(segment, "wd_")
	if index := strings.LastIndex(segment, "_"); index > 0 {
		segment = segment[:index]
	}
	return segment
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
