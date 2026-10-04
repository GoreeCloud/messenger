// SPDX-License-Identifier: AGPL-3.0-only

package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
)

const typingPrivacyPreferenceStoreVersion = 1

var ErrTypingPreferenceDurabilityUnknown = errors.New("typing preference durability unknown")

var syncTypingPreferenceDirectory = syncDirectory

type typingPrivacyPreferenceEntry struct {
	ConversationID string `json:"conversation_id"`
	UserID         string `json:"user_id"`
	PublishTyping  bool   `json:"publish_typing"`
	ObserveTyping  bool   `json:"observe_typing"`
}

type typingPrivacyPreferenceDocument struct {
	Version     int                            `json:"version"`
	Preferences []typingPrivacyPreferenceEntry `json:"preferences"`
}

// FileTypingPrivacyPolicy is a durable, single-node Development implementation of both
// TypingPrivacyPreferenceStore and TypingPrivacyPolicy.
//
// It stores only conversation/user-scoped publish/observe booleans. The root is tightened to 0700,
// the state file is required to be a regular non-symlink 0600 file, and writes use temp-file fsync,
// atomic rename, and parent-directory fsync. Ambiguous post-rename durability poisons the live
// instance until it is reopened, matching the fail-closed behavior used by other Development
// persistence boundaries.
//
// This does not establish Privacy Shield acceptance, distributed persistence, backup, replication,
// or production readiness.
type FileTypingPrivacyPolicy struct {
	mu             sync.RWMutex
	path           string
	defaultAllowed bool
	preferences    map[string]typingPrivacyPreferenceEntry
	unavailable    error
}

func NewFileTypingPrivacyPolicy(root string, defaultAllowed bool) (*FileTypingPrivacyPolicy, error) {
	if strings.TrimSpace(root) == "" {
		return nil, errors.New("typing privacy preference root is required")
	}
	if err := ensurePrivateTypingPreferenceRoot(root); err != nil {
		return nil, err
	}
	policy := &FileTypingPrivacyPolicy{
		path:           filepath.Join(root, "typing-privacy-preferences.json"),
		defaultAllowed: defaultAllowed,
		preferences:    make(map[string]typingPrivacyPreferenceEntry),
	}
	if err := policy.load(); err != nil {
		return nil, err
	}
	return policy, nil
}

func (p *FileTypingPrivacyPolicy) GetTypingPreferences(
	ctx context.Context,
	conversationID,
	userID string,
) (TypingPrivacyPreferences, error) {
	if err := ctx.Err(); err != nil {
		return TypingPrivacyPreferences{}, err
	}
	conversationID, userID, err := normalizedTypingPreferenceScope(conversationID, userID)
	if err != nil {
		return TypingPrivacyPreferences{}, err
	}

	p.mu.RLock()
	defer p.mu.RUnlock()
	if p.unavailable != nil {
		return TypingPrivacyPreferences{}, fmt.Errorf("typing privacy preference store unavailable: %w", p.unavailable)
	}
	entry, ok := p.preferences[typingStateKey(conversationID, userID)]
	if !ok {
		return TypingPrivacyPreferences{
			PublishTyping: p.defaultAllowed,
			ObserveTyping: p.defaultAllowed,
		}, nil
	}
	return TypingPrivacyPreferences{
		PublishTyping: entry.PublishTyping,
		ObserveTyping: entry.ObserveTyping,
	}, nil
}

func (p *FileTypingPrivacyPolicy) HasTypingPreferences(
	ctx context.Context,
	conversationID,
	userID string,
) (bool, error) {
	if err := ctx.Err(); err != nil {
		return false, err
	}
	conversationID, userID, err := normalizedTypingPreferenceScope(conversationID, userID)
	if err != nil {
		return false, err
	}

	p.mu.RLock()
	defer p.mu.RUnlock()
	if p.unavailable != nil {
		return false, fmt.Errorf("typing privacy preference store unavailable: %w", p.unavailable)
	}
	_, exists := p.preferences[typingStateKey(conversationID, userID)]
	return exists, nil
}

func (p *FileTypingPrivacyPolicy) SetTypingPreferences(
	ctx context.Context,
	conversationID,
	userID string,
	preferences TypingPrivacyPreferences,
) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	conversationID, userID, err := normalizedTypingPreferenceScope(conversationID, userID)
	if err != nil {
		return err
	}

	p.mu.Lock()
	defer p.mu.Unlock()
	if p.unavailable != nil {
		return fmt.Errorf("typing privacy preference store unavailable: %w", p.unavailable)
	}

	next := cloneTypingPreferenceMap(p.preferences)
	next[typingStateKey(conversationID, userID)] = typingPrivacyPreferenceEntry{
		ConversationID: conversationID,
		UserID:         userID,
		PublishTyping:  preferences.PublishTyping,
		ObserveTyping:  preferences.ObserveTyping,
	}
	if err := p.persist(next); err != nil {
		if errors.Is(err, ErrTypingPreferenceDurabilityUnknown) {
			p.unavailable = err
		}
		return err
	}
	p.preferences = next
	return nil
}

func (p *FileTypingPrivacyPolicy) DeleteTypingPreferences(
	ctx context.Context,
	conversationID,
	userID string,
) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	conversationID, userID, err := normalizedTypingPreferenceScope(conversationID, userID)
	if err != nil {
		return err
	}

	p.mu.Lock()
	defer p.mu.Unlock()
	if p.unavailable != nil {
		return fmt.Errorf("typing privacy preference store unavailable: %w", p.unavailable)
	}

	key := typingStateKey(conversationID, userID)
	if _, exists := p.preferences[key]; !exists {
		return nil
	}
	next := cloneTypingPreferenceMap(p.preferences)
	delete(next, key)
	if err := p.persist(next); err != nil {
		if errors.Is(err, ErrTypingPreferenceDurabilityUnknown) {
			p.unavailable = err
		}
		return err
	}
	p.preferences = next
	return nil
}

func (p *FileTypingPrivacyPolicy) CanPublishTyping(
	ctx context.Context,
	conversationID,
	userID string,
) (bool, error) {
	preferences, err := p.GetTypingPreferences(ctx, conversationID, userID)
	if err != nil {
		return false, err
	}
	return preferences.PublishTyping, nil
}

func (p *FileTypingPrivacyPolicy) CanObserveTyping(
	ctx context.Context,
	conversationID,
	userID string,
) (bool, error) {
	preferences, err := p.GetTypingPreferences(ctx, conversationID, userID)
	if err != nil {
		return false, err
	}
	return preferences.ObserveTyping, nil
}

func (p *FileTypingPrivacyPolicy) load() error {
	info, err := os.Lstat(p.path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("stat typing privacy preference store: %w", err)
	}
	if info.Mode()&os.ModeSymlink != 0 || !info.Mode().IsRegular() {
		return errors.New("typing privacy preference state must be a regular non-symlink file")
	}
	if info.Mode().Perm() != 0o600 {
		return fmt.Errorf("typing privacy preference state permissions must be 0600, got %o", info.Mode().Perm())
	}

	data, err := os.ReadFile(p.path)
	if err != nil {
		return fmt.Errorf("read typing privacy preference store: %w", err)
	}
	var document typingPrivacyPreferenceDocument
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&document); err != nil {
		return fmt.Errorf("decode typing privacy preference store: %w", err)
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		if err == nil {
			return errors.New("typing privacy preference store must contain one JSON document")
		}
		return fmt.Errorf("decode trailing typing privacy preference data: %w", err)
	}
	if document.Version != typingPrivacyPreferenceStoreVersion {
		return fmt.Errorf("unsupported typing privacy preference store version %d", document.Version)
	}

	loaded := make(map[string]typingPrivacyPreferenceEntry, len(document.Preferences))
	for _, entry := range document.Preferences {
		conversationID, userID, err := normalizedTypingPreferenceScope(entry.ConversationID, entry.UserID)
		if err != nil {
			return fmt.Errorf("invalid persisted typing privacy preference: %w", err)
		}
		if conversationID != entry.ConversationID || userID != entry.UserID {
			return errors.New("persisted typing privacy preference identifiers must be canonical")
		}
		key := typingStateKey(conversationID, userID)
		if _, duplicate := loaded[key]; duplicate {
			return errors.New("duplicate persisted typing privacy preference scope")
		}
		loaded[key] = entry
	}
	p.preferences = loaded
	return nil
}

func (p *FileTypingPrivacyPolicy) persist(preferences map[string]typingPrivacyPreferenceEntry) error {
	values := make([]typingPrivacyPreferenceEntry, 0, len(preferences))
	for _, preference := range preferences {
		values = append(values, preference)
	}
	sort.Slice(values, func(i, j int) bool {
		if values[i].ConversationID != values[j].ConversationID {
			return values[i].ConversationID < values[j].ConversationID
		}
		return values[i].UserID < values[j].UserID
	})
	data, err := json.MarshalIndent(
		typingPrivacyPreferenceDocument{
			Version:     typingPrivacyPreferenceStoreVersion,
			Preferences: values,
		},
		"",
		"  ",
	)
	if err != nil {
		return fmt.Errorf("encode typing privacy preference store: %w", err)
	}
	data = append(data, '\n')

	temporary, err := os.CreateTemp(filepath.Dir(p.path), ".typing-privacy-*.tmp")
	if err != nil {
		return fmt.Errorf("create temporary typing privacy preference store: %w", err)
	}
	temporaryName := temporary.Name()
	cleanup := func() {
		_ = temporary.Close()
		_ = os.Remove(temporaryName)
	}
	if err := temporary.Chmod(0o600); err != nil {
		cleanup()
		return fmt.Errorf("protect temporary typing privacy preference store: %w", err)
	}
	if _, err := temporary.Write(data); err != nil {
		cleanup()
		return fmt.Errorf("write temporary typing privacy preference store: %w", err)
	}
	if err := temporary.Sync(); err != nil {
		cleanup()
		return fmt.Errorf("sync temporary typing privacy preference store: %w", err)
	}
	if err := temporary.Close(); err != nil {
		_ = os.Remove(temporaryName)
		return fmt.Errorf("close temporary typing privacy preference store: %w", err)
	}
	if err := os.Rename(temporaryName, p.path); err != nil {
		_ = os.Remove(temporaryName)
		return fmt.Errorf("replace typing privacy preference store: %w", err)
	}
	if err := os.Chmod(p.path, 0o600); err != nil {
		return fmt.Errorf(
			"%w: protect replaced typing privacy preference store: %v",
			ErrTypingPreferenceDurabilityUnknown,
			err,
		)
	}
	if err := syncTypingPreferenceDirectory(filepath.Dir(p.path)); err != nil {
		return fmt.Errorf(
			"%w: sync typing privacy preference directory: %v",
			ErrTypingPreferenceDurabilityUnknown,
			err,
		)
	}
	return nil
}

func ensurePrivateTypingPreferenceRoot(root string) error {
	if err := os.MkdirAll(root, 0o700); err != nil {
		return fmt.Errorf("create typing privacy preference root: %w", err)
	}
	info, err := os.Lstat(root)
	if err != nil {
		return fmt.Errorf("stat typing privacy preference root: %w", err)
	}
	if info.Mode()&os.ModeSymlink != 0 || !info.IsDir() {
		return errors.New("typing privacy preference root must be a non-symlink directory")
	}
	if info.Mode().Perm() != 0o700 {
		if err := os.Chmod(root, 0o700); err != nil {
			return fmt.Errorf("protect typing privacy preference root: %w", err)
		}
	}
	return nil
}

func normalizedTypingPreferenceScope(conversationID, userID string) (string, string, error) {
	conversationID = strings.TrimSpace(conversationID)
	userID = strings.TrimSpace(userID)
	if conversationID == "" {
		return "", "", errors.New("conversation id is required")
	}
	if userID == "" {
		return "", "", errors.New("user id is required")
	}
	if strings.ContainsRune(conversationID, '\x00') || strings.ContainsRune(userID, '\x00') {
		return "", "", errors.New("typing privacy preference identifiers contain an invalid separator")
	}
	return conversationID, userID, nil
}

func cloneTypingPreferenceMap(
	source map[string]typingPrivacyPreferenceEntry,
) map[string]typingPrivacyPreferenceEntry {
	result := make(map[string]typingPrivacyPreferenceEntry, len(source))
	for key, value := range source {
		result[key] = value
	}
	return result
}
