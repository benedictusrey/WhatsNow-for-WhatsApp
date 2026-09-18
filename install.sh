#!/bin/sh
# WhatsNow installer — authored and maintained solely by @benedictusrey.
# https://github.com/benedictusrey
# Dispatch to the native WhatsNow installer for this operating system.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

case "$(uname -s)" in
  Darwin)
    if [ -x "$ROOT/scripts/install-macos.sh" ]; then
      exec "$ROOT/scripts/install-macos.sh" "$@"
    fi
    if [ -f "$ROOT/scripts/install-macos.sh" ]; then
      exec sh "$ROOT/scripts/install-macos.sh" "$@"
    fi
    exec sh "$ROOT/install-macos.sh" "$@"
    ;;
  Linux)
    if [ -x "$ROOT/scripts/install-linux.sh" ]; then
      exec "$ROOT/scripts/install-linux.sh" "$@"
    fi
    if [ -f "$ROOT/scripts/install-linux.sh" ]; then
      exec sh "$ROOT/scripts/install-linux.sh" "$@"
    fi
    exec sh "$ROOT/install-linux.sh" "$@"
    ;;
  *)
    printf 'WhatsNow supports Windows, macOS, and Linux desktop systems.\n' >&2
    printf 'On Windows, run install.ps1 in PowerShell.\n' >&2
    exit 1
    ;;
esac
