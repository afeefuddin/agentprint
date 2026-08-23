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
	EventID           string `json:"event_id"`
	SchemaVersion     int    `json:"schema_version"`
	OccurredAt        string `json:"occurred_at"`
	LocalDate         string `json:"local_date"`
	HarnessID         string `json:"harness_id"`
	HarnessVersion    string `json:"harness_version,omitempty"`
	ProviderID        string `json:"provider_id,omitempty"`
	ModelID           string `json:"model_id,omitempty"`
	InputTokens       int64  `json:"input_tokens"`
	OutputTokens      int64  `json:"output_tokens"`
	CachedInputTokens *int64 `json:"cached_input_tokens,omitempty"`
	ReasoningTokens   *int64 `json:"reasoning_tokens,omitempty"`
	TotalTokens       int64  `json:"total_tokens"`
	SourceFingerprint string `json:"source_fingerprint"`
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
	Model  bool `json:"model"`
}

type Adapter interface {
	ID() string
	Detect(context.Context) DetectionResult
	Validate(context.Context) HealthResult
	Collect(context.Context, string) ([]UsageRecord, string, error)
	Capabilities() CapabilitySet
}

/*
Session sharing types.

The usage pipeline above is metadata-only. Everything below carries content and
is only ever produced when the user explicitly asks to share one session, is
always passed through the redactor first, and is always previewable before it
leaves the machine.
*/

const (
	BlockText       = "text"
	BlockThinking   = "thinking"
	BlockToolUse    = "tool_use"
	BlockToolResult = "tool_result"
	BlockOmitted    = "omitted"
)

// Block mirrors the closed vocabulary in packages/contracts. It is one Go
// struct for convenience, but it marshals per kind so the wire shape matches
// exactly one branch of the strict discriminated union on the server. An
// unknown kind is an error here rather than a rejected upload later.
type Block struct {
	Kind      string
	Text      string
	ID        string
	Name      string
	Input     string
	ToolUseID string
	OK        *bool
	Output    string
	Truncated bool
	Reason    string
}

func (block Block) MarshalJSON() ([]byte, error) {
	switch block.Kind {
	case BlockText, BlockThinking:
		return json.Marshal(struct {
			Kind      string `json:"kind"`
			Text      string `json:"text"`
			Truncated bool   `json:"truncated,omitempty"`
		}{block.Kind, block.Text, block.Truncated})
	case BlockToolUse:
		return json.Marshal(struct {
			Kind      string `json:"kind"`
			ID        string `json:"id,omitempty"`
			Name      string `json:"name"`
			Input     string `json:"input"`
			Truncated bool   `json:"truncated,omitempty"`
		}{block.Kind, block.ID, block.Name, block.Input, block.Truncated})
	case BlockToolResult:
		ok := true
		if block.OK != nil {
			ok = *block.OK
		}
		return json.Marshal(struct {
			Kind      string `json:"kind"`
			ToolUseID string `json:"tool_use_id,omitempty"`
			OK        bool   `json:"ok"`
			Output    string `json:"output"`
			Truncated bool   `json:"truncated,omitempty"`
		}{block.Kind, block.ToolUseID, ok, block.Output, block.Truncated})
	case BlockOmitted:
		return json.Marshal(struct {
			Kind   string `json:"kind"`
			Reason string `json:"reason"`
		}{block.Kind, block.Reason})
	}
	return nil, fmt.Errorf("unknown transcript block kind %q", block.Kind)
}

type Turn struct {
	Index   int     `json:"index"`
	Role    string  `json:"role"`
	At      string  `json:"at,omitempty"`
	ModelID string  `json:"model_id,omitempty"`
	Blocks  []Block `json:"blocks"`
}

type Totals struct {
	InputTokens       int64  `json:"input_tokens"`
	OutputTokens      int64  `json:"output_tokens"`
	CachedInputTokens *int64 `json:"cached_input_tokens,omitempty"`
	ReasoningTokens   *int64 `json:"reasoning_tokens,omitempty"`
	TotalTokens       int64  `json:"total_tokens"`
}

// SessionSummary is the listing entry. It deliberately carries no message
// content so `agentprint sessions` can be printed without reading transcripts.
type SessionSummary struct {
	HarnessID        string    `json:"harness_id"`
	Key              string    `json:"key"`
	Title            string    `json:"title"`
	StartedAt        time.Time `json:"started_at"`
	EndedAt          time.Time `json:"ended_at"`
	Turns            int       `json:"turns"`
	Tokens           int64     `json:"tokens"`
	Project          string    `json:"project,omitempty"`
	WorkingDirectory string    `json:"-"`
	ProjectRoot      string    `json:"-"`
}

type Transcript struct {
	HarnessID      string   `json:"harness_id"`
	HarnessVersion string   `json:"harness_version,omitempty"`
	Key            string   `json:"-"`
	Title          string   `json:"title"`
	Summary        string   `json:"summary,omitempty"`
	StartedAt      string   `json:"started_at"`
	EndedAt        string   `json:"ended_at"`
	ModelIDs       []string `json:"model_ids"`
	Totals         Totals   `json:"totals"`
	Turns          []Turn   `json:"turns"`

	// WorkingDirectory lets the redactor rewrite the project root out of paths.
	// It is never uploaded.
	WorkingDirectory string `json:"-"`
}

// SessionSource is optional. Adapters that do not implement it simply do not
// appear in `agentprint share`, which keeps a harness format change contained
// to one adapter exactly as the usage pipeline does.
type SessionSource interface {
	ListSessions(ctx context.Context, since time.Time) ([]SessionSummary, error)
	ReadSession(ctx context.Context, key string) (Transcript, error)
}

func SessionFingerprint(harness, key, root string) string {
	return StableID("agentprint-session-v1", harness, key, root)
}

func Truthy(value bool) *bool { return &value }

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
