package updater

import (
	"archive/tar"
	"archive/zip"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"
)

const (
	defaultDownloadBase = "https://agentprint.tech/releases/latest"
	checkInterval       = 24 * time.Hour
	maxArchiveBytes     = 64 * 1024 * 1024
)

type Artifact struct {
	File   string `json:"file"`
	SHA256 string `json:"sha256"`
}

type Manifest struct {
	Version  string              `json:"version"`
	Archives map[string]Artifact `json:"archives"`
}

type cache struct {
	CheckedAt           time.Time `json:"checked_at"`
	LastPromptedAt      time.Time `json:"last_prompted_at,omitempty"`
	LastPromptedVersion string    `json:"last_prompted_version,omitempty"`
	Manifest            Manifest  `json:"manifest"`
}

type Client struct {
	BaseURL   string
	CachePath string
	HTTP      *http.Client
	Now       func() time.Time
}

func New(cachePath string) *Client {
	return &Client{
		BaseURL:   defaultDownloadBase,
		CachePath: cachePath,
		HTTP:      &http.Client{Timeout: 30 * time.Second},
		Now:       time.Now,
	}
}

func (client *Client) Check(ctx context.Context, currentVersion string, force bool) (Manifest, bool, error) {
	cached, _ := client.readCache()
	manifest := cached.Manifest
	if force || cached.CheckedAt.IsZero() || client.Now().Sub(cached.CheckedAt) >= checkInterval {
		fetched, err := client.fetchManifest(ctx)
		if err != nil {
			return Manifest{}, false, err
		}
		manifest = fetched
		cached.CheckedAt = client.Now().UTC()
		cached.Manifest = fetched
		if err := client.writeCache(cached); err != nil {
			return Manifest{}, false, err
		}
	}
	newer, err := isNewer(manifest.Version, currentVersion)
	if err != nil {
		return Manifest{}, false, err
	}
	return manifest, newer, nil
}

func (client *Client) ShouldPrompt(version string) bool {
	cached, err := client.readCache()
	if err != nil || cached.LastPromptedVersion != version {
		return true
	}
	return client.Now().Sub(cached.LastPromptedAt) >= checkInterval
}

func (client *Client) MarkPrompted(version string) error {
	cached, _ := client.readCache()
	cached.LastPromptedAt = client.Now().UTC()
	cached.LastPromptedVersion = version
	return client.writeCache(cached)
}

func (client *Client) Install(ctx context.Context, manifest Manifest, executable string) error {
	key := runtime.GOOS + "-" + runtime.GOARCH
	artifact, ok := manifest.Archives[key]
	if !ok {
		return fmt.Errorf("release %s does not support %s", manifest.Version, key)
	}
	if artifact.File == "" || artifact.SHA256 == "" {
		return errors.New("release manifest contains an incomplete archive entry")
	}

	body, err := client.download(ctx, artifact.File)
	if err != nil {
		return err
	}
	digest := sha256.Sum256(body)
	if !strings.EqualFold(hex.EncodeToString(digest[:]), artifact.SHA256) {
		return errors.New("downloaded update failed checksum verification")
	}

	executable, err = filepath.Abs(executable)
	if err != nil {
		return err
	}
	directory := filepath.Dir(executable)
	temporary, err := os.MkdirTemp(directory, ".agentprint-update-")
	if err != nil {
		return fmt.Errorf("prepare update beside current executable: %w", err)
	}
	defer os.RemoveAll(temporary)

	name := "agentprint"
	if runtime.GOOS == "windows" {
		name += ".exe"
	}
	candidate := filepath.Join(temporary, name)
	if strings.HasSuffix(artifact.File, ".zip") {
		err = extractZip(body, name, candidate)
	} else {
		err = extractTarGzip(body, name, candidate)
	}
	if err != nil {
		return err
	}
	if err := os.Chmod(candidate, 0o755); err != nil {
		return err
	}
	output, err := exec.CommandContext(ctx, candidate, "version").CombinedOutput()
	if err != nil {
		return fmt.Errorf("validate downloaded update: %w", err)
	}
	expected := "agentprint " + manifest.Version + " "
	if !strings.HasPrefix(string(output), expected) {
		return fmt.Errorf("downloaded update reported an unexpected version: %s", strings.TrimSpace(string(output)))
	}
	if err := replaceExecutable(executable, candidate); err != nil {
		return fmt.Errorf("replace current executable: %w", err)
	}
	return nil
}

func (client *Client) fetchManifest(ctx context.Context) (Manifest, error) {
	body, err := client.download(ctx, "manifest.json")
	if err != nil {
		return Manifest{}, err
	}
	var manifest Manifest
	if err := json.Unmarshal(body, &manifest); err != nil {
		return Manifest{}, fmt.Errorf("decode release manifest: %w", err)
	}
	if manifest.Version == "" || len(manifest.Archives) == 0 {
		return Manifest{}, errors.New("release manifest is incomplete")
	}
	if _, err := parseVersion(manifest.Version); err != nil {
		return Manifest{}, err
	}
	return manifest, nil
}

func (client *Client) download(ctx context.Context, name string) ([]byte, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, client.BaseURL+"/"+name, nil)
	if err != nil {
		return nil, err
	}
	response, err := client.HTTP.Do(request)
	if err != nil {
		return nil, fmt.Errorf("download %s: %w", name, err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("download %s: server returned %s", name, response.Status)
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, maxArchiveBytes+1))
	if err != nil {
		return nil, err
	}
	if len(body) > maxArchiveBytes {
		return nil, fmt.Errorf("download %s exceeded %d bytes", name, maxArchiveBytes)
	}
	return body, nil
}

func (client *Client) readCache() (cache, error) {
	body, err := os.ReadFile(client.CachePath)
	if err != nil {
		return cache{}, err
	}
	var value cache
	if err := json.Unmarshal(body, &value); err != nil {
		return cache{}, err
	}
	return value, nil
}

func (client *Client) writeCache(value cache) error {
	if err := os.MkdirAll(filepath.Dir(client.CachePath), 0o700); err != nil {
		return err
	}
	body, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(client.CachePath, body, 0o600)
}

func isNewer(latest, current string) (bool, error) {
	latestParts, err := parseVersion(latest)
	if err != nil {
		return false, err
	}
	currentParts, err := parseVersion(current)
	if err != nil {
		return false, err
	}
	for index := range latestParts {
		if latestParts[index] != currentParts[index] {
			return latestParts[index] > currentParts[index], nil
		}
	}
	return false, nil
}

func parseVersion(value string) ([3]int, error) {
	value = strings.TrimPrefix(strings.TrimSpace(value), "v")
	parts := strings.Split(value, ".")
	if len(parts) != 3 {
		return [3]int{}, fmt.Errorf("invalid release version %q", value)
	}
	var parsed [3]int
	for index, part := range parts {
		number, err := strconv.Atoi(part)
		if err != nil || number < 0 {
			return [3]int{}, fmt.Errorf("invalid release version %q", value)
		}
		parsed[index] = number
	}
	return parsed, nil
}

func extractTarGzip(body []byte, expectedName, destination string) error {
	compressed, err := gzip.NewReader(bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("open update archive: %w", err)
	}
	defer compressed.Close()
	reader := tar.NewReader(compressed)
	for {
		header, err := reader.Next()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return fmt.Errorf("read update archive: %w", err)
		}
		if header.Name != expectedName || header.Typeflag != tar.TypeReg {
			continue
		}
		return writeCandidate(destination, reader)
	}
	return fmt.Errorf("update archive does not contain %s", expectedName)
}

func extractZip(body []byte, expectedName, destination string) error {
	reader, err := zip.NewReader(bytes.NewReader(body), int64(len(body)))
	if err != nil {
		return fmt.Errorf("open update archive: %w", err)
	}
	for _, file := range reader.File {
		if file.Name != expectedName || file.FileInfo().IsDir() {
			continue
		}
		source, err := file.Open()
		if err != nil {
			return err
		}
		err = writeCandidate(destination, source)
		source.Close()
		return err
	}
	return fmt.Errorf("update archive does not contain %s", expectedName)
}

func writeCandidate(destination string, source io.Reader) error {
	file, err := os.OpenFile(destination, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o755)
	if err != nil {
		return err
	}
	written, copyErr := io.Copy(file, io.LimitReader(source, maxArchiveBytes+1))
	closeErr := file.Close()
	if copyErr != nil {
		return copyErr
	}
	if written > maxArchiveBytes {
		return errors.New("extracted update exceeded the maximum executable size")
	}
	return closeErr
}

func replaceExecutable(current, candidate string) error {
	if runtime.GOOS != "windows" {
		return os.Rename(candidate, current)
	}
	backup := current + ".old"
	_ = os.Remove(backup)
	if err := os.Rename(current, backup); err != nil {
		return err
	}
	if err := os.Rename(candidate, current); err != nil {
		_ = os.Rename(backup, current)
		return err
	}
	_ = os.Remove(backup)
	return nil
}
