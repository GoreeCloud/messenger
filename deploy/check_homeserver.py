#!/usr/bin/env python3
"""Fail-closed Synapse preview configuration audit. Never logs secret values.

This is a local development acceptance aid, not a production security audit.
Parse with PyYAML safe_load to avoid arbitrary Python object construction.
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit


def check_policy(config: Any, mode: str = "local") -> list[str]:
    """Return field-name-only problems in a parsed Synapse config."""
    if mode not in {"local", "production"}:
        return ["Unsupported security mode."]
    if not isinstance(config, dict):
        return ["Expected a YAML mapping."]
    errors: list[str] = []

    def require_false(key: str) -> None:
        if config.get(key) is not False:
            errors.append(key + " must be explicitly false.")

    require_false("enable_registration")
    # Synapse's legacy disable_registration alias OVERRIDES enable_registration.
    # Therefore an explicit false alias re-enables signups despite the safe flag.
    if config.get("disable_registration") is False:
        errors.append("disable_registration=false overrides enable_registration=false.")
    require_false("enable_registration_without_verification")
    require_false("allow_guest_access")
    require_false("url_preview_enabled")
    require_false("report_stats")
    require_false("enable_metrics")
    require_false("enable_3pid_lookup")
    if "sentry" in config:
        errors.append("sentry integration must be absent in the local preview.")
    if "app_service_config_files" in config and config["app_service_config_files"] != []:
        errors.append("app_service_config_files must be empty for the preview.")
    server_name = config.get("server_name")
    if not isinstance(server_name, str) or not server_name.strip() or any(
        ch in server_name for ch in " /\\\t\r\n@"
    ):
        errors.append("server_name must be a valid-looking host name.")
    public_baseurl = config.get("public_baseurl")
    if public_baseurl is not None:
        try:
            parsed = urlsplit(public_baseurl) if isinstance(public_baseurl, str) else None
            safe_base = (
                parsed is not None and parsed.scheme == "https" and bool(parsed.hostname)
                and parsed.username is None and parsed.password is None
                and not parsed.query and not parsed.fragment
            )
        except ValueError:
            safe_base = False
        if not safe_base:
            errors.append("public_baseurl must be a credential-free HTTPS URL.")
    listeners = config.get("listeners")
    if not isinstance(listeners, list) or not listeners:
        errors.append("listeners must be explicitly configured.")
        listeners = []
    client_listener = False
    for index, listener in enumerate(listeners):
        if not isinstance(listener, dict):
            errors.append("listeners entries must be mappings.")
            continue
        if listener.get("type") == "http":
            resources = listener.get("resources")
            if not isinstance(resources, list):
                errors.append("HTTP listener resources must be explicit.")
                continue
            if any(isinstance(resource, dict) and isinstance(resource.get("names"), list)
                   and "client" in resource["names"] for resource in resources):
                client_listener = True
            # Unencrypted HTTP is permitted for a loopback-mapped local container
            # only; production must terminate trusted TLS upstream.
            if mode == "production" and listener.get("tls") is True:
                # This still does not establish a valid certificate or TLS termination.
                pass
        if listener.get("tls") is True and mode == "local":
            errors.append("Unexpected embedded TLS preview listener; review routing.")
    if not client_listener:
        errors.append("A configured HTTP client listener is required.")
    if mode == "production":
        db = config.get("database")
        if not isinstance(db, dict) or db.get("name") != "psycopg2":
            errors.append("Production database must be PostgreSQL, not SQLite.")
        if not public_baseurl or not str(public_baseurl).startswith("https://"):
            errors.append("Production public_baseurl must use HTTPS.")
        # Even a passing config cannot verify reverse proxy, TLS, backups, federation
        # metadata, credentials, filesystem isolation or signing key permissions.
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit local Synapse config without logging its contents.")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--mode", choices=["local", "production"], default="local")
    args = parser.parse_args()
    target = args.config
    try:
        if target.is_symlink() or not target.is_file():
            raise ValueError("Config must be an existing regular non-symlink file.")
        if target.stat().st_size > 1024 * 1024:
            raise ValueError("Config exceeds 1 MiB safety limit.")
        if os.name == "posix" and target.stat().st_mode & 0o077:
            raise ValueError("Config file permissions must be 0600 or more restrictive.")
        try:
            import yaml
        except ImportError as exc:
            raise ValueError("PyYAML is required for safe parsing; do not use a regex YAML parser.") from exc
        config = yaml.safe_load(target.read_text(encoding="utf-8"))
        problems = check_policy(config, args.mode)
    except Exception as exc:
        # Do not print exception strings; they may contain raw source/config text.
        print("FAIL: unable to securely parse configuration (" + type(exc).__name__ + ").")
        return 1
    if problems:
        for problem in problems:
            print("FAIL: " + problem)
        return 1
    print("PASS: Synapse " + args.mode + " configuration passed basic privacy/security checks.")
    print("NOT VERIFIED: actual service, public exposure, valid TLS, identities, encryption or restore.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
