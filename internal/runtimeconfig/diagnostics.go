// SPDX-License-Identifier: AGPL-3.0-only

package runtimeconfig

import (
	"errors"
	"fmt"

	"github.com/GoreeCloud/goreecloud-messenger/internal/api"
)

const runtimeConfigurationSource = "environment"

type ReceiptPersistenceDiagnostic struct {
	Mode                string
	Durability          string
	ConfigurationSource string
}

// ReceiptPersistenceDiagnosticFor returns a deliberately minimized operational
// projection. It never contains the configured durable filesystem root.
func ReceiptPersistenceDiagnosticFor(config api.ReceiptPersistenceConfig) (ReceiptPersistenceDiagnostic, error) {
	switch config.Mode {
	case api.ReceiptPersistenceMemory:
		if config.Root != "" {
			return ReceiptPersistenceDiagnostic{}, errors.New("memory receipt persistence must not carry a durable root")
		}
		return ReceiptPersistenceDiagnostic{
			Mode:                string(api.ReceiptPersistenceMemory),
			Durability:          "process-local",
			ConfigurationSource: runtimeConfigurationSource,
		}, nil
	case api.ReceiptPersistenceFile:
		if config.Root == "" {
			return ReceiptPersistenceDiagnostic{}, errors.New("file receipt persistence requires configured durable storage")
		}
		return ReceiptPersistenceDiagnostic{
			Mode:                string(api.ReceiptPersistenceFile),
			Durability:          "single-node-durable",
			ConfigurationSource: runtimeConfigurationSource,
		}, nil
	default:
		return ReceiptPersistenceDiagnostic{}, fmt.Errorf("unsupported receipt persistence mode")
	}
}

func (diagnostic ReceiptPersistenceDiagnostic) LogLine() string {
	return fmt.Sprintf(
		"receipt_persistence=%s receipt_durability=%s receipt_config_source=%s",
		diagnostic.Mode,
		diagnostic.Durability,
		diagnostic.ConfigurationSource,
	)
}

type TypingPrivacyPersistenceDiagnostic struct {
	Mode                string
	Durability          string
	DefaultPolicy       string
	ConfigurationSource string
}

// TypingPrivacyPersistenceDiagnosticFor reports only categorical operational state.
// The configured filesystem root is deliberately omitted.
func TypingPrivacyPersistenceDiagnosticFor(
	config TypingPrivacyPersistenceConfig,
) (TypingPrivacyPersistenceDiagnostic, error) {
	defaultPolicy := "deny"
	if config.DefaultAllowed {
		defaultPolicy = "allow"
	}

	switch config.Mode {
	case TypingPrivacyPersistenceMemory:
		if config.Root != "" {
			return TypingPrivacyPersistenceDiagnostic{}, errors.New(
				"memory typing privacy persistence must not carry a durable root",
			)
		}
		return TypingPrivacyPersistenceDiagnostic{
			Mode:                string(TypingPrivacyPersistenceMemory),
			Durability:          "process-local",
			DefaultPolicy:       defaultPolicy,
			ConfigurationSource: runtimeConfigurationSource,
		}, nil
	case TypingPrivacyPersistenceFile:
		if config.Root == "" {
			return TypingPrivacyPersistenceDiagnostic{}, errors.New(
				"file typing privacy persistence requires configured durable storage",
			)
		}
		return TypingPrivacyPersistenceDiagnostic{
			Mode:                string(TypingPrivacyPersistenceFile),
			Durability:          "single-node-durable",
			DefaultPolicy:       defaultPolicy,
			ConfigurationSource: runtimeConfigurationSource,
		}, nil
	default:
		return TypingPrivacyPersistenceDiagnostic{}, fmt.Errorf(
			"unsupported typing privacy persistence mode",
		)
	}
}

func (diagnostic TypingPrivacyPersistenceDiagnostic) LogLine() string {
	return fmt.Sprintf(
		"typing_privacy_persistence=%s typing_privacy_durability=%s typing_privacy_default=%s typing_privacy_config_source=%s",
		diagnostic.Mode,
		diagnostic.Durability,
		diagnostic.DefaultPolicy,
		diagnostic.ConfigurationSource,
	)
}
