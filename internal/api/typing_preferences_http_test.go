// SPDX-License-Identifier: AGPL-3.0-only

package api

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/GoreeCloud/goreecloud-messenger/internal/domain"
	messagingservice "github.com/GoreeCloud/goreecloud-messenger/internal/service"
)

type typingPreferencesAuthenticator struct{ userID string }

func (a typingPreferencesAuthenticator) Authenticate(context.Context, *http.Request) (string, error) {
	return a.userID, nil
}

func typingPreferenceTestService(t *testing.T) (*messagingservice.TypingPrivacyPreferenceService, *messagingservice.MemoryTypingPrivacyPolicy) {
	t.Helper()
	access := messagingservice.NewMemoryConversationAccess()
	if err := access.SetConversation(domain.Conversation{
		ID:             "conversation-a",
		Kind:           domain.ConversationDirect,
		ParticipantIDs: []string{"user-a", "user-b"},
	}); err != nil {
		t.Fatal(err)
	}
	policy := messagingservice.NewMemoryTypingPrivacyPolicy(true)
	service, err := messagingservice.NewTypingPrivacyPreferenceService(policy, access)
	if err != nil {
		t.Fatal(err)
	}
	return service, policy
}

func TestTypingPreferencesHTTPGetsAndUpdatesAuthenticatedParticipantChoices(t *testing.T) {
	service, _ := typingPreferenceTestService(t)
	handler, err := NewTypingPreferencesHTTPHandler(service, typingPreferencesAuthenticator{userID: "user-a"})
	if err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	put := httptest.NewRequest(http.MethodPut, "/v1/data/conversations/conversation-a/typing/preferences", strings.NewReader(`{"publish_typing":false,"observe_typing":true}`))
	putRecorder := httptest.NewRecorder()
	mux.ServeHTTP(putRecorder, put)
	if putRecorder.Code != http.StatusOK {
		t.Fatalf("expected %d, got %d: %s", http.StatusOK, putRecorder.Code, putRecorder.Body.String())
	}
	if got := strings.TrimSpace(putRecorder.Body.String()); got != `{"publish_typing":false,"observe_typing":true}` {
		t.Fatalf("unexpected minimized response: %s", got)
	}

	get := httptest.NewRequest(http.MethodGet, "/v1/data/conversations/conversation-a/typing/preferences", nil)
	getRecorder := httptest.NewRecorder()
	mux.ServeHTTP(getRecorder, get)
	if getRecorder.Code != http.StatusOK {
		t.Fatalf("expected %d, got %d: %s", http.StatusOK, getRecorder.Code, getRecorder.Body.String())
	}
	if got := strings.TrimSpace(getRecorder.Body.String()); got != `{"publish_typing":false,"observe_typing":true}` {
		t.Fatalf("unexpected preference response: %s", got)
	}
}

func TestTypingPreferencesHTTPRejectsClientSuppliedIdentityAndOutsiders(t *testing.T) {
	service, _ := typingPreferenceTestService(t)

	participant, err := NewTypingPreferencesHTTPHandler(service, typingPreferencesAuthenticator{userID: "user-a"})
	if err != nil {
		t.Fatal(err)
	}
	participantMux := http.NewServeMux()
	participant.RegisterRoutes(participantMux)
	request := httptest.NewRequest(
		http.MethodPut,
		"/v1/data/conversations/conversation-a/typing/preferences",
		bytes.NewBufferString(`{"publish_typing":true,"observe_typing":true,"user_id":"user-b"}`),
	)
	recorder := httptest.NewRecorder()
	participantMux.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected unknown identity field to fail with %d, got %d", http.StatusBadRequest, recorder.Code)
	}

	outsider, err := NewTypingPreferencesHTTPHandler(service, typingPreferencesAuthenticator{userID: "outsider"})
	if err != nil {
		t.Fatal(err)
	}
	outsiderMux := http.NewServeMux()
	outsider.RegisterRoutes(outsiderMux)
	outsideRequest := httptest.NewRequest(http.MethodGet, "/v1/data/conversations/conversation-a/typing/preferences", nil)
	outsideRecorder := httptest.NewRecorder()
	outsiderMux.ServeHTTP(outsideRecorder, outsideRequest)
	if outsideRecorder.Code != http.StatusForbidden {
		t.Fatalf("expected outsider to fail with %d, got %d", http.StatusForbidden, outsideRecorder.Code)
	}

}

func TestTypingPreferencesHTTPDeleteResetsAuthenticatedParticipantToDefault(t *testing.T) {
	service, _ := typingPreferenceTestService(t)
	handler, err := NewTypingPreferencesHTTPHandler(
		service,
		typingPreferencesAuthenticator{userID: "user-a"},
	)
	if err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	put := httptest.NewRequest(
		http.MethodPut,
		"/v1/data/conversations/conversation-a/typing/preferences",
		strings.NewReader(`{"publish_typing":false,"observe_typing":false}`),
	)
	putRecorder := httptest.NewRecorder()
	mux.ServeHTTP(putRecorder, put)
	if putRecorder.Code != http.StatusOK {
		t.Fatalf("expected update success, got %d", putRecorder.Code)
	}

	reset := httptest.NewRequest(
		http.MethodDelete,
		"/v1/data/conversations/conversation-a/typing/preferences",
		nil,
	)
	resetRecorder := httptest.NewRecorder()
	mux.ServeHTTP(resetRecorder, reset)
	if resetRecorder.Code != http.StatusOK {
		t.Fatalf("expected reset success, got %d: %s", resetRecorder.Code, resetRecorder.Body.String())
	}
	if got := strings.TrimSpace(resetRecorder.Body.String()); got !=
		`{"publish_typing":true,"observe_typing":true}` {
		t.Fatalf("unexpected reset response: %s", got)
	}
}
