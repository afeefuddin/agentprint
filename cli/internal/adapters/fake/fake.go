package fake

import (
	"bufio"
	"context"
	"encoding/json"
	"os"
	"time"

	"github.com/agentprint/agentprint/cli/internal/adapters"
)

type Adapter struct {
	Path string
}

func (adapter *Adapter) ID() string { return "synthetic" }
func (adapter *Adapter) Capabilities() adapters.CapabilitySet {
	return adapters.CapabilitySet{Tokens: true, Model: true, Cost: true}
}
func (adapter *Adapter) Detect(context.Context) adapters.DetectionResult {
	_, err := os.Stat(adapter.Path)
	return adapters.DetectionResult{Detected: err == nil, Path: adapter.Path, Detail: "Explicit synthetic fixture"}
}
func (adapter *Adapter) Validate(ctx context.Context) adapters.HealthResult {
	found := adapter.Detect(ctx)
	return adapters.HealthResult{Healthy: found.Detected, Detail: found.Detail}
}
func (adapter *Adapter) Collect(_ context.Context, cursor string) ([]adapters.UsageRecord, string, error) {
	if cursor == "complete" {
		return nil, cursor, nil
	}
	file, err := os.Open(adapter.Path)
	if err != nil {
		return nil, cursor, err
	}
	defer file.Close()
	var records []adapters.UsageRecord
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		var record adapters.UsageRecord
		if err := json.Unmarshal(scanner.Bytes(), &record); err != nil {
			return nil, cursor, err
		}
		if record.SchemaVersion == 0 {
			record.SchemaVersion = 1
		}
		if record.OccurredAt == "" {
			record.OccurredAt = time.Now().UTC().Format(time.RFC3339Nano)
		}
		records = append(records, record)
	}
	return records, "complete", scanner.Err()
}
