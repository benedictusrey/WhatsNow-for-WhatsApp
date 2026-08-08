# Local release assets

WhatsNow is authored and maintained solely by
[@benedictusrey](https://github.com/benedictusrey).

This folder is a local upload staging area. Executables and platform packages
are ignored by Git and should be attached to GitHub Releases.

The Windows subfolder is the v2.0.0 upload staging area. Linux and macOS
packages should be added only after native build and platform validation.

Upload these files to the `v2.0.0` GitHub Release rather than committing the
binary packages to repository history. Keep the checksum manifest beside the
matching release assets.

Files carrying `1.0.0`, including `checksums-windows10.sha256`, are retained
only as historical staging material for the earlier release. Do not attach
them to the `v2.0.0` release.
