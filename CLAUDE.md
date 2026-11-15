# CLAUDE.md: WhatsNow project instructions

WhatsNow is authored and maintained solely by Benedictus Reynaldo Hartanto
([@benedictusrey](https://github.com/benedictusrey)).
Repository: <https://github.com/benedictusrey/WhatsNow-for-WhatsApp>.

[AGENTS.md](AGENTS.md) holds the binding rules (authorship, locked behavior, standing rules). Read it first and
follow it. This file adds the release routine.

## Checkpoint after every successful release

After every successfully released version, update the checkpoint in [docs/checkpoint/](docs/checkpoint/) before
the work is called done. A release is successful when all of these are true:

- the release workflow finished green for the tag;
- the GitHub release is public (not a draft) with the expected installers and `checksums.sha256`;
- the asset digests match `checksums.sha256` and the tag commit is on `main`.

Then:

1. Add `docs/checkpoint/CHECKPOINT_<YYYY-MM-DD>_v<version>.md`, using the latest checkpoint as the template. Keep
   older checkpoints unchanged.
2. Update every section: state (version, branch, tag, release, asset sizes and SHA-256, test counts), what the
   version contains, decisions made, working rules, open items (close the done ones, add new ones), how to resume,
   pitfalls found, and local-only folders.
3. Record the tests run for that version (automated, live, CI, not verified) in `WhatsNow_v<version>.md`, and link
   it from the checkpoint.
4. Run `node scripts/check-docs.mjs`, commit, and ask before pushing. A checkpoint is a docs-only change and must
   never start a GitHub Actions workflow.

A release that failed, was rolled back, or was only a draft does not get a checkpoint; note it under open items in
the last one instead.
