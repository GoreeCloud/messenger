// SPDX-License-Identifier: AGPL-3.0-only

package service

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestFileTypingPrivacyPolicySurvivesReopenAndImplementsPolicy(t *testing.T) {
	root := t.TempDir()
	policy, err := NewFileTypingPrivacyPolicy(root, true)
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()

	initial, err := policy.GetTypingPreferences(ctx, "conversation-a", "user-a")
	if err != nil {
		t.Fatal(err)
	}
	if !initial.PublishTyping || !initial.ObserveTyping {
		t.Fatalf("expected enabled defaults, got %+v", initial)
	}

	want := TypingPrivacyPreferences{PublishTyping: false, ObserveTyping: true}
	if err := policy.SetTypingPreferences(ctx, "conversation-a", "user-a", want); err != nil {
		t.Fatal(err)
	}

	reopened, err := NewFileTypingPrivacyPolicy(root, true)
	if err != nil {
		t.Fatal(err)
	}
	got, err := reopened.GetTypingPreferences(ctx, "conversation-a", "user-a")
	if err != nil {
		t.Fatal(err)
	}
	if got != want {
		t.Fatalf("expected persisted preferences %+v, got %+v", want, got)
	}
	publish, err := reopened.CanPublishTyping(ctx, "conversation-a", "user-a")
	if err != nil || publish {
		t.Fatalf("expected persisted publish denial, allowed=%v err=%v", publish, err)
	}
	observe, err := reopened.CanObserveTyping(ctx, "conversation-a", "user-a")
	if err != nil || !observe {
		t.Fatalf("expected persisted observe allowance, allowed=%v err=%v", observe, err)
	}

	stateInfo, err := os.Stat(filepath.Join(root, "typing-privacy-preferences.json"))
	if err != nil {
		t.Fatal(err)
	}
	if stateInfo.Mode().Perm() != 0o600 {
		t.Fatalf("expected private state permissions, got %o", stateInfo.Mode().Perm())
	}
	rootInfo, err := os.Stat(root)
	if err != nil {
		t.Fatal(err)
	}
	if rootInfo.Mode().Perm() != 0o700 {
		t.Fatalf("expected private root permissions, got %o", rootInfo.Mode().Perm())
	}
}

func TestFileTypingPrivacyPolicyDefaultsRemainConstructorControlled(t *testing.T) {
	root := t.TempDir()
	policy, err := NewFileTypingPrivacyPolicy(root, false)
	if err != nil {
		t.Fatal(err)
	}
	if err := policy.SetTypingPreferences(
		context.Background(),
		"conversation-a",
		"user-a",
		TypingPrivacyPreferences{PublishTyping: true, ObserveTyping: false},
	); err != nil {
		t.Fatal(err)
	}

	reopened, err := NewFileTypingPrivacyPolicy(root, false)
	if err != nil {
		t.Fatal(err)
	}
	other, err := reopened.GetTypingPreferences(context.Background(), "conversation-a", "user-b")
	if err != nil {
		t.Fatal(err)
	}
	if other.PublishTyping || other.ObserveTyping {
		t.Fatalf("expected constructor default false for unset scope, got %+v", other)
	}
}

func TestFileTypingPrivacyPolicyRejectsUnknownFieldsTrailingDocumentsAndAmbiguousScopes(t *testing.T) {
	for name, data := range map[string]string{
		"unknown field":             `{"version":1,"preferences":[],"unexpected":true}`,
		"trailing document":         `{"version":1,"preferences":[]} {"version":1,"preferences":[]}`,
		"separator in conversation": `{"version":1,"preferences":[{"conversation_id":"conversation\u0000a","user_id":"user-a","publish_typing":true,"observe_typing":true}]}`,
		"separator in user":         `{"version":1,"preferences":[{"conversation_id":"conversation-a","user_id":"user\u0000a","publish_typing":true,"observe_typing":true}]}`,
	} {
		t.Run(name, func(t *testing.T) {
			root := t.TempDir()
			path := filepath.Join(root, "typing-privacy-preferences.json")
			if err := os.WriteFile(path, []byte(data), 0o600); err != nil {
				t.Fatal(err)
			}
			if _, err := NewFileTypingPrivacyPolicy(root, true); err == nil {
				t.Fatal("expected unsafe persisted state to fail closed")
			}
		})
	}

	policy, err := NewFileTypingPrivacyPolicy(t.TempDir(), true)
	if err != nil {
		t.Fatal(err)
	}
	if err := policy.SetTypingPreferences(
		context.Background(),
		"conversation\x00a",
		"user-a",
		TypingPrivacyPreferences{},
	); err == nil {
		t.Fatal("expected separator-bearing runtime scope to be rejected")
	}
}

func TestFileTypingPrivacyPolicyFailsClosedOnCorruptUnsupportedOrUnsafeState(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "typing-privacy-preferences.json")

	if err := os.WriteFile(path, []byte("not-json"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := NewFileTypingPrivacyPolicy(root, true); err == nil {
		t.Fatal("expected corrupt state to fail closed")
	}

	if err := os.WriteFile(path, []byte(`{"version":99,"preferences":[]}`), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := NewFileTypingPrivacyPolicy(root, true); err == nil {
		t.Fatal("expected unsupported state version to fail closed")
	}

	if err := os.WriteFile(path, []byte(`{"version":1,"preferences":[]}`), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(path, 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := NewFileTypingPrivacyPolicy(root, true); err == nil {
		t.Fatal("expected permissive state permissions to fail closed")
	}
}

func TestFileTypingPrivacyPolicyRejectsSymlinkBoundaries(t *testing.T) {
	base := t.TempDir()
	target := filepath.Join(base, "target")
	if err := os.Mkdir(target, 0o700); err != nil {
		t.Fatal(err)
	}
	rootLink := filepath.Join(base, "root-link")
	if err := os.Symlink(target, rootLink); err != nil {
		t.Fatal(err)
	}
	if _, err := NewFileTypingPrivacyPolicy(rootLink, true); err == nil {
		t.Fatal("expected symlink root to fail closed")
	}

	stateRoot := filepath.Join(base, "state-root")
	if err := os.Mkdir(stateRoot, 0o700); err != nil {
		t.Fatal(err)
	}
	stateTarget := filepath.Join(base, "state-target.json")
	if err := os.WriteFile(stateTarget, []byte(`{"version":1,"preferences":[]}`), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(stateTarget, filepath.Join(stateRoot, "typing-privacy-preferences.json")); err != nil {
		t.Fatal(err)
	}
	if _, err := NewFileTypingPrivacyPolicy(stateRoot, true); err == nil {
		t.Fatal("expected symlink state to fail closed")
	}
}

func TestFileTypingPrivacyPolicyPoisonsAmbiguousPostRenameStateUntilReopen(t *testing.T) {
	root := t.TempDir()
	policy, err := NewFileTypingPrivacyPolicy(root, true)
	if err != nil {
		t.Fatal(err)
	}

	originalSync := syncTypingPreferenceDirectory
	defer func() { syncTypingPreferenceDirectory = originalSync }()
	syncTypingPreferenceDirectory = func(string) error {
		return errors.New("simulated directory sync failure")
	}

	ctx := context.Background()
	writeErr := policy.SetTypingPreferences(
		ctx,
		"conversation-a",
		"user-a",
		TypingPrivacyPreferences{PublishTyping: false, ObserveTyping: true},
	)
	if !errors.Is(writeErr, ErrTypingPreferenceDurabilityUnknown) {
		t.Fatalf("expected durability-unknown error, got %v", writeErr)
	}
	if _, err := policy.GetTypingPreferences(ctx, "conversation-a", "user-a"); !errors.Is(err, ErrTypingPreferenceDurabilityUnknown) {
		t.Fatalf("expected poisoned store to reject reads, got %v", err)
	}

	syncTypingPreferenceDirectory = originalSync
	reopened, err := NewFileTypingPrivacyPolicy(root, true)
	if err != nil {
		t.Fatal(err)
	}
	got, err := reopened.GetTypingPreferences(ctx, "conversation-a", "user-a")
	if err != nil {
		t.Fatal(err)
	}
	if got.PublishTyping || !got.ObserveTyping {
		t.Fatalf("expected reopen to reconcile renamed state, got %+v", got)
	}
}

func TestFileTypingPrivacyPolicyHonorsCanceledContext(t *testing.T) {
	policy, err := NewFileTypingPrivacyPolicy(t.TempDir(), true)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	if _, err := policy.GetTypingPreferences(ctx, "conversation-a", "user-a"); !errors.Is(err, context.Canceled) {
		t.Fatalf("expected canceled read, got %v", err)
	}
	if err := policy.SetTypingPreferences(ctx, "conversation-a", "user-a", TypingPrivacyPreferences{}); !errors.Is(err, context.Canceled) {
		t.Fatalf("expected canceled write, got %v", err)
	}

func TestFileTypingPrivacyPolicyResetSurvivesReopen(t *testing.T) {
	root := t.TempDir()
	policy, err := NewFileTypingPrivacyPolicy(root, false)
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	if err := policy.SetTypingPreferences(
		ctx,
		"conversation-a",
		"user-a",
		TypingPrivacyPreferences{PublishTyping: true, ObserveTyping: true},
	); err != nil {
		t.Fatal(err)
	}
	if err := policy.DeleteTypingPreferences(ctx, "conversation-a", "user-a"); err != nil {
		t.Fatal(err)
	}

	reopened, err := NewFileTypingPrivacyPolicy(root, false)
	if err != nil {
		t.Fatal(err)
	}
	got, err := reopened.GetTypingPreferences(ctx, "conversation-a", "user-a")
	if err != nil {
		t.Fatal(err)
	}
	if got.PublishTyping || got.ObserveTyping {
		t.Fatalf("expected reset scope to use configured defaults, got %+v", got)
	}
}

}
