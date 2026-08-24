package updater

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"
)

func TestNewDefaultsToProductionDownloadBase(t *testing.T) {
	client := New(filepath.Join(t.TempDir(), "update-check.json"))
	if client.BaseURL != "https://agentprint.tech/releases/latest" {
		t.Fatalf("default download base = %q, want https://agentprint.tech/releases/latest", client.BaseURL)
	}
}

func TestCheckUsesCachedManifestForOneDay(t *testing.T) {
	now := time.Date(2026, 8, 3, 12, 0, 0, 0, time.UTC)
	requests := 0
	manifest := Manifest{
		Version: "0.2.0",
		Archives: map[string]Artifact{
			"darwin-arm64": {File: "agentprint.tar.gz", SHA256: "abc"},
		},
	}
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		requests++
		json.NewEncoder(response).Encode(manifest)
	}))
	defer server.Close()

	client := New(filepath.Join(t.TempDir(), "update-check.json"))
	client.BaseURL = server.URL
	client.Now = func() time.Time { return now }

	got, available, err := client.Check(context.Background(), "0.1.1", false)
	if err != nil {
		t.Fatal(err)
	}
	if !available || got.Version != "0.2.0" {
		t.Fatalf("expected update 0.2.0, got %#v available=%v", got, available)
	}
	if _, _, err := client.Check(context.Background(), "0.1.1", false); err != nil {
		t.Fatal(err)
	}
	if requests != 1 {
		t.Fatalf("expected one manifest request, got %d", requests)
	}

	now = now.Add(25 * time.Hour)
	if _, _, err := client.Check(context.Background(), "0.2.0", false); err != nil {
		t.Fatal(err)
	}
	if requests != 2 {
		t.Fatalf("expected cache refresh after one day, got %d requests", requests)
	}
}

func TestPromptIsLimitedToOncePerVersionPerDay(t *testing.T) {
	now := time.Date(2026, 8, 3, 12, 0, 0, 0, time.UTC)
	client := New(filepath.Join(t.TempDir(), "update-check.json"))
	client.Now = func() time.Time { return now }
	if !client.ShouldPrompt("0.2.0") {
		t.Fatal("expected first prompt to be allowed")
	}
	if err := client.MarkPrompted("0.2.0"); err != nil {
		t.Fatal(err)
	}
	if client.ShouldPrompt("0.2.0") {
		t.Fatal("expected same-day prompt to be suppressed")
	}
	if !client.ShouldPrompt("0.2.1") {
		t.Fatal("expected a new version to prompt immediately")
	}
	now = now.Add(25 * time.Hour)
	if !client.ShouldPrompt("0.2.0") {
		t.Fatal("expected prompt to be allowed again after one day")
	}
}

func TestInstallVerifiesAndReplacesExecutable(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("test archive contains a Unix executable")
	}
	newBinary := []byte("#!/bin/sh\necho 'agentprint 0.2.0 (test/test)'\n")
	archive := tarGzip(t, "agentprint", newBinary)
	digest := sha256.Sum256(archive)
	artifact := Artifact{File: "agentprint-test.tar.gz", SHA256: hex.EncodeToString(digest[:])}
	manifest := Manifest{
		Version:  "0.2.0",
		Archives: map[string]Artifact{runtime.GOOS + "-" + runtime.GOARCH: artifact},
	}
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		response.Write(archive)
	}))
	defer server.Close()

	directory := t.TempDir()
	executable := filepath.Join(directory, "agentprint")
	if err := os.WriteFile(executable, []byte("old binary"), 0o755); err != nil {
		t.Fatal(err)
	}
	client := New(filepath.Join(directory, "cache.json"))
	client.BaseURL = server.URL
	if err := client.Install(context.Background(), manifest, executable); err != nil {
		t.Fatal(err)
	}
	body, err := os.ReadFile(executable)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(body, newBinary) {
		t.Fatalf("unexpected installed binary: %q", body)
	}
}

func TestInstallRejectsChecksumMismatch(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		response.Write([]byte("not the expected archive"))
	}))
	defer server.Close()

	directory := t.TempDir()
	executable := filepath.Join(directory, "agentprint")
	if err := os.WriteFile(executable, []byte("old binary"), 0o755); err != nil {
		t.Fatal(err)
	}
	client := New(filepath.Join(directory, "cache.json"))
	client.BaseURL = server.URL
	manifest := Manifest{
		Version: "0.2.0",
		Archives: map[string]Artifact{
			runtime.GOOS + "-" + runtime.GOARCH: {File: "agentprint.tar.gz", SHA256: "bad"},
		},
	}
	if err := client.Install(context.Background(), manifest, executable); err == nil {
		t.Fatal("expected checksum verification to fail")
	}
	body, err := os.ReadFile(executable)
	if err != nil {
		t.Fatal(err)
	}
	if string(body) != "old binary" {
		t.Fatalf("existing executable changed after failed update: %q", body)
	}
}

func TestVersionComparison(t *testing.T) {
	cases := []struct {
		latest  string
		current string
		newer   bool
	}{
		{latest: "0.2.0", current: "0.1.1", newer: true},
		{latest: "v1.0.0", current: "0.9.9", newer: true},
		{latest: "0.2.0", current: "0.2.0", newer: false},
		{latest: "0.1.9", current: "0.2.0", newer: false},
	}
	for _, test := range cases {
		got, err := isNewer(test.latest, test.current)
		if err != nil {
			t.Fatal(err)
		}
		if got != test.newer {
			t.Fatalf("isNewer(%q, %q) = %v, want %v", test.latest, test.current, got, test.newer)
		}
	}
}

func tarGzip(t *testing.T, name string, body []byte) []byte {
	t.Helper()
	var output bytes.Buffer
	compressed := gzip.NewWriter(&output)
	archive := tar.NewWriter(compressed)
	if err := archive.WriteHeader(&tar.Header{Name: name, Mode: 0o755, Size: int64(len(body)), Typeflag: tar.TypeReg}); err != nil {
		t.Fatal(err)
	}
	if _, err := archive.Write(body); err != nil {
		t.Fatal(err)
	}
	if err := archive.Close(); err != nil {
		t.Fatal(err)
	}
	if err := compressed.Close(); err != nil {
		t.Fatal(err)
	}
	return output.Bytes()
}
