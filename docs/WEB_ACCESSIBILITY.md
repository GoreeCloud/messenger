# Accessible browser Messenger preview

The React app uses semantic HTML and existing verified GoreeCloud UI color
variables rather than introducing a new visual design-token palette.

This change adds clear keyboard focus rings using the app's existing
--brand token, announces the selected conversation via aria-current, names
reply/reaction actions with the message sender for assistive technology,
and links the persistent-crypto passphrase input to its risk explanation
via aria-describedby.

Existing accessibility features retained: named page/section landmarks,
associated login labels, the message timeline as a polite accessible log,
masked login inputs, error/status live-region messages, visible encryption
warnings, reduced-motion styling and mobile responsive layout.

## Verified and outstanding

- TypeScript typecheck, React static-markup tests for login labels and
  landmarks, existing security tests, and Vite production bundle are required.
- The static render tests cannot validate real screen-reader announcements,
  keyboard interaction after authentication, color-contrast measurements
  across every visual state or actual mobile assistive technologies.
- No Android accessibility acceptance or cross-device encrypted messaging
  result is implied by a browser source build.

Future manual acceptance must include keyboard-only room navigation, focus
visibility at narrow viewport widths, live-message announcements in NVDA/
Orca/TalkBack, no excessive announcements on initial sync, high-contrast
mode, and long untrusted user identifiers. Fix observed failures with
reproducible tests before product release.
