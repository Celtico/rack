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

# An HTML page that shows the icon edge to edge, so a window-sized screenshot is the icon.
page() { # $1 = html file, $2 = "rounded" | "bleed", $3 = content scale for bleed
  local body
  if [ "$2" = rounded ]; then
    body="<img src=\"$PWD/$SVG\" style=\"width:100vw;height:100vh;display:block\">"
  else
    body="<div style=\"width:100vw;height:100vh;background:#ffb000;display:grid;place-items:center\">
      <img src=\"$PWD/$SVG\" style=\"width:calc(100vw * $3);height:calc(100vh * $3);display:block\"></div>"
  fi
  printf '<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}</style>%s' "$body" > "$1"
}

# Chrome will not open a window under ~500 px, so every icon is shot at 512 and scaled down with sips.
shot() { # $1 = html, $2 = size, $3 = png
  "$CHROME" --headless=new --hide-scrollbars --default-background-color=00000000 \
    --window-size=512,512 --screenshot="$3" "file://$1" >/dev/null 2>&1
  [ "$2" = 512 ] || sips -z "$2" "$2" "$3" >/dev/null
}

page "$TMP/rounded.html" rounded
page "$TMP/bleed.html" bleed 0.84
page "$TMP/maskable.html" bleed 0.7

shot "$TMP/rounded.html" 192 "$OUT/icon-192.png"
shot "$TMP/rounded.html" 512 "$OUT/icon-512.png"
shot "$TMP/bleed.html" 180 "$OUT/apple-touch-icon.png"
shot "$TMP/maskable.html" 512 "$OUT/icon-maskable-512.png"
ls -la "$OUT"
