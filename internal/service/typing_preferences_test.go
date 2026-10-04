// SPDX-License-Identifier: AGPL-3.0-only

package service

import (
	"context"
	"errors"
	"testing"

	"github.com/GoreeCloud/goreecloud-messenger/internal/domain"
)

func TestTypingPrivacyPreferencesUseEffectiveDefaultsAndExplicitOverrides(t *testing.T) {
	access := NewMemoryConversationAccess()
	if err := access.SetConversation(domain.Conversation{
		ID:             "conversation-a",
		Kind:           domain.ConversationDirect,
		ParticipantIDs: []string{"user-a", "user-b"},
	}); err != nil {
		t.Fatal(err)
	}
	policy := NewMemoryTypingPrivacyPolicy(true)
	service, err := NewTypingPrivacyPreferenceService(policy, access)
	if err != nil {
		t.Fatal(err)
	}

	initial, err := service.Get(context.Background(), "user-a", "conversation-a")
	if err != nil {
		t.Fatal(err)
	}
	if !initial.PublishTyping || !initial.ObserveTyping {
		t.Fatalf("expected enabled defaults, got %+v", initial)
	}

	updated, err := service.Update(context.Background(), "user-a", "conversation-a", TypingPrivacyPreferences{
		PublishTyping: false,
		ObserveTyping: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if updated.PublishTyping || !updated.ObserveTyping {
		t.Fatalf("unexpected update projection: %+v", updated)
	}

	publish, err := policy.CanPublishTyping(context.Background(), "conversation-a", "user-a")
	if err != nil || publish {
		t.Fatalf("expected publish disabled, allowed=%v err=%v", publish, err)
	}
	observe, err := policy.CanObserveTyping(context.Background(), "conversation-a", "user-a")
	if err != nil || !observe {
		t.Fatalf("expected observe enabled, allowed=%v err=%v", observe, err)
	}
}

func TestTypingPrivacyPreferencesRejectConversationOutsider(t *testing.T) {
	access := NewMemoryConversationAccess()
	if err := access.SetConversation(domain.Conversation{
		ID:             "conversation-a",
		Kind:           domain.ConversationDirect,
		ParticipantIDs: []string{"user-a", "user-b"},
	}); err != nil {
		t.Fatal(err)
	}
	service, err := NewTypingPrivacyPreferenceService(NewMemoryTypingPrivacyPolicy(true), access)
	if err != nil {
		t.Fatal(err)
	}

	_, err = service.Get(context.Background(), "outsider", "conversation-a")
	if !errors.Is(err, ErrConversationAccess) {
		t.Fatalf("expected conversation access error, got %v", err)
	}
	_, err = service.Update(context.Background(), "outsider", "conversation-a", TypingPrivacyPreferences{})
	if !errors.Is(err, ErrConversationAccess) {
		t.Fatalf("expected conversation access error, got %v", err)
	}

}

func TestTypingPrivacyPreferencesResetToConfiguredDefault(t *testing.T) {
	access := NewMemoryConversationAccess()
	if err := access.SetConversation(domain.Conversation{
		ID:             "conversation-a",
		Kind:           domain.ConversationDirect,
		ParticipantIDs: []string{"user-a", "user-b"},
	}); err != nil {
		t.Fatal(err)
	}
	policy := NewMemoryTypingPrivacyPolicy(false)
	service, err := NewTypingPrivacyPreferenceService(policy, access)
	if err != nil {
		t.Fatal(err)
	}

	if _, err := service.Update(
		context.Background(),
		"user-a",
		"conversation-a",
		TypingPrivacyPreferences{PublishTyping: true, ObserveTyping: true},
	); err != nil {
		t.Fatal(err)
	}
	reset, err := service.Reset(context.Background(), "user-a", "conversation-a")
	if err != nil {
		t.Fatal(err)
	}
	if reset.PublishTyping || reset.ObserveTyping {
		t.Fatalf("expected configured deny defaults after reset, got %+v", reset)
	}
}
