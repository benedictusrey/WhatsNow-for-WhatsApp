## Description

<!-- Provide a brief, clear summary of what this Pull Request does and the problem it solves. -->

## Type of Change

- [ ] 🐛 Bug fix (non-breaking change resolving an issue)
- [ ] ✨ New feature (non-breaking change adding functionality)
- [ ] 🎨 UI / Theme refinement (improving appearance, styling, or layout)
- [ ] ⚡ Performance improvement / Memory optimization
- [ ] 📖 Documentation update or guide addition
- [ ] 🔧 Build, CI, or tooling enhancement

## Platforms Tested

- [ ] Windows 10 / 11 (x64)
- [ ] Linux (AppImage / DEB / Flatpak)
- [ ] macOS Apple Silicon (arm64)
- [ ] macOS Intel (x86_64)

## Quality & Verification Checklist

Before submitting your PR, please verify the following:

- [ ] Code follows existing architectural patterns and the Four Locked Pillars (`AGENTS.md`).
- [ ] `cd src-tauri && cargo fmt --all -- --check` passes cleanly.
- [ ] `cd src-tauri && cargo test --lib` passes with zero failures.
- [ ] `cd src-tauri && cargo clippy --locked --all-targets -- -D warnings` reports no warnings.
- [ ] JavaScript tests pass (`node src-tauri/resources/bridge.test.mjs`, etc.).
- [ ] Documentation checks pass (`node scripts/check-docs.mjs`).
- [ ] No private messages, phone numbers, tokens, or credentials are included in code or screenshots.

## Screenshots / Visual Media (If Applicable)

<!-- If your PR modifies UI elements, please attach before & after screenshots. Ensure personal data is completely redacted. -->

---

WhatsNow is authored and maintained solely by
[@benedictusrey](https://github.com/benedictusrey). Accepted contributions are
credited through Git history while project authorship remains with the
maintainer.
