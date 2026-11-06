# WhatsNow consolidated workspace

_2026-10-17 · WhatsNow is authored and maintained by [@benedictusrey](https://github.com/benedictusrey)._

---

## 📋 Canonical location

Use the active **WhatsNow** checkout for development, documentation, native
builds, tests, and GitHub Desktop. The former **WhatsNow - Improved** folder
has been moved into this workspace; it is no longer a second working checkout.
No application feature or chat-theme/notification logic was changed by the move.

The current checkout is under the Desktop **04_Projects** collection. Select
that existing repository in GitHub Desktop; the consolidation details below
describe the historical 2026-10-17 move, not a second active checkout.

The active Git repository retains the public checkout's history and remote:
`https://github.com/benedictusrey/WhatsNow-for-WhatsApp.git`.
Consolidating local files does not commit, push, or publish them.

## 📚 Folder guide

| Location | Purpose | Commit policy |
| --- | --- | --- |
| `src-tauri/` | Rust/Tauri code, resources, capabilities, icons | Reviewed source |
| `settings-ui/` | Local Settings interface | Reviewed source |
| `.github/` | CI and release workflows | Reviewed source |
| `scripts/` | Build, installer, verification, and regression tools | Reviewed tools; exclude generated screenshots |
| `docs/` and root Markdown | Current guides and release records | Reviewed documentation |
| `release-assets/` | Versioned upload staging and checksum records | Metadata only; package binaries ignored |
| `dist/` | Local package sets, including earlier v2.6.1 candidates | Local-only |
| `backup/` | Locked behavioral/source references | Local-only; do not alter snapshots |
| `versions/` | Historical development snapshots and old repository mirror | Local-only; historical guidance, not a live mirror |
| `node_modules/` | Local browser-test dependencies | Local-only |
| `.workspace/` | Build caches, consolidation evidence, and recovery copies | Local-only |
| `.freebuff/` | Preserved local tool metadata | Local-only |

The live source keeps its existing internal structure so imports, embedded
resources, build scripts, and relative test paths continue to resolve. The
legacy portable README is preserved as historical material rather than placed
beside current installation guidance. Use [Installation](INSTALLATION.md).

## 🔐 Preservation and verification

The pre-move inventories contained **23,851 files** in the development folder
and **7,108 files** in the public checkout: **30,959 original file records**,
totalling **18,636,485,556 bytes** (about 17.36 GiB before added evidence).
Every record was checked by SHA-256 after moving. Identical shared files may
have both a canonical copy and a retained original; no content was deleted.

The public Git history remains active. The former private `.git` metadata is
retained in the ignored recovery area under the name `legacy-git`, so it does
not become the active checkout or change the public remote. Existing public
compiler/generated trees were preserved separately instead of merging their
contents into a different build cache. Private build caches moved with the
development tree. Both locked backups and version snapshots retain their bytes.

This was a consolidation, not storage cleanup. Large build caches were kept.
Relocated compiler caches may contain old absolute paths and may be rebuilt
by Cargo; cached debug paths are not proof of an active second workspace.
Release preflight later reproduced this: stale Tauri permission metadata pointed
to the old folder. The relocated Windows cache was preserved under
`.workspace/consolidation-20261017/relocated-target-windows-stale/`, its recovery
map was updated, and a fresh canonical `.workspace/target-windows/` cache was
created for native verification. No application logic change was required.
The installed app and its per-user session data were outside the move scope.
No G: files were accessed or changed.

## 🔧 Local recovery evidence

The ignored `.workspace/consolidation-20261017/` directory contains:

- `source-before.csv` and `destination-before.csv`: original sizes and hashes
- `plan.json`: inventory totals and the preservation policy
- `moves.jsonl`: intended/completed moves with exact local endpoints
- `verified-file-map.csv`: original-to-current paths and original hashes
- `verified-file-map.before-maintenance.csv`: mapping before metadata maintenance
- `legacy-git/`: the former private repository's Git metadata
- `previous-destination/`: the public checkout's prior generated/cache trees
- `preserved-source/`: shared original files retained for recovery
- `historical-documents/PORTABLE-README.md`: unchanged legacy portable guide
- `maintenance-before/`: originals of the intentionally updated maintenance files

These records contain local paths and must remain ignored. The move journal
supports recovery planning; do not blindly reverse moves over an edited working
tree. Review the journal, verify hashes, and preserve later work before any
rollback. Do not delete the recovery area merely because consolidation succeeded.

## ✅ Maintenance changes and acceptance

Only the public ignore rules, documentation-checker directory exclusions, and
workspace guidance were intentionally adjusted after the byte-preserving move.
The original public ignore rules remain archived; historical `versions/` content
is now excluded. The documentation checker skips `.workspace/` and `.freebuff/`
so it checks current documentation rather than local caches and recovery copies.
Application build inputs and the final v2.6.1 package hashes remain the regression
baseline recorded in the release source manifest.

Post-move checks passed from the canonical root: phone routing, attribution-link
preservation, Settings contrast, chat-theme tests, Settings ACL tests, and all
27 current Markdown files. Cargo metadata resolves WhatsNow 2.6.1 at the new
manifest path. Full native compilation was not rerun, avoiding unnecessary
rewrites of preserved compiler caches; no new release binaries were produced.

Run tests and builds from this canonical folder. In GitHub Desktop, keep/open
the existing **WhatsNow** repository; the old private entry may show a missing
location. Remove that obsolete entry from the app's list if desired, without
deleting the consolidated files. No GitHub Desktop settings were changed here.

For release acceptance and remaining live-platform limits, use
[release preparation](RELEASE_PREPARATION_2.6.1.md). Moving files is not a new
end-to-end validation of WhatsApp server behavior or a real two-party call.
