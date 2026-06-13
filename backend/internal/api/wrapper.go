package api

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"reflect"
	"strings"

	"budgeting_system/internal/service"

	"go.uber.org/zap"
)

type requestKeyType struct{}

var requestKey = requestKeyType{}

// PathValue retrieves path variables from context using the original request.
func PathValue(ctx context.Context, name string) string {
	r, ok := ctx.Value(requestKey).(*http.Request)
	if !ok || r == nil {
		return ""
	}
	return r.PathValue(name)
}

// RequestFromContext retrieves the original http.Request from context if needed.
func RequestFromContext(ctx context.Context) *http.Request {
	r, _ := ctx.Value(requestKey).(*http.Request)
	return r
}

type responseWriterKeyType struct{}

var responseWriterKey = responseWriterKeyType{}

// MakeHandler is a generic wrapper to transform service-style handler functions into http.HandlerFunc.
func MakeHandler[Req any, Resp any](h func(ctx context.Context, req Req) (Resp, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := context.WithValue(r.Context(), requestKey, r)
		ctx = context.WithValue(ctx, responseWriterKey, w)

		var req Req

		// Decode body if there is one and Req is not an empty struct
		if r.Body != nil && r.ContentLength != 0 && reflect.TypeOf(req).Kind() == reflect.Struct && reflect.TypeOf(req).NumField() > 0 {
			err := json.NewDecoder(r.Body).Decode(&req)
			if err != nil && !errors.Is(err, io.EOF) {
				respondError(w, http.StatusBadRequest, "invalid request body")
				return
			}
		}

		resp, err := h(ctx, req)
		if err != nil {
			handleWrapperError(w, err)
			return
		}

		// If the response is nil, we write 200 OK or 204 No Content
		if reflect.ValueOf(resp).Kind() == reflect.Ptr && reflect.ValueOf(resp).IsNil() {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		// Check if we need to return a specific status code (e.g. 201 Created)
		// By default we return 200 OK.
		status := http.StatusOK
		if r.Method == http.MethodPost {
			path := r.URL.Path
			if strings.HasSuffix(path, "/register") ||
				strings.HasSuffix(path, "/budgets") ||
				strings.HasSuffix(path, "/accounts") ||
				strings.HasSuffix(path, "/categories") ||
				strings.HasSuffix(path, "/transactions") {
				status = http.StatusCreated
			}
		}

		respondJSON(w, status, resp)
	}
}

// handleWrapperError maps service errors to correct HTTP responses and logs internal errors.
func handleWrapperError(w http.ResponseWriter, err error) {
	if errors.Is(err, service.ErrNotFound) {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}
	if errors.Is(err, service.ErrUnauthorized) {
		respondError(w, http.StatusUnauthorized, err.Error())
		return
	}
	if errors.Is(err, service.ErrForbidden) {
		respondError(w, http.StatusForbidden, err.Error())
		return
	}
	if errors.Is(err, service.ErrConflict) {
		respondError(w, http.StatusConflict, err.Error())
		return
	}
	if errors.Is(err, service.ErrBadRequest) {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Internal server errors
	zap.S().Errorf("API Internal Error: %v", err)
	respondError(w, http.StatusInternalServerError, "internal server error")
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		_ = json.NewEncoder(w).Encode(data)
	}
}

func respondError(w http.ResponseWriter, status int, message string) {
	// Trim custom error prefixes to show clean message
	cleanMsg := message
	for _, prefix := range []string{"resource not found: ", "bad request: ", "conflict: ", "unauthorized: ", "forbidden: "} {
		if len(message) > len(prefix) && message[:len(prefix)] == prefix {
			cleanMsg = message[len(prefix):]
			break
		}
	}
	// Fallback to simple mapping if it's nested
	if idx := lastIndex(cleanMsg, ": "); idx != -1 {
		cleanMsg = cleanMsg[idx+2:]
	}
	respondJSON(w, status, map[string]string{"error": cleanMsg})
}

func lastIndex(s, substr string) int {
	for i := len(s) - len(substr); i >= 0; i-- {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}
