package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/agentprint/agentprint/cli/internal/adapters"
)

func TestRankSessionsForDirectoryKeepsEverySession(t *testing.T) {
	root := t.TempDir()
	home := filepath.Join(root, "home")
	current := filepath.Join(root, "work", "agentprint")
	other := filepath.Join(root, "work", "storefront")
	for _, directory := range []string{
		home,
		filepath.Join(current, ".git"),
		filepath.Join(current, "cli"),
		filepath.Join(other, ".git"),
	} {
		if err := os.MkdirAll(directory, 0o755); err != nil {
			t.Fatal(err)
		}
	}
	now := time.Date(2026, 8, 24, 12, 0, 0, 0, time.UTC)
	sessions := []adapters.SessionSummary{
		{Key: "other", WorkingDirectory: other, EndedAt: now.Add(4 * time.Minute)},
		{Key: "agnostic-missing", EndedAt: now.Add(3 * time.Minute)},
		{Key: "agnostic-home", WorkingDirectory: home, Project: "home", EndedAt: now.Add(2 * time.Minute)},
		{Key: "current", WorkingDirectory: filepath.Join(current, "cli"), EndedAt: now},
		{Key: "name-only", Project: "agentprint", EndedAt: now.Add(5 * time.Minute)},
	}

	ranked := rankSessionsForDirectory(sessions, filepath.Join(current, "cli"), home)
	want := []string{"current", "agnostic-missing", "agnostic-home", "name-only", "other"}
	if len(ranked) != len(want) {
		t.Fatalf("expected every session to remain available, got %d", len(ranked))
	}
	for index, key := range want {
		if ranked[index].Key != key {
			t.Fatalf("expected %q at %d, got %q", key, index, ranked[index].Key)
		}
	}
	if projectLabel(ranked[0]) != "agentprint" {
		t.Fatalf("expected repository root label, got %q", projectLabel(ranked[0]))
	}
	if projectLabel(ranked[2]) != "No project" {
		t.Fatalf("home-directory session must be project agnostic, got %q", projectLabel(ranked[2]))
	}
	if ranked[2].Project != "home" {
		t.Fatalf("ranking must not rewrite the stable fingerprint input, got %q", ranked[2].Project)
	}
}

func TestRankSessionsForDirectoryPrioritizesAgnosticOutsideAProject(t *testing.T) {
	root := t.TempDir()
	home := filepath.Join(root, "home")
	project := filepath.Join(root, "work", "api")
	for _, directory := range []string{home, filepath.Join(project, ".git")} {
		if err := os.MkdirAll(directory, 0o755); err != nil {
			t.Fatal(err)
		}
	}
	now := time.Date(2026, 8, 24, 12, 0, 0, 0, time.UTC)
	ranked := rankSessionsForDirectory([]adapters.SessionSummary{
		{Key: "project", WorkingDirectory: project, EndedAt: now.Add(time.Minute)},
		{Key: "agnostic", WorkingDirectory: home, EndedAt: now},
	}, home, home)
	if ranked[0].Key != "agnostic" || ranked[1].Key != "project" {
		t.Fatalf("expected agnostic session first outside a project, got %q then %q", ranked[0].Key, ranked[1].Key)
	}
}

func TestProjectRootFindsGitAncestor(t *testing.T) {
	root := t.TempDir()
	home := filepath.Join(root, "home")
	project := filepath.Join(root, "work", "api")
	nested := filepath.Join(project, "internal", "auth")
	for _, directory := range []string{home, filepath.Join(project, ".git"), nested} {
		if err := os.MkdirAll(directory, 0o755); err != nil {
			t.Fatal(err)
		}
	}
	want, err := filepath.EvalSymlinks(project)
	if err != nil {
		t.Fatal(err)
	}
	if got := projectRoot(nested, home); got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}
	if got := projectRoot(home, home); got != "" {
		t.Fatalf("expected home to be project agnostic, got %q", got)
	}
}

func TestSessionSummaryJSONKeepsLocalPathsPrivate(t *testing.T) {
	encoded, err := json.Marshal(adapters.SessionSummary{
		Key:              "session-1",
		Project:          "api",
		WorkingDirectory: "/Users/dana/private/api",
		ProjectRoot:      "/Users/dana/private/api",
	})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(encoded), "/Users/dana") {
		t.Fatalf("session JSON exposed a local path: %s", encoded)
	}
	if !strings.Contains(string(encoded), `"project":"api"`) {
		t.Fatalf("session JSON lost its safe project label: %s", encoded)
	}
}
