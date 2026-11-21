#!/usr/bin/env python3
"""Test-only private Unix-socket bridge into a --network none Synapse container.

Listens only on /data/gc-matrix.sock, which is a disposable runner-owned
bind mount. It never opens a host network port or writes message content.
"""
from __future__ import annotations

import os
from pathlib import Path
import select
import socket
import socketserver

SOCKET = Path("/data/gc-matrix.sock")
UPSTREAM = ("127.0.0.1", 8008)


class Forward(socketserver.BaseRequestHandler):
    def handle(self) -> None:
        try:
            with socket.create_connection(UPSTREAM, timeout=5) as upstream:
                upstream.settimeout(None)
                peers = (self.request, upstream)
                while True:
                    ready, _, _ = select.select(peers, [], [], 75)
                    if not ready:
                        return
                    for source in ready:
                        data = source.recv(64 * 1024)
                        if not data:
                            return
                        destination = upstream if source is self.request else self.request
                        destination.sendall(data)
        except (OSError, ValueError):
            # No upstream request, token, message or credential is logged.
            return


class DisposableUnixRelay(socketserver.ThreadingMixIn, socketserver.UnixStreamServer):
    daemon_threads = True
    request_queue_size = 32
    allow_reuse_address = True


def main() -> None:
    if os.geteuid() != 991 or not Path("/data/homeserver.yaml").is_file():
        raise SystemExit("BLOCKED: relay is limited to disposable Synapse UID 991.")
    if SOCKET.is_symlink():
        raise SystemExit("BLOCKED: unexpected relay path symlink.")
    if SOCKET.exists():
        if not SOCKET.is_socket():
            raise SystemExit("BLOCKED: unexpected relay path type.")
        SOCKET.unlink()
    with DisposableUnixRelay(str(SOCKET), Forward) as relay:
        # The host runner's temp parent is mode 0700. Group/other traversal
        # is restricted by that parent even though this socket is connectable.
        SOCKET.chmod(0o666)
        relay.serve_forever(poll_interval=0.2)


if __name__ == "__main__":
    main()
