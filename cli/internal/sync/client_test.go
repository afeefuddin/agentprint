package sync

import (
	"bytes"
	"compress/gzip"
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/agentprint/agentprint/cli/internal/adapters"
	"github.com/agentprint/agentprint/cli/internal/store"
)

func TestSyncAllDrainsMoreThanOneBatch(t *testing.T) {
	_, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	var batchSizes []int
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		compressed, err := io.ReadAll(request.Body)
		if err != nil {
			t.Fatal(err)
		}
		reader, err := gzip.NewReader(bytesReader(compressed))
		if err != nil {
			t.Fatal(err)
		}
		payload, err := io.ReadAll(reader)
		if err != nil {
			t.Fatal(err)
		}
		var batch struct {
			Records []adapters.UsageRecord `json:"records"`
		}
		if err := json.Unmarshal(payload, &batch); err != nil {
			t.Fatal(err)
		}
		batchSizes = append(batchSizes, len(batch.Records))
		response.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(response, `{"batch_id":"batch","acknowledgement":"receipt","accepted":%d,"duplicate":0,"rejected":0,"replay":false}`, len(batch.Records))
	}))
	defer server.Close()

	local, err := store.Open(filepath.Join(t.TempDir(), "queue.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer local.Close()
	records := make([]adapters.UsageRecord, 4_501)
	for index := range records {
		records[index] = adapters.UsageRecord{
			EventID: fmt.Sprintf("event-%d", index), SchemaVersion: 1,
			OccurredAt: "2026-07-29T09:30:00Z", LocalDate: "2026-07-29",
			HarnessID: "synthetic", InputTokens: 10, OutputTokens: 5,
			TotalTokens: 15, SourceFingerprint: fmt.Sprintf("source-%d", index),
		}
	}
	if _, err := local.Queue(context.Background(), "synthetic", records, "done"); err != nil {
		t.Fatal(err)
	}

	client := NewClient(server.URL)
	receipt, err := client.SyncAll(
		context.Background(), local, "access-token",
		base64.StdEncoding.EncodeToString(privateKey), "UTC",
	)
	if err != nil {
		t.Fatal(err)
	}
	if receipt.Accepted != len(records) {
		t.Fatalf("accepted = %d, want %d", receipt.Accepted, len(records))
	}
	wantBatchSizes := []int{2_000, 2_000, 501}
	if fmt.Sprint(batchSizes) != fmt.Sprint(wantBatchSizes) {
		t.Fatalf("batch sizes = %v, want %v", batchSizes, wantBatchSizes)
	}
	pending, err := local.PendingCount()
	if err != nil {
		t.Fatal(err)
	}
	if pending != 0 {
		t.Fatalf("pending = %d, want 0", pending)
	}
}

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

func TestPublishShareUploadsContentDirectlyAndQueuesIt(t *testing.T) {
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	var uploaded []byte
	uploadServer := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodPost {
			t.Errorf("upload method = %s, want POST", request.Method)
		}
		if err := request.ParseMultipartForm(16 * 1024 * 1024); err != nil {
			t.Fatal(err)
		}
		if request.FormValue("Content-Encoding") != "gzip" {
			t.Errorf("expected gzip form field")
		}
		file, _, err := request.FormFile("file")
		if err != nil {
			t.Fatal(err)
		}
		defer file.Close()
		uploaded, err = io.ReadAll(file)
		if err != nil {
			t.Fatal(err)
		}
		response.WriteHeader(http.StatusNoContent)
	}))
	defer uploadServer.Close()

	verifySigned := func(request *http.Request, body []byte) {
		t.Helper()
		timestamp := request.Header.Get("X-Agentprint-Timestamp")
		signature, decodeErr := base64.StdEncoding.DecodeString(request.Header.Get("X-Agentprint-Signature"))
		if decodeErr != nil {
			t.Fatal(decodeErr)
		}
		if !ed25519.Verify(publicKey, append([]byte(timestamp+"."), body...), signature) {
			t.Error("control request signature did not verify")
		}
	}

	apiServer := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		body, readErr := io.ReadAll(request.Body)
		if readErr != nil {
			t.Fatal(readErr)
		}
		verifySigned(request, body)
		response.Header().Set("Content-Type", "application/json")
		switch request.URL.Path {
		case "/v1/me/shares/uploads":
			var reservation map[string]any
			if err := json.Unmarshal(body, &reservation); err != nil {
				t.Fatal(err)
			}
			if reservation["title"] != "Private transcript" || reservation["harness_id"] != "codex" {
				t.Errorf("reservation display metadata = %#v", reservation)
			}
			if _, included := reservation["turns"]; included {
				t.Error("reservation request contained transcript turns")
			}
			fmt.Fprintf(response,
				`{"upload_id":"upload-123","upload_url":%q,"fields":{"key":"session-uploads/upload-123.json.gz","Content-Type":"application/json","Content-Encoding":"gzip"}}`,
				uploadServer.URL)
		case "/v1/me/shares/uploads/upload-123/finalize":
			if string(body) != "{}" {
				t.Errorf("finalize body = %q, want {}", body)
			}
			response.WriteHeader(http.StatusAccepted)
			_, _ = io.WriteString(response, `{"upload_id":"upload-123","status":"queued","run_id":"run-123"}`)
		default:
			http.NotFound(response, request)
		}
	}))
	defer apiServer.Close()

	client := NewClient(apiServer.URL)
	receipt, err := client.PublishShare(
		context.Background(), "access-token", base64.StdEncoding.EncodeToString(privateKey),
		map[string]string{"title": "Private transcript", "harness_id": "codex"},
	)
	if err != nil {
		t.Fatal(err)
	}
	if receipt.UploadID != "upload-123" || receipt.Status != "queued" {
		t.Fatalf("unexpected receipt: %+v", receipt)
	}
	reader, err := gzip.NewReader(bytesReader(uploaded))
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := io.ReadAll(reader)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Contains(decoded, []byte("Private transcript")) {
		t.Fatalf("uploaded payload was not the transcript: %s", decoded)
	}
}

func TestGetShareUploadStatusUsesDeviceBearer(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/v1/me/shares/uploads/upload-123" {
			http.NotFound(response, request)
			return
		}
		if request.Header.Get("Authorization") != "Bearer access-token" {
			t.Errorf("authorization = %q", request.Header.Get("Authorization"))
		}
		response.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(response, `{"upload_id":"upload-123","status":"failed","failure_code":"credentials_detected"}`)
	}))
	defer server.Close()

	status, err := NewClient(server.URL).GetShareUploadStatus(
		context.Background(), "access-token", "upload-123",
	)
	if err != nil {
		t.Fatal(err)
	}
	if status.UploadID != "upload-123" || status.Status != "failed" || status.FailureCode != "credentials_detected" {
		t.Fatalf("unexpected status: %+v", status)
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
