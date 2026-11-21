# Browser security headers: staging policy for Messenger

This repository includes a **nondeployed Caddy v2 Caddyfile example** in
`deploy/web-security.Caddyfile.example`. Its placeholder hostname ends in
`.invalid` intentionally. It is not the current GoreeCloud Gateway
configuration or proof that any application is hosted securely.

The sample serves built React/Vite files and sets browser protections for
referrer leakage, MIME sniffing, framing, and unwanted geolocation/payment/
USB features. Its Content Security Policy is initially **Report-Only**:
the Matrix Rust-backed browser SDK uses WebAssembly, Web Workers, and a
dynamic HTTPS/WSS homeserver, so real-browser acceptance must precede
enforcement.

## Operator acceptance sequence

1. Build the locked web application and verify the preview artifact hashes.
2. Use a dedicated authorized staging hostname, trustworthy TLS, and a
   restricted static-files directory. Do not replace existing production
   Caddy, GoreeCloud Gateway, Matrix, or DNS configuration blindly.
3. Review and validate the Caddyfile with the actual running Caddy version.
   The provided sample is not automatically deployed or validated against a
   live Caddy process.
4. Replace the broad `connect-src https: wss:` sources with the specific
   chosen HTTPS/WSS Matrix homeserver origins after smoke tests confirm SDK
   behavior. Keep `script-src` restricted to same origin plus the narrowly
   supported WebAssembly compilation source.
5. Test login, local encrypted IndexedDB unlock, Web Locks in two tabs,
   encryption/decryption, reply and reaction, room switching, and browser
   WebAssembly/worker loading. Inspect developer console CSP violations.
6. Only then choose an **enforcing** policy. Consider an HTTP CSP response
   header, not a meta-only substitute: `frame-ancestors` is header-only.
   Require independent verification for TLS, HSTS scope, reverse proxies,
   cache-control of private content, and application CSP compatibility.

The example avoids HSTS `includeSubDomains` because that could affect
unrelated GoreeCloud services if pasted onto a real shared domain.
Environment-specific certificate and deployment policies belong to the
actual ingress owner. Future calling and media features may require
additional, individually justified permissions.

The offline test checks that the example remains private, report-only and
does not silently loosen key directives. **Passing source tests cannot
verify browser enforcement, network privacy, or a deployed configuration.**

Caddy documentation:
https://caddyserver.com/docs/caddyfile/directives/header
https://caddyserver.com/docs/caddyfile/directives/file_server
https://caddyserver.com/docs/caddyfile/directives/try_files
