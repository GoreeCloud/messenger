# Synapse offline backup-input and restore-rehearsal gates

This repository includes an offline, standard-library-only verifier for a
PostgreSQL dump and optional media bundle. It is a **precondition** to a
real restore rehearsal, not the restore itself.

The manifest uses the exact JSON schema below, with actual byte size and
lowercase SHA-256 for each operator-produced file:

```json
{
  "version": 1,
  "files": [
    {
      "name": "database.dump",
      "bytes": 123456,
      "sha256": "<replace with actual 64-character SHA-256>"
    }
  ]
}
```

Optional file `media.tar` has the same metadata structure. The verifier
accepts only these two fixed basenames; every listed file must be regular,
nonempty, unreadable symlinks/devices are refused, and the hash/size must
match. Unlisted files or unexpected manifest fields are refused to avoid
misleading partial verification. It does **not** parse or extract media archives.

With a privately secured, **authorized** backup root that you prepared
offline, verify without modifying or copying the data:

```sh
python3 deploy/verify_snapshot.py --snapshot-dir /private/backup-directory
```

To copy verified inputs into an existing private scratch **parent**, where
the named destination does not already exist, explicitly acknowledge the
potentially sensitive copy:

```sh
python3 deploy/verify_snapshot.py \
  --snapshot-dir /private/backup-directory \
  --rehearsal-dir /private/scratch-parent/new-test-directory \
  --ack-sensitive-scratch-copy
```

The copy mode creates private directory/file permissions, refuses overwrite,
and rechecks the copied bytes. If copying fails, it **does not delete**
possibly sensitive data; examine and clean up under controlled procedures.

**Never put production dumps, signing keys, tokens, password files, media or
unencrypted personal data into Git, public CI artifacts, tickets or logs.**
Protect both source backup and rehearsal scratch with independent encrypted
storage, restricted accounts, retention policy and authorized deletion.

## Actual service recovery still unverified

A complete Synapse installation needs more than a PostgreSQL dump and
media bundle. Plan and protect the signing key, server name, configuration
secrets, external appservice registrations, reverse proxy/TLS certificates,
PostgreSQL version and extensions, migration compatibility and media store
permissions. Confirm any backup's actual restorable structure with
`pg_restore --list` in the secured staging environment, then restore into
a **new isolated PostgreSQL database** with no real traffic.

After restore, independently verify Synapse starts with preserved server
identity, encrypted account-room history and media metadata; conduct server
side key recovery, backup retention, monitored failover and rollback drills.
Do not overwrite live PostgreSQL databases or destroy existing keys.

Tests in deploy/tests create only fabricated, non-database bytes. Their
passing result proves safe offline validation and protected scratch-copy
handling, **not** a PostgreSQL data restore, E2EE key recovery, database
consistency, or production disaster recovery.

## File-descriptor verification

The offline verifier opens each input and its manifest through a regular-file
file descriptor using no-follow semantics. Size and hash are checked against
the **same opened descriptor**, and copying reopens via no-follow (then
rechecks the copied bytes). This closes the former check-then-open leaf
symlink substitution window. Synthetic tests exercise symlink substitution
*after* an initial successful integrity pass.

This is still not a complete defense against an attacker able to replace
the entire parent directory, modify bytes concurrently or control the
underlying filesystem. Keep snapshot roots and scratch parents private,
owned by a trusted account, and on reliable encrypted storage. No production
backup has been ingested or restored by this project.
