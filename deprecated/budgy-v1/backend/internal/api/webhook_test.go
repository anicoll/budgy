package api

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"testing"
	"time"

	"budgeting_system/internal/domain"
	"budgeting_system/internal/service/mocks"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestVerifyBasiqSignature(t *testing.T) {
	secret := "whsec_dGhlIHF1aWNrIGJyb3duIGZveA==" // decoded base64: "the quick brown fox"
	rawSecret := "the quick brown fox"

	body := []byte(`{"id":"msg_123","event":"user.created"}`)
	webhookID := "msg_123"
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)

	// 1. Valid signature
	signedContent := webhookID + "." + timestamp + "." + string(body)
	mac := hmac.New(sha256.New, []byte(rawSecret))
	mac.Write([]byte(signedContent))
	signatureBytes := mac.Sum(nil)
	validSigHeader := "v1," + base64.StdEncoding.EncodeToString(signatureBytes)

	ok, err := verifyBasiqSignature(webhookID, timestamp, validSigHeader, secret, body)
	assert.True(t, ok)
	assert.NoError(t, err)

	// 2. Invalid signature (altered body)
	alteredBody := []byte(`{"id":"msg_123","event":"user.updated"}`)
	ok, err = verifyBasiqSignature(webhookID, timestamp, validSigHeader, secret, alteredBody)
	assert.False(t, ok)
	assert.Error(t, err)

	// 3. Expired timestamp
	oldTimestamp := strconv.FormatInt(time.Now().Unix()-600, 10) // 10 minutes ago
	expiredSignedContent := webhookID + "." + oldTimestamp + "." + string(body)
	macOld := hmac.New(sha256.New, []byte(rawSecret))
	macOld.Write([]byte(expiredSignedContent))
	expiredSigHeader := "v1," + base64.StdEncoding.EncodeToString(macOld.Sum(nil))

	ok, err = verifyBasiqSignature(webhookID, oldTimestamp, expiredSigHeader, secret, body)
	assert.False(t, ok)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "too far in the past or future")
}

func TestHandleBasiqWebhook(t *testing.T) {
	secret := "whsec_dGhlIHF1aWNrIGJyb3duIGZveA=="
	rawSecret := "the quick brown fox"
	os.Setenv("BASIQ_WEBHOOK_SECRET", secret)
	defer os.Unsetenv("BASIQ_WEBHOOK_SECRET")

	mockAuth := mocks.NewMockAuthService(t)
	mockBankSync := mocks.NewMockBankSyncService(t)
	server := NewAPIServer(mockAuth, nil, nil, nil, nil, mockBankSync, nil)

	body := []byte(`{
		"id": "11a85f64-5717-4562-b3fc-2c963f66af11",
		"webhookId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
		"event": "user.created",
		"eventTypeId": "user.created",
		"eventId": "44a85f64-5717-4562-b3fc-2c963f66af44",
		"payload": {
			"eventId": "44a85f64-5717-4562-b3fc-2c963f66af44",
			"eventTypeId": "user.created",
			"links": {
				"self": "https://au-api.basiq.io/events/44a85f64-5717-4562-b3fc-2c963f66af44"
			}
		},
		"attempts": ["2026-06-13T12:00:00Z"]
	}`)

	webhookID := "11a85f64-5717-4562-b3fc-2c963f66af11"
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)

	// Compute signature
	signedContent := webhookID + "." + timestamp + "." + string(body)
	mac := hmac.New(sha256.New, []byte(rawSecret))
	mac.Write([]byte(signedContent))
	validSigHeader := "v1," + base64.StdEncoding.EncodeToString(mac.Sum(nil))

	// 1. Success case (no user link)
	req := httptest.NewRequest("POST", "/api/webhooks/basiq", bytes.NewReader(body))
	req.Header.Set("webhook-id", webhookID)
	req.Header.Set("webhook-timestamp", timestamp)
	req.Header.Set("webhook-signature", validSigHeader)
	w := httptest.NewRecorder()

	server.handleBasiqWebhook(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	var resp map[string]string
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	assert.NoError(t, err)
	assert.Equal(t, "received", resp["status"])

	// 2. Success case (with user link and user sync)
	bodyWithUser := []byte(`{
		"id": "11a85f64-5717-4562-b3fc-2c963f66af11",
		"webhookId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
		"event": "user.created",
		"eventTypeId": "user.created",
		"eventId": "44a85f64-5717-4562-b3fc-2c963f66af44",
		"payload": {
			"eventId": "44a85f64-5717-4562-b3fc-2c963f66af44",
			"eventTypeId": "user.created",
			"links": {
				"self": "https://au-api.basiq.io/events/44a85f64-5717-4562-b3fc-2c963f66af44",
				"user": "https://au-api.basiq.io/users/basiq-user-123"
			}
		},
		"attempts": ["2026-06-13T12:00:00Z"]
	}`)

	signedContentUser := webhookID + "." + timestamp + "." + string(bodyWithUser)
	macUser := hmac.New(sha256.New, []byte(rawSecret))
	macUser.Write([]byte(signedContentUser))
	validSigHeaderUser := "v1," + base64.StdEncoding.EncodeToString(macUser.Sum(nil))

	mockAuth.On("GetUserByBasiqUserID", mock.Anything, "basiq-user-123").Return(&domain.User{ID: "local-user-123"}, nil)
	mockBankSync.On("SyncUser", mock.Anything, "local-user-123").Return(nil)

	reqUser := httptest.NewRequest("POST", "/api/webhooks/basiq", bytes.NewReader(bodyWithUser))
	reqUser.Header.Set("webhook-id", webhookID)
	reqUser.Header.Set("webhook-timestamp", timestamp)
	reqUser.Header.Set("webhook-signature", validSigHeaderUser)
	wUser := httptest.NewRecorder()

	server.handleBasiqWebhook(wUser, reqUser)
	assert.Equal(t, http.StatusOK, wUser.Code)

	// Sleep a tiny bit to let the background goroutine run
	time.Sleep(50 * time.Millisecond)
}
