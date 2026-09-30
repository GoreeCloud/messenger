// SPDX-License-Identifier: AGPL-3.0-only

package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/GoreeCloud/goreecloud-messenger/internal/domain"
	messagingservice "github.com/GoreeCloud/goreecloud-messenger/internal/service"
)

func newTypingHTTPTestService(t *testing.T, now *time.Time) (*messagingservice.TypingService, *messagingservice.MemoryTypingPrivacyPolicy) {
	t.Helper()
	access := messagingservice.NewMemoryConversationAccess()
	if err := access.SetConversation(domain.Conversation{
		ID:             "conversation-typing-http",
		Kind:           domain.ConversationDirect,
		ParticipantIDs: []string{"user-1", "user-2"},
	}); err != nil {
		t.Fatalf("set conversation: %v", err)
	}
	policy := messagingservice.NewMemoryTypingPrivacyPolicy(true)
	service, err := messagingservice.NewTypingService(
		messagingservice.NewMemoryTypingStore(),
		access,
		policy,
		func() time.Time { return *now },
	)
	if err != nil {
		t.Fatalf("new typing service: %v", err)
	}
	return service, policy
}

func newTypingHTTPHandler(t *testing.T, service *messagingservice.TypingService, userID string) http.Handler {
	t.Helper()
	handler, err := NewTypingHTTPHandler(service, testAuthenticator{userID: userID})
	if err != nil {
		t.Fatalf("new typing handler: %v", err)
	}
	return handler.Routes()
}

func TestTypingHTTPPublishAndListMinimizedProjection(t *testing.T) {
	now := time.Date(2026, 8, 30, 21, 10, 0, 0, time.UTC)
	service, _ := newTypingHTTPTestService(t, &now)
	publisher := newTypingHTTPHandler(t, service, "user-1")
	observer := newTypingHTTPHandler(t, service, "user-2")

	publish := httptest.NewRequest(http.MethodPost, "/v1/data/conversations/conversation-typing-http/typing", strings.NewReader(`{"sequence":1,"state":"typing"}`))
	publishRecorder := httptest.NewRecorder()
	publisher.ServeHTTP(publishRecorder, publish)
	if publishRecorder.Code != http.StatusAccepted {
		t.Fatalf("publish status = %d, body = %s", publishRecorder.Code, publishRecorder.Body.String())
	}

	list := httptest.NewRequest(http.MethodGet, "/v1/data/conversations/conversation-typing-http/typing", nil)
	listRecorder := httptest.NewRecorder()
	observer.ServeHTTP(listRecorder, list)
	if listRecorder.Code != http.StatusOK {
		t.Fatalf("list status = %d, body = %s", listRecorder.Code, listRecorder.Body.String())
	}
	body := listRecorder.Body.String()
	if !strings.Contains(body, `"user_id":"user-1"`) || !strings.Contains(body, `"sequence":1`) || !strings.Contains(body, `"expires_at"`) {
		t.Fatalf("typing response missing active projection: %s", body)
	}
	for _, forbidden := range []string{"draft", "ciphertext", "client_nonce", `"state"`} {
		if strings.Contains(body, forbidden) {
			t.Fatalf("typing response exposed forbidden field %q: %s", forbidden, body)
		}
	}
}

func TestTypingHTTPIdleAndStaleSequence(t *testing.T) {
	now := time.Date(2026, 8, 30, 21, 10, 0, 0, time.UTC)
	service, _ := newTypingHTTPTestService(t, &now)
	handler := newTypingHTTPHandler(t, service, "user-1")

	for _, body := range []string{
		`{"sequence":2,"state":"typing"}`,
		`{"sequence":3,"state":"idle"}`,
	} {
		req := httptest.NewRequest(http.MethodPost, "/v1/data/conversations/conversation-typing-http/typing", strings.NewReader(body))
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, req)
		if recorder.Code != http.StatusAccepted {
			t.Fatalf("publish status = %d, body = %s", recorder.Code, recorder.Body.String())
		}
	}

	stale := httptest.NewRequest(http.MethodPost, "/v1/data/conversations/conversation-typing-http/typing", strings.NewReader(`{"sequence":2,"state":"typing"}`))
	staleRecorder := httptest.NewRecorder()
	handler.ServeHTTP(staleRecorder, stale)
	if staleRecorder.Code != http.StatusConflict {
		t.Fatalf("stale status = %d, body = %s", staleRecorder.Code, staleRecorder.Body.String())
	}
}

func TestTypingHTTPPrivacyAndStrictJSON(t *testing.T) {
	now := time.Date(2026, 8, 30, 21, 10, 0, 0, time.UTC)
	service, policy := newTypingHTTPTestService(t, &now)
	policy.SetPublish("conversation-typing-http", "user-1", false)
	handler := newTypingHTTPHandler(t, service, "user-1")

	denied := httptest.NewRequest(http.MethodPost, "/v1/data/conversations/conversation-typing-http/typing", strings.NewReader(`{"sequence":1,"state":"typing"}`))
	deniedRecorder := httptest.NewRecorder()
	handler.ServeHTTP(deniedRecorder, denied)
	if deniedRecorder.Code != http.StatusForbidden {
		t.Fatalf("privacy status = %d, body = %s", deniedRecorder.Code, deniedRecorder.Body.String())
	}

	policy.SetPublish("conversation-typing-http", "user-1", true)
	unknown := httptest.NewRequest(http.MethodPost, "/v1/data/conversations/conversation-typing-http/typing", strings.NewReader(`{"sequence":1,"state":"typing","draft":"secret"}`))
	unknownRecorder := httptest.NewRecorder()
	handler.ServeHTTP(unknownRecorder, unknown)
	if unknownRecorder.Code != http.StatusBadRequest {
		t.Fatalf("unknown-field status = %d, body = %s", unknownRecorder.Code, unknownRecorder.Body.String())
	}
}

func TestTypingHTTPRejectsCallerSuppliedUserIdentity(t *testing.T) {
	now := time.Date(2026, 8, 30, 21, 10, 0, 0, time.UTC)
	service, _ := newTypingHTTPTestService(t, &now)
	handler := newTypingHTTPHandler(t, service, "user-1")

	request := httptest.NewRequest(
		http.MethodPost,
		"/v1/data/conversations/conversation-typing-http/typing",
		strings.NewReader(`{"user_id":"user-2","sequence":1,"state":"typing"}`),
	)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("caller-supplied user identity status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
}

func TestTypingHTTPRejectsTrailingJSONValue(t *testing.T) {
	now := time.Date(2026, 9, 23, 12, 0, 0, 0, time.UTC)
	service, _ := newTypingHTTPTestService(t, &now)
	handler := newTypingHTTPHandler(t, service, "user-1")

	request := httptest.NewRequest(
		http.MethodPost,
		"/v1/data/conversations/conversation-typing-http/typing",
		strings.NewReader(`{"sequence":1,"state":"typing"}{"draft":"must-not-be-ignored"}`),
	)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("trailing typing JSON status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
}
