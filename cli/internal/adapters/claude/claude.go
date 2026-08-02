package claude

import (
	"bufio"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/agentprint/agentprint/cli/internal/adapters"
)

type Adapter struct {
	Root     string
	Location *time.Location
}

func New(home string, location *time.Location) *Adapter {
	return &Adapter{Root: filepath.Join(home, ".claude", "projects"), Location: location}
}
func (adapter *Adapter) ID() string { return "claude-code" }
func (adapter *Adapter) Capabilities() adapters.CapabilitySet {
	return adapters.CapabilitySet{Tokens: true, Model: true}
}
func (adapter *Adapter) Detect(context.Context) adapters.DetectionResult {
	info, err := os.Stat(adapter.Root)
	return adapters.DetectionResult{Detected: err == nil && info.IsDir(), Path: adapter.Root, Detail: "Claude Code project metadata"}
}
func (adapter *Adapter) Validate(ctx context.Context) adapters.HealthResult {
	found := adapter.Detect(ctx)
	return adapters.HealthResult{Healthy: found.Detected, Detail: found.Detail}
}

type envelope struct {
	UUID      string `json:"uuid"`
	Timestamp string `json:"timestamp"`
	Message   struct {
		Model string `json:"model"`
		Usage *struct {
			Input         int64 `json:"input_tokens"`
			Output        int64 `json:"output_tokens"`
			CacheCreation int64 `json:"cache_creation_input_tokens"`
			CacheRead     int64 `json:"cache_read_input_tokens"`
		} `json:"usage"`
	} `json:"message"`
}

func (adapter *Adapter) Collect(ctx context.Context, cursor string) ([]adapters.UsageRecord, string, error) {
	var records []adapters.UsageRecord
	maxModified, _ := strconv.ParseInt(cursor, 10, 64)
	nextCursor := maxModified
	err := filepath.WalkDir(adapter.Root, func(path string, entry os.DirEntry, err error) error {
		if err != nil || entry.IsDir() || !strings.HasSuffix(path, ".jsonl") {
			return err
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
		scanner := bufio.NewScanner(file)
		scanner.Buffer(make([]byte, 64*1024), 4*1024*1024)
		line := 0
		for scanner.Scan() {
			line++
			var item envelope
			if json.Unmarshal(scanner.Bytes(), &item) != nil || item.Message.Usage == nil {
				continue
			}
			timestamp, err := time.Parse(time.RFC3339Nano, item.Timestamp)
			if err != nil {
				continue
			}
			usage := item.Message.Usage
			cached := usage.CacheCreation + usage.CacheRead
			total := usage.Input + usage.Output + cached
			identity := item.UUID
			if identity == "" {
				identity = adapters.StableID(path, strconv.Itoa(line), item.Timestamp)
			}
			records = append(records, adapters.UsageRecord{
				EventID: adapters.StableID("claude-code", identity), SchemaVersion: 1,
				OccurredAt: timestamp.UTC().Format(time.RFC3339Nano), LocalDate: adapters.LocalDate(timestamp, adapter.Location),
				HarnessID: "claude-code", ProviderID: "anthropic", ModelID: item.Message.Model,
				InputTokens: usage.Input, OutputTokens: usage.Output, CachedInputTokens: &cached, TotalTokens: total,
				SourceFingerprint: adapters.Fingerprint(adapter.Root, "claude-code"),
			})
		}
		return scanner.Err()
	})
	return records, strconv.FormatInt(nextCursor, 10), err
}
