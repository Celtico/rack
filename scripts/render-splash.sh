#!/usr/bin/env bash
# Render the iOS launch screens ("apple-touch-startup-image") with headless Chrome: the logo's art
# and the word RACK, black on white, centred — one PNG per iPhone / iPad size and orientation,
# since iOS wants an exact match per device. Android needs none: it builds its own splash from the
# manifest's `background_color`, icon and name.
#
# Writes public/splash/*.png and prints the <link> tags for index.html.
#
# Usage: scripts/render-splash.sh   (macOS; CHROME overrides the browser path)
set -euo pipefail
cd "$(dirname "$0")/.."

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
OUT=public/splash
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"

# The page: the `art` group of public/favicon.svg (its bounding box as the viewBox, no panel) over
# the name, sized in vmin so the same page fits every screen and either orientation.
cat > "$TMP/splash.html" <<'HTML'
<!doctype html>
<meta charset="utf-8">
<style>
  html, body { margin: 0; height: 100%; background: #fff; }
  body {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 6vmin; font-family: "Helvetica Neue", Helvetica, Inter, system-ui, sans-serif;
  }
  svg { width: 27vmin; height: auto; display: block; }
  .name { font-size: 8.5vmin; line-height: 1; letter-spacing: -0.02em; color: #000; }
</style>
<svg viewBox="254 254 961 981" xmlns="http://www.w3.org/2000/svg">
  <rect x="748.042" y="254.776" width="361" height="361" rx="2" fill="#000"/>
  <rect x="958.578" y="722.95" width="361.28" height="361.28" rx="2" transform="rotate(45 958.578 722.95)" fill="#000"/>
  <rect x="254.042" y="254.776" width="363" height="361" rx="2" fill="#000"/>
  <rect x="254.042" y="757.776" width="363" height="361" rx="2" fill="#000"/>
</svg>
<div class="name">RACK</div>
HTML

# CSS width, CSS height and pixel ratio of each screen, portrait. Landscape is the same swapped.
DEVICES=(
  "440 956 3"   # iPhone 16 Pro Max
  "402 874 3"   # iPhone 16 Pro
  "430 932 3"   # iPhone 14 Pro Max, 15 Plus / Pro Max, 16 Plus
  "393 852 3"   # iPhone 14 Pro, 15 / 15 Pro, 16
  "428 926 3"   # iPhone 12/13 Pro Max, 14 Plus
  "390 844 3"   # iPhone 12/13/14, 12/13 Pro
  "375 812 3"   # iPhone X/XS, 11 Pro, 12/13 mini
  "414 896 3"   # iPhone XS Max, 11 Pro Max
  "414 896 2"   # iPhone XR, 11
  "375 667 2"   # iPhone 6/7/8, SE (2nd/3rd)
  "414 736 3"   # iPhone 6/7/8 Plus
  "1024 1366 2" # iPad Pro 12.9"
  "1032 1376 2" # iPad Pro 13" (M4)
  "834 1194 2"  # iPad Pro 11", Air 4/5
  "834 1210 2"  # iPad Pro 11" (M4)
  "820 1180 2"  # iPad 10th gen
  "810 1080 2"  # iPad 7th–9th gen
  "768 1024 2"  # iPad mini 5, Air 2, 9.7" Pro
  "744 1133 2"  # iPad mini 6
)

shot() { # $1 = px width, $2 = px height, $3 = png
  "$CHROME" --headless=new --hide-scrollbars --window-size="$1,$2" --screenshot="$3" \
    "file://$TMP/splash.html" >/dev/null 2>&1
}

LINKS="$TMP/links.html"
: > "$LINKS"
for d in "${DEVICES[@]}"; do
  read -r w h r <<< "$d"
  for o in portrait landscape; do
    if [ "$o" = portrait ]; then pw=$((w * r)); ph=$((h * r)); else pw=$((h * r)); ph=$((w * r)); fi
    png="$OUT/${pw}x${ph}.png"
    [ -f "$png" ] || shot "$pw" "$ph" "$png"
    printf '    <link rel="apple-touch-startup-image" media="screen and (device-width: %spx) and (device-height: %spx) and (-webkit-device-pixel-ratio: %s) and (orientation: %s)" href="/splash/%sx%s.png" />\n' \
      "$w" "$h" "$r" "$o" "$pw" "$ph" >> "$LINKS"
  done
done
echo "$(ls "$OUT"/*.png | wc -l | tr -d ' ') screens in $OUT. The <link> tags for index.html:"
cat "$LINKS"
