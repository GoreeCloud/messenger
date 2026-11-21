"""Synthetic Unix-domain-socket to loopback relay functional acceptance.

The relay runs entirely in-process over a temporary socket and an
ephemeral localhost test TCP server. No Matrix accounts/containers/network
egress, personal data, or production resources are involved.
"""
from __future__ import annotations

from pathlib import Path
import socket
import socketserver
import sys
import tempfile
import threading
import unittest

DEPLOY = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DEPLOY))
import ephemeral_unix_relay as relay_module


class ReplyHandler(socketserver.BaseRequestHandler):
    def handle(self):
        self.request.settimeout(2)
        incoming = self.request.recv(4096)
        if b"GET /_matrix/client/versions" in incoming:
            self.request.sendall(
                b"HTTP/1.1 200 OK\r\nContent-Length: 12\r\nConnection: close\r\n\r\n" +
                b'{"synthetic":1}'
            )


class TestRelay(unittest.TestCase):
    def test_forwards_synthetic_matrix_http_over_unix_to_private_loopback(self):
        previous = relay_module.UPSTREAM
        with tempfile.TemporaryDirectory() as directory:
            path = str(Path(directory) / "test.sock")
            with socketserver.TCPServer(("127.0.0.1", 0), ReplyHandler) as upstream:
                upstream.timeout = 2
                address = upstream.server_address
                relay_module.UPSTREAM = address
                with relay_module.DisposableUnixRelay(path, relay_module.Forward) as unix:
                    upstream_thread = threading.Thread(
                        target=upstream.handle_request, daemon=True
                    )
                    forward_thread = threading.Thread(
                        target=unix.serve_forever, kwargs={"poll_interval": 0.05},
                        daemon=True,
                    )
                    upstream_thread.start()
                    forward_thread.start()
                    try:
                        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
                            client.settimeout(3)
                            client.connect(path)
                            client.sendall(
                                b"GET /_matrix/client/versions HTTP/1.1\r\n"
                                b"Host: localhost\r\nConnection: close\r\n\r\n"
                            )
                            answer = b""
                            while True:
                                data = client.recv(4096)
                                if not data:
                                    break
                                answer += data
                        self.assertIn(b"HTTP/1.1 200 OK", answer)
                        self.assertIn(b'{"synthetic":1}', answer)
                    finally:
                        unix.shutdown()
                        upstream_thread.join(3)
                        forward_thread.join(3)
                        relay_module.UPSTREAM = previous

    def test_upstream_is_container_loopback_by_default(self):
        self.assertEqual(("127.0.0.1", 8008), relay_module.UPSTREAM)


if __name__ == "__main__":
    unittest.main()
