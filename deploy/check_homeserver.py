#!/usr/bin/env python3
"""Fail-closed Synapse preview configuration audit. Never logs secret values.

This is a local development acceptance aid, not a production security audit.
Parse with PyYAML safe_load to avoid arbitrary Python object construction.
"""
from __future__ import annotations

import argparse
import os
import stat
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
    if "disable_registration" in config and config["disable_registration"] is not True:
        errors.append("disable_registration must be true when set (Synapse override).")
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


def check_dev_compose_policy(config: Any) -> list[str]:
    """Strict audit of the intentionally single-service local Docker Compose.

    This is an offline preview guard only: a good result cannot establish
    real host firewall, ingress, reverse-proxy or container runtime state.
    """
    if not isinstance(config, dict):
        return ["Compose must be a YAML mapping."]
    services = config.get("services")
    if not isinstance(services, dict) or set(services) != {"synapse"}:
        return ["Compose must contain only the explicit Synapse preview service."]
    service = services["synapse"]
    if not isinstance(service, dict):
        return ["Synapse service must be a YAML mapping."]

    errors: list[str] = []
    for key in ("network_mode", "pid", "ipc"):
        if service.get(key) is not None:
            errors.append("Synapse " + key + " must be absent from isolated preview.")
    for key in ("privileged",):
        if key in service and service[key] is not False:
            errors.append("Synapse privileged must not be enabled.")
    for key in ("cap_add", "devices"):
        if service.get(key) not in (None, []):
            errors.append("Synapse " + key + " must be absent or empty.")
    if service.get("restart") != "no":
        errors.append("Synapse preview automatic restart must be disabled.")
    security_opts = service.get("security_opt")
    if not isinstance(security_opts, list) or "no-new-privileges:true" not in security_opts:
        errors.append("Synapse must require no-new-privileges:true.")
    if service.get("volumes") != ["./data/synapse:/data"]:
        errors.append("Synapse preview volumes must use the scoped local data path only.")

    ports = service.get("ports")
    if not isinstance(ports, list) or not ports:
        errors.append("Synapse preview must explicitly publish loopback-only port 8008.")
    else:
        for port in ports:
            if isinstance(port, str):
                permitted = port in {
                    "127.0.0.1:8008:8008", "127.0.0.1:8008:8008/tcp",
                    "[::1]:8008:8008", "[::1]:8008:8008/tcp",
                }
            elif isinstance(port, dict):
                published = port.get("published")
                target = port.get("target")
                permitted = (
                    str(published) == "8008" and type(target) is int and target == 8008
                    and isinstance(port.get("host_ip"), str)
                    and port["host_ip"] in {"127.0.0.1", "::1"}
                    and port.get("protocol", "tcp") == "tcp"
                    and set(port) <= {"published", "target", "host_ip", "protocol", "mode"}
                )
            else:
                permitted = False
            if not permitted:
                errors.append("Synapse preview port mapping must be loopback-only 8008/tcp.")
    return errors


def load_checked_yaml(path: Path, parser: Any, private: bool) -> Any:
    """Read one regular file descriptor without following its final symlink."""
    if os.name == "posix" and not hasattr(os, "O_NOFOLLOW"):
        raise ValueError("Host cannot reject unsafe config symlinks.")
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0)
    fd = os.open(path, flags)
    try:
        metadata = os.fstat(fd)
        if not stat.S_ISREG(metadata.st_mode):
            raise ValueError("Config must be a regular file.")
        if metadata.st_size < 1 or metadata.st_size > 1024 * 1024:
            raise ValueError("Config must contain at most 1 MiB.")
        if private and os.name == "posix" and (metadata.st_mode & 0o077):
            raise ValueError("Private homeserver config must not be group/other readable.")
        with os.fdopen(fd, "rb") as data:
            fd = -1
            source = data.read(1024 * 1024 + 1)
        if len(source) > 1024 * 1024:
            raise ValueError("Config exceeded byte limit during read.")
        return parser.safe_load(source)
    finally:
        if fd >= 0:
            os.close(fd)


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit local Synapse config without logging its contents.")
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--mode", choices=["local", "production"], default="local")
    parser.add_argument("--compose", type=Path, help="Optional local preview Compose file to audit.")
    args = parser.parse_args()
    try:
        try:
            import yaml
        except ImportError as exc:
            raise ValueError("PyYAML is required for safe parsing; do not use a regex YAML parser.") from exc
        config = load_checked_yaml(args.config, yaml, private=True)
        problems = check_policy(config, args.mode)
        if args.compose:
            if args.mode != "local":
                problems.append("Compose preview check is valid only in local mode.")
            else:
                compose = load_checked_yaml(args.compose, yaml, private=False)
                problems.extend(check_dev_compose_policy(compose))
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
