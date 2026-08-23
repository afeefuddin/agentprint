package kimi

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

type Adapter struct {
	Root     string
	Location *time.Location
}

func New(home string, location *time.Location) *Adapter {
	return &Adapter{Root: filepath.Join(home, ".kimi-code", "sessions"), Location: location}
}

func (adapter *Adapter) ID() string { return "kimi-code" }
func (adapter *Adapter) Capabilities() adapters.CapabilitySet {
	return adapters.CapabilitySet{Tokens: true, Model: true}
}
func (adapter *Adapter) Detect(context.Context) adapters.DetectionResult {
	info, err := os.Stat(adapter.Root)
	return adapters.DetectionResult{
		Detected: err == nil && info.IsDir(),
		Path:     adapter.Root,
		Detail:   "Kimi Code session metadata",
	}
}
func (adapter *Adapter) Validate(ctx context.Context) adapters.HealthResult {
	detection := adapter.Detect(ctx)
	return adapters.HealthResult{Healthy: detection.Detected, Detail: detection.Detail}
}

// envelope covers the usage.record events Kimi Code appends to each agent's
// wire log. Session-scoped records restate the running total for the whole
// session, so only turn-scoped records are counted.
type envelope struct {
	Type       string `json:"type"`
	Model      string `json:"model"`
	UsageScope string `json:"usageScope"`
	Time       int64  `json:"time"`
	Usage      *struct {
		InputOther         int64 `json:"inputOther"`
		Output             int64 `json:"output"`
		InputCacheRead     int64 `json:"inputCacheRead"`
		InputCacheCreation int64 `json:"inputCacheCreation"`
	} `json:"usage"`
}

func (adapter *Adapter) Collect(ctx context.Context, cursor string) ([]adapters.UsageRecord, string, error) {
	var records []adapters.UsageRecord
	maxModified, _ := strconv.ParseInt(cursor, 10, 64)
	nextCursor := maxModified
	err := filepath.WalkDir(adapter.Root, func(path string, entry os.DirEntry, err error) error {
		if err != nil || entry.IsDir() || filepath.Base(path) != "wire.jsonl" {
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
		// Identify the session by its path relative to the root so moving
		// ~/.kimi-code cannot re-mint event ids for records already synced.
		session, relErr := filepath.Rel(adapter.Root, path)
		if relErr != nil {
			session = path
		}
		reader := bufio.NewReader(file)
		for {
			body, oversized, readErr := readMetadataLine(reader)
			if readErr != nil && readErr != io.EOF {
				return readErr
			}
			if len(body) == 0 && !oversized && readErr == io.EOF {
				break
			}
			if !oversized {
				if record, ok := adapter.usageRecord(filepath.ToSlash(session), body); ok {
					records = append(records, record)
				}
			}
			if readErr == io.EOF {
				break
			}
		}
		return nil
	})
	return records, strconv.FormatInt(nextCursor, 10), err
}

func (adapter *Adapter) usageRecord(session string, body []byte) (adapters.UsageRecord, bool) {
	var item envelope
	if json.Unmarshal(body, &item) != nil || item.Type != "usage.record" || item.Usage == nil {
		return adapters.UsageRecord{}, false
	}
	if !strings.EqualFold(item.UsageScope, "turn") || item.Time <= 0 {
		return adapters.UsageRecord{}, false
	}
	usage := item.Usage
	cached := usage.InputCacheRead + usage.InputCacheCreation
	total := usage.InputOther + usage.Output + cached
	if total == 0 {
		return adapters.UsageRecord{}, false
	}
	timestamp := time.UnixMilli(item.Time)
	// The wire log carries no event id, so identity is the session plus the
	// turn's timestamp and token counts. Deriving it from content rather than
	// a line number keeps ids stable if a log is ever rewritten or compacted,
	// so a re-read cannot inflate a total.
	return adapters.UsageRecord{
		EventID: adapters.StableID("kimi-code", session,
			strconv.FormatInt(item.Time, 10),
			strconv.FormatInt(usage.InputOther, 10),
			strconv.FormatInt(usage.Output, 10),
			strconv.FormatInt(usage.InputCacheRead, 10),
			strconv.FormatInt(usage.InputCacheCreation, 10)),
		SchemaVersion: 1,
		OccurredAt:    timestamp.UTC().Format(time.RFC3339Nano),
		LocalDate:     adapters.LocalDate(timestamp, adapter.Location),
		HarnessID:     "kimi-code", ProviderID: "moonshot", ModelID: item.Model,
		InputTokens: usage.InputOther, OutputTokens: usage.Output,
		CachedInputTokens: &cached, TotalTokens: total,
		SourceFingerprint: adapters.Fingerprint(adapter.Root, "kimi-code"),
	}, true
}

// readMetadataLine returns one line, skipping the body of any line larger than
// maxMetadataLineBytes. Wire logs carry full turn payloads, so a single huge
// line must not truncate the records that follow it.
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
