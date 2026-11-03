# GoreeCloud Messenger — Native Android preview

**Status:** Developer-only Android application, not an SMS/MMS provider, and not a production messenger.

This directory contains an original Android Activity written in Java, displaying the four target modes: DATA, RCS, MMS, and SMS. The working interaction is **safe, delegated text composition**: the user enters a phone number and optional message, taps *Open system messaging app*, then reviews and sends in the separately installed default messaging app. The app does **not** transmit an SMS, read SMS/MMS databases, receive messages, prompt for the default SMS role, or request dangerous SMS permissions. It is not a bridge that can detect or control whether the handler chooses SMS, MMS or RCS.

## First-party GC UI semantic colors

Android's light and dark palette resources now use the exact supported **GC UI Foundations 1.0.1** semantic color roles from the same tagged first-party stylesheet as the web preview. System light/dark configuration chooses native `values/` or `values-night/` resources; lagoon is the explicit app accent. All palette mappings are checked by `android/scripts/check-gc-ui-token-mapping.py` before the Gradle build. This is **resource-level token parity only**; no native GC UI component SDK or real-device theme audit is claimed.

## Build and validation

- Android SDK platform 36; Android Gradle Plugin 8.13.2; Gradle 8.13; JDK 17.
- `gradle :app:assembleDebug :app:testDebugUnitTest` from this directory, with the Android SDK installed.
- `.github/workflows/android-preview.yml` verifies GC UI palette parity and builds, runs JVM tests, and Android lint on applicable pushes/PRs. The token check also runs when its first-party source CSS changes.
- The native UI and handoff require **real-device tests**. Compiling or running unit tests is not proof of device delivery.
- CI additionally runs Android lint and publishes a **short-lived debug APK artifact** for authorized testers. Download from the successful Android native preview workflow. The APK is unsigned for production release (debug-signed by the Android SDK), not approved for app stores and not a replacement default SMS handler.

No Gradle wrapper binary is checked in. Use a trusted local Gradle installation or the pinned GitHub Actions setup. Do not download or execute unfamiliar wrapper binaries.

## Release gates

1. Explicit user approval and safety of SMS role transition. Never advertise default-SMS eligibility before complete SMS and MMS receive/send/persistence, recovery, export, multi-SIM behavior, and denial/fallback handling.
2. Implement SMS-deliver and WAP-push delivery components with correct Android permissions, provider lifecycle, and comprehensive tests; do not add stub receivers that would swallow messages.
3. Runtime-role/permission guidance consistent with Android's restricted permissions and Google Play policies.
4. Distinct transport/security labels, costs, send/delivery/failure callbacks and multi-SIM choice.
5. Screen-reader, rotation, zoom, color contrast, gesture target size and device carrier testing.
6. RCS interoperability only through a legitimate, authorized provider/OEM/operator API; never assume public IMS access.
7. Native DATA client uses vetted Matrix cryptography, verified identities, recovery and independent security review.

Official platform references:
- https://developer.android.com/guide/components/intents-common
- https://developer.android.com/reference/android/provider/Telephony
- https://developer.android.com/guide/topics/permissions/default-handlers
- https://developer.android.com/build/releases/agp-8-13-0-release-notes
