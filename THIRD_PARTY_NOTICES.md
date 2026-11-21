# Third-party source and licensing

GoreeCloud does not claim authorship of imported upstream components.

| Project | Source | Purpose | License |
| --- | --- | --- | --- |
| Synapse v1.163.0 | https://github.com/element-hq/synapse | Pinned homeserver source and dev image | AGPL-3.0-or-later or commercial; this vendored copy is governed by AGPL |
| matrix-js-sdk 45.1.0 | https://github.com/matrix-org/matrix-js-sdk | Browser protocol and Rust crypto integration | Apache-2.0 |
| Matrix Rust SDK | https://github.com/matrix-org/matrix-rust-sdk | Native Android protocol, E2EE and timeline SDK pinned to sdk-android 26.11.17 | Apache-2.0 |
| React | https://github.com/facebook/react | First-party web UI | MIT |
| Vite | https://github.com/vitejs/vite | Web build tooling | MIT |
| Jetpack Compose | https://developer.android.com/compose | Native Android UI | Apache-2.0 |

| GoreeCloud UI (first-party) | https://github.com/GoreeCloud/gc-ui | Source-pinned official web token stylesheet and Android Material 3 Expressive Compose theme; see `third_party/gc-ui/SOURCE.md` | MIT (copyright 2026 GoreeCloud) |

The repository root Apache-2.0 license governs new first-party code unless otherwise marked. Synapse files in third_party/synapse retain their source-origin AGPL, copyright and notices; no upstream code is relicensed by the root file. A complete transitive dependency licensing inventory and source security assessment are still pending.
