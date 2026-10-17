# WhatsNow v2.6.1 — implementation record

_Consolidated on 2026-10-17. WhatsNow is authored and maintained by Benedictus Reynaldo Hartanto ([@benedictusrey](https://github.com/benedictusrey))._

---

## 📋 Scope and release status

This record preserves the changes, rejected approaches, regression tests, and
remaining checks for the v2.6.1 maintenance cycle. It supplements, rather than
replaces, [CHANGELOG.md](CHANGELOG.md), [the detailed audit](docs/AUDIT_2.6.1.md),
and [release notes](RELEASE_NOTES.md). Current capabilities are catalogued in
[WhatsNow_latest.md](WhatsNow_latest.md).

Version remains **2.6.1** throughout the local iterations. These builds are not
interchangeable simply because they share a version number: package checksums
and `source-manifest.json` identify the final candidate. The current local
candidate is the **attribution** revision. Earlier private package sets remain
available; no historical backup was modified or deleted.

This is a prepared candidate, not a declaration that every live scenario or
platform has passed. The public API showed v2.6.0 as the newest published release
on 2026-10-17; it exposed no v2.6.1 tag. Unauthenticated reads cannot enumerate
private draft releases. See [release preparation](docs/RELEASE_PREPARATION_2.6.1.md).

## 🔧 Phone-link delivery

### Original failure and rejected refresh fallback

The earlier bridge could raise WhatsNow without opening the requested number
when the contact was absent from the rendered/virtualized chat list. A first
v2.6.1 fallback entered WhatsApp's `/send` document URL. The user confirmed it
opened the target but refreshed the application first. A browser test reproduced
one document load where zero was required. That fallback was removed.

### Current no-reload implementation

- Preserve the trusted-click fast path for a matching visible contact row
- Use WhatsApp's native New chat search for other numbers in the same account
- Verify the resulting conversation header before reporting success
- Match contact identities rather than arbitrary phone mentions in previews
- Reject group/broadcast identifiers as direct-contact identities
- Support phone-labelled native search results with opaque LID contact IDs
- Bound the lookup to 12 seconds with readiness polling, not a fixed-delay assumption
- Preserve user-owned editing drawers and conflicting message drafts
- Cancel on Escape; let a newer request supersede an older lookup
- Close only a lookup drawer owned by the current request
- Fail safely without a document-refresh or interstitial-popup fallback

Phone and draft text are passed through the native host-to-bridge handoff.
Text is inserted through browser editing operations only into an empty composer;
it is never sent automatically. Multiline/Unicode verification uses rendered
text with newline normalization instead of replacing the editor DOM.

The host queues a request while an account bridge is loading. Page-load start
invalidates the old loaded marker, and a secondary account cannot consume the
active account's queued handoff. Mixed-case protocol schemes and phone keys are
accepted; formatted phone input is restricted and bounded to 5–15 digits.

### Follow-up: false busy state

The installed log subsequently recorded two handoffs reaching the bridge and
returning `native phone lookup busy`. The broad `[role='dialog']` selector could
mistake an ordinary page container for a blocking editing panel. A regression
reproduced `busy` instead of the expected `row` result.

Detection now distinguishes visible drawers/explicitly modal dialogs from
nonmodal application shells and excludes CSS-hidden or off-screen panels.
Genuine visible modals and user-owned drawers remain protected. This resolves
the controlled reproduction; the final binary still needs live handoff testing.

### Protocol boundaries retained

An HTTPS `wa.me` link opened outside WhatsNow starts in the browser. Its
**Open WhatsApp** action hands a `whatsapp://send` URI to the installed Windows
application. Portable mode intentionally does not register this association.
This update does not introduce macOS/Linux protocol registration. Ordinary web
links retain the external-browser flow; look-alike WhatsApp hosts are rejected.

## ⚙️ Dedicated calling windows

Both HTTPS `call.whatsapp.com` stages and `web.whatsapp.com/call[/...]` stages
select the dedicated call window. Similar paths such as `/callback` do not.
Native decorations, resizing, minimizing, and maximizing are explicitly enabled.
The opener's session/environment and existing media permissions are retained.

Initial geometry now:

- Uses the opening window's monitor work area and DPI scale
- Preserves negative-origin secondary-monitor positions
- Interprets popup coordinates relative to the work area
- Reserves space for native borders and the title bar
- Fits oversized windows and reduces minimum dimensions on tiny displays
- Handles invalid/non-finite requested sizes and scale values
- Sets no maximum-size constraint that would prevent native maximize

Transient `wa-call-*` windows are excluded from saved-state restoration, so stale
cached positions cannot undo the monitor-aware fit. Other window-state behavior
is unchanged. Tests exercise the production geometry helper at 100%, 125%, 150%,
and 200% scaling, not a copied test-only sizing formula.

A complete real two-party call, media continuity, and maximize/restore cycle
remain release acceptance checks. Self-chat may not offer a calling action.

## 👤 Settings clarity and attribution

### Contrast and readability

The old white foreground on bright mint actions measured only 1.70–1.90:1 in
dark Settings palettes. A semantic `--on-accent` foreground now covers primary
actions, selected navigation icons, and account unread badges. Light secondary
text and the Aurora accent were also adjusted. Keyboard focus has an explicit
outline, and footer/legal text is larger.

The tested normal text-token pairs, navigation labels, and Save changes states
(normal/hover) meet at least 4.5:1 across ten resolved Settings palettes; selected
icons meet 3:1. This is a scoped contrast check, not a claim of complete WCAG
conformance. Chat palette/doodle files were not changed by this Settings work.

### Concise author identity and working GitHub links

The footer displays `WhatsNow 2.6.1 · Benedictus RH (@benedictusrey)`.
About uses the same abbreviated name and shorter explanatory copy. The username
in each location links to `https://github.com/benedictusrey` through the existing
external-browser command. Full-name licensing/provenance notices remain intact.

The version bootstrap previously replaced a container's `textContent`, erasing
the footer anchor. It now updates direct text nodes while preserving the anchor.
The new test executes the actual Rust-embedded script repeatedly and checks that
both profile clicks request the correct `open_external_url` command.

## 🔐 Preserved contracts

- Official Dark/Light retain WhatsApp doodles; all eight personality themes remain clean
- Theme changes do not visibly navigate through the user's profile or reload the page
- Composer/emoji protection and existing chat palettes remain intact
- Compact native Windows toast delivery remains; no floating notification window is added
- Existing sender-chat notification routing and replay suppression remain
- Drag-and-drop streaming, validation, and cancellation behavior remain
- Account isolation, Focus, App Lock, shortcuts, startup, and downloads retain their logic
- Visible/unfocused media windows retain the normal Windows memory target
- Historical backups, prior private package sets, and unrelated local edits remain

## ✅ Verification record

| Check | Evidence and boundary |
| --- | --- |
| Rust | 110 library tests passed in installer mode; portable-mode suite passed during the earlier no-reload cycle |
| Static analysis | All-target/all-feature strict Clippy passed during the no-reload cycle, before the final attribution-only bootstrap change |
| Phone routing | Trusted Chromium clicks, zero loads, drawer/modal handling, no results, cancellation, supersession, group decoys, LIDs, and protected drafts |
| Attachments | Existing bridge/drop suite passed, including mixed batches, incomplete streams, and cancellation |
| Notifications | Toast routing, group/community metadata, and startup replay assertions passed |
| Appearance | All 11 stored theme states and doodle rules passed in the browser smoke fixture |
| Settings | Panel navigation, ACL, shortcut, contrast, and attribution-link checks passed |
| Packages | Setup, MSI, and portable built; SHA-256 verified; executable metadata reports 2.6.1 |
| Signatures | Local Windows packages report `NotSigned` |
| Documentation | Local Markdown integrity checks pass; final preparation reruns these checks |

Browser checks use controlled WhatsApp-shaped pages. They do not prove live
WhatsApp server behavior, a real OS browser launch, or a two-party media call.
The desktop-control helper failed before it could list windows; those interactive
checks were not marked passed. Native Linux/macOS validation is still required.

## 📦 Packaging and release gates

### Presentation refresh

The README now centres on v2.6.1 and uses the four user-supplied hero, feature,
themes/tray, and performance images unchanged. Captions distinguish artwork
from actual UI and historical host-process memory from complete webview usage.
The [asset ledger](docs/assets/README.md) records their roles and limitations.
This documentation refresh does not modify application behavior. Per the user's
release instruction, v2.6.1 remains a draft until live acceptance is confirmed.

The final local Windows filenames are:

```text
WhatsNow_2.6.1_windows_x64-setup.exe
WhatsNow_2.6.1_windows_x64_en-US.msi
WhatsNow_2.6.1_windows_x64-portable.exe
checksums-windows.sha256
source-manifest.json
```

The manifest identifies build inputs and regression files for the local candidate;
it explicitly records working-tree changes rather than claiming a clean commit.
For a cross-platform release, commit the approved source first and rebuild all
nine package files from that same immutable revision. Do not mix locally rebuilt
Windows files with unrelated or older Linux/macOS artifacts.

The workflows include phone routing, Settings contrast, and attribution-link
browser gates. The release workflow collects nine native packages, verifies a
combined SHA-256 manifest, and is configured to create a **draft** release.
Configuring a workflow locally does not mean Actions ran or assets were uploaded.

Before publishing, complete live Windows handoff/call/notification acceptance,
native platform builds and installation checks, signature disclosure, and a
final artifact-to-source reconciliation. See the release checklist for exact steps.
