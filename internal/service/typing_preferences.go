// SPDX-License-Identifier: AGPL-3.0-only

package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
)

// TypingPrivacyPreferences is the minimized user-controlled projection for
// content-free typing presence. It contains no message content, device data,
// identity secrets, or client activity beyond the two explicit policy choices.
type TypingPrivacyPreferences struct {
	PublishTyping bool
	ObserveTyping bool
}

type TypingPrivacyPreferenceState struct {
	Preferences TypingPrivacyPreferences
	UsesDefault bool
}

// TypingPrivacyPreferenceStore is the mutable preference boundary used by the
// Development control surface. Production durability remains a separate Privacy
// Shield-backed milestone.
type TypingPrivacyPreferenceStore interface {
	GetTypingPreferences(context.Context, string, string) (TypingPrivacyPreferences, error)
	SetTypingPreferences(context.Context, string, string, TypingPrivacyPreferences) error
	DeleteTypingPreferences(context.Context, string, string) error
}

type TypingPrivacyPreferenceSourceStore interface {
	HasTypingPreferences(context.Context, string, string) (bool, error)
}

// TypingPrivacyPreferenceService authorizes preference reads/writes against
// conversation membership. The authenticated user is always supplied by the
// trusted authentication boundary rather than the request body.
type TypingPrivacyPreferenceService struct {
	store  TypingPrivacyPreferenceStore
	access ConversationAccess
}

func NewTypingPrivacyPreferenceService(store TypingPrivacyPreferenceStore, access ConversationAccess) (*TypingPrivacyPreferenceService, error) {
	if store == nil || access == nil {
		return nil, errors.New("typing privacy preference store and conversation access are required")
	}
	return &TypingPrivacyPreferenceService{store: store, access: access}, nil
}

func (s *TypingPrivacyPreferenceService) Get(ctx context.Context, authenticatedUserID, conversationID string) (TypingPrivacyPreferences, error) {
	state, err := s.GetState(ctx, authenticatedUserID, conversationID)
	if err != nil {
		return TypingPrivacyPreferences{}, err
	}
	return state.Preferences, nil
}

func (s *TypingPrivacyPreferenceService) GetState(
	ctx context.Context,
	authenticatedUserID,
	conversationID string,
) (TypingPrivacyPreferenceState, error) {
	conversationID, err := s.authorize(ctx, authenticatedUserID, conversationID)
	if err != nil {
		return TypingPrivacyPreferenceState{}, err
	}
	preferences, err := s.store.GetTypingPreferences(ctx, conversationID, authenticatedUserID)
	if err != nil {
		return TypingPrivacyPreferenceState{}, fmt.Errorf("get typing privacy preferences: %w", err)
	}
	sourceStore, ok := s.store.(TypingPrivacyPreferenceSourceStore)
	if !ok {
		return TypingPrivacyPreferenceState{}, errors.New(
			"typing privacy preference store does not expose source state",
		)
	}
	explicit, err := sourceStore.HasTypingPreferences(ctx, conversationID, authenticatedUserID)
	if err != nil {
		return TypingPrivacyPreferenceState{}, fmt.Errorf("inspect typing privacy preference source: %w", err)
	}
	return TypingPrivacyPreferenceState{
		Preferences: preferences,
		UsesDefault: !explicit,
	}, nil
}

func (s *TypingPrivacyPreferenceService) Update(
	ctx context.Context,
	authenticatedUserID,
	conversationID string,
	preferences TypingPrivacyPreferences,
) (TypingPrivacyPreferences, error) {
	conversationID, err := s.authorize(ctx, authenticatedUserID, conversationID)
	if err != nil {
		return TypingPrivacyPreferences{}, err
	}
	if err := s.store.SetTypingPreferences(ctx, conversationID, authenticatedUserID, preferences); err != nil {
		return TypingPrivacyPreferences{}, fmt.Errorf("set typing privacy preferences: %w", err)
	}
	return preferences, nil
}

func (s *TypingPrivacyPreferenceService) Reset(
	ctx context.Context,
	authenticatedUserID,
	conversationID string,
) (TypingPrivacyPreferences, error) {
	conversationID, err := s.authorize(ctx, authenticatedUserID, conversationID)
	if err != nil {
		return TypingPrivacyPreferences{}, err
	}
	if err := s.store.DeleteTypingPreferences(ctx, conversationID, authenticatedUserID); err != nil {
		return TypingPrivacyPreferences{}, fmt.Errorf("delete typing privacy preferences: %w", err)
	}
	preferences, err := s.store.GetTypingPreferences(ctx, conversationID, authenticatedUserID)
	if err != nil {
		return TypingPrivacyPreferences{}, fmt.Errorf("get reset typing privacy preferences: %w", err)
	}
	return preferences, nil
}

func (s *TypingPrivacyPreferenceService) authorize(ctx context.Context, authenticatedUserID, conversationID string) (string, error) {
	authenticatedUserID = strings.TrimSpace(authenticatedUserID)
	conversationID = strings.TrimSpace(conversationID)
	if authenticatedUserID == "" {
		return "", errors.New("authenticated user id is required")
	}
	if conversationID == "" {
		return "", errors.New("conversation id is required")
	}
	allowed, err := s.access.IsParticipant(ctx, conversationID, authenticatedUserID)
	if err != nil {
		return "", fmt.Errorf("verify conversation access: %w", err)
	}
	if !allowed {
		return "", ErrConversationAccess
	}
	return conversationID, nil
}

// GetTypingPreferences returns the effective in-memory values, including the
// configured default when no explicit conversation/user override exists.
func (p *MemoryTypingPrivacyPolicy) GetTypingPreferences(
	_ context.Context,
	conversationID,
	userID string,
) (TypingPrivacyPreferences, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()
	key := typingStateKey(conversationID, userID)
	publish, ok := p.publish[key]
	if !ok {
		publish = p.defaultAllowed
	}
	observe, ok := p.observe[key]
	if !ok {
		observe = p.defaultAllowed
	}
	return TypingPrivacyPreferences{PublishTyping: publish, ObserveTyping: observe}, nil
}

func (p *MemoryTypingPrivacyPolicy) HasTypingPreferences(
	_ context.Context,
	conversationID,
	userID string,
) (bool, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()
	key := typingStateKey(conversationID, userID)
	_, publishSet := p.publish[key]
	_, observeSet := p.observe[key]
	return publishSet || observeSet, nil
}

func (p *MemoryTypingPrivacyPolicy) SetTypingPreferences(
	_ context.Context,
	conversationID,
	userID string,
	preferences TypingPrivacyPreferences,
) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	key := typingStateKey(conversationID, userID)
	p.publish[key] = preferences.PublishTyping
	p.observe[key] = preferences.ObserveTyping
	return nil
}

func (p *MemoryTypingPrivacyPolicy) DeleteTypingPreferences(
	_ context.Context,
	conversationID,
	userID string,
) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	key := typingStateKey(conversationID, userID)
	delete(p.publish, key)
	delete(p.observe, key)
	return nil
}
