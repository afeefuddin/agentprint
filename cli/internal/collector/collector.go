package collector

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/agentprint/agentprint/cli/internal/adapters"
	"github.com/agentprint/agentprint/cli/internal/adapters/claude"
	"github.com/agentprint/agentprint/cli/internal/adapters/codex"
	"github.com/agentprint/agentprint/cli/internal/adapters/fake"
	"github.com/agentprint/agentprint/cli/internal/adapters/kimi"
	"github.com/agentprint/agentprint/cli/internal/adapters/opencode"
	"github.com/agentprint/agentprint/cli/internal/store"
)

type Collector struct {
	Adapters []adapters.Adapter
	Store    *store.Store
}

type SourceStatus struct {
	ID           string                   `json:"id"`
	Detection    adapters.DetectionResult `json:"detection"`
	Health       adapters.HealthResult    `json:"health"`
	Capabilities adapters.CapabilitySet   `json:"capabilities"`
}

func DefaultAdapters(timezone string) ([]adapters.Adapter, error) {
	home := os.Getenv("AGENTPRINT_SOURCE_HOME")
	if home == "" {
		var err error
		home, err = os.UserHomeDir()
		if err != nil {
			return nil, err
		}
	}
	location, err := time.LoadLocation(timezone)
	if err != nil {
		location = time.UTC
	}
	result := []adapters.Adapter{
		codex.New(home, location),
		claude.New(home, location),
		opencode.New(home, location),
		kimi.New(home, location),
	}
	if fixture := os.Getenv("AGENTPRINT_FIXTURE"); fixture != "" {
		result = append(result, &fake.Adapter{Path: fixture})
	}
	return result, nil
}

func (collector *Collector) Sources(ctx context.Context) []SourceStatus {
	result := make([]SourceStatus, 0, len(collector.Adapters))
	for _, adapter := range collector.Adapters {
		detection := adapter.Detect(ctx)
		health := adapters.HealthResult{Healthy: false, Detail: "Not detected"}
		if detection.Detected {
			health = adapter.Validate(ctx)
		}
		result = append(result, SourceStatus{
			ID: adapter.ID(), Detection: detection, Health: health,
			Capabilities: adapter.Capabilities(),
		})
	}
	return result
}

func (collector *Collector) Collect(ctx context.Context) (int, error) {
	total := 0
	for _, adapter := range collector.Adapters {
		if !adapter.Detect(ctx).Detected {
			continue
		}
		cursor, err := collector.Store.Cursor(adapter.ID())
		if err != nil {
			return total, fmt.Errorf("%s cursor: %w", adapter.ID(), err)
		}
		records, nextCursor, err := adapter.Collect(ctx, cursor)
		if err != nil {
			return total, fmt.Errorf("%s collect: %w", adapter.ID(), err)
		}
		inserted, err := collector.Store.Queue(ctx, adapter.ID(), records, nextCursor)
		if err != nil {
			return total, fmt.Errorf("%s queue: %w", adapter.ID(), err)
		}
		total += inserted
	}
	return total, nil
}
