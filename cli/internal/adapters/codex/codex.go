package codex

import (
	"bufio"
	"context"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/agentprint/agentprint/cli/internal/adapters"
)

const maxMetadataLineBytes = 2 * 1024 * 1024
const cursorVersion = "model-v1:"

type Adapter struct {
	Root     string
	Location *time.Location
}

func New(home string, location *time.Location) *Adapter {
	return &Adapter{Root: filepath.Join(home, ".codex", "sessions"), Location: location}
}

func (adapter *Adapter) ID() string { return "codex" }
func (adapter *Adapter) Capabilities() adapters.CapabilitySet {
	return adapters.CapabilitySet{Tokens: true, Model: true}
}
func (adapter *Adapter) Detect(context.Context) adapters.DetectionResult {
	info, err := os.Stat(adapter.Root)
	return adapters.DetectionResult{
		Detected: err == nil && info.IsDir(),
		Path:     adapter.Root,
		Detail:   "Codex session metadata",
	}
}
func (adapter *Adapter) Validate(context.Context) adapters.HealthResult {
	detection := adapter.Detect(context.Background())
	return adapters.HealthResult{Healthy: detection.Detected, Detail: detection.Detail}
}

type envelope struct {
	Timestamp string `json:"timestamp"`
	Type      string `json:"type"`
	Payload   struct {
		Type  string `json:"type"`
		Model string `json:"model"`
		Info  *struct {
			Last *struct {
				Input     int64 `json:"input_tokens"`
				Cached    int64 `json:"cached_input_tokens"`
				Output    int64 `json:"output_tokens"`
				Reasoning int64 `json:"reasoning_output_tokens"`
				Total     int64 `json:"total_tokens"`
			} `json:"last_token_usage"`
		} `json:"info"`
	} `json:"payload"`
}

func (adapter *Adapter) Collect(ctx context.Context, cursor string) ([]adapters.UsageRecord, string, error) {
	var records []adapters.UsageRecord
	maxModified := int64(0)
	if strings.HasPrefix(cursor, cursorVersion) {
		maxModified, _ = strconv.ParseInt(strings.TrimPrefix(cursor, cursorVersion), 10, 64)
	}
	nextCursor := maxModified
	err := filepath.WalkDir(adapter.Root, func(path string, entry os.DirEntry, err error) error {
		if err != nil || entry.IsDir() || !strings.HasSuffix(path, ".jsonl") {
			return err
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		modified := info.ModTime().UnixNano()
		if modified <= maxModified {
			return nil
		}
		if modified > nextCursor {
			nextCursor = modified
		}
		file, err := os.Open(path)
		if err != nil {
			return err
		}
		defer file.Close()
		reader := bufio.NewReader(file)
		line := 0
		model := ""
		for {
			body, oversized, readErr := readMetadataLine(reader)
			if readErr != nil && readErr != io.EOF {
				return readErr
			}
			if len(body) == 0 && !oversized && readErr == io.EOF {
				break
			}
			line++
			if !oversized {
				var item envelope
				if json.Unmarshal(body, &item) == nil && item.Type == "turn_context" {
					model = item.Payload.Model
				}
				if record, ok := adapter.usageRecord(path, line, body, model); ok {
					records = append(records, record)
				}
			}
			if readErr == io.EOF {
				break
			}
		}
		return nil
	})
	return records, cursorVersion + strconv.FormatInt(nextCursor, 10), err
}

func (adapter *Adapter) usageRecord(path string, line int, body []byte, model string) (adapters.UsageRecord, bool) {
	var item envelope
	if json.Unmarshal(body, &item) != nil || item.Payload.Type != "token_count" || item.Payload.Info == nil || item.Payload.Info.Last == nil {
		return adapters.UsageRecord{}, false
	}
	timestamp, err := time.Parse(time.RFC3339Nano, item.Timestamp)
	if err != nil {
		return adapters.UsageRecord{}, false
	}
	usage := item.Payload.Info.Last
	cached, reasoning := usage.Cached, usage.Reasoning
	return adapters.UsageRecord{
		EventID: adapters.StableID(path, strconv.Itoa(line), item.Timestamp), SchemaVersion: 1,
		OccurredAt: timestamp.UTC().Format(time.RFC3339Nano),
		LocalDate:  adapters.LocalDate(timestamp, adapter.Location),
		HarnessID:  "codex", ProviderID: "openai", ModelID: model,
		InputTokens: usage.Input, OutputTokens: usage.Output,
		CachedInputTokens: &cached, ReasoningTokens: &reasoning,
		TotalTokens:       usage.Total,
		SourceFingerprint: adapters.Fingerprint(adapter.Root, "codex"),
	}, true
}

func readMetadataLine(reader *bufio.Reader) ([]byte, bool, error) {
	var body []byte
	oversized := false
	for {
		fragment, err := reader.ReadSlice('\n')
		if !oversized {
			if len(body)+len(fragment) > maxMetadataLineBytes+1 {
				body = nil
				oversized = true
			} else {
				body = append(body, fragment...)
			}
		}
		if err != bufio.ErrBufferFull {
			return body, oversized, err
		}
	}
}
