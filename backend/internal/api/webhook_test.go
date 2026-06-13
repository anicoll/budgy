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

	"github.com/stretchr/testify/assert"
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
	// Set the webhook secret in env for the test
	secret := "whsec_dGhlIHF1aWNrIGJyb3duIGZveA=="
	rawSecret := "the quick brown fox"
	os.Setenv("BASIQ_WEBHOOK_SECRET", secret)
	defer os.Unsetenv("BASIQ_WEBHOOK_SECRET")

	server := NewAPIServer(nil, nil, nil, nil, nil, nil)

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

	// 1. Success case
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

	// 2. Unauthorized case (invalid signature)
	reqBadSig := httptest.NewRequest("POST", "/api/webhooks/basiq", bytes.NewReader(body))
	reqBadSig.Header.Set("webhook-id", webhookID)
	reqBadSig.Header.Set("webhook-timestamp", timestamp)
	reqBadSig.Header.Set("webhook-signature", "v1,invalidBase64String")
	wBadSig := httptest.NewRecorder()

	server.handleBasiqWebhook(wBadSig, reqBadSig)
	assert.Equal(t, http.StatusUnauthorized, wBadSig.Code)

	// 3. Bad Request case (missing headers)
	reqMissingHeaders := httptest.NewRequest("POST", "/api/webhooks/basiq", bytes.NewReader(body))
	wMissingHeaders := httptest.NewRecorder()

	server.handleBasiqWebhook(wMissingHeaders, reqMissingHeaders)
	assert.Equal(t, http.StatusBadRequest, wMissingHeaders.Code)

	// 4. Bad Request case (malformed JSON with valid signature)
	malformedBody := []byte("{malformed_json}")
	signedContentMalformed := webhookID + "." + timestamp + "." + string(malformedBody)
	macMalformed := hmac.New(sha256.New, []byte(rawSecret))
	macMalformed.Write([]byte(signedContentMalformed))
	validSigHeaderMalformed := "v1," + base64.StdEncoding.EncodeToString(macMalformed.Sum(nil))

	reqMalformed := httptest.NewRequest("POST", "/api/webhooks/basiq", bytes.NewReader(malformedBody))
	reqMalformed.Header.Set("webhook-id", webhookID)
	reqMalformed.Header.Set("webhook-timestamp", timestamp)
	reqMalformed.Header.Set("webhook-signature", validSigHeaderMalformed)
	wMalformed := httptest.NewRecorder()

	server.handleBasiqWebhook(wMalformed, reqMalformed)
	assert.Equal(t, http.StatusBadRequest, wMalformed.Code)
}
