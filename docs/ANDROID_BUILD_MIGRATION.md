# Coordinated Android build-toolchain migration

The isolated Dependabot proposals #20 (Compose BOM 2026.09.00) and #21
(Gradle 9.9.1) fail when applied independently. The Compose libraries require
compileSdk 37 with Android Gradle Plugin (AGP) at least 9.1; Gradle 9.9.1 removed
an internal API still consumed by AGP 8.13.2.

This candidate migrates the build stack together:

- Gradle 8.13 to **9.9.1**, with the official distribution SHA-256 pinned in
  gradle-wrapper.properties, verified against services.gradle.org.
- AGP 8.13.2 to **9.5.1**, with AGP 9 built-in Kotlin. The standalone
  org.jetbrains.kotlin.android plugin is not applied twice.
- compileSdk 36 to **37**; Compose BOM 2025.10.01 to **2026.09.00**.
- Retain Kotlin Compose compiler plugin **2.4.21**, minSdk **26** and targetSdk
  **35**. Raising the compile SDK does not authorize raising the target SDK.
- Keep the official Matrix Rust SDK dependency and its source attribution.

## Acceptance gates

Required protected GitHub CI: Android unit tests and debug APK, web unit
tests/typecheck/production build, and backend offline provenance tests.

Required separate device checks: connectedDebugAndroidTest on the test-only
Keystore alias, Android 16 launch/navigation, existing-account restoration,
encrypted-room UX and accessibility, before distribution.

If toolchain compatibility is rejected, retain protected main unchanged;
do not bypass CI or ship an incompatible Kotlin/Compose/FFI dependency set.

Sources consulted November 20, 2026: Android official AGP 9.1.1 compatibility
(API 37) and AGP 9.5 release notes (Gradle >= 9.6; API 37):
https://developer.android.com/build/releases/agp-9-1-0-release-notes
https://developer.android.com/build/releases/agp-9-5-0-release-notes

No production release or deployment is represented by this build migration.
