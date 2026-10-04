// SPDX-License-Identifier: AGPL-3.0-only

package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	messagingservice "github.com/GoreeCloud/goreecloud-messenger/internal/service"
)

// TypingPreferencesHTTPHandler exposes only the authenticated participant's two
// content-free typing privacy choices for one conversation.
type TypingPreferencesHTTPHandler struct {
	service *messagingservice.TypingPrivacyPreferenceService
	auth    Authenticator
}

func NewTypingPreferencesHTTPHandler(
	service *messagingservice.TypingPrivacyPreferenceService,
	auth Authenticator,
) (*TypingPreferencesHTTPHandler, error) {
	if service == nil || auth == nil {
		return nil, errors.New("typing preference service and authenticator are required")
	}
	return &TypingPreferencesHTTPHandler{service: service, auth: auth}, nil
}

func (h *TypingPreferencesHTTPHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /v1/data/conversations/{conversationID}/typing/preferences", h.get)
	mux.HandleFunc("PUT /v1/data/conversations/{conversationID}/typing/preferences", h.put)
	mux.HandleFunc("DELETE /v1/data/conversations/{conversationID}/typing/preferences", h.delete)
}

type typingPreferencesRequest struct {
	PublishTyping bool `json:"publish_typing"`
	ObserveTyping bool `json:"observe_typing"`
}

type typingPreferencesResponse struct {
	PublishTyping bool `json:"publish_typing"`
	ObserveTyping bool `json:"observe_typing"`
	UsesDefault   bool `json:"uses_default"`
}

func (h *TypingPreferencesHTTPHandler) get(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		return
	}
	state, err := h.service.GetState(
		r.Context(),
		userID,
		strings.TrimSpace(r.PathValue("conversationID")),
	)
	if err != nil {
		writeTypingPreferenceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, typingPreferencesResponse{
		PublishTyping: state.Preferences.PublishTyping,
		ObserveTyping: state.Preferences.ObserveTyping,
		UsesDefault:   state.UsesDefault,
	})
}

func (h *TypingPreferencesHTTPHandler) put(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBodyBytes)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	var input typingPreferencesRequest
	if err := decoder.Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if decoder.Decode(&struct{}{}) == nil {
		writeError(w, http.StatusBadRequest, "request body must contain one JSON object")
		return
	}

	preferences, err := h.service.Update(
		r.Context(),
		userID,
		strings.TrimSpace(r.PathValue("conversationID")),
		messagingservice.TypingPrivacyPreferences{
			PublishTyping: input.PublishTyping,
			ObserveTyping: input.ObserveTyping,
		},
	)
	if err != nil {
		writeTypingPreferenceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, typingPreferencesResponse{
		PublishTyping: preferences.PublishTyping,
		ObserveTyping: preferences.ObserveTyping,
		UsesDefault:   false,
	})
}

func (h *TypingPreferencesHTTPHandler) delete(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		return
	}
	preferences, err := h.service.Reset(
		r.Context(),
		userID,
		strings.TrimSpace(r.PathValue("conversationID")),
	)
	if err != nil {
		writeTypingPreferenceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, typingPreferencesResponse{
		PublishTyping: preferences.PublishTyping,
		ObserveTyping: preferences.ObserveTyping,
		UsesDefault:   true,
	})
}

func (h *TypingPreferencesHTTPHandler) authenticate(w http.ResponseWriter, r *http.Request) (string, bool) {
	userID, err := h.auth.Authenticate(r.Context(), r)
	if err != nil || strings.TrimSpace(userID) == "" {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return "", false
	}
	return userID, true
}

func writeTypingPreferenceError(w http.ResponseWriter, err error) {
	if errors.Is(err, messagingservice.ErrConversationAccess) {
		writeError(w, http.StatusForbidden, "conversation access denied")
		return
	}
	writeError(w, http.StatusBadRequest, "typing privacy preference rejected")
}
