package api

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"go.uber.org/zap"
)

// WebhookPayload represents the inner payload details of a Basiq webhook message.
type WebhookPayload struct {
	EventID     string            `json:"eventId"`
	EventTypeID string            `json:"eventTypeId"`
	Links       map[string]string `json:"links"`
}

// WebhookMessage represents the structure of an incoming Basiq webhook notification.
type WebhookMessage struct {
	ID          string         `json:"id"`
	WebhookID   string         `json:"webhookId"`
	Event       string         `json:"event"`
	EventTypeID string         `json:"eventTypeId"`
	EventID     string         `json:"eventId"`
	Payload     WebhookPayload `json:"payload"`
	Attempts    []string       `json:"attempts"`
}

// verifyBasiqSignature validates the authenticity of a Basiq webhook message using HMAC-SHA256.
func verifyBasiqSignature(webhookID, timestamp, signatureHeader, secret string, rawBody []byte) (bool, error) {
	if secret == "" {
		// If no secret is configured, skip verification (useful for local development/testing)
		return true, nil
	}

	// 1. Replay attack check (5 minutes window)
	ts, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		return false, fmt.Errorf("invalid timestamp format: %w", err)
	}
	now := time.Now().Unix()
	diff := now - ts
	if diff < 0 {
		diff = -diff
	}
	if diff > 300 { // 5 minutes
		return false, fmt.Errorf("timestamp is too far in the past or future (diff: %ds)", diff)
	}

	// 2. Secret parsing (trim whsec_ prefix and base64 decode)
	cleanSecret := strings.TrimPrefix(secret, "whsec_")
	decodedSecret, err := base64.StdEncoding.DecodeString(cleanSecret)
	if err != nil {
		return false, fmt.Errorf("failed to decode signing secret: %w", err)
	}

	// 3. Compute expected signature
	// signedContent = webhook_id + "." + webhook_timestamp + "." + raw_payload
	signedContent := webhookID + "." + timestamp + "." + string(rawBody)
	mac := hmac.New(sha256.New, decodedSecret)
	mac.Write([]byte(signedContent))
	expectedSignature := mac.Sum(nil)

	// 4. Verify against signatures in header
	signatures := strings.Fields(signatureHeader)
	for _, sig := range signatures {
		parts := strings.SplitN(sig, ",", 2)
		if len(parts) == 2 && parts[0] == "v1" {
			sigBytes, err := base64.StdEncoding.DecodeString(parts[1])
			if err == nil && hmac.Equal(sigBytes, expectedSignature) {
				return true, nil
			}
		}
	}

	return false, fmt.Errorf("signature verification failed")
}

// handleBasiqWebhook handles incoming webhook requests from Basiq.
func (s *APIServer) handleBasiqWebhook(w http.ResponseWriter, r *http.Request) {
	// Read body
	rawBody, err := io.ReadAll(r.Body)
	if err != nil {
		respondError(w, http.StatusBadRequest, "failed to read request body")
		return
	}

	// Check signature secret config
	secret := os.Getenv("BASIQ_WEBHOOK_SECRET")

	// Extract headers if secret is set
	if secret != "" {
		webhookID := r.Header.Get("webhook-id")
		timestamp := r.Header.Get("webhook-timestamp")
		signatureHeader := r.Header.Get("webhook-signature")

		if webhookID == "" || timestamp == "" || signatureHeader == "" {
			respondError(w, http.StatusBadRequest, "missing required webhook security headers")
			return
		}

		if ok, err := verifyBasiqSignature(webhookID, timestamp, signatureHeader, secret, rawBody); !ok {
			respondError(w, http.StatusUnauthorized, fmt.Sprintf("unauthorized: %v", err))
			return
		}
	} else {
		zap.S().Warn("Warning: BASIQ_WEBHOOK_SECRET is not configured. Webhook signature verification is skipped.")
	}

	// Parse payload
	var msg WebhookMessage
	if err := json.Unmarshal(rawBody, &msg); err != nil {
		respondError(w, http.StatusBadRequest, "failed to parse webhook payload")
		return
	}

	// Log receipt
	zap.S().Debugf("Basiq Webhook Event Received and Verified: id=%s, event=%s, type=%s", msg.ID, msg.Event, msg.EventTypeID)

	var basiqUserID string
	if userLink, ok := msg.Payload.Links["user"]; ok && userLink != "" {
		parts := strings.Split(userLink, "/users/")
		if len(parts) > 1 {
			basiqUserID = parts[1]
		}
	}

	if basiqUserID != "" {
		localUser, err := s.auth.GetUserByBasiqUserID(r.Context(), basiqUserID)
		if err != nil {
			zap.S().Errorf("Basiq Webhook: failed to find user for basiq_user_id %s: %v", basiqUserID, err)
		} else {
			zap.S().Infof("Basiq Webhook: Triggering background sync for user %s (%s)", localUser.ID, basiqUserID)
			go func() {
				ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
				defer cancel()
				if err := s.bankSync.SyncUser(ctx, localUser.ID); err != nil {
					zap.S().Errorf("Basiq Webhook: failed to sync user %s: %v", localUser.ID, err)
				} else {
					zap.S().Infof("Basiq Webhook: successfully synced user %s", localUser.ID)
				}
			}()
		}
	} else {
		zap.S().Warn("Basiq Webhook: missing user link in payload")
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "received"})
}
