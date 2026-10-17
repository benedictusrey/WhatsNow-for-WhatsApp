# WhatsNow presentation assets

_v2.6.1 documentation refresh · 2026-10-17 · WhatsNow is created and maintained by [@benedictusrey](https://github.com/benedictusrey)._

---

## 📋 Current artwork

| File | Documentation role |
| --- | --- |
| `WhatsNow hero.png` | README introduction and release branding |
| `WhatsNow features.png` | Accounts, Focus, App Lock, sharing, and desktop-tool overview |
| `WhatsNow themes-tray.png` | Appearance choices and tray-workflow overview |
| `WhatsNow performance.png` | Historical process-view illustration with measurement caveats |

The four user-supplied images are kept unchanged, with their supplied filenames.
Markdown references URL-encode spaces for reliable repository rendering. The
previous standalone icon/hero/features files were already removed before this
refresh; current documentation no longer depends on those missing paths.

## ⚠️ Interpretation and limitations

The interface compositions are illustrative, not pixel-exact evidence of the
shipped UI. Available controls, platform authentication, tray layout, and
WhatsApp service features can differ. Decorative security/speed claims are
not a security audit, benchmark, or guarantee.

The performance image compares historical snapshots with different account
states/process groupings: an Edge tab at 173.2 MB and a WhatsNow host group at
6.8 MB. The latter excludes WebView2 processes that may be grouped elsewhere.
Do not cite it as total RAM, a percentage saving, or proof that WhatsNow always
uses less memory than Edge or Microsoft's client. A controlled comparison must
count complete process trees with matched sessions, workloads, runtime versions,
and measurement times. See [Windows memory notes](../WINDOWS.md).

`whatsnow-resource-snapshot.png` is retained as an older reference image, not
the new v2.6.1 benchmark. No new measurements were performed for this artwork.

## 🔗 Related documents

- [README](../../README.md)
- [Current features](../../WhatsNow_latest.md)
- [v2.6.1 implementation record](../../CHANGELOGS_v2.6.1.md)
- [Release notes](../../RELEASE_NOTES.md)
