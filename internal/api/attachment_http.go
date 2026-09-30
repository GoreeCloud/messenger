// SPDX-License-Identifier: AGPL-3.0-only

package api

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/GoreeCloud/goreecloud-messenger/internal/domain"
	messagingservice "github.com/GoreeCloud/goreecloud-messenger/internal/service"
)

// maxAttachmentRequestBodyBytes leaves bounded JSON/base64 overhead above the
// 25 MiB ciphertext ceiling enforced by the domain contract.
const maxAttachmentRequestBodyBytes = 36 << 20
const defaultAttachmentListLimit = 50

// AttachmentHTTPHandler exposes opaque encrypted GoreeCloud Data attachments
// without introducing a plaintext interpretation boundary.
type AttachmentHTTPHandler struct {
	service *messagingservice.AttachmentService
	auth    Authenticator
}

func NewAttachmentHTTPHandler(service *messagingservice.AttachmentService, auth Authenticator) (*AttachmentHTTPHandler, error) {
	if service == nil {
		return nil, errors.New("attachment service is required")
	}
	if auth == nil {
		return nil, errors.New("authenticator is required")
	}
	return &AttachmentHTTPHandler{service: service, auth: auth}, nil
}

func (h *AttachmentHTTPHandler) Routes() http.Handler {
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)
	return mux
}

// RegisterRoutes installs encrypted attachment routes onto a caller-owned mux so the
// application can compose them with message routes that share the conversation namespace.
func (h *AttachmentHTTPHandler) RegisterRoutes(mux *http.ServeMux) {
	if mux == nil {
		panic("HTTP mux is required")
	}
	mux.HandleFunc("POST /v1/data/attachments", h.submitAttachment)
	mux.HandleFunc("GET /v1/data/attachments/{attachmentID}", h.getAttachment)
	mux.HandleFunc("GET /v1/data/attachments/{attachmentID}/ciphertext", h.getAttachmentCiphertext)
	mux.HandleFunc("DELETE /v1/data/attachments/{attachmentID}", h.deleteAttachment)
	mux.HandleFunc("GET /v1/data/conversations/{conversationID}/attachments", h.listAttachments)
}

type attachmentRequest struct {
	AttachmentID   string `json:"attachment_id"`
	ConversationID string `json:"conversation_id"`
	SenderID       string `json:"sender_id"`
	ClientNonce    string `json:"client_nonce"`
	Filename       string `json:"filename"`
	MIMEType       string `json:"mime_type"`
	Ciphertext     string `json:"ciphertext"`
}

type attachmentResponse struct {
	AttachmentID   string `json:"attachment_id"`
	ConversationID string `json:"conversation_id"`
	SenderID       string `json:"sender_id"`
	ClientNonce    string `json:"client_nonce"`
	Filename       string `json:"filename"`
	MIMEType       string `json:"mime_type"`
	Ciphertext     string `json:"ciphertext"`
}

type attachmentMetadataResponse struct {
	AttachmentID    string `json:"attachment_id"`
	ConversationID  string `json:"conversation_id"`
	SenderID        string `json:"sender_id"`
	Filename        string `json:"filename"`
	MIMEType        string `json:"mime_type"`
	CiphertextBytes int    `json:"ciphertext_bytes"`
}

type attachmentListResponse struct {
	Attachments []attachmentMetadataResponse `json:"attachments"`
}

func (h *AttachmentHTTPHandler) submitAttachment(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxAttachmentRequestBodyBytes)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	var input attachmentRequest
	if err := decoder.Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if hasUnexpectedTrailingJSON(decoder) {
		writeError(w, http.StatusBadRequest, "request body must contain one JSON object")
		return
	}

	ciphertext, err := base64.StdEncoding.DecodeString(input.Ciphertext)
	if err != nil {
		writeError(w, http.StatusBadRequest, "ciphertext must be base64 encoded")
		return
	}

	attachment := domain.DataAttachment{
		AttachmentID:   input.AttachmentID,
		ConversationID: input.ConversationID,
		SenderID:       input.SenderID,
		ClientNonce:    input.ClientNonce,
		Filename:       input.Filename,
		MIMEType:       input.MIMEType,
		Ciphertext:     ciphertext,
	}
	if err := h.service.Submit(r.Context(), userID, attachment); err != nil {
		writeAttachmentServiceError(w, err)
		return
	}
	w.WriteHeader(http.StatusAccepted)
}

func (h *AttachmentHTTPHandler) getAttachment(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		return
	}

	attachmentID := strings.TrimSpace(r.PathValue("attachmentID"))
	attachment, err := h.service.Get(r.Context(), userID, attachmentID)
	if err != nil {
		writeAttachmentServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, attachmentResponse{
		AttachmentID:   attachment.AttachmentID,
		ConversationID: attachment.ConversationID,
		SenderID:       attachment.SenderID,
		ClientNonce:    attachment.ClientNonce,
		Filename:       attachment.Filename,
		MIMEType:       attachment.MIMEType,
		Ciphertext:     base64.StdEncoding.EncodeToString(attachment.Ciphertext),
	})
}

func (h *AttachmentHTTPHandler) getAttachmentCiphertext(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		return
	}

	attachment, err := h.service.Get(r.Context(), userID, strings.TrimSpace(r.PathValue("attachmentID")))
	if err != nil {
		writeAttachmentServiceError(w, err)
		return
	}

	// The transport deliberately describes the payload as generic binary data.
	// MIME type and filename are metadata for the E2EE client after decryption;
	// the server must never encourage a browser to interpret ciphertext as the
	// sender-declared plaintext media type.
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Length", strconv.Itoa(len(attachment.Ciphertext)))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(attachment.Ciphertext)
}

func (h *AttachmentHTTPHandler) deleteAttachment(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		return
	}
	if err := h.service.Delete(r.Context(), userID, strings.TrimSpace(r.PathValue("attachmentID"))); err != nil {
		writeAttachmentServiceError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *AttachmentHTTPHandler) listAttachments(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.authenticate(w, r)
	if !ok {
		return
	}

	limit := defaultAttachmentListLimit
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil {
			writeError(w, http.StatusBadRequest, "attachment list limit is invalid")
			return
		}
		limit = parsed
	}

	metadata, err := h.service.List(
		r.Context(),
		userID,
		strings.TrimSpace(r.PathValue("conversationID")),
		limit,
	)
	if err != nil {
		writeAttachmentServiceError(w, err)
		return
	}

	items := make([]attachmentMetadataResponse, 0, len(metadata))
	for _, item := range metadata {
		items = append(items, attachmentMetadataResponse{
			AttachmentID:    item.AttachmentID,
			ConversationID:  item.ConversationID,
			SenderID:        item.SenderID,
			Filename:        item.Filename,
			MIMEType:        item.MIMEType,
			CiphertextBytes: item.CiphertextBytes,
		})
	}
	writeJSON(w, http.StatusOK, attachmentListResponse{Attachments: items})
}

func (h *AttachmentHTTPHandler) authenticate(w http.ResponseWriter, r *http.Request) (string, bool) {
	userID, err := h.auth.Authenticate(r.Context(), r)
	if err != nil || strings.TrimSpace(userID) == "" {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return "", false
	}
	return userID, true
}

func writeAttachmentServiceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, messagingservice.ErrConversationAccess):
		writeError(w, http.StatusForbidden, "conversation access denied")
	case errors.Is(err, messagingservice.ErrSenderMismatch):
		writeError(w, http.StatusForbidden, "sender does not match authenticated user")
	case errors.Is(err, messagingservice.ErrAttachmentNotFound):
		writeError(w, http.StatusNotFound, "attachment not found")
	case errors.Is(err, messagingservice.ErrDuplicateAttachment), errors.Is(err, messagingservice.ErrAttachmentNonceReuse):
		writeError(w, http.StatusConflict, "attachment conflicts with existing state")
	case errors.Is(err, messagingservice.ErrAttachmentListLimit):
		writeError(w, http.StatusBadRequest, "attachment list limit is invalid")
	default:
		writeError(w, http.StatusBadRequest, "attachment request rejected")
	}
}
