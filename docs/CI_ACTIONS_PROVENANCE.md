# GitHub Actions supply-chain controls

Messenger's GitHub workflow actions are now pinned to **full 40-character Git
commit SHAs**, rather than moving major-version tags. All referenced commits
were resolved against the current upstream GitHub repositories before changing
the workflow configuration. Human-readable major-version comments remain
alongside each commit for review and Dependabot.

Pinning protects future runs from a tag unexpectedly resolving to a different
commit. It does **not** prove that the existing upstream JavaScript, binary
or action dependencies are safe; source and license review, signed release
verification, sandbox boundaries and action-version updates remain important.

Pinned actions in the current CI workflows include checkout, setup-node,
setup-java, upload-artifact and android-actions/setup-android. Weekly
Dependabot GitHub Actions update proposals remain configured. Review proposed
SHA updates against corresponding upstream release source and official version
documentation. Never auto-merge without web/Android/backend checks.

The standard-library-only offline test in ci/tests/test_actions_pins.py checks
that actions are pinned and comments retain the reviewed major version. The
scheduled dependency-audit workflow invokes those tests; it still does not
audit the behavior of external actions.

GitHub's protected main branch and limited workflow contents:read permissions
remain mandatory. Builds and preview artifacts do not receive production
credentials or release-signing keys.
