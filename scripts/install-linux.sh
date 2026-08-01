#!/bin/sh
# WhatsNow installer — authored and maintained solely by @benedictusrey.
# https://github.com/benedictusrey
# Install the WhatsNow AppImage (portable) or Debian package.
set -eu

SOURCE=""
INSTALL_DIR="${WHATSNOW_INSTALL_DIR:-$HOME/.local/opt/WhatsNow}"
REPOSITORY="${WHATSNOW_GITHUB_REPOSITORY:-benedictusrey/WhatsNow-for-WhatsApp}"
EXPECTED_SHA256=""
LAUNCH=0
TMP=""

status() { printf '\033[32m%s\033[0m\n' "$*"; }
warn() { printf '\033[33mWarning: %s\033[0m\n' "$*" >&2; }
fail() { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

usage() {
  cat <<'EOF'
Usage: install-linux.sh [options]
  --source PATH_OR_HTTPS_URL  AppImage or .deb package
  --install-dir DIRECTORY     AppImage destination
  --repository OWNER/NAME     Download the latest GitHub release
  --sha256 HASH               Require this package checksum
  --launch                    Launch after installation
EOF
}

cleanup() {
  if [ -n "$TMP" ] && [ -d "$TMP" ]; then rm -rf "$TMP"; fi
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

[ "$(uname -s)" = "Linux" ] || fail 'This installer must run on Linux.'
case "$INSTALL_DIR" in /*) ;; *) fail 'The install directory must be an absolute path.' ;; esac

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
  for candidate in "$SCRIPT_ROOT"/*.AppImage "$SCRIPT_ROOT"/*.deb \
    "$SCRIPT_ROOT"/../*.AppImage "$SCRIPT_ROOT"/../*.deb; do
    if [ -f "$candidate" ]; then SOURCE=$candidate; break; fi
  done
fi

if [ -z "$SOURCE" ]; then
  [ -n "$REPOSITORY" ] || fail \
    'No local Linux package was found. Use --source or --repository OWNER/NAME.'
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
  case "$(uname -m)" in
    x86_64|amd64) ARCH_RE='(amd64|x86_64|x64)' ;;
    aarch64|arm64) ARCH_RE='(aarch64|arm64)' ;;
    *) fail "Unsupported Linux architecture: $(uname -m)" ;;
  esac
  SOURCE=$(printf '%s' "$RELEASE_JSON" | tr ',' '\n' |
    sed -nE 's/.*"browser_download_url"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/p' |
    grep -Ei "${ARCH_RE}.*\.(AppImage|deb)$" | head -n 1 || true)
  [ -n "$SOURCE" ] || fail 'The latest release has no compatible Linux package.'
fi

case "$SOURCE" in
  https://*)
    PACKAGE="$TMP/$(basename "${SOURCE%%\?*}")"
    status "Downloading $(basename "$PACKAGE")..."
    download "$SOURCE" "$PACKAGE"
    ;;
  *)
    [ -f "$SOURCE" ] || fail "Package not found: $SOURCE"
    PACKAGE=$(CDPATH= cd -- "$(dirname -- "$SOURCE")" && pwd)/$(basename "$SOURCE")
    ;;
esac

if [ -n "$EXPECTED_SHA256" ]; then
  printf '%s' "$EXPECTED_SHA256" | grep -Eq '^[A-Fa-f0-9]{64}$' ||
    fail '--sha256 must contain exactly 64 hexadecimal characters.'
  ACTUAL_SHA256=$(sha256sum "$PACKAGE" | awk '{print $1}')
  [ "$(printf '%s' "$ACTUAL_SHA256" | tr '[:upper:]' '[:lower:]')" = \
    "$(printf '%s' "$EXPECTED_SHA256" | tr '[:upper:]' '[:lower:]')" ] ||
    fail 'SHA-256 verification failed.'
  status 'SHA-256 verification passed.'
else
  warn 'No SHA-256 checksum was supplied; authenticity could not be pinned.'
fi

case "$PACKAGE" in
  *.AppImage)
    mkdir -p "$INSTALL_DIR" "$HOME/.local/bin" "$HOME/.local/share/applications"
    DESTINATION="$INSTALL_DIR/WhatsNow.AppImage"
    STAGED="$DESTINATION.new"
    cp "$PACKAGE" "$STAGED"
    chmod 755 "$STAGED"
    mv -f "$STAGED" "$DESTINATION"

    LAUNCHER="$HOME/.local/bin/whatsnow"
    cat > "$LAUNCHER" <<EOF
#!/bin/sh
APPIMAGE='$DESTINATION'
if command -v fusermount >/dev/null 2>&1 || command -v fusermount3 >/dev/null 2>&1; then
  exec "\$APPIMAGE" "\$@"
fi
exec "\$APPIMAGE" --appimage-extract-and-run "\$@"
EOF
    chmod 755 "$LAUNCHER"

    ICON=""
    SCRIPT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
    for candidate in "$SCRIPT_ROOT/app-icon.svg" "$SCRIPT_ROOT/../app-icon.svg" \
      "$SCRIPT_ROOT/icon.png" "$SCRIPT_ROOT/../icon.png"; do
      if [ -f "$candidate" ]; then
        ICON="$HOME/.local/share/icons/hicolor/512x512/apps/app.whatsnow.desktop.${candidate##*.}"
        mkdir -p "$(dirname "$ICON")"
        cp "$candidate" "$ICON"
        break
      fi
    done
    DESKTOP_FILE="$HOME/.local/share/applications/app.whatsnow.desktop"
    {
      printf '%s\n' '[Desktop Entry]' 'Type=Application' 'Name=WhatsNow'
      printf 'Exec=%s\n' "$LAUNCHER"
      if [ -n "$ICON" ]; then printf 'Icon=%s\n' "$ICON"; fi
      printf '%s\n' 'Terminal=false' 'Categories=Network;InstantMessaging;'
      printf '%s\n' 'StartupWMClass=WhatsNow'
    } > "$DESKTOP_FILE"
    chmod 644 "$DESKTOP_FILE"
    ;;
  *.deb)
    if ! have dpkg; then fail 'This system cannot install Debian packages; use the AppImage.'; fi
    if [ "$(id -u)" -eq 0 ]; then SUDO=""; elif have sudo; then SUDO="sudo"; else
      fail 'Installing a .deb needs root access or sudo. Use the AppImage instead.'
    fi
    if have apt-get; then
      $SUDO apt-get install -y "$PACKAGE"
    else
      $SUDO dpkg -i "$PACKAGE" ||
        fail 'dpkg reported missing dependencies. Install them and retry.'
    fi
    DESTINATION=$(command -v whatsnow || true)
    ;;
  *) fail "Unsupported Linux package: $(basename "$PACKAGE")" ;;
esac

if have pkg-config; then
  if ! pkg-config --atleast-version=2.46.1 webkit2gtk-4.1; then
    warn 'WebKitGTK 2.46.1+ was not detected; install/update webkit2gtk-4.1 before launching.'
    LAUNCH=0
  fi
else
  warn 'pkg-config is unavailable, so WebKitGTK compatibility could not be checked.'
  LAUNCH=0
fi

status "WhatsNow installed at ${DESTINATION:-system application directory}"
if [ "$LAUNCH" -eq 1 ]; then
  if [ -x "${LAUNCHER:-}" ]; then "$LAUNCHER" >/dev/null 2>&1 &
  elif have whatsnow; then whatsnow >/dev/null 2>&1 &
  fi
fi
