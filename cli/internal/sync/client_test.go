package sync

import (
	"compress/gzip"
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/agentprint/agentprint/cli/internal/adapters"
	"github.com/agentprint/agentprint/cli/internal/store"
)

func TestSyncCompressesSignsAndAcknowledges(t *testing.T) {
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.Header.Get("Content-Encoding") != "gzip" {
			t.Errorf("expected gzip content encoding")
		}
		compressed, err := io.ReadAll(request.Body)
		if err != nil {
			t.Fatal(err)
		}
		timestamp := request.Header.Get("X-Agentprint-Timestamp")
		signature, err := base64.StdEncoding.DecodeString(request.Header.Get("X-Agentprint-Signature"))
		if err != nil {
			t.Fatal(err)
		}
		signed := append([]byte(timestamp+"."), compressed...)
		if !ed25519.Verify(publicKey, signed, signature) {
			t.Errorf("signature did not verify")
		}
		reader, err := gzip.NewReader(bytesReader(compressed))
		if err != nil {
			t.Fatal(err)
		}
		payload, err := io.ReadAll(reader)
		if err != nil {
			t.Fatal(err)
		}
		var batch map[string]any
		if err := json.Unmarshal(payload, &batch); err != nil {
			t.Fatal(err)
		}
		if len(batch["records"].([]any)) != 1 {
			t.Errorf("expected one record")
		}
		response.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(response, `{"batch_id":"batch","acknowledgement":"receipt","accepted":1,"duplicate":0,"rejected":0,"replay":false}`)
	}))
	defer server.Close()

	local, err := store.Open(filepath.Join(t.TempDir(), "queue.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer local.Close()
	record := adapters.UsageRecord{
		EventID: "signed-event-with-entropy", SchemaVersion: 1,
		OccurredAt: "2026-07-29T09:30:00Z", LocalDate: "2026-07-29",
		HarnessID: "synthetic", InputTokens: 10, OutputTokens: 5,
		TotalTokens: 15, SourceFingerprint: "source-fingerprint",
	}
	if _, err := local.Queue(context.Background(), "synthetic", []adapters.UsageRecord{record}, "done"); err != nil {
		t.Fatal(err)
	}
	client := NewClient(server.URL)
	receipt, err := client.Sync(
		context.Background(), local, "access-token",
		base64.StdEncoding.EncodeToString(privateKey), "UTC",
	)
	if err != nil {
		t.Fatal(err)
	}
	if receipt.Accepted != 1 {
		t.Fatalf("expected accepted receipt")
	}
	count, _ := local.PendingCount()
	if count != 0 {
		t.Fatalf("expected acknowledged queue, got %d", count)
	}
}

type byteReader struct {
	body []byte
	at   int
}

func bytesReader(body []byte) *byteReader { return &byteReader{body: body} }
func (reader *byteReader) Read(destination []byte) (int, error) {
	if reader.at >= len(reader.body) {
		return 0, io.EOF
	}
	count := copy(destination, reader.body[reader.at:])
	reader.at += count
	return count, nil
}
