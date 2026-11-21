# Manual Android synthetic device acceptance in GitHub Actions

The nine previously passing connected-device Android tests were exercised
on an authorized OnePlus handset before the official GoreeCloud UI
Material 3 Expressive theme migration and later native invitation checks.
That handset is currently disconnected. A separate **manual-only** GitHub
Actions workflow `.github/workflows/android-emulator-isolated.yml`
can run the same tests on a disposable Android 35 emulator without
touching the owner's phone, Matrix account or production servers.

## Verified design and constraints

- Manual dispatch on **protected main** only, with explicit `YES` consent.
- Dedicated `messenger-android-emulator` GitHub environment, limited
  to protected branches. No secrets, artifact uploads or release signing.
- GitHub-hosted ephemeral Ubuntu 24.04, pinned checkout, JDK 21,
  official Android SDK tools; verifies first-party GoreeCloud UI source
  pins and Gradle wrapper before any build.
- Pinned upstream action
  `ReactiveCircus/android-emulator-runner@a421e43855164a8197daf9d8d40fe71c6996bb0d`
  from the reviewed Android Emulator Runner v2 source (repository
  Apache-2.0; package metadata differs and warrants independent licensing
  review). The action may download Android SDK emulator images.
- Android API 35, Google APIs x86_64 synthetic emulator, headless,
  hardware KVM acceleration on the **disposable GitHub runner only**,
  2 GiB guest memory, bounded boot timeout and 40-minute job limit.
- Executes `./gradlew :app:connectedDebugAndroidTest` with the existing
  six synthetic Android Keystore/vault checks and three no-login Compose
  onboarding tests. Test-only Android Keystore aliases use a separate
  slot, and cleanup is enforced by test @After handlers. Inputs never
  submit login or use real servers.

## Launch after merging

```sh
gh workflow run android-emulator-isolated.yml -R GoreeCloud/messenger --ref main \
  -f disposable_emulator_ack=YES
```

Do not run on user-controlled VPS or laptop to work around lack of
hardware acceleration. Inspect the current main workflow and exact
upstream action pins before accepting any runtime result. A successful
full emulator test must be recorded with the GitHub run ID, not inferred
from a passing unit-test or compile-only PR CI check.

## Exclusions

This test does not validate signed APK distribution, the owner's physical
Android16 handset, end-to-end Matrix cryptography, device identity, SAS/QR
verification, key recovery, real homeserver login, real invitation
acceptance, accessibility services, or production security. These remain
separate release gates. This workflow is a testing aid, not an app
deployment or implicit production environment.

The KVM udev rule is scoped to an ephemeral GitHub-hosted runner. It is
never applied to GoreeCloud production devices. Passing tests do not
make third-party GitHub Actions a security boundary; the action version
is pinned and source reviewed, but requires continued dependency review.
