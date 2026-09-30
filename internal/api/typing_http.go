// SPDX-License-Identifier: AGPL-3.0-only

package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/GoreeCloud/goreecloud-messenger/internal/domain"
	messagingservice "github.com/GoreeCloud/goreecloud-messenger/internal/service"
)

// TypingHTTPHandler exposes content-free ephemeral typing presence.
type TypingHTTPHandler struct {
	service *messagingservice.TypingService
	auth    Authenticator
}

func NewTypingHTTPHandler(service *messagingservice.TypingService, auth Authenticator) (*TypingHTTPHandler, error) {
	if service == nil {
		return nil, errors.New("typing service is required")
	}
	if auth == nil {
		return nil, errors.New("authenticator is required")
	}
	return &TypingHTTPHandler{service: service, auth: auth}, nil
}

func (h *TypingHTTPHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /v1/data/conversations/{conversationID}/typing", h.publish)
	mux.HandleFunc("GET /v1/data/conversations/{conversationID}/typing", h.list)
}

func (h *TypingHTTPHandler) Routes() http.Handler {
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)
	return mux
}

type typingRequest struct {
	Sequence uint64             `json:"sequence"`
	State    domain.TypingState `json:"state"`
}

type typingResponse struct {
	UserID    string    `json:"user_id"`
	Sequence  uint64    `json:"sequence"`
	ExpiresAt time.Time `json:"expires_at"`
}

func (h *TypingHTTPHandler) publish(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBodyBytes)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	var input typingRequest
	if err := decoder.Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if hasUnexpectedTrailingJSON(decoder) {
		writeError(w, http.StatusBadRequest, "request body must contain one JSON object")
		return
	}

	// The authenticated runtime is the only authority for the typing actor.
	// The request body intentionally carries no user identity field.
	signal := domain.TypingSignal{
		ConversationID: strings.TrimSpace(r.PathValue("conversationID")),
		UserID:         userID,
		Sequence:       input.Sequence,
		State:          input.State,
	}
	if err := h.service.Publish(r.Context(), userID, signal); err != nil {
		writeTypingServiceError(w, err)
		return
	}
	w.WriteHeader(http.StatusAccepted)
}

func (h *TypingHTTPHandler) list(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		return
	}

	active, err := h.service.List(r.Context(), userID, strings.TrimSpace(r.PathValue("conversationID")))
	if err != nil {
		writeTypingServiceError(w, err)
		return
	}
	response := make([]typingResponse, 0, len(active))
	for _, indicator := range active {
		response = append(response, typingResponse{
			UserID:    indicator.UserID,
			Sequence:  indicator.Sequence,
			ExpiresAt: indicator.ExpiresAt,
		})
	}
	writeJSON(w, http.StatusOK, response)
}

func (h *TypingHTTPHandler) authenticate(w http.ResponseWriter, r *http.Request) (string, bool) {
	userID, err := h.auth.Authenticate(r.Context(), r)
	if err != nil || strings.TrimSpace(userID) == "" {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return "", false
	}
	return userID, true
}

func writeTypingServiceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, messagingservice.ErrConversationAccess):
		writeError(w, http.StatusForbidden, "conversation access denied")
	case errors.Is(err, messagingservice.ErrTypingUserMismatch):
		writeError(w, http.StatusForbidden, "typing user does not match authenticated user")
	case errors.Is(err, messagingservice.ErrTypingPrivacyDenied):
		writeError(w, http.StatusForbidden, "typing indicator disabled by privacy policy")
	case errors.Is(err, messagingservice.ErrTypingStaleSignal):
		writeError(w, http.StatusConflict, "typing signal conflicts with newer state")
	default:
		writeError(w, http.StatusBadRequest, "typing signal rejected")
	}
}
