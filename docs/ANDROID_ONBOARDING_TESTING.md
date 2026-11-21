# Native Compose Messenger onboarding UI regression checks

The existing Android app remains Kotlin + Jetpack Compose with Material 3.
To make UI interaction verifiable without real Matrix accounts, explicit
Compose test tags identify the homeserver origin, user ID, password field
and connect action. These do not alter production credentials, layout,
design tokens, or Android release permissions.

Three synthetic Android Compose instrumentation checks verify:

1. The unauthenticated screen states the Android Keystore storage and
   key-recovery limitation and disables sign-in initially.
2. A password alone cannot enable sign-in without a user ID.
3. A synthetic user ID and password enable the connect button but are
   **never submitted** to a network or account.

Run after a successful debug APK build, on an authorized Android device:

    cd android
    ./gradlew :app:connectedDebugAndroidTest --no-daemon --console=plain

The test scope is UI affordances, not authentication, account restoration,
encrypted message receipt, device identity verification, accessibility
screen readers, network behavior or production readiness. Do not use a
personal Matrix username or password in any instrumented test.

## Connected-device result (November 20, 2026 local)

The combined Android test run on authorized connected OnePlus DE2117
reported BUILD SUCCESSFUL after the new Compose test dependencies were
included in the androidTest Compose BOM configuration. The connected XML
report contained **9 tests, 0 failures, 0 errors, 0 skipped**:
six existing synthetic Android Keystore/vault tests plus three onboarding
UI tests. No actual Matrix login request was performed.

The test-only login input strings use the reserved example.invalid domain;
the Compose button was enabled but **never clicked**. No existing
Messenger account or production package installation was overwritten.

## Invitation UX extension

After a Matrix sync, pending room invites (if any) are shown with
name-specific accessible Join/Decline labels, and a warning that joining
may disclose membership. This is not a claim that the invite is encrypted
or its sender/device is trusted. A room joined from an invitation is
still subject to the SDK encrypted-room gate for sending.
