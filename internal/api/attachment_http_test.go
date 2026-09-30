// SPDX-License-Identifier: AGPL-3.0-only

package api

import (
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/GoreeCloud/goreecloud-messenger/internal/domain"
	messagingservice "github.com/GoreeCloud/goreecloud-messenger/internal/service"
)

func newTestAttachmentHandler(t *testing.T, userID string) http.Handler {
	t.Helper()
	access := messagingservice.NewMemoryConversationAccess()
	if err := access.SetConversation(domain.Conversation{
		ID:             "conversation-1",
		Kind:           domain.ConversationDirect,
		ParticipantIDs: []string{"user-1", "user-2"},
	}); err != nil {
		t.Fatalf("set conversation: %v", err)
	}
	service, err := messagingservice.NewAttachmentService(messagingservice.NewMemoryAttachmentStore(), access)
	if err != nil {
		t.Fatalf("new attachment service: %v", err)
	}
	handler, err := NewAttachmentHTTPHandler(service, testAuthenticator{userID: userID})
	if err != nil {
		t.Fatalf("new attachment handler: %v", err)
	}
	return handler.Routes()
}

func TestAttachmentSubmitAndGetPreservesOpaqueCiphertext(t *testing.T) {
	handler := newTestAttachmentHandler(t, "user-1")
	ciphertext := base64.StdEncoding.EncodeToString([]byte("opaque attachment ciphertext"))
	body := `{"attachment_id":"attachment-1","conversation_id":"conversation-1","sender_id":"user-1","client_nonce":"attachment-nonce-1","filename":"photo.jpg","mime_type":"image/jpeg","ciphertext":"` + ciphertext + `"}`

	submit := httptest.NewRequest(http.MethodPost, "/v1/data/attachments", strings.NewReader(body))
	submitRecorder := httptest.NewRecorder()
	handler.ServeHTTP(submitRecorder, submit)
	if submitRecorder.Code != http.StatusAccepted {
		t.Fatalf("submit status = %d, body = %s", submitRecorder.Code, submitRecorder.Body.String())
	}

	get := httptest.NewRequest(http.MethodGet, "/v1/data/attachments/attachment-1", nil)
	getRecorder := httptest.NewRecorder()
	handler.ServeHTTP(getRecorder, get)
	if getRecorder.Code != http.StatusOK {
		t.Fatalf("get status = %d, body = %s", getRecorder.Code, getRecorder.Body.String())
	}
	response := getRecorder.Body.String()
	if !strings.Contains(response, `"ciphertext":"`+ciphertext+`"`) {
		t.Fatalf("response did not preserve ciphertext: %s", response)
	}
	if strings.Contains(response, "opaque attachment ciphertext") {
		t.Fatal("response exposed decoded attachment payload")
	}
}

func TestAttachmentSubmitRejectsSenderMismatch(t *testing.T) {
	handler := newTestAttachmentHandler(t, "user-2")
	body := `{"attachment_id":"attachment-1","conversation_id":"conversation-1","sender_id":"user-1","client_nonce":"attachment-nonce-1","filename":"photo.jpg","mime_type":"image/jpeg","ciphertext":"Y2lwaGVydGV4dA=="}`
	request := httptest.NewRequest(http.MethodPost, "/v1/data/attachments", strings.NewReader(body))
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusForbidden {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
}

func TestAttachmentSubmitRejectsUnknownFields(t *testing.T) {
	handler := newTestAttachmentHandler(t, "user-1")
	body := `{"attachment_id":"attachment-1","conversation_id":"conversation-1","sender_id":"user-1","client_nonce":"attachment-nonce-1","filename":"photo.jpg","mime_type":"image/jpeg","ciphertext":"Y2lwaGVydGV4dA==","plaintext":"forbidden"}`
	request := httptest.NewRequest(http.MethodPost, "/v1/data/attachments", strings.NewReader(body))
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
}

func TestAttachmentGetRejectsConversationOutsider(t *testing.T) {
	access := messagingservice.NewMemoryConversationAccess()
	if err := access.SetConversation(domain.Conversation{ID: "conversation-1", Kind: domain.ConversationDirect, ParticipantIDs: []string{"user-1", "user-2"}}); err != nil {
		t.Fatalf("set conversation: %v", err)
	}
	service, err := messagingservice.NewAttachmentService(messagingservice.NewMemoryAttachmentStore(), access)
	if err != nil {
		t.Fatalf("new attachment service: %v", err)
	}
	if err := service.Submit(t.Context(), "user-1", domain.DataAttachment{AttachmentID: "attachment-1", ConversationID: "conversation-1", SenderID: "user-1", ClientNonce: "nonce-1", Filename: "photo.jpg", MIMEType: "image/jpeg", Ciphertext: []byte("ciphertext")}); err != nil {
		t.Fatalf("seed attachment: %v", err)
	}
	handler, err := NewAttachmentHTTPHandler(service, testAuthenticator{userID: "user-3"})
	if err != nil {
		t.Fatalf("new attachment handler: %v", err)
	}
	request := httptest.NewRequest(http.MethodGet, "/v1/data/attachments/attachment-1", nil)
	recorder := httptest.NewRecorder()
	handler.Routes().ServeHTTP(recorder, request)
	if recorder.Code != http.StatusForbidden {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
}

func TestAttachmentGetReturnsNotFound(t *testing.T) {
	handler := newTestAttachmentHandler(t, "user-1")
	request := httptest.NewRequest(http.MethodGet, "/v1/data/attachments/missing", nil)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusNotFound {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
}

func TestAttachmentSubmitRejectsTrailingJSONValue(t *testing.T) {
	handler := newTestAttachmentHandler(t, "user-1")
	body := `{"attachment_id":"attachment-trailing","conversation_id":"conversation-1","sender_id":"user-1","client_nonce":"attachment-trailing-nonce","filename":"photo.jpg","mime_type":"image/jpeg","ciphertext":"Y2lwaGVydGV4dA=="}{"plaintext":"must-not-be-ignored"}`

	request := httptest.NewRequest(http.MethodPost, "/v1/data/attachments", strings.NewReader(body))
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("trailing attachment JSON status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
}
