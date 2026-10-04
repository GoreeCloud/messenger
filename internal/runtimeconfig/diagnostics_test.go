// SPDX-License-Identifier: AGPL-3.0-only

package runtimeconfig

import (
	"path/filepath"
	"strings"
	"testing"

	"github.com/GoreeCloud/goreecloud-messenger/internal/api"
)

func TestReceiptPersistenceDiagnosticReportsMemoryWithoutStorageDetails(t *testing.T) {
	diagnostic, err := ReceiptPersistenceDiagnosticFor(api.ReceiptPersistenceConfig{
		Mode: api.ReceiptPersistenceMemory,
	})
	if err != nil {
		t.Fatal(err)
	}
	if diagnostic.Mode != "memory" || diagnostic.Durability != "process-local" || diagnostic.ConfigurationSource != "environment" {
		t.Fatalf("unexpected diagnostic: %#v", diagnostic)
	}
	if got := diagnostic.LogLine(); got != "receipt_persistence=memory receipt_durability=process-local receipt_config_source=environment" {
		t.Fatalf("unexpected log line: %q", got)
	}
}

func TestReceiptPersistenceDiagnosticNeverIncludesDurableRoot(t *testing.T) {
	root := filepath.Join(string(filepath.Separator), "private", "messenger", "receipt-secret-path")
	diagnostic, err := ReceiptPersistenceDiagnosticFor(api.ReceiptPersistenceConfig{
		Mode: api.ReceiptPersistenceFile,
		Root: root,
	})
	if err != nil {
		t.Fatal(err)
	}

	if diagnostic.Mode != "file" || diagnostic.Durability != "single-node-durable" {
		t.Fatalf("unexpected file diagnostic: %#v", diagnostic)
	}
	line := diagnostic.LogLine()
	for _, forbidden := range []string{root, "private", "receipt-secret-path"} {
		if strings.Contains(line, forbidden) {
			t.Fatalf("diagnostic leaked durable storage detail %q in %q", forbidden, line)
		}
	}
}

func TestReceiptPersistenceDiagnosticRejectsMalformedConfiguration(t *testing.T) {
	cases := []api.ReceiptPersistenceConfig{
		{Mode: api.ReceiptPersistenceMemory, Root: "/must-not-exist"},
		{Mode: api.ReceiptPersistenceFile},
		{Mode: api.ReceiptPersistenceMode("database")},
	}
	for _, config := range cases {
		if _, err := ReceiptPersistenceDiagnosticFor(config); err == nil {
			t.Fatalf("expected malformed config to fail closed: %#v", config)
		}
	}
}

func TestTypingPrivacyPersistenceDiagnosticReportsPolicyWithoutStorageDetails(t *testing.T) {
	root := filepath.Join(
		string(filepath.Separator),
		"private",
		"messenger",
		"typing-secret-path",
	)
	diagnostic, err := TypingPrivacyPersistenceDiagnosticFor(
		TypingPrivacyPersistenceConfig{
			Mode:           TypingPrivacyPersistenceFile,
			Root:           root,
			DefaultAllowed: false,
		},
	)
	if err != nil {
		t.Fatal(err)
	}
	if diagnostic.Mode != "file" ||
		diagnostic.Durability != "single-node-durable" ||
		diagnostic.DefaultPolicy != "deny" ||
		diagnostic.ConfigurationSource != "environment" {
		t.Fatalf("unexpected diagnostic: %#v", diagnostic)
	}

	line := diagnostic.LogLine()
	for _, forbidden := range []string{root, "private", "typing-secret-path"} {
		if strings.Contains(line, forbidden) {
			t.Fatalf("diagnostic leaked durable storage detail %q in %q", forbidden, line)
		}
	}
	if !strings.Contains(line, "typing_privacy_default=deny") {
		t.Fatalf("diagnostic omitted explicit default policy: %q", line)
	}
}

func TestTypingPrivacyPersistenceDiagnosticReportsMemoryAllowDefault(t *testing.T) {
	diagnostic, err := TypingPrivacyPersistenceDiagnosticFor(
		TypingPrivacyPersistenceConfig{
			Mode:           TypingPrivacyPersistenceMemory,
			DefaultAllowed: true,
		},
	)
	if err != nil {
		t.Fatal(err)
	}
	if got := diagnostic.LogLine(); got !=
		"typing_privacy_persistence=memory typing_privacy_durability=process-local typing_privacy_default=allow typing_privacy_config_source=environment" {
		t.Fatalf("unexpected typing privacy diagnostic: %q", got)
	}
}

func TestTypingPrivacyPersistenceDiagnosticRejectsMalformedConfiguration(t *testing.T) {
	cases := []TypingPrivacyPersistenceConfig{
		{Mode: TypingPrivacyPersistenceMemory, Root: "/must-not-exist"},
		{Mode: TypingPrivacyPersistenceFile},
		{Mode: TypingPrivacyPersistenceMode("database")},
	}
	for _, config := range cases {
		if _, err := TypingPrivacyPersistenceDiagnosticFor(config); err == nil {
			t.Fatalf("expected malformed config to fail closed: %#v", config)
		}
	}
}
