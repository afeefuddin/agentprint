package sync

import (
	"bytes"
	"compress/gzip"
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/agentprint/agentprint/cli/internal/adapters"
	"github.com/agentprint/agentprint/cli/internal/store"
	"github.com/google/uuid"
)

type Client struct {
	BaseURL    string
	HTTPClient *http.Client
}

type DeviceCode struct {
	DeviceCode              string `json:"device_code"`
	UserCode                string `json:"user_code"`
	VerificationURI         string `json:"verification_uri"`
	VerificationURIComplete string `json:"verification_uri_complete"`
	ExpiresIn               int    `json:"expires_in"`
	Interval                int    `json:"interval"`
}

type TokenResponse struct {
	RegistrationToken string `json:"registration_token"`
}

type RegisteredDevice struct {
	DeviceID    string `json:"device_id"`
	AccessToken string `json:"access_token"`
}

type Source struct {
	HarnessID string `json:"harness_id"`
	Version   string `json:"version,omitempty"`
}

type Receipt struct {
	BatchID        string `json:"batch_id"`
	Acknowledgment string `json:"acknowledgement"`
	Accepted       int    `json:"accepted"`
	Duplicate      int    `json:"duplicate"`
	Rejected       int    `json:"rejected"`
	Replay         bool   `json:"replay"`
}

type apiError struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

func NewClient(baseURL string) *Client {
	return &Client{
		BaseURL:    strings.TrimRight(baseURL, "/"),
		HTTPClient: &http.Client{Timeout: 20 * time.Second},
	}
}

func (client *Client) request(ctx context.Context, method, path string, body any, credential string, result any) error {
	var reader io.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(encoded)
	}
	request, err := http.NewRequestWithContext(ctx, method, client.BaseURL+path, reader)
	if err != nil {
		return err
	}
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	if credential != "" {
		request.Header.Set("Authorization", "Bearer "+credential)
	}
	response, err := client.HTTPClient.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	payload, err := io.ReadAll(io.LimitReader(response.Body, 2*1024*1024))
	if err != nil {
		return err
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		var failure apiError
		_ = json.Unmarshal(payload, &failure)
		if failure.Error == "" {
			failure.Error = response.Status
		}
		return fmt.Errorf("%s: %s", failure.Error, failure.Message)
	}
	if result != nil && len(payload) > 0 {
		return json.Unmarshal(payload, result)
	}
	return nil
}

func (client *Client) StartDeviceFlow(ctx context.Context) (DeviceCode, error) {
	var result DeviceCode
	err := client.request(ctx, http.MethodPost, "/v1/device/code", map[string]string{
		"client_name": "Agentprint CLI",
	}, "", &result)
	return result, err
}

func (client *Client) PollDeviceFlow(ctx context.Context, code DeviceCode) (string, error) {
	interval := time.Duration(max(code.Interval, 1)) * time.Second
	deadline := time.NewTimer(time.Duration(code.ExpiresIn) * time.Second)
	defer deadline.Stop()
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return "", ctx.Err()
		case <-deadline.C:
			return "", errors.New("device code expired")
		case <-ticker.C:
			var result TokenResponse
			err := client.request(ctx, http.MethodPost, "/v1/device/token", map[string]string{
				"device_code": code.DeviceCode,
			}, "", &result)
			if err != nil && strings.Contains(err.Error(), "authorization_pending") {
				continue
			}
			if err != nil {
				return "", err
			}
			return result.RegistrationToken, nil
		}
	}
}

func (client *Client) RegisterDevice(ctx context.Context, registrationToken, name, platform, version, signingPublicKey string, sources []Source) (RegisteredDevice, error) {
	var result RegisteredDevice
	err := client.request(ctx, http.MethodPost, "/v1/devices/register", map[string]any{
		"registration_token": registrationToken,
		"name":               name,
		"platform":           platform,
		"agent_version":      version,
		"signing_public_key": signingPublicKey,
		"sources":            sources,
	}, "", &result)
	return result, err
}

func (client *Client) Sync(ctx context.Context, localStore *store.Store, credential, signingPrivateKey, timezone string) (Receipt, error) {
	pending, err := localStore.Pending(ctx, 2_000)
	if err != nil {
		return Receipt{}, err
	}
	if len(pending) == 0 {
		return Receipt{}, nil
	}
	records := make([]adapters.UsageRecord, len(pending))
	ids := make([]int64, len(pending))
	for index, item := range pending {
		records[index] = item.Record
		ids[index] = item.ID
	}
	batchID := uuid.NewString()
	payload, err := json.Marshal(map[string]any{
		"batch_id":       batchID,
		"schema_version": 1,
		"timezone":       timezone,
		"records":        records,
	})
	if err != nil {
		return Receipt{}, err
	}
	var compressed bytes.Buffer
	writer := gzip.NewWriter(&compressed)
	if _, err := writer.Write(payload); err != nil {
		return Receipt{}, err
	}
	if err := writer.Close(); err != nil {
		return Receipt{}, err
	}
	privateKey, err := base64.StdEncoding.DecodeString(signingPrivateKey)
	if err != nil || len(privateKey) != ed25519.PrivateKeySize {
		return Receipt{}, errors.New("invalid signing private key in OS keychain")
	}
	timestamp := fmt.Sprint(time.Now().Unix())
	signed := append([]byte(timestamp+"."), compressed.Bytes()...)
	signature := ed25519.Sign(ed25519.PrivateKey(privateKey), signed)
	request, err := http.NewRequestWithContext(
		ctx, http.MethodPost, client.BaseURL+"/v1/sync/batches", bytes.NewReader(compressed.Bytes()),
	)
	if err != nil {
		return Receipt{}, err
	}
	request.Header.Set("Authorization", "Bearer "+credential)
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Content-Encoding", "gzip")
	request.Header.Set("X-Agentprint-Timestamp", timestamp)
	request.Header.Set("X-Agentprint-Signature", base64.StdEncoding.EncodeToString(signature))
	response, err := client.HTTPClient.Do(request)
	if err != nil {
		return Receipt{}, err
	}
	defer response.Body.Close()
	responseBody, err := io.ReadAll(io.LimitReader(response.Body, 2*1024*1024))
	if err != nil {
		return Receipt{}, err
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		var failure apiError
		_ = json.Unmarshal(responseBody, &failure)
		return Receipt{}, fmt.Errorf("%s: %s", failure.Error, failure.Message)
	}
	var receipt Receipt
	if err := json.Unmarshal(responseBody, &receipt); err != nil {
		return Receipt{}, err
	}
	if receipt.Rejected > 0 {
		return receipt, fmt.Errorf("server rejected %d records; queue retained", receipt.Rejected)
	}
	detail, _ := json.Marshal(receipt)
	if err := localStore.Acknowledge(ctx, batchID, ids, string(detail)); err != nil {
		return receipt, err
	}
	return receipt, nil
}

func (client *Client) SyncAll(ctx context.Context, localStore *store.Store, credential, signingPrivateKey, timezone string) (Receipt, error) {
	var total Receipt
	for {
		pending, err := localStore.PendingCount()
		if err != nil {
			return total, err
		}
		if pending == 0 {
			return total, nil
		}

		var receipt Receipt
		var syncErr error
		for attempt := 0; attempt < 4; attempt++ {
			receipt, syncErr = client.Sync(ctx, localStore, credential, signingPrivateKey, timezone)
			if syncErr == nil {
				break
			}
			if attempt < 3 {
				delay := time.Duration(1<<attempt) * time.Second
				select {
				case <-ctx.Done():
					return total, ctx.Err()
				case <-time.After(delay):
				}
			}
		}
		if syncErr != nil {
			return total, syncErr
		}
		total.Accepted += receipt.Accepted
		total.Duplicate += receipt.Duplicate
		total.Rejected += receipt.Rejected
		total.Replay = total.Replay || receipt.Replay
	}
}

func (client *Client) Revoke(ctx context.Context, credential string) error {
	return client.request(ctx, http.MethodDelete, "/v1/device", nil, credential, nil)
}

/* Session sharing. */

type ShareReceipt struct {
	UploadID string `json:"upload_id"`
	Status   string `json:"status"`
	RunID    string `json:"run_id"`
}

type ShareUploadStatus struct {
	UploadID    string `json:"upload_id"`
	Status      string `json:"status"`
	FailureCode string `json:"failure_code"`
	ShareID     string `json:"share_id"`
	ShareURL    string `json:"share_url"`
	ExpiresAt   string `json:"expires_at"`
}

type ShareEntry struct {
	ID         string `json:"id"`
	Slug       string `json:"slug"`
	HarnessID  string `json:"harness_id"`
	Title      string `json:"title"`
	Visibility string `json:"visibility"`
	TurnCount  int    `json:"turn_count"`
	ViewCount  string `json:"view_count"`
	Published  string `json:"published_at"`
}

type shareUploadReservation struct {
	UploadID  string            `json:"upload_id"`
	UploadURL string            `json:"upload_url"`
	Fields    map[string]string `json:"fields"`
}

func signedDeviceRequest(
	ctx context.Context,
	method string,
	url string,
	body []byte,
	credential string,
	signingPrivateKey string,
) (*http.Request, error) {
	privateKey, err := base64.StdEncoding.DecodeString(signingPrivateKey)
	if err != nil || len(privateKey) != ed25519.PrivateKeySize {
		return nil, errors.New("invalid signing private key in OS keychain")
	}
	timestamp := fmt.Sprint(time.Now().Unix())
	signature := ed25519.Sign(
		ed25519.PrivateKey(privateKey),
		append([]byte(timestamp+"."), body...),
	)
	request, err := http.NewRequestWithContext(ctx, method, url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	request.Header.Set("Authorization", "Bearer "+credential)
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Agentprint-Timestamp", timestamp)
	request.Header.Set("X-Agentprint-Signature", base64.StdEncoding.EncodeToString(signature))
	return request, nil
}

func shareAPIError(response *http.Response) error {
	body, err := io.ReadAll(io.LimitReader(response.Body, 1024*1024))
	if err != nil {
		return err
	}
	var failure struct {
		Error    string   `json:"error"`
		Message  string   `json:"message"`
		Detected []string `json:"detected"`
	}
	_ = json.Unmarshal(body, &failure)
	if len(failure.Detected) > 0 {
		return fmt.Errorf("%s: %s (%s)", failure.Error, failure.Message, strings.Join(failure.Detected, ", "))
	}
	if failure.Error == "" {
		failure.Error = response.Status
	}
	return fmt.Errorf("%s: %s", failure.Error, failure.Message)
}

// PublishShare reserves a bounded object, uploads the signed payload directly
// to private object storage, then queues asynchronous publication. The web
// request path sees only small authenticated control messages.
func (client *Client) PublishShare(ctx context.Context, credential, signingPrivateKey string, share any) (ShareReceipt, error) {
	payload, err := json.Marshal(share)
	if err != nil {
		return ShareReceipt{}, err
	}
	var compressed bytes.Buffer
	writer := gzip.NewWriter(&compressed)
	if _, err := writer.Write(payload); err != nil {
		return ShareReceipt{}, err
	}
	if err := writer.Close(); err != nil {
		return ShareReceipt{}, err
	}
	digest := sha256.Sum256(compressed.Bytes())
	reservationBody, err := json.Marshal(map[string]any{
		"content_length": len(compressed.Bytes()),
		"content_sha256": fmt.Sprintf("%x", digest),
	})
	if err != nil {
		return ShareReceipt{}, err
	}
	reservationRequest, err := signedDeviceRequest(
		ctx, http.MethodPost, client.BaseURL+"/v1/me/shares/uploads",
		reservationBody, credential, signingPrivateKey,
	)
	if err != nil {
		return ShareReceipt{}, err
	}
	reservationResponse, err := client.HTTPClient.Do(reservationRequest)
	if err != nil {
		return ShareReceipt{}, err
	}
	defer reservationResponse.Body.Close()
	if reservationResponse.StatusCode < 200 || reservationResponse.StatusCode >= 300 {
		return ShareReceipt{}, shareAPIError(reservationResponse)
	}
	var reservation shareUploadReservation
	if err := json.NewDecoder(io.LimitReader(reservationResponse.Body, 1024*1024)).Decode(&reservation); err != nil {
		return ShareReceipt{}, err
	}
	if reservation.UploadID == "" || reservation.UploadURL == "" {
		return ShareReceipt{}, errors.New("the server returned an incomplete upload reservation")
	}

	var uploadForm bytes.Buffer
	formWriter := multipart.NewWriter(&uploadForm)
	for name, value := range reservation.Fields {
		if err := formWriter.WriteField(name, value); err != nil {
			return ShareReceipt{}, err
		}
	}
	filePart, err := formWriter.CreateFormFile("file", "session.json.gz")
	if err != nil {
		return ShareReceipt{}, err
	}
	if _, err := filePart.Write(compressed.Bytes()); err != nil {
		return ShareReceipt{}, err
	}
	if err := formWriter.Close(); err != nil {
		return ShareReceipt{}, err
	}
	uploadRequest, err := http.NewRequestWithContext(
		ctx, http.MethodPost, reservation.UploadURL, &uploadForm,
	)
	if err != nil {
		return ShareReceipt{}, err
	}
	uploadRequest.Header.Set("Content-Type", formWriter.FormDataContentType())
	uploadClient := &http.Client{
		Transport:     client.HTTPClient.Transport,
		CheckRedirect: client.HTTPClient.CheckRedirect,
		Jar:           client.HTTPClient.Jar,
		Timeout:       90 * time.Second,
	}
	uploadResponse, err := uploadClient.Do(uploadRequest)
	if err != nil {
		return ShareReceipt{}, err
	}
	defer uploadResponse.Body.Close()
	if uploadResponse.StatusCode < 200 || uploadResponse.StatusCode >= 300 {
		_, _ = io.Copy(io.Discard, io.LimitReader(uploadResponse.Body, 1024*1024))
		return ShareReceipt{}, fmt.Errorf("object upload failed: %s", uploadResponse.Status)
	}

	finalizeBody := []byte("{}")
	finalizeRequest, err := signedDeviceRequest(
		ctx, http.MethodPost,
		client.BaseURL+"/v1/me/shares/uploads/"+reservation.UploadID+"/finalize",
		finalizeBody, credential, signingPrivateKey,
	)
	if err != nil {
		return ShareReceipt{}, err
	}
	finalizeResponse, err := client.HTTPClient.Do(finalizeRequest)
	if err != nil {
		return ShareReceipt{}, err
	}
	defer finalizeResponse.Body.Close()
	if finalizeResponse.StatusCode < 200 || finalizeResponse.StatusCode >= 300 {
		return ShareReceipt{}, shareAPIError(finalizeResponse)
	}
	var receipt ShareReceipt
	if err := json.NewDecoder(io.LimitReader(finalizeResponse.Body, 1024*1024)).Decode(&receipt); err != nil {
		return ShareReceipt{}, err
	}
	return receipt, nil
}

func (client *Client) ListShares(ctx context.Context, credential string) ([]ShareEntry, error) {
	var result struct {
		Shares []ShareEntry `json:"shares"`
	}
	err := client.request(ctx, http.MethodGet, "/v1/me/shares", nil, credential, &result)
	return result.Shares, err
}

func (client *Client) GetShareUploadStatus(ctx context.Context, credential, uploadID string) (ShareUploadStatus, error) {
	var result ShareUploadStatus
	err := client.request(
		ctx,
		http.MethodGet,
		"/v1/me/shares/uploads/"+url.PathEscape(uploadID),
		nil,
		credential,
		&result,
	)
	return result, err
}

func (client *Client) RevokeShare(ctx context.Context, credential, id string) error {
	return client.request(ctx, http.MethodDelete, "/v1/me/shares/"+id, nil, credential, nil)
}
