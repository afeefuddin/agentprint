package telemetry

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestTrackCommandSpawnsPrivacyLimitedPayload(t *testing.T) {
	t.Setenv("AGENTPRINT_TELEMETRY_DISABLED", "")
	oldToken, oldHook := PostHogProjectToken, spawnHook
	PostHogProjectToken = "phc_test"
	defer func() {
		PostHogProjectToken = oldToken
		spawnHook = oldHook
	}()

	var captured string
	spawnHook = func(payload string) { captured = payload }
	TrackCommand("status", "0.4.0")

	var event Event
	if err := json.Unmarshal([]byte(captured), &event); err != nil {
		t.Fatal(err)
	}
	if event.Event != "cli_command_executed" || event.Properties["command"] != "status" {
		t.Fatalf("unexpected event: %#v", event)
	}
	for _, forbidden := range []string{"arguments", "error", "path", "prompt", "session"} {
		if _, exists := event.Properties[forbidden]; exists {
			t.Fatalf("payload contains forbidden property %q", forbidden)
		}
	}
}

func TestTrackCommandHonorsEnvironmentOptOut(t *testing.T) {
	t.Setenv("AGENTPRINT_TELEMETRY_DISABLED", "1")
	oldToken, oldHook := PostHogProjectToken, spawnHook
	PostHogProjectToken = "phc_test"
	defer func() {
		PostHogProjectToken = oldToken
		spawnHook = oldHook
	}()
	spawned := false
	spawnHook = func(string) { spawned = true }
	TrackCommand("status", "0.4.0")
	if spawned {
		t.Fatal("telemetry spawned despite opt-out")
	}
}

func TestTrackCommandSkipsDatabaseBackedOutcomes(t *testing.T) {
	t.Setenv("AGENTPRINT_TELEMETRY_DISABLED", "")
	oldToken, oldHook := PostHogProjectToken, spawnHook
	PostHogProjectToken = "phc_test"
	defer func() {
		PostHogProjectToken = oldToken
		spawnHook = oldHook
	}()
	for _, command := range []string{"sync", "daemon", "share"} {
		spawned := false
		spawnHook = func(string) { spawned = true }
		TrackCommand(command, "0.4.0")
		if spawned {
			t.Fatalf("database-backed command %q emitted telemetry", command)
		}
	}
}

func TestSendPostsDirectlyToPostHogBatchEndpoint(t *testing.T) {
	t.Setenv("AGENTPRINT_TELEMETRY_DISABLED", "")
	requestPath := ""
	requestBody := ""
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		requestPath = request.URL.Path
		body, err := io.ReadAll(request.Body)
		if err != nil {
			t.Error(err)
		}
		requestBody = string(body)
		response.WriteHeader(http.StatusOK)
		_, _ = response.Write([]byte(`{"status":"Ok"}`))
	}))
	defer server.Close()

	oldToken, oldEndpoint := PostHogProjectToken, PostHogEndpoint
	PostHogProjectToken, PostHogEndpoint = "phc_test", server.URL
	defer func() { PostHogProjectToken, PostHogEndpoint = oldToken, oldEndpoint }()

	payload, err := json.Marshal(Event{
		Event:      "cli_command_executed",
		DistinctID: "protected-machine-id",
		Properties: map[string]any{"command": "status"},
		Timestamp:  time.Now(),
	})
	if err != nil {
		t.Fatal(err)
	}
	Send(string(payload))

	if requestPath != "/batch/" {
		t.Fatalf("path = %q, want /batch/", requestPath)
	}
	for _, expected := range []string{"phc_test", "cli_command_executed", "protected-machine-id", "status"} {
		if !strings.Contains(requestBody, expected) {
			t.Fatalf("PostHog payload does not contain %q: %s", expected, requestBody)
		}
	}
}
