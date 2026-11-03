# GC UI Foundations 1.0.1 — vendored CSS token provenance

**Status:** Implemented token-only consumer integration, not full GC UI component/theme-controller migration.

- Authority: first-party [GoreeCloud/gc-ui](https://github.com/GoreeCloud/gc-ui), stable tag `foundations-v1.0.1` at commit `7e0b61ee70af2edb87aa736cca483425f0aacaf4`
- Verified upstream source: `styles/gc.v1.generated.css` in that tag. It is the supported CSS export of the release-building process and was copied verbatim to `web/foundations/gc-ui-tokens.v1.0.1.css`. Do not edit the generated file; update it by reviewed source pin only.
- Corresponding license copied from tag `LICENSE` into `web/foundations/LICENSE`: Apache License 2.0. No third-party icon or experimental component assets copied.
- Runtime: static first-party CSS loaded from the same origin before `web/styles.css`, mapped to local application aliases. A small in-app mode/contrast attribute bridge respects browser media preferences and a tab-only theme toggle.
- Stable scope includes token CSS/JSON and first-party color/theme runtime; **only token CSS** is consumed here. Application-specific navigation, controls and native Android styling remain noncertified and require separate premium UI, screen-reader and contrast reviews.
- Security: no CDN, npm dependency, new network request origin, cookies or persistent settings introduced.
- Rollback: remove the first-party stylesheet link and restore prior application token declarations from the preceding Messenger commit.

**Verification:** compare the vendored CSS with the exact upstream tagged file; run `npm run check`, `npm test` and `node scripts/browser-smoke.mjs` (Node 22 and Chromium). Validate themes, responsive layout and contrast. Browser screenshots alone do not imply full accessibility acceptance.

## Native Android semantic resource mapping

The Android preview now includes native `values/colors.xml` and `values-night/colors.xml` with lagoon-accented GC UI v1.0.1 semantics, programmatically verified against the exact same vendored CSS via the standard-library-only `android/scripts/check-gc-ui-token-mapping.py` CI gate. The Java Activity reads these native resources at runtime to honor the device's light/dark mode. This is **not** a stable Android GC UI component SDK and has not been accepted through on-device TalkBack or visual QA.
