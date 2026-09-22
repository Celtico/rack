#!/usr/bin/env bash
# Builds the STR-6 sampled sounds into public/samples/guitar/<sound>/<Note>.mp3 from two CC0
# libraries: FreePats' Spanish Classical Guitar (nylon) and Karoryfer's Black And Green Guitars
# (the green Gretsch, electric). One note every three semitones from E2 to G5 — Tone's Sampler
# repitches from the nearest one, so nothing is ever shifted more than a semitone and a half.
# Each take is trimmed to 4 s with a fade, peak-normalised to -1 dBFS and written as mono MP3.
# Needs curl, bsdtar (macOS) and ffmpeg.
set -euo pipefail

cd "$(dirname "$0")/.."
OUT=public/samples/guitar
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# The notes as Tone spells them (flats) and the source file of each. FreePats has no A#2 or
# C#3, so the nylon set steps by twos there; Karoryfer's names sit an octave up (their e4 is
# MIDI 52, E3).
NYLON_NOTES=(E2 G2 A2 C3 D3 E3 G3 Bb3 Db4 E4 G4 Bb4 Db5 E5 G5)
NYLON_FILES=(E2 G2 A2 C3 D3 E3 G3 A#3 C#4 E4 G4 A#4 C#5 E5 G5)
ELECTRIC_NOTES=(E2 G2 Bb2 Db3 E3 G3 Bb3 Db4 E4 G4 Bb4 Db5 E5 G5)
ELECTRIC_FILES=(e3 g3 bb3 db4 e4 g4 bb4 db5 e5 g5 bb5 db6 e6 g6)

# $1 source, $2 destination: trim, fade, normalise the peak to -1 dBFS, mono MP3.
convert() {
  local peak
  peak=$(ffmpeg -v info -i "$1" -af "atrim=0:4,volumedetect" -f null - 2>&1 |
    sed -n 's/.*max_volume: \(-*[0-9.]*\) dB/\1/p')
  ffmpeg -v error -y -i "$1" \
    -af "atrim=0:4,afade=t=out:st=3.5:d=0.5,volume=$(echo "-1 - ($peak)" | bc)dB" \
    -ac 1 -ar 44100 -codec:a libmp3lame -b:a 96k "$2"
}

echo "nylon: FreePats Spanish Classical Guitar"
curl -sL "https://freepats.zenvoid.org/Guitar/SpanishClassicalGuitar/SpanishClassicalGuitar-SFZ+FLAC-20190618.7z" \
  -o "$WORK/scg.7z"
mkdir -p "$WORK/scg" && bsdtar -xf "$WORK/scg.7z" -C "$WORK/scg"
# The archive's one folder, resolved once: a "#" in a note's file name would stop a glob expanding.
SCG=$(find "$WORK/scg" -type d -name samples | head -1)
mkdir -p "$OUT/nylon"
for i in "${!NYLON_NOTES[@]}"; do
  convert "$SCG/${NYLON_FILES[$i]}.flac" "$OUT/nylon/${NYLON_NOTES[$i]}.mp3"
done

echo "electric: Karoryfer Black And Green Guitars (green, ordinary, mf)"
mkdir -p "$OUT/electric"
for i in "${!ELECTRIC_NOTES[@]}"; do
  file="twang_${ELECTRIC_FILES[$i]}_mf_rr1.wav"
  curl -sfL "https://raw.githubusercontent.com/sfzinstruments/karoryfer.black-and-green-guitars/HEAD/Samples/green/ord/$file" \
    -o "$WORK/$file"
  convert "$WORK/$file" "$OUT/electric/${ELECTRIC_NOTES[$i]}.mp3"
done

cat >"$OUT/LICENSE.txt" <<'EOF'
Guitar samples for STR-6, all under the Creative Commons CC0 1.0 public domain dedication
(https://creativecommons.org/publicdomain/zero/1.0/), converted by scripts/make-guitar-samples.sh.

nylon/    Spanish Classical Guitar, FreePats project, recorded by roberto@zenvoid.org (2008,
          version 2019-06-18). https://freepats.zenvoid.org/Guitar/acoustic-guitar.html
electric/ Black And Green Guitars (the green Gretsch Anniversary), Karoryfer Lecolds, recorded
          by Brian Wood, 2022. https://github.com/sfzinstruments/karoryfer.black-and-green-guitars
EOF

du -sh "$OUT"/*
