// SPDX-License-Identifier: AGPL-3.0-only

package runtimeconfig

import (
	"context"
	"path/filepath"
	"testing"

	messagingservice "github.com/GoreeCloud/goreecloud-messenger/internal/service"
)

func TestTypingPrivacyPersistenceRequiresExplicitModeAndDefault(t *testing.T) {
	if _, err := typingPrivacyPersistenceFromLookup(environment(nil)); err == nil {
		t.Fatal("expected missing typing privacy configuration to fail closed")
	}
	if _, err := typingPrivacyPersistenceFromLookup(environment(map[string]string{
		typingPrivacyPersistenceEnv: "memory",
	})); err == nil {
		t.Fatal("expected missing default policy to fail closed")
	}
}

func TestTypingPrivacyPersistenceAcceptsExplicitMemoryPolicy(t *testing.T) {
	config, err := typingPrivacyPersistenceFromLookup(environment(map[string]string{
		typingPrivacyPersistenceEnv: " memory ",
		typingPrivacyDefaultEnv:     " deny ",
	}))
	if err != nil {
		t.Fatal(err)
	}
	if config.Mode != TypingPrivacyPersistenceMemory || config.Root != "" || config.DefaultAllowed {
		t.Fatalf("unexpected memory config: %#v", config)
	}

	policy, err := TypingPrivacyStorePolicyFor(config)
	if err != nil {
		t.Fatal(err)
	}
	got, err := policy.GetTypingPreferences(context.Background(), "conversation-a", "user-a")
	if err != nil {
		t.Fatal(err)
	}
	if got.PublishTyping || got.ObserveTyping {
		t.Fatalf("expected deny default, got %+v", got)
	}
}

func TestTypingPrivacyPersistenceFileFactorySurvivesReopen(t *testing.T) {
	root := t.TempDir()
	config := TypingPrivacyPersistenceConfig{
		Mode:           TypingPrivacyPersistenceFile,
		Root:           root,
		DefaultAllowed: true,
	}
	policy, err := TypingPrivacyStorePolicyFor(config)
	if err != nil {
		t.Fatal(err)
	}
	want := messagingservice.TypingPrivacyPreferences{
		PublishTyping: false,
		ObserveTyping: true,
	}
	if err := policy.SetTypingPreferences(
		context.Background(),
		"conversation-a",
		"user-a",
		want,
	); err != nil {
		t.Fatal(err)
	}

	reopened, err := TypingPrivacyStorePolicyFor(config)
	if err != nil {
		t.Fatal(err)
	}
	got, err := reopened.GetTypingPreferences(
		context.Background(),
		"conversation-a",
		"user-a",
	)
	if err != nil {
		t.Fatal(err)
	}
	if got != want {
		t.Fatalf("expected persisted preferences %+v, got %+v", want, got)
	}
}

func TestTypingPrivacyPersistenceRejectsUnsafeOrAmbiguousConfiguration(t *testing.T) {
	absolute := filepath.Join(
		string(filepath.Separator),
		"var",
		"lib",
		"goreecloud",
		"messenger",
		"typing-privacy",
	)

	for name, values := range map[string]map[string]string{
		"memory root": {
			typingPrivacyPersistenceEnv: "memory",
			typingPrivacyDefaultEnv:     "allow",
			typingPrivacyRootEnv:        absolute,
		},
		"file missing root": {
			typingPrivacyPersistenceEnv: "file",
			typingPrivacyDefaultEnv:     "allow",
		},
		"file relative root": {
			typingPrivacyPersistenceEnv: "file",
			typingPrivacyDefaultEnv:     "allow",
			typingPrivacyRootEnv:        "./typing",
		},
		"file filesystem root": {
			typingPrivacyPersistenceEnv: "file",
			typingPrivacyDefaultEnv:     "allow",
			typingPrivacyRootEnv:        string(filepath.Separator),
		},
		"unknown mode": {
			typingPrivacyPersistenceEnv: "database",
			typingPrivacyDefaultEnv:     "allow",
		},
		"unknown default": {
			typingPrivacyPersistenceEnv: "memory",
			typingPrivacyDefaultEnv:     "sometimes",
		},
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := typingPrivacyPersistenceFromLookup(environment(values)); err == nil {
				t.Fatal("expected configuration to fail closed")
			}
		})
	}
}
