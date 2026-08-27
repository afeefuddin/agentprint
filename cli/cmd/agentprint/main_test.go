package main

import (
	"bytes"
	"context"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/agentprint/agentprint/cli/internal/config"
)

func TestOpenBrowserReturnsLauncherFailure(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("the Windows launcher is not resolved through PATH")
	}
	launcher := "xdg-open"
	if runtime.GOOS == "darwin" {
		launcher = "open"
	}
	directory := t.TempDir()
	path := filepath.Join(directory, launcher)
	if err := os.WriteFile(path, []byte("#!/bin/sh\necho launcher-failed >&2\nexit 7\n"), 0o700); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", directory)

	err := openBrowser("file:///tmp/share-preview.html")
	if err == nil || !strings.Contains(err.Error(), "launcher-failed") {
		t.Fatalf("expected launcher failure, got %v", err)
	}
}

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
	for _, command := range []string{"login", "status", "sync", "sources", "privacy", "doctor", "pause", "resume", "logout", "share-status"} {
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
