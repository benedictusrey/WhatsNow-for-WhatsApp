#!/bin/sh
# WhatsNow installer — authored and maintained solely by @benedictusrey.
# https://github.com/benedictusrey
# Install a WhatsNow DMG or app archive without requiring administrator access.
set -eu

APP="WhatsNow"
BUNDLE_ID="app.whatsnow.desktop"
SOURCE=""
INSTALL_DIR="${WHATSNOW_INSTALL_DIR:-$HOME/Applications}"
REPOSITORY="${WHATSNOW_GITHUB_REPOSITORY:-benedictusrey/WhatsNow-for-WhatsApp}"
EXPECTED_SHA256=""
LAUNCH=0
TMP=""
MOUNT=""

status() { printf '\033[32m%s\033[0m\n' "$*"; }
warn() { printf '\033[33mWarning: %s\033[0m\n' "$*" >&2; }
fail() { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

usage() {
  cat <<'EOF'
Usage: install-macos.sh [options]
  --source PATH_OR_HTTPS_URL  DMG, .app.tar.gz, or .app bundle
  --install-dir DIRECTORY     Destination (default: ~/Applications)
  --repository OWNER/NAME     Download the latest GitHub release
  --sha256 HASH               Require this package checksum
  --launch                    Launch after installation
EOF
}

cleanup() {
  if [ -n "$MOUNT" ] && mount | grep -F " on $MOUNT " >/dev/null 2>&1; then
    hdiutil detach "$MOUNT" -quiet >/dev/null 2>&1 || true
  fi
  if [ -n "$TMP" ] && [ -d "$TMP" ]; then
    rm -rf "$TMP"
  fi
}
trap cleanup EXIT HUP INT TERM

while [ "$#" -gt 0 ]; do
  case "$1" in
    --source) [ "$#" -ge 2 ] || fail '--source needs a value.'; SOURCE=$2; shift 2 ;;
    --install-dir) [ "$#" -ge 2 ] || fail '--install-dir needs a value.'; INSTALL_DIR=$2; shift 2 ;;
    --repository) [ "$#" -ge 2 ] || fail '--repository needs a value.'; REPOSITORY=$2; shift 2 ;;
    --sha256) [ "$#" -ge 2 ] || fail '--sha256 needs a value.'; EXPECTED_SHA256=$2; shift 2 ;;
    --launch) LAUNCH=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) [ -z "$SOURCE" ] || fail "Unexpected argument: $1"; SOURCE=$1; shift ;;
  esac
done

[ "$(uname -s)" = "Darwin" ] || fail 'This installer must run on macOS.'
case "$INSTALL_DIR" in
  /*) ;;
  *) fail 'The install directory must be an absolute path.' ;;
esac

MACOS_VERSION=$(sw_vers -productVersion)
OLD_IFS=$IFS
IFS=.
set -- $MACOS_VERSION
IFS=$OLD_IFS
MACOS_MAJOR=${1:-0}
MACOS_MINOR=${2:-0}
if [ "$MACOS_MAJOR" -lt 12 ] ||
  { [ "$MACOS_MAJOR" -eq 12 ] && [ "$MACOS_MINOR" -lt 1 ]; }; then
  fail "WhatsNow requires macOS 12.1 or newer; this Mac reports $MACOS_VERSION."
fi

TMP=$(mktemp -d "${TMPDIR:-/tmp}/whatsnow-install.XXXXXX")

download() {
  url=$1
  output=$2
  case "$url" in https://*) ;; *) fail 'Only HTTPS package URLs are accepted.' ;; esac
  if have curl; then
    curl --fail --location --proto '=https' --tlsv1.2 --output "$output" "$url"
  elif have wget; then
    wget --https-only --output-document="$output" "$url"
  else
    fail 'curl or wget is required to download a release.'
  fi
}

if [ -z "$SOURCE" ]; then
  SCRIPT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
  for candidate in "$SCRIPT_ROOT"/*.dmg "$SCRIPT_ROOT"/*.app.tar.gz \
    "$SCRIPT_ROOT"/../*.dmg "$SCRIPT_ROOT"/../*.app.tar.gz; do
    if [ -f "$candidate" ]; then SOURCE=$candidate; break; fi
  done
fi

if [ -z "$SOURCE" ]; then
  [ -n "$REPOSITORY" ] || fail \
    'No local macOS package was found. Use --source or --repository OWNER/NAME.'
  printf '%s' "$REPOSITORY" | grep -Eq '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$' ||
    fail 'Repository must use the owner/name format.'
  API="https://api.github.com/repos/$REPOSITORY/releases/latest"
  if have curl; then
    RELEASE_JSON=$(curl --fail --silent --show-error --location \
      --header 'Accept: application/vnd.github+json' \
      --header 'User-Agent: WhatsNow-Installer' "$API")
  elif have wget; then
    RELEASE_JSON=$(wget --quiet --header='Accept: application/vnd.github+json' \
      --header='User-Agent: WhatsNow-Installer' -O- "$API")
  else
    fail 'curl or wget is required to query the release.'
  fi
  case "$(uname -m)" in arm64|aarch64) ARCH_RE='(aarch64|arm64)' ;; *) ARCH_RE='(x64|x86_64|intel)' ;; esac
  SOURCE=$(printf '%s' "$RELEASE_JSON" | tr ',' '\n' |
    sed -nE 's/.*"browser_download_url"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' |
    grep -Ei "${ARCH_RE}.*\.(dmg|app\.tar\.gz)$" | head -n 1 || true)
  [ -n "$SOURCE" ] || fail 'The latest release has no compatible macOS package.'
fi

case "$SOURCE" in
  https://*)
    PACKAGE="$TMP/$(basename "${SOURCE%%\?*}")"
    status "Downloading $(basename "$PACKAGE")..."
    download "$SOURCE" "$PACKAGE"
    ;;
  *)
    [ -e "$SOURCE" ] || fail "Package not found: $SOURCE"
    PACKAGE=$(CDPATH= cd -- "$(dirname -- "$SOURCE")" && pwd)/$(basename "$SOURCE")
    ;;
esac

if [ -n "$EXPECTED_SHA256" ]; then
  printf '%s' "$EXPECTED_SHA256" | grep -Eq '^[A-Fa-f0-9]{64}$' ||
    fail '--sha256 must contain exactly 64 hexadecimal characters.'
  ACTUAL_SHA256=$(shasum -a 256 "$PACKAGE" | awk '{print $1}')
  [ "$(printf '%s' "$ACTUAL_SHA256" | tr '[:upper:]' '[:lower:]')" = \
    "$(printf '%s' "$EXPECTED_SHA256" | tr '[:upper:]' '[:lower:]')" ] ||
    fail 'SHA-256 verification failed.'
  status 'SHA-256 verification passed.'
else
  warn 'No SHA-256 checksum was supplied; authenticity could not be pinned.'
fi

case "$PACKAGE" in
  *.dmg)
    MOUNT="$TMP/mount"
    mkdir "$MOUNT"
    hdiutil attach -nobrowse -readonly -mountpoint "$MOUNT" "$PACKAGE" -quiet
    APP_SOURCE=$(find "$MOUNT" -maxdepth 1 -type d -name 'WhatsNow.app' -print | head -n 1)
    ;;
  *.app.tar.gz|*.tgz)
    if tar -tzf "$PACKAGE" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then
      fail 'The application archive contains an unsafe path.'
    fi
    mkdir "$TMP/archive"
    tar -xzf "$PACKAGE" -C "$TMP/archive"
    APP_SOURCE=$(find "$TMP/archive" -maxdepth 2 -type d -name 'WhatsNow.app' -print | head -n 1)
    ;;
  *.app)
    APP_SOURCE=$PACKAGE
    ;;
  *) fail "Unsupported macOS package: $(basename "$PACKAGE")" ;;
esac

[ -n "${APP_SOURCE:-}" ] || fail 'WhatsNow.app was not found in the package.'
PLIST="$APP_SOURCE/Contents/Info.plist"
[ -f "$PLIST" ] || fail 'The application bundle has no Info.plist.'
ACTUAL_ID=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$PLIST" 2>/dev/null || true)
[ "$ACTUAL_ID" = "$BUNDLE_ID" ] ||
  fail "Unexpected application identifier: ${ACTUAL_ID:-missing}"

mkdir -p "$INSTALL_DIR"
DESTINATION="$INSTALL_DIR/$APP.app"
STAGED="$INSTALL_DIR/.$APP.app.new.$$"
BACKUP="$INSTALL_DIR/.$APP.app.previous.$$"
ditto "$APP_SOURCE" "$STAGED"
if [ -e "$DESTINATION" ]; then mv "$DESTINATION" "$BACKUP"; fi
if mv "$STAGED" "$DESTINATION"; then
  [ ! -e "$BACKUP" ] || rm -rf "$BACKUP"
else
  [ ! -e "$BACKUP" ] || mv "$BACKUP" "$DESTINATION"
  fail 'Could not activate the new application bundle.'
fi

if codesign --verify --deep --strict "$DESTINATION" >/dev/null 2>&1; then
  status 'Code-signature verification passed.'
else
  warn 'This build is unsigned. macOS may require Open from the Finder context menu.'
fi

status "WhatsNow installed at $DESTINATION"
if [ "$LAUNCH" -eq 1 ]; then open "$DESTINATION"; fi
