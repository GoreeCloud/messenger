// SPDX-License-Identifier: AGPL-3.0-only

package runtimeconfig

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	messagingservice "github.com/GoreeCloud/goreecloud-messenger/internal/service"
)

const (
	typingPrivacyPersistenceEnv = "GOREECLOUD_MESSENGER_TYPING_PRIVACY_PERSISTENCE"
	typingPrivacyRootEnv        = "GOREECLOUD_MESSENGER_TYPING_PRIVACY_ROOT"
	typingPrivacyDefaultEnv     = "GOREECLOUD_MESSENGER_TYPING_PRIVACY_DEFAULT"
)

type TypingPrivacyPersistenceMode string

const (
	TypingPrivacyPersistenceMemory TypingPrivacyPersistenceMode = "memory"
	TypingPrivacyPersistenceFile   TypingPrivacyPersistenceMode = "file"
)

type TypingPrivacyPersistenceConfig struct {
	Mode           TypingPrivacyPersistenceMode
	Root           string
	DefaultAllowed bool
}

// TypingPrivacyStorePolicy is the exact pair of boundaries required to both enforce
// and mutate typing privacy preferences.
type TypingPrivacyStorePolicy interface {
	messagingservice.TypingPrivacyPreferenceStore
	messagingservice.TypingPrivacyPolicy
}

// TypingPrivacyPersistenceFromEnvironment requires explicit persistence and default-policy
// choices. There is no silent memory fallback.
func TypingPrivacyPersistenceFromEnvironment() (TypingPrivacyPersistenceConfig, error) {
	return typingPrivacyPersistenceFromLookup(os.LookupEnv)
}

func typingPrivacyPersistenceFromLookup(lookup lookupEnvironment) (TypingPrivacyPersistenceConfig, error) {
	if lookup == nil {
		return TypingPrivacyPersistenceConfig{}, errors.New("environment lookup is required")
	}

	modeValue, ok := lookup(typingPrivacyPersistenceEnv)
	if !ok || strings.TrimSpace(modeValue) == "" {
		return TypingPrivacyPersistenceConfig{}, fmt.Errorf("%s is required", typingPrivacyPersistenceEnv)
	}
	defaultValue, ok := lookup(typingPrivacyDefaultEnv)
	if !ok || strings.TrimSpace(defaultValue) == "" {
		return TypingPrivacyPersistenceConfig{}, fmt.Errorf("%s is required", typingPrivacyDefaultEnv)
	}
	defaultAllowed, err := parseTypingPrivacyDefault(defaultValue)
	if err != nil {
		return TypingPrivacyPersistenceConfig{}, err
	}

	mode := TypingPrivacyPersistenceMode(strings.ToLower(strings.TrimSpace(modeValue)))
	rootValue, rootSet := lookup(typingPrivacyRootEnv)
	root := strings.TrimSpace(rootValue)

	switch mode {
	case TypingPrivacyPersistenceMemory:
		if rootSet && root != "" {
			return TypingPrivacyPersistenceConfig{}, fmt.Errorf(
				"%s must be unset in memory mode",
				typingPrivacyRootEnv,
			)
		}
		return TypingPrivacyPersistenceConfig{
			Mode:           mode,
			DefaultAllowed: defaultAllowed,
		}, nil

	case TypingPrivacyPersistenceFile:
		if !rootSet || root == "" {
			return TypingPrivacyPersistenceConfig{}, fmt.Errorf(
				"%s is required in file mode",
				typingPrivacyRootEnv,
			)
		}
		if !filepath.IsAbs(root) {
			return TypingPrivacyPersistenceConfig{}, fmt.Errorf(
				"%s must be an absolute path",
				typingPrivacyRootEnv,
			)
		}
		cleaned := filepath.Clean(root)
		if cleaned == string(filepath.Separator) {
			return TypingPrivacyPersistenceConfig{}, fmt.Errorf(
				"%s must not be the filesystem root",
				typingPrivacyRootEnv,
			)
		}
		return TypingPrivacyPersistenceConfig{
			Mode:           mode,
			Root:           cleaned,
			DefaultAllowed: defaultAllowed,
		}, nil

	default:
		return TypingPrivacyPersistenceConfig{}, fmt.Errorf(
			"unsupported %s value %q",
			typingPrivacyPersistenceEnv,
			modeValue,
		)
	}
}

func parseTypingPrivacyDefault(value string) (bool, error) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "allow":
		return true, nil
	case "deny":
		return false, nil
	default:
		return false, fmt.Errorf(
			"%s must be either allow or deny",
			typingPrivacyDefaultEnv,
		)
	}
}

// TypingPrivacyStorePolicyFor instantiates the configured Development boundary.
// File mode gains single-node durability only; it does not establish Privacy Shield
// acceptance or production persistence.
func TypingPrivacyStorePolicyFor(
	config TypingPrivacyPersistenceConfig,
) (TypingPrivacyStorePolicy, error) {
	switch config.Mode {
	case TypingPrivacyPersistenceMemory:
		if config.Root != "" {
			return nil, errors.New("memory typing privacy persistence must not carry a root")
		}
		return messagingservice.NewMemoryTypingPrivacyPolicy(config.DefaultAllowed), nil

	case TypingPrivacyPersistenceFile:
		if strings.TrimSpace(config.Root) == "" {
			return nil, errors.New("file typing privacy persistence requires a root")
		}
		return messagingservice.NewFileTypingPrivacyPolicy(
			config.Root,
			config.DefaultAllowed,
		)

	default:
		return nil, errors.New("unsupported typing privacy persistence mode")
	}
}
