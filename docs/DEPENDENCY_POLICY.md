# Dependency supply-chain maintenance

The repository's lockfiles, approved pinned vendor source, and branch
protection are the source of truth for software being built. Dependency
updates are proposals until tests, license review and scoped code review
verify that they work. Never automatically merge dependency PRs.

The scheduled and manually callable workflow
.github/workflows/dependency-audit.yml checks the locked web production
dependency advisory surface using npm audit and retains a CycloneDX JSON
software bill of materials for seven days. A local verification on
November 19, 2026 found zero known production npm advisories (not a guarantee
of security). The workflow also checks source provenance and the loopback
development Compose policy; it does NOT run vendored code.

Dependabot is set to propose npm updates for web/, Gradle updates for
android/, and GitHub Actions updates on a weekly schedule, each limited to
small batches of outstanding PRs. PR branch protection and CI continue to
apply. An SBOM is inventory, not a vulnerability scan, runtime evidence
or proof of license compliance.

The Android wrapper distribution is Gradle 8.13, guarded by the official
SHA-256 download checksum when a fresh distribution download occurs.
This protects the distribution ZIP against undetected network tampering,
but not the build script, Java dependencies or private development machine.
Gradle dependency scanning, native Rust binary supply-chain verification,
third-party license acceptance, artifact signature transparency, and a
reproducible server image remain outstanding.

No external scanner should be installed/executed without inspecting its
source, permissions, inputs, outputs and dependencies. Do not run arbitrary
untrusted PR code with repository write credentials or production secrets.
