# Security policy

## Supported release

Security fixes are provided for the latest published WhatsNow release. Version
2.0.0 is the current release.

## Report a vulnerability privately

Use **Security > Report a vulnerability** on the GitHub repository to open a
private security advisory. If that option is unavailable, contact the maintainer
through the private contact method shown on
[@benedictusrey](https://github.com/benedictusrey).

Include the WhatsNow version, operating system, reproduction steps, expected
behavior, and the security impact. Do not place session tokens, private
messages, profile directories, or exploit details in a public issue.

## Release trust

Release safety depends on provenance, integrity, and platform signing:

1. Download only from the official `benedictusrey/WhatsNow-for-WhatsApp`
   Releases page.
2. Verify the SHA-256 checksum.
3. Verify the publisher signature when the release is signed.
4. Reject a file whose checksum differs, source is uncertain, or signature is
   invalid.

An unsigned executable may receive a Windows SmartScreen or antivirus
reputation warning, especially during an initial release. This repository does
not ask users to disable antivirus protection or create broad exclusions.
Submit a suspected false positive to the antivirus vendor with the exact hash
and release URL, and wait for review if authenticity cannot be established.

More detail and verification commands are in
[Security and verification](docs/SECURITY_AND_VERIFICATION.md).
