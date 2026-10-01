// SPDX-License-Identifier: AGPL-3.0-only

package service

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestFileTypingPrivacyPolicyPersistsMinimizedPreferencesAcrossInstances(t *testing.T) {
	root := t.TempDir()
	first, err := NewFileTypingPrivacyPolicy(root, true)
	if err != nil {
		t.Fatal(err)
	}
	preferences := TypingPrivacyPreferences{PublishTyping: false, ObserveTyping: true}
	if err := first.SetTypingPreferences(context.Background(), "conversation-private", "user-private", preferences); err != nil {
		t.Fatal(err)
	}

	second, err := NewFileTypingPrivacyPolicy(root, true)
	if err != nil {
		t.Fatal(err)
	}
	got, err := second.GetTypingPreferences(context.Background(), "conversation-private", "user-private")
	if err != nil {
		t.Fatal(err)
	}
	if got != preferences {
		t.Fatalf("expected persisted preferences %#v, got %#v", preferences, got)
	}

	entries, err := os.ReadDir(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 {
		t.Fatalf("expected one minimized record, got %d", len(entries))
	}
	bytes, err := os.ReadFile(filepath.Join(root, entries[0].Name()))
	if err != nil {
		t.Fatal(err)
	}
	text := string(bytes)
	for _, forbidden := range []string{"conversation-private", "user-private"} {
		if strings.Contains(text, forbidden) || strings.Contains(entries[0].Name(), forbidden) {
			t.Fatalf("durable typing privacy record exposed identifier %q", forbidden)
		}
	}
}

func TestFileTypingPrivacyPolicyUsesExplicitDefaultUntilOverrideExists(t *testing.T) {
	policy, err := NewFileTypingPrivacyPolicy(t.TempDir(), false)
	if err != nil {
		t.Fatal(err)
	}
	got, err := policy.GetTypingPreferences(context.Background(), "conversation-a", "user-a")
	if err != nil {
		t.Fatal(err)
	}
	if got.PublishTyping || got.ObserveTyping {
		t.Fatalf("expected deny-by-default preferences, got %#v", got)
	}
}

func TestFileTypingPrivacyPolicyFailsClosedOnCorruptPersistedRecord(t *testing.T) {
	root := t.TempDir()
	policy, err := NewFileTypingPrivacyPolicy(root, true)
	if err != nil {
		t.Fatal(err)
	}
	path, err := policy.recordPath("conversation-a", "user-a")
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("not-json\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := policy.CanPublishTyping(context.Background(), "conversation-a", "user-a"); err == nil {
		t.Fatal("expected corrupt durable preference record to fail closed")
	}
}

func TestFileTypingPrivacyPolicyRejectsFilesystemRootAndMissingIdentifiers(t *testing.T) {
	if _, err := NewFileTypingPrivacyPolicy(string(filepath.Separator), true); err == nil {
		t.Fatal("expected filesystem root to be rejected")
	}
	policy, err := NewFileTypingPrivacyPolicy(t.TempDir(), true)
	if err != nil {
		t.Fatal(err)
	}
	if err := policy.SetTypingPreferences(context.Background(), "", "user-a", TypingPrivacyPreferences{}); err == nil {
		t.Fatal("expected missing conversation id to be rejected")
	}
}
