// SPDX-License-Identifier: AGPL-3.0-only

package api

import (
	"context"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/GoreeCloud/goreecloud-messenger/internal/domain"
	messagingservice "github.com/GoreeCloud/goreecloud-messenger/internal/service"
)

type testAuthenticator struct {
	userID string
	err    error
}

func (a testAuthenticator) Authenticate(context.Context, *http.Request) (string, error) {
	return a.userID, a.err
}

func newTestHandler(t *testing.T, userID string) http.Handler {
	t.Helper()

	store := messagingservice.NewMemoryDataStore()
	access := messagingservice.NewMemoryConversationAccess()
	if err := access.SetConversation(domain.Conversation{
		ID:             "conversation-1",
		Kind:           domain.ConversationDirect,
		ParticipantIDs: []string{"user-1", "user-2"},
	}); err != nil {
		t.Fatalf("set conversation: %v", err)
	}

	dataService, err := messagingservice.NewDataService(store, access)
	if err != nil {
		t.Fatalf("new Data service: %v", err)
	}
	receiptService, err := messagingservice.NewReceiptService(store, messagingservice.NewMemoryReceiptStore(), access)
	if err != nil {
		t.Fatalf("new receipt service: %v", err)
	}
	handler, err := NewHandler(dataService, receiptService, testAuthenticator{userID: userID})
	if err != nil {
		t.Fatalf("new handler: %v", err)
	}
	return handler.Routes()
}

func TestSubmitAndListEncryptedDataEnvelope(t *testing.T) {
	handler := newTestHandler(t, "user-1")
	ciphertext := base64.StdEncoding.EncodeToString([]byte("opaque encrypted payload"))
	body := `{"message_id":"message-1","conversation_id":"conversation-1","sender_id":"user-1","client_nonce":"nonce-1","ciphertext":"` + ciphertext + `","encryption":"e2ee","created_at":"2026-08-24T14:00:00Z"}`

	submit := httptest.NewRequest(http.MethodPost, "/v1/data/messages", strings.NewReader(body))
	submitRecorder := httptest.NewRecorder()
	handler.ServeHTTP(submitRecorder, submit)
	if submitRecorder.Code != http.StatusAccepted {
		t.Fatalf("submit status = %d, body = %s", submitRecorder.Code, submitRecorder.Body.String())
	}

	list := httptest.NewRequest(http.MethodGet, "/v1/data/conversations/conversation-1/messages", nil)
	listRecorder := httptest.NewRecorder()
	handler.ServeHTTP(listRecorder, list)
	if listRecorder.Code != http.StatusOK {
		t.Fatalf("list status = %d, body = %s", listRecorder.Code, listRecorder.Body.String())
	}
	response := listRecorder.Body.String()
	if !strings.Contains(response, `"ciphertext":"`+ciphertext+`"`) {
		t.Fatalf("response did not preserve ciphertext: %s", response)
	}
	if strings.Contains(response, "opaque encrypted payload") {
		t.Fatal("response exposed decoded payload instead of ciphertext")
	}
	if !strings.Contains(response, `"encryption":"e2ee"`) {
		t.Fatalf("response did not preserve encryption provenance: %s", response)
	}
}

func TestDeliveryReceiptRoundTrip(t *testing.T) {
	handler := newTestHandler(t, "user-1")
	messageBody := `{"message_id":"message-1","conversation_id":"conversation-1","sender_id":"user-1","client_nonce":"nonce-1","ciphertext":"Y2lwaGVydGV4dA==","encryption":"e2ee","created_at":"2026-08-24T14:00:00Z"}`
	submit := httptest.NewRequest(http.MethodPost, "/v1/data/messages", strings.NewReader(messageBody))
	submitRecorder := httptest.NewRecorder()
	handler.ServeHTTP(submitRecorder, submit)
	if submitRecorder.Code != http.StatusAccepted {
		t.Fatalf("submit status = %d, body = %s", submitRecorder.Code, submitRecorder.Body.String())
	}

	handler = newTestHandlerWithSeededMessage(t, "user-2")
	receiptBody := `{"conversation_id":"conversation-1","user_id":"user-2","state":"delivered","observed_at":"2026-08-24T14:01:00Z"}`
	receipt := httptest.NewRequest(http.MethodPost, "/v1/data/messages/message-1/receipts", strings.NewReader(receiptBody))
	receiptRecorder := httptest.NewRecorder()
	handler.ServeHTTP(receiptRecorder, receipt)
	if receiptRecorder.Code != http.StatusAccepted {
		t.Fatalf("receipt status = %d, body = %s", receiptRecorder.Code, receiptRecorder.Body.String())
	}

	list := httptest.NewRequest(http.MethodGet, "/v1/data/messages/message-1/receipts", nil)
	listRecorder := httptest.NewRecorder()
	handler.ServeHTTP(listRecorder, list)
	if listRecorder.Code != http.StatusOK || !strings.Contains(listRecorder.Body.String(), `"state":"delivered"`) {
		t.Fatalf("receipt list status = %d, body = %s", listRecorder.Code, listRecorder.Body.String())
	}
}

func newTestHandlerWithSeededMessage(t *testing.T, userID string) http.Handler {
	t.Helper()
	store := messagingservice.NewMemoryDataStore()
	access := messagingservice.NewMemoryConversationAccess()
	if err := access.SetConversation(domain.Conversation{ID: "conversation-1", Kind: domain.ConversationDirect, ParticipantIDs: []string{"user-1", "user-2"}}); err != nil {
		t.Fatalf("set conversation: %v", err)
	}
	dataService, err := messagingservice.NewDataService(store, access)
	if err != nil {
		t.Fatalf("new Data service: %v", err)
	}
	if err := dataService.Submit(context.Background(), "user-1", domain.DataEnvelope{MessageID: "message-1", ConversationID: "conversation-1", SenderID: "user-1", ClientNonce: "nonce-1", Ciphertext: []byte("ciphertext"), Encryption: domain.EncryptionE2EE, CreatedAt: time.Date(2026, 8, 24, 14, 0, 0, 0, time.UTC)}); err != nil {
		t.Fatalf("seed message: %v", err)
	}
	receiptService, err := messagingservice.NewReceiptService(store, messagingservice.NewMemoryReceiptStore(), access)
	if err != nil {
		t.Fatalf("new receipt service: %v", err)
	}
	handler, err := NewHandler(dataService, receiptService, testAuthenticator{userID: userID})
	if err != nil {
		t.Fatalf("new handler: %v", err)
	}
	return handler.Routes()
}

func TestReceiptRejectsSenderSelfAcknowledgement(t *testing.T) {
	handler := newTestHandlerWithSeededMessage(t, "user-1")
	body := `{"conversation_id":"conversation-1","user_id":"user-1","state":"delivered","observed_at":"2026-08-24T14:01:00Z"}`
	request := httptest.NewRequest(http.MethodPost, "/v1/data/messages/message-1/receipts", strings.NewReader(body))
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusForbidden {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
}

func TestSubmitRejectsSenderMismatch(t *testing.T) {
	handler := newTestHandler(t, "user-2")
	body := `{"message_id":"message-1","conversation_id":"conversation-1","sender_id":"user-1","client_nonce":"nonce-1","ciphertext":"Y2lwaGVydGV4dA==","encryption":"e2ee","created_at":"2026-08-24T14:00:00Z"}`

	request := httptest.NewRequest(http.MethodPost, "/v1/data/messages", strings.NewReader(body))
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusForbidden {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
}

func TestListRejectsNonParticipant(t *testing.T) {
	handler := newTestHandler(t, "user-3")
	request := httptest.NewRequest(http.MethodGet, "/v1/data/conversations/conversation-1/messages", nil)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusForbidden {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
}

func TestHandlerRejectsMissingAuthentication(t *testing.T) {
	handler := newTestHandler(t, "")
	request := httptest.NewRequest(http.MethodGet, "/v1/data/conversations/conversation-1/messages", nil)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
}

func TestSubmitRejectsUnknownFields(t *testing.T) {
	handler := newTestHandler(t, "user-1")
	body := `{"message_id":"message-1","conversation_id":"conversation-1","sender_id":"user-1","client_nonce":"nonce-1","ciphertext":"Y2lwaGVydGV4dA==","encryption":"e2ee","created_at":"2026-08-24T14:00:00Z","plaintext":"must-not-be-accepted"}`

	request := httptest.NewRequest(http.MethodPost, "/v1/data/messages", strings.NewReader(body))
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
}

func TestMessageResponseTimestampIsStable(t *testing.T) {
	value := messageResponse{CreatedAt: time.Date(2026, 8, 24, 14, 0, 0, 0, time.UTC)}
	if value.CreatedAt.Format(time.RFC3339) != "2026-08-24T14:00:00Z" {
		t.Fatalf("unexpected timestamp: %s", value.CreatedAt)
	}
}

func TestSubmitRejectsTrailingJSONValue(t *testing.T) {
	handler := newTestHandler(t, "user-1")
	body := `{"message_id":"message-trailing","conversation_id":"conversation-1","sender_id":"user-1","client_nonce":"nonce-trailing","ciphertext":"Y2lwaGVydGV4dA==","encryption":"e2ee","created_at":"2026-09-23T12:00:00Z"}{"plaintext":"must-not-be-ignored"}`

	request := httptest.NewRequest(http.MethodPost, "/v1/data/messages", strings.NewReader(body))
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("trailing message JSON status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
}

func TestReceiptRejectsTrailingJSONValue(t *testing.T) {
	handler := newTestHandlerWithSeededMessage(t, "user-2")
	body := `{"conversation_id":"conversation-1","user_id":"user-2","state":"delivered","observed_at":"2026-09-23T12:01:00Z"}{"ignored":true}`

	request := httptest.NewRequest(http.MethodPost, "/v1/data/messages/message-1/receipts", strings.NewReader(body))
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("trailing receipt JSON status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
}
