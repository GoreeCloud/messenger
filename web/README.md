# GoreeCloud Messenger — Web app development preview

This is the **first-party web app**, distributed separately from the **native Android app** in `android/`. The web package is a self-hostable developer preview, not a production encrypted messenger.

## Launch locally

Extract the preview artifact into a folder containing `web/` and `src/`. From that folder, run:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open **http://127.0.0.1:4173/web/** in a modern browser. Do not open `index.html` using a `file://` URL: browser ES module imports require a web origin. Stop the server with Ctrl+C. For any remote installation, HTTPS and appropriate production security review are mandatory.

## Actual capabilities

- Responsive GC UI Foundations 1.0.1 styling, dark/light mode and home-screen manifest/icon, matching the native Android design direction.
- Temporary personal notes stored only in this browser tab's memory, lost on refresh or tab close.
- Opt-in **plaintext Matrix DATA** for development/test accounts. Messages are readable by the homeserver and **not end-to-end encrypted**.
- RCS, SMS and MMS are not integrated in this web build. Encrypted or unknown Matrix rooms remain locked; no silent fallback.
- No service worker, offline message queue, push notifications, analytics, stored login tokens, app store submission or verified production deployment.

The native Android app offers a different currently implemented subset: ephemeral native notes and user-initiated SMS composition delegated to the installed messaging app. Neither client replaces the other. The real Matrix Rust E2EE prototype in repository CI is isolated and not shipped in this package.

See [the main source repository](https://github.com/GoreeCloud/messenger) for build details and open security release gates.
