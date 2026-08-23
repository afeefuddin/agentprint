package telemetry

import (
	"encoding/json"
	"os"
	"runtime"
	"time"

	"github.com/denisbrodbeck/machineid"
	"github.com/posthog/posthog-go"
)

var (
	// PostHogProjectToken and PostHogEndpoint are injected into release binaries.
	PostHogProjectToken string
	PostHogEndpoint     = "https://us.i.posthog.com"
)

type Event struct {
	Event      string         `json:"event"`
	DistinctID string         `json:"distinct_id"`
	Properties map[string]any `json:"properties"`
	Timestamp  time.Time      `json:"timestamp"`
}

type silentLogger struct{}

func (silentLogger) Logf(string, ...interface{})   {}
func (silentLogger) Debugf(string, ...interface{}) {}
func (silentLogger) Warnf(string, ...interface{})  {}
func (silentLogger) Errorf(string, ...interface{}) {}

var spawnHook func(string)

var trackedCommands = map[string]struct{}{
	"status":   {},
	"sources":  {},
	"sessions": {},
	"shares":   {},
	"unshare":  {},
	"doctor":   {},
	"pause":    {},
	"resume":   {},
}

// TrackCommand starts a detached sender and returns without waiting for PostHog.
func TrackCommand(command, version string) {
	if IsDisabled() || PostHogProjectToken == "" {
		return
	}
	if _, tracked := trackedCommands[command]; !tracked {
		return
	}
	distinctID, err := machineid.ProtectedID("agentprint-cli")
	if err != nil {
		return
	}
	payload, err := json.Marshal(Event{
		Event:      "cli_command_executed",
		DistinctID: distinctID,
		Properties: map[string]any{
			"command":     command,
			"cli_version": version,
			"os":          runtime.GOOS,
			"arch":        runtime.GOARCH,
		},
		Timestamp: time.Now(),
	})
	if err != nil {
		return
	}
	if spawnHook != nil {
		spawnHook(string(payload))
		return
	}
	spawnDetached("__send_analytics", string(payload))
}

func IsDisabled() bool {
	return os.Getenv("AGENTPRINT_TELEMETRY_DISABLED") != ""
}

// Send delivers one event from the detached __send_analytics process.
func Send(payloadJSON string) {
	if IsDisabled() || PostHogProjectToken == "" {
		return
	}
	var payload Event
	if json.Unmarshal([]byte(payloadJSON), &payload) != nil || payload.Event == "" || payload.DistinctID == "" {
		return
	}
	client, err := posthog.NewWithConfig(PostHogProjectToken, posthog.Config{
		Endpoint:     PostHogEndpoint,
		Logger:       silentLogger{},
		DisableGeoIP: posthog.Ptr(true),
		IsServer:     posthog.Ptr(false),
	})
	if err != nil {
		return
	}
	defer func() { _ = client.Close() }()
	_ = client.Enqueue(posthog.Capture{
		DistinctId: payload.DistinctID,
		Event:      payload.Event,
		Properties: posthog.Properties(payload.Properties),
		Timestamp:  payload.Timestamp,
	})
}
