package main

import (
	"bytes"
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/agentprint/agentprint/cli/internal/config"
)

func TestLoginHonorsCanceledContext(t *testing.T) {
	manager := &config.Manager{Root: t.TempDir()}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	err := login(ctx, manager, config.Config{Server: "https://agentprint.tech"}, []string{"-no-browser", "-no-service"})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("login error = %v, want context canceled", err)
	}
}

func TestConfirmUpdate(t *testing.T) {
	for _, answer := range []string{"\n", "y\n", "YES\n"} {
		var output bytes.Buffer
		confirmed, err := confirmUpdate(strings.NewReader(answer), &output)
		if err != nil {
			t.Fatal(err)
		}
		if !confirmed {
			t.Fatalf("expected %q to confirm update", answer)
		}
		if output.String() != "Update now? [Y/n] " {
			t.Fatalf("unexpected prompt %q", output.String())
		}
	}

	confirmed, err := confirmUpdate(strings.NewReader("n\n"), &bytes.Buffer{})
	if err != nil {
		t.Fatal(err)
	}
	if confirmed {
		t.Fatal("expected n to decline update")
	}
}

func TestUpdatePromptsOnlyForInteractiveCommands(t *testing.T) {
	for _, command := range []string{"login", "status", "sync", "sources", "privacy", "doctor", "pause", "resume", "logout"} {
		if !shouldOfferUpdate(command) {
			t.Fatalf("expected %s to offer updates", command)
		}
	}
	for _, command := range []string{"daemon", "version", "help", "update", "uninstall"} {
		if shouldOfferUpdate(command) {
			t.Fatalf("did not expect %s to offer updates", command)
		}
	}
}
