// SPDX-License-Identifier: AGPL-3.0-only

package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

const typingPrivacyRecordVersion = 1

type typingPrivacyRecord struct {
	Version       int  `json:"version"`
	PublishTyping bool `json:"publish_typing"`
	ObserveTyping bool `json:"observe_typing"`
}

// FileTypingPrivacyPolicy is a single-node durable Development adapter for the
// minimized typing privacy preference contract. It stores only the two explicit
// booleans. Conversation/user identifiers are used only to derive a SHA-256 file
// key and are not written into the record body.
type FileTypingPrivacyPolicy struct {
	mu             sync.RWMutex
	rootDir        string
	defaultAllowed bool
}

func NewFileTypingPrivacyPolicy(rootDir string, defaultAllowed bool) (*FileTypingPrivacyPolicy, error) {
	rootDir = strings.TrimSpace(rootDir)
	if rootDir == "" {
		return nil, errors.New("typing privacy persistence root is required")
	}
	absolute, err := filepath.Abs(rootDir)
	if err != nil {
		return nil, fmt.Errorf("resolve typing privacy persistence root: %w", err)
	}
	if absolute == string(filepath.Separator) {
		return nil, errors.New("typing privacy persistence root cannot be filesystem root")
	}
	if err := os.MkdirAll(absolute, 0o700); err != nil {
		return nil, fmt.Errorf("create typing privacy persistence root: %w", err)
	}
	if err := os.Chmod(absolute, 0o700); err != nil {
		return nil, fmt.Errorf("protect typing privacy persistence root: %w", err)
	}
	return &FileTypingPrivacyPolicy{rootDir: absolute, defaultAllowed: defaultAllowed}, nil
}

func (p *FileTypingPrivacyPolicy) GetTypingPreferences(
	_ context.Context,
	conversationID,
	userID string,
) (TypingPrivacyPreferences, error) {
	path, err := p.recordPath(conversationID, userID)
	if err != nil {
		return TypingPrivacyPreferences{}, err
	}

	p.mu.RLock()
	defer p.mu.RUnlock()
	bytes, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return TypingPrivacyPreferences{
			PublishTyping: p.defaultAllowed,
			ObserveTyping: p.defaultAllowed,
		}, nil
	}
	if err != nil {
		return TypingPrivacyPreferences{}, fmt.Errorf("read typing privacy preference: %w", err)
	}

	var record typingPrivacyRecord
	if err := json.Unmarshal(bytes, &record); err != nil {
		return TypingPrivacyPreferences{}, fmt.Errorf("decode typing privacy preference: %w", err)
	}
	if record.Version != typingPrivacyRecordVersion {
		return TypingPrivacyPreferences{}, fmt.Errorf("unsupported typing privacy preference version %d", record.Version)
	}
	return TypingPrivacyPreferences{
		PublishTyping: record.PublishTyping,
		ObserveTyping: record.ObserveTyping,
	}, nil
}

func (p *FileTypingPrivacyPolicy) SetTypingPreferences(
	_ context.Context,
	conversationID,
	userID string,
	preferences TypingPrivacyPreferences,
) error {
	path, err := p.recordPath(conversationID, userID)
	if err != nil {
		return err
	}
	record := typingPrivacyRecord{
		Version:       typingPrivacyRecordVersion,
		PublishTyping: preferences.PublishTyping,
		ObserveTyping: preferences.ObserveTyping,
	}
	bytes, err := json.Marshal(record)
	if err != nil {
		return fmt.Errorf("encode typing privacy preference: %w", err)
	}
	bytes = append(bytes, '\n')

	p.mu.Lock()
	defer p.mu.Unlock()
	temp, err := os.CreateTemp(p.rootDir, ".typing-privacy-*")
	if err != nil {
		return fmt.Errorf("create typing privacy temporary record: %w", err)
	}
	tempPath := temp.Name()
	removeTemp := true
	defer func() {
		_ = temp.Close()
		if removeTemp {
			_ = os.Remove(tempPath)
		}
	}()
	if err := temp.Chmod(0o600); err != nil {
		return fmt.Errorf("protect typing privacy temporary record: %w", err)
	}
	if _, err := temp.Write(bytes); err != nil {
		return fmt.Errorf("write typing privacy temporary record: %w", err)
	}
	if err := temp.Sync(); err != nil {
		return fmt.Errorf("sync typing privacy temporary record: %w", err)
	}
	if err := temp.Close(); err != nil {
		return fmt.Errorf("close typing privacy temporary record: %w", err)
	}
	if err := os.Rename(tempPath, path); err != nil {
		return fmt.Errorf("commit typing privacy preference: %w", err)
	}
	removeTemp = false
	return nil
}

func (p *FileTypingPrivacyPolicy) CanPublishTyping(ctx context.Context, conversationID, userID string) (bool, error) {
	preferences, err := p.GetTypingPreferences(ctx, conversationID, userID)
	if err != nil {
		return false, err
	}
	return preferences.PublishTyping, nil
}

func (p *FileTypingPrivacyPolicy) CanObserveTyping(ctx context.Context, conversationID, userID string) (bool, error) {
	preferences, err := p.GetTypingPreferences(ctx, conversationID, userID)
	if err != nil {
		return false, err
	}
	return preferences.ObserveTyping, nil
}

func (p *FileTypingPrivacyPolicy) recordPath(conversationID, userID string) (string, error) {
	conversationID = strings.TrimSpace(conversationID)
	userID = strings.TrimSpace(userID)
	if conversationID == "" || userID == "" {
		return "", errors.New("conversation id and user id are required for typing privacy persistence")
	}
	digest := sha256.Sum256([]byte(typingStateKey(conversationID, userID)))
	return filepath.Join(p.rootDir, hex.EncodeToString(digest[:])+".json"), nil
}
