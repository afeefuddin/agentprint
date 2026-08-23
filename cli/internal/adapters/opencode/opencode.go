package opencode

import (
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
	return &Adapter{Root: filepath.Join(home, ".local", "share", "opencode", "storage", "message"), Location: location}
}
func (adapter *Adapter) ID() string { return "opencode" }
func (adapter *Adapter) Capabilities() adapters.CapabilitySet {
	return adapters.CapabilitySet{Tokens: true, Model: true}
}
func (adapter *Adapter) Detect(context.Context) adapters.DetectionResult {
	info, err := os.Stat(adapter.Root)
	return adapters.DetectionResult{Detected: err == nil && info.IsDir(), Path: adapter.Root, Detail: "OpenCode message metadata"}
}
func (adapter *Adapter) Validate(ctx context.Context) adapters.HealthResult {
	found := adapter.Detect(ctx)
	return adapters.HealthResult{Healthy: found.Detected, Detail: found.Detail}
}

type message struct {
	ID         string `json:"id"`
	Role       string `json:"role"`
	ProviderID string `json:"providerID"`
	ModelID    string `json:"modelID"`
	Time       struct {
		Created   int64 `json:"created"`
		Completed int64 `json:"completed"`
	} `json:"time"`
	Tokens struct {
		Input     int64 `json:"input"`
		Output    int64 `json:"output"`
		Reasoning int64 `json:"reasoning"`
		Cache     struct {
			Read  int64 `json:"read"`
			Write int64 `json:"write"`
		} `json:"cache"`
	} `json:"tokens"`
}

func (adapter *Adapter) Collect(ctx context.Context, cursor string) ([]adapters.UsageRecord, string, error) {
	var records []adapters.UsageRecord
	maxModified, _ := strconv.ParseInt(cursor, 10, 64)
	nextCursor := maxModified
	err := filepath.WalkDir(adapter.Root, func(path string, entry os.DirEntry, err error) error {
		if err != nil || entry.IsDir() || !strings.HasSuffix(path, ".json") {
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
		body, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		var item message
		if json.Unmarshal(body, &item) != nil || item.Role != "assistant" || item.ID == "" {
			return nil
		}
		created := item.Time.Created
		if created == 0 {
			created = info.ModTime().UnixMilli()
		}
		timestamp := time.UnixMilli(created)
		cached := item.Tokens.Cache.Read + item.Tokens.Cache.Write
		reasoning := item.Tokens.Reasoning
		total := item.Tokens.Input + item.Tokens.Output + reasoning + cached
		if total == 0 {
			return nil
		}
		records = append(records, adapters.UsageRecord{
			EventID: adapters.StableID("opencode", item.ID), SchemaVersion: 1,
			OccurredAt: timestamp.UTC().Format(time.RFC3339Nano), LocalDate: adapters.LocalDate(timestamp, adapter.Location),
			HarnessID: "opencode", ProviderID: item.ProviderID, ModelID: item.ModelID,
			InputTokens: item.Tokens.Input, OutputTokens: item.Tokens.Output,
			CachedInputTokens: &cached, ReasoningTokens: &reasoning, TotalTokens: total,
			SourceFingerprint: adapters.Fingerprint(adapter.Root, "opencode"),
		})
		return nil
	})
	return records, strconv.FormatInt(nextCursor, 10), err
}
