#!/usr/bin/env bash
# Render the PWA icons from public/favicon.svg with headless Chrome.
#
#   icon-192 / icon-512      the favicon as is: rounded panel on a transparent ground
#   apple-touch-icon (180)   full-bleed square — iOS rounds it itself
#   icon-maskable-512        full-bleed square with the panel shrunk into the safe zone
#
# Usage: scripts/render-icons.sh   (macOS; CHROME overrides the browser path)
set -euo pipefail
cd "$(dirname "$0")/.."

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
SVG=public/favicon.svg
OUT=public/icons
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# An HTML page that shows the icon edge to edge, so a window-sized screenshot is the icon. The
# full-bleed variants (Apple, maskable) use the same art on the square: the SVG with its corner
# radius stripped, filling the window — the tiles sit inside the maskable safe zone as drawn.
SQUARE="$TMP/square.svg"
sed 's/ rx="300"//' "$SVG" > "$SQUARE"
page() { # $1 = html file, $2 = "rounded" | "bleed"
  local src="$PWD/$SVG"
  [ "$2" = bleed ] && src="$SQUARE"
  printf '<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}</style><img src="file://%s" style="width:100vw;height:100vh;display:block">' "$src" > "$1"
}

# Chrome will not open a window under ~500 px, so every icon is shot at 512 and scaled down with sips.
shot() { # $1 = html, $2 = size, $3 = png
  "$CHROME" --headless=new --hide-scrollbars --default-background-color=00000000 \
    --window-size=512,512 --screenshot="$3" "file://$1" >/dev/null 2>&1
  [ "$2" = 512 ] || sips -z "$2" "$2" "$3" >/dev/null
}

page "$TMP/rounded.html" rounded
page "$TMP/bleed.html" bleed

shot "$TMP/rounded.html" 192 "$OUT/icon-192.png"
shot "$TMP/rounded.html" 512 "$OUT/icon-512.png"
shot "$TMP/bleed.html" 180 "$OUT/apple-touch-icon.png"
shot "$TMP/bleed.html" 512 "$OUT/icon-maskable-512.png"
ls -la "$OUT"
