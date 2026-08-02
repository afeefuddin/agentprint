package adapters

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"
)

type UsageRecord struct {
	EventID             string `json:"event_id"`
	SchemaVersion       int    `json:"schema_version"`
	OccurredAt          string `json:"occurred_at"`
	LocalDate           string `json:"local_date"`
	HarnessID           string `json:"harness_id"`
	HarnessVersion      string `json:"harness_version,omitempty"`
	ProviderID          string `json:"provider_id,omitempty"`
	ModelID             string `json:"model_id,omitempty"`
	InputTokens         int64  `json:"input_tokens"`
	OutputTokens        int64  `json:"output_tokens"`
	CachedInputTokens   *int64 `json:"cached_input_tokens,omitempty"`
	ReasoningTokens     *int64 `json:"reasoning_tokens,omitempty"`
	TotalTokens         int64  `json:"total_tokens"`
	EstimatedCostMicros *int64 `json:"estimated_cost_micros,omitempty"`
	CostBasis           string `json:"cost_basis,omitempty"`
	SourceFingerprint   string `json:"source_fingerprint"`
}

type DetectionResult struct {
	Detected bool   `json:"detected"`
	Path     string `json:"-"`
	Version  string `json:"version,omitempty"`
	Detail   string `json:"detail"`
}

type HealthResult struct {
	Healthy bool   `json:"healthy"`
	Detail  string `json:"detail"`
}

type CapabilitySet struct {
	Tokens bool `json:"tokens"`
	Cost   bool `json:"cost"`
	Model  bool `json:"model"`
}

type Adapter interface {
	ID() string
	Detect(context.Context) DetectionResult
	Validate(context.Context) HealthResult
	Collect(context.Context, string) ([]UsageRecord, string, error)
	Capabilities() CapabilitySet
}

func StableID(parts ...string) string {
	hash := sha256.New()
	for _, part := range parts {
		hash.Write([]byte(part))
		hash.Write([]byte{0})
	}
	return hex.EncodeToString(hash.Sum(nil))
}

func Fingerprint(path, harness string) string {
	return StableID("agentprint-source-v1", harness, path)
}

func LocalDate(timestamp time.Time, location *time.Location) string {
	return timestamp.In(location).Format("2006-01-02")
}

func DecodeLine(line []byte, destination any) error {
	if err := json.Unmarshal(line, destination); err != nil {
		return fmt.Errorf("decode metadata record: %w", err)
	}
	return nil
}
