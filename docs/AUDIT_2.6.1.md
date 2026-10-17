# WhatsNow 2.6.1 audit

Prepared on 2026-10-17 for WhatsNow, authored and maintained by
[@benedictusrey](https://github.com/benedictusrey).
Official distribution: [WhatsNow-for-WhatsApp](https://github.com/benedictusrey/WhatsNow-for-WhatsApp).

## Findings and changes

### Concise Settings attribution

The Settings footer now reads `WhatsNow 2.6.1 · Benedictus RH (@benedictusrey)`
after runtime version insertion. About uses the same abbreviated name and
shorter copy; the profile mentions in both places link to GitHub. License files
and other full-name provenance notices are unchanged. A new Chromium regression
executes the actual Rust-embedded version bootstrap and existing external-link
handler. It first failed because container `textContent` replacement erased
the footer anchor. Updating direct text nodes preserves both anchors across
repeated version application; both clicks now invoke `open_external_url` with
`https://github.com/benedictusrey`. This checks the UI-to-host command boundary,
not a live operating-system browser launch. Packages are built separately in
`dist/v2.6.1-attribution/windows`; earlier candidates remain available privately.

### Follow-up: live busy refusal and Settings contrast

The installed session log recorded two browser-originated protocol requests
reaching the account bridge and returning `native phone lookup busy`.
This establishes a bridge refusal, not a browser association failure. A new
regression reproduces that refusal when an ordinary page container carries
`role="dialog"`: expected `row`, actual `busy`. The former broad selector
treated any such container as an editing modal. Detection now accepts visible
drawers or explicitly modal dialogs, checks CSS visibility and viewport
intersection, and ignores nonmodal application shells. The regression passes
while genuine active modals and user-owned drawers still return `busy`.
This is consistent with the live failure, but live DOM inspection remains
unavailable: the Computer Use kernel fails before listing windows because
its sandbox rejects the bracket-containing workspace path. Do not claim a
live end-to-end pass from this controlled reproduction.

`scripts/settings-contrast.test.mjs` measures the actual Settings stylesheet
in Chromium. Before correction, Save changes and selected icons had only
1.70-1.90:1 contrast in dark palettes. Palette-aware `--on-accent` text now
covers primary actions, selected icons, and badges. Normal primary, muted,
accent, navigation, and Save button text (normal/hover) pass 4.5:1 across ten
resolved palettes; icons pass 3:1. Light secondary text and Aurora accent were
also corrected. Footer/legal text is larger and keyboard focus is outlined.
Only Settings presentation changes; chat theme CSS, doodles, emoji, compact
toast delivery, and call sizing remain untouched by this follow-up.

The follow-up outputs are in `dist/v2.6.1-panel-contrast/windows`; the prior
no-reload package set is retained. A same-version full quit and setup reinstall
is required before live testing. Version remains 2.6.1; hashes distinguish it.

The v2.6.0 bridge intentionally returned `no-row` when the phone from a browser
handoff was absent from the currently rendered chat list. Virtualized chats,
new numbers, and chats represented only by LID identifiers could therefore
leave the app showing its previous conversation. The native handoff also
discarded the `text` parameter before calling the bridge.

The first v2.6.1 candidate used the official `/send` document-entry URL when
the target was not visible. The user confirmed that it opened the requested
chat but refreshed the whole app first. The new browser regression reproduced
that symptom: one `load` event, where zero was required.

The revised v2.6.1 retains the trusted-row fast path and opens other numbers
through WhatsApp's native New chat panel. Result selection requires a matching
phone identity and trusted input, followed by verification of the conversation
header. A 12-second total deadline bounds the lookup; element checks handle
hydration instead of assuming that a fixed delay means the UI is ready.
Known-row matching excludes group/broadcast identifiers and phone mentions
in message previews. Native search still supports contacts whose identity is
an opaque LID, using the phone-labeled result and verified conversation title.
There is no reload or popup fallback. No result preserves the existing chat.
Existing user drawers are left alone; only a lookup drawer owned by the
current request may be reused or closed. Escape cancels; newer requests
supersede older ones. Prefilled text is inserted through browser editing only
into an empty composer; a conflicting draft is preserved. Nothing is sent
automatically. Unsupported UI shapes fail safely and need live verification.

Account-page load start now invalidates the loaded-bridge marker, so a link
received during a document reload is queued until the next bridge is ready.
A secondary account's startup cannot drain the active account's pending links.

The call classifier previously recognized only `call.whatsapp.com`, even
though the popup policy admitted `web.whatsapp.com/call/...`. Those same-origin
stages could enter the reusable content-popup path. Both call URL forms now
select the dedicated call window with explicit native decorations, resize,
maximize, and minimize controls. Opener environment/session sharing and media
permission handling are retained. Similar paths such as `/callback` and
look-alike domains do not qualify.

Call-window geometry now uses the opener's monitor work area and scale instead
of always selecting the primary display. It reserves space for native borders
and the title bar, handles negative monitor origins, clamps invalid dimensions,
and reduces minimum dimensions on tiny work areas. No maximum-size constraint
is set, preserving native maximize. The production `fit_call_geometry` helper
is tested directly at 100%, 125%, 150%, and 200% scale, on secondary and small
displays, and with non-finite popup inputs. Session-sharing and permission
behavior are retained; no WebView2 popup-creation policy was changed.

Transient `wa-call-*` windows are excluded from the window-state plugin's
tracking/restore filter. The dependency implementation (2.4.1) checks that
filter before restoring geometry; old cached call positions therefore cannot
override the opener-monitor fit. Chat, Settings, and content-popup state rules
remain unchanged. This also avoids accumulating new per-call geometry entries.

Mixed-case protocol schemes and phone parameter names are accepted. Phone
input is bounded to 5-15 digits after permitted formatting is stripped.

## Preserved behavior

- Chat theme engine, palettes, doodle enforcement, and typing-area emoji
  protection retain their existing implementations. Settings-only contrast,
  copy, and attribution changes are described above.
- Native toast implementation and sender-chat notification routing retain
  their existing implementations; no floating notification window is added.
- Drag/drop, account storage, App Lock, focus tools, shortcuts, startup,
  downloads, and Windows memory policy retain their implementations.
- Existing local warning-annotation edits in `lib.rs` and `notify.rs` were
  present before this audit and are preserved.
- Locked historical backups and previous release artifacts are retained.

## Automated verification

| Area | Evidence |
| --- | --- |
| Rust backend | 110 tests passed in installer mode (`windows-memory`) and again in portable mode (`windows-memory,portable-mode`) |
| Static analysis | `cargo clippy --locked --all-targets --all-features -- -D warnings`: passed |
| Drag/drop and links | `bridge.test.mjs`: known row, unavailable lookup without reload, malformed input, drop streams and cancellation |
| Themes and Settings | `chat-theme.test.mjs`, `theme.test.mjs`, `settingsAcl.test.mjs`, `comboToAccelerator.test.mjs`: passed |
| Notifications | `toast-route.test.mjs`: passed; bridge startup replay and group/community assertions passed |
| Browser UI | `scripts/smoke-test.mjs`: Settings navigation, theme/doodle matrix, media CSS protection, and promo coalescing |
| Browser links | `scripts/smoke-links.mjs`: known and unlisted targets have zero document loads, correct conversation, no popup; external links retain browser routing |
| Trusted browser input | `scripts/phone-routing.test.mjs`: real Chromium CDP clicks, zero document loads, multiline/Unicode text draft with trusted editor input events, existing-draft conflict, no-result preservation, supersession, user-drawer protection, test-ID-free markup, and Escape cancellation |

The new no-reload gate went red against the installed-candidate source
(`1 !== 0` load events), then green against the revised source. It drives the
production bridge with real trusted Chromium mouse input and a controlled
WhatsApp-shaped UI. Both CI and release workflows install pinned Playwright
1.63.0 and run this gate, so the old document-navigation fallback fails CI.

Additional failures caught during revision were retained as regression cases:

- An older request owned the search drawer when a newer link arrived. The
  drawer now transfers ownership only between WhatsNow lookup requests;
  user-opened drawers and their text remain untouched.
- A group identifier/preview containing the phone could be selected as a
  contact. Identity matching is now separated from native result text and
  group/broadcast identifiers are excluded.
- Multiline browser editing produces block structure rather than literal
  newline text nodes. Draft verification now compares the rendered text,
  with newline normalization; the test also verifies trusted input events
  update the editor model. Existing drafts are never overwritten.

## Installation and release boundaries

The final attribution candidate supersedes the package sets described below.
Its exact Windows hashes and outstanding publication gates are consolidated in
[release preparation](RELEASE_PREPARATION_2.6.1.md). The complete v2.6.1
implementation record is [CHANGELOGS_v2.6.1.md](../CHANGELOGS_v2.6.1.md).

The revised Windows builds use `dist/v2.6.1-no-reload/windows/`, with SHA-256
checksums. Both installer and portable builds use the same working source;
the portable feature deliberately skips protocol registration. Protocol tests
cover the browser-normalized trailing slash in `whatsapp://send/?phone=...`.

The previous candidate is retained under `dist/v2.6.1/windows/` for rollback.
The revised setup and portable
executable report `2.6.1`; the MSI `ProductVersion` is `2.6.1` and its product
name is `WhatsNow`. Packages are unsigned (`NotSigned`). Portable mode and its
neutral Tauri bundle marker were verified. Checksums match both staging
locations. `source-manifest.json` records all 134 tracked build inputs; every
public-checkout input matches the development candidate byte for byte.
The source is an uncommitted local candidate. Version remains 2.6.1 at the
user's request; the revised build is identified by its new checksums and
source manifest. Fully quit the running tray app and use the updated setup
installer to replace the earlier same-version candidate. A running old process
does not acquire new code merely because the source or installer was rebuilt.

A browser starts an HTTPS `wa.me` link; its **Open WhatsApp** action hands the
`whatsapp://` URI to the installed registered application. Windows does not
provide a per-host HTTPS association for an arbitrary desktop client. Portable
mode does not register an association. macOS/Linux protocol registration is
unchanged by this Windows-oriented fix.

The source release workflow produces Linux x64 and macOS Apple Silicon/Intel
packages on native runners. Updating this local workflow does not itself run
GitHub Actions, upload assets, or publish a release.

Live repository inspection confirmed that the current public repository
already tracks `src-tauri/` and `settings-ui/` (132 tracked files in those
trees). It is no longer installation-only, despite the older `PUBLISHING.md`
description. The published latest release was `v2.6.0`, with all nine platform
assets and a checksum file. The release guide is corrected to match this
observed layout. Local backups, tool metadata, sessions, and credentials are
excluded from release staging.

## Interactive checks still required

### Installed-app check on 2026-10-17

The installed executable reports product/file version `2.6.1`, and the
installed process was confirmed running. The per-user `whatsapp://` open
command points to that installed executable with the URI passed as `%1`.
No overriding protocol `UserChoice` ProgId was present.
Those installed-app checks apply to the earlier candidate that refreshed;
they do not establish live behavior of the revised no-reload binary.

Live UI testing was attempted using the Windows Computer Use helper. Its
JavaScript kernel exited before listing any windows because its sandbox
rejected a workspace path containing square brackets. Resetting the kernel
and retrying produced the same error. No test link was opened, no call was
started, and neither interactive test is marked passed. The user's own
number was provided as the intended test target; it is omitted from this
report. Self-chat may not expose a calling action, so any such restriction
must be distinguished from call-window behavior in a subsequent live test.

Automated browser tests use a controlled WhatsApp-shaped page; they do not
prove WhatsApp server behavior or replace a logged-in end-to-end test.
Before declaring the release fully verified:

1. Install the new Windows package, then use Edge's **Open WhatsApp** action
   for a known number and a valid number absent from the chat list. Check a
   text-bearing link and a cold-start handoff. Confirm the target composer
   opens and the draft is not automatically sent.
2. Complete a real two-party video call, maximize/restore the call window,
   and verify video, microphone, speaker, and account-session continuity.
3. Confirm a real incoming toast and tray restore in the installed app.
4. Run native Linux/macOS CI and platform installation smoke checks before
   claiming those new package formats are available.

No calls or messages are sent by the automated audit. Unsigned packages and
Windows notification-duration limits retain the existing release caveats.
