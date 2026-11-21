# First-party GoreeCloud UI design-source snapshot

GoreeCloud Messenger consumes the **official** [GoreeCloud/gc-ui](https://github.com/GoreeCloud/gc-ui)
alpha design system, and does not create a separate design authority.

The source files were retrieved directly from the official GitHub repository at
pinned commit:

`5625121316230d78dd40a6e41a0671a250cb873b`

Included, unmodified and SHA-256-verified:
- `android/material3-expressive/gc-ui-compose/src/main/java/com/goreecloud/ui/material3/GoreeCloudExpressiveTheme.kt`
- `android/material3-expressive/gc-ui-compose/src/main/java/com/goreecloud/ui/material3/GeneratedGoreePalettes.kt`
- `src/tokens.css` (generated from canonical `tokens/gc.tokens.json`)
- Official MIT `LICENSE` (copyright 2026 GoreeCloud)

They are source-vendored into Messenger's corresponding Kotlin and web directories.
The checksum and replacement rules are maintained by
`ci/check_gc_ui_source.py`, executed in required CI. **Never edit the
generated palette or stylesheet in Messenger** or silently accept drift; update
the official gc-ui token source first, regenerate upstream, inspect upstream
changes, then deliberately update the source pin and copy.

**Android:** the official `GoreeCloudExpressiveTheme` hosts Material 3
Expressive, shapes, motion and system light/dark preference, with Iris as the
default. UI surfaces, accents, error and success feedback derive from the
central theme. Dynamic wallpaper color remains off by default. Physical-device
visual, high-contrast and accessibility acceptance is not yet established.

**Web:** the original generated tokens CSS is imported, and local semantic
aliases now delegate to canonical `--gc-*` variables. The current preview
intentionally retains its prior Iris/dark appearance in HTML until a separately
designed, privacy-preserving user theme preference is verified. Source pinning
does not itself establish screenshot quality or assistive-technology acceptance.

**Security and roles:** these sources do not access network services,
identity, analytics or storage. GoreeCloud UI provides presentation only;
GoreeShield privacy, Wardveil security and GoreeCloud Mesh integration retain
their separate responsibilities. Source checks cannot prove no vulnerabilities.

**Provenance:** Source comes from a first-party experimental design library
(MIT; not a published Stable SDK), so it is vendored and pinned rather than
assuming a public Maven/npm package exists. Changes are subject to
source review and protected GitHub CI.

## Android Material 3 dependency compatibility

The official theme source directly uses `MaterialTheme(motionScheme = ...)`
and `MotionScheme.expressive()`. Messenger's pinned Compose BOM
`2026.09.00` resolves Material 3 **1.4.0**, where those APIs are not
public to consumers, causing an actual Kotlin compilation error. The official
`gc-ui` module explicitly uses `androidx.compose.material3:material3:1.5.0`.

Messenger therefore keeps the overall Compose BOM for other dependencies
and **explicitly pins Material 3 1.5.0** for this verified first-party
adapter, without modifying the upstream theme source. That is a deliberate
compatibility override, not a globally upgraded Compose release. It must
pass debug APK compilation, unit tests, and guarded protected CI. Native
device accessibility and light/dark visual acceptance remain outstanding.
