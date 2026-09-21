#!/usr/bin/env node
/**
 * Writes the composed demo songs into public/songs/. Each song is built from
 * small pattern strings ("x...x..." for a kit row, "0.2.4..." for a note row,
 * "A.B." + a chord table for a poly grid) so a part reads like a drum sheet
 * rather than 16 booleans. Run: `node scripts/make-songs.mjs`.
 *
 * Rows of a melodic machine are its key's notes (src/state/key.ts): with a
 * key of A minor at octave 3 the rows are A3 B3 C4 D4 E4 F4 G4 A4, so row 0
 * is the root, row 2 the third, row 4 the fifth and row 7 the octave.
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "songs")

// ---------- pattern strings ----------

/** "x...x..." → 16 booleans; anything but "." and " " is a hit. */
const hits = (s = "") => {
  const chars = s.replace(/ /g, "").padEnd(16, ".").slice(0, 16)
  return [...chars].map((c) => c !== ".")
}

/** "0.2.4..." → 16 row indices or null; a hex digit is a row (0–7), "." a rest. */
const line = (s = "") => {
  const chars = s.replace(/ /g, "").padEnd(16, ".").slice(0, 16)
  return [...chars].map((c) => (c === "." ? null : parseInt(c, 16)))
}

/** "A.B.C..." with { A: [0, 2, 4] } → 16 chords; "." is a rest, "-" too. */
const chords = (s, table) => {
  const chars = s.replace(/ /g, "").padEnd(16, ".").slice(0, 16)
  return [...chars].map((c) => (c === "." || c === "-" ? [] : [...table[c]].sort((a, b) => a - b)))
}

const DRUMS = ["kick", "snare", "clap", "hat"]
const PERC = ["tomLo", "tomHi", "rim", "cowbell", "shaker", "crash"]

const kit = (kind, voices, rows) => ({
  kind,
  rows: Object.fromEntries(voices.map((v) => [v, hits(rows[v])])),
})
const drums = (rows) => kit("drums", DRUMS, rows)
const perc = (rows) => kit("perc", PERC, rows)
const synth = (notes) => ({ kind: "synth", notes: line(notes) })
const bass = (notes, accent = "", slide = "") => ({
  kind: "bass",
  bass: { notes: line(notes), accent: hits(accent), slide: hits(slide) },
})
const poly = (kind, s, table) => ({ kind, chords: chords(s, table) })

// ---------- instances ----------

const lfo = (target = "off", rate = 1, amount = 0.5, shape = "sine") => ({
  shape,
  rate,
  target,
  amount,
})
const macro = (value = 0, targets = []) => ({ value, targets })
const mod = ({
  tune = 0,
  drive = 0,
  lfo1 = lfo(),
  lfo2 = lfo(),
  random = { target: "off", amount: 0.5 },
  macros = [],
} = {}) => ({
  tune,
  drive,
  lfo: [lfo1, lfo2],
  random,
  macros: [0, 1, 2, 3].map((i) => macros[i] ?? macro()),
})

const instance = (
  id,
  kind,
  params,
  { level = 0.8, send = 0.2, pan = 0, space, filter, key, mod: m } = {},
) => ({
  id,
  kind,
  params,
  level,
  send,
  mute: false,
  pan,
  ...(space ? { space } : {}),
  ...(filter ? { filter } : {}),
  ...(key ? { key } : {}),
  mod: m ?? mod(),
})

const key = (root, scale, octave) => ({ root, scale, octave })
const highpass = (cutoff, resonance = 0.7) => ({ type: "highpass", cutoff, resonance })
const lowpass = (cutoff, resonance = 0.7) => ({ type: "lowpass", cutoff, resonance })

// ---------- songs ----------

/**
 * `sections` is a list of [name, bars, patternsPerBar]; the bars cycle through
 * the pattern list. Returns chain + sections.
 */
const arrange = (sections) => {
  const chain = []
  for (const [, bars, slots] of sections)
    for (let i = 0; i < bars; i++) chain.push(slots[i % slots.length])
  return { chain, sections: sections.map(([name, bars]) => ({ name, bars })) }
}

/**
 * `places` puts machines in 3D — `{ id: [angle, distance] }`, front is 0°, right positive — and
 * switches the song's 3D mode on.
 */
const song = ({ bpm, swing = 0, master = 0.8, fx, instances, patterns, sections, places }) => ({
  version: 2,
  bpm,
  swing,
  masterVolume: master,
  instances: places
    ? instances.map((i) =>
        places[i.id] ? { ...i, space: { angle: places[i.id][0], distance: places[i.id][1] } } : i,
      )
    : instances,
  patterns,
  activePattern: 0,
  ...arrange(sections),
  fx: {
    delayTime: "8n.",
    feedback: 0.3,
    reverbDecay: 3,
    pingPong: false,
    space: Boolean(places),
    ...fx,
  },
})

const pattern = (tracks, muted) => ({ tracks, ...(muted?.length ? { muted } : {}) })

// ======================================================================
// 1 · Nit de Festa — house, 120 BPM, La menor
// ======================================================================
function nitDeFesta() {
  // Rows (A minor, octave 3): A3 B3 C4 D4 E4 F4 G4 A4
  const CH = { a: [0, 2, 4], f: [2, 5, 7], c: [2, 4, 6], g: [1, 3, 6] } // Am F C G
  const PAD = { a: [0, 2, 4, 7], f: [0, 2, 5], c: [2, 4, 6], g: [1, 3, 6] }

  const kickFour = "x...x...x...x..."
  const drumsIntro = drums({ kick: kickFour, hat: "..x...x...x...x." })
  const drumsFull = drums({ kick: kickFour, clap: "....x.......x...", hat: "..x...x...x...x." })
  const drumsFill = drums({
    kick: "x...x...x...x.x.",
    clap: "....x.......x.xx",
    hat: "..x...x...x...x.",
  })
  const drumsBreak = drums({ kick: "x.......x.....x.", hat: "..x...x...x...x." })
  const tops = drums({ hat: "x.xxx.xxx.xxx.xx", snare: "" })
  const topsBuild = drums({ hat: "xxxxxxxxxxxxxxxx", snare: "x.x.x.x.xxxxxxxx" })
  const percVerse = perc({ shaker: "x.x.x.x.x.x.x.x.", rim: ".......x.......x" })
  const percDrop = perc({
    shaker: "xxxxxxxxxxxxxxxx",
    rim: ".......x.......x",
    cowbell: "..x.....x...x...",
  })
  const crash = perc({ crash: "x..............." })

  // Bass rows (A minor, octave 1): A1 B1 C2 D2 E2 F2 G2 A2
  const bassA = bass("0.0.7.0...0.7.0.", "x.......x.......", "....x.....x.....")
  const bassF = bass("5.5.5..5..5.7.5.", "x.......x.......", "...x......x.....")
  const bassC = bass("2.2.2..2..2.4.2.", "x.......x.......", "......x.........")
  const bassG = bass("6.6.6..6..6.7.6.", "x.......x.......", "...x.......xx...")
  const bassDrop = bass("0.0.7.0.0.7.0.5.", "x...x...x...x...", "....x.......x...")

  // Lead rows (A minor, octave 4): A4 B4 C5 D5 E5 F5 G5 A5
  const leadA = synth("0.2.4...7.4.2...")
  const leadF = synth("5...7.5.4.2.....")
  const leadC = synth("2.4.6...7...6.4.")
  const leadG = synth("6.4.3.1.....0...")

  const epA = poly("ep", "a...a.a...a...a.", CH)
  const epF = poly("ep", "f...f.f...f...f.", CH)
  const epC = poly("ep", "c...c.c...c...c.", CH)
  const epG = poly("ep", "g...g.g...g...g.", CH)
  const pad = (c) => poly("poly", `${c}...............`, PAD)

  const patterns = [
    /* 0 */ pattern({ "drums-1": drumsIntro }),
    /* 1 */ pattern({ "drums-1": drumsIntro, "bass-1": bassA, "perc-1": percVerse }),
    /* 2 */ pattern({ "drums-1": drumsFull, "bass-1": bassA, "perc-1": percVerse, "ep-1": epA }),
    /* 3 */ pattern({ "drums-1": drumsFull, "bass-1": bassF, "perc-1": percVerse, "ep-1": epF }),
    /* 4 */ pattern({ "drums-1": drumsFull, "bass-1": bassC, "perc-1": percVerse, "ep-1": epC }),
    /* 5 */ pattern({ "drums-1": drumsFill, "bass-1": bassG, "perc-1": percVerse, "ep-1": epG }),
    /* 6 */ pattern({
      "drums-1": drumsFull,
      "drums-2": tops,
      "bass-1": bassA,
      "perc-1": percVerse,
      "ep-1": epA,
      "poly-1": pad("a"),
    }),
    /* 7 */ pattern({
      "drums-1": drumsFull,
      "drums-2": tops,
      "bass-1": bassF,
      "perc-1": percVerse,
      "ep-1": epF,
      "poly-1": pad("f"),
    }),
    /* 8 */ pattern({
      "drums-1": drumsFull,
      "drums-2": tops,
      "bass-1": bassC,
      "perc-1": percVerse,
      "ep-1": epC,
      "poly-1": pad("c"),
    }),
    /* 9 */ pattern({
      "drums-1": drumsFill,
      "drums-2": topsBuild,
      "bass-1": bassG,
      "perc-1": percVerse,
      "ep-1": epG,
      "poly-1": pad("g"),
    }),
    /* 10 */ pattern({
      "drums-1": drumsFull,
      "drums-2": tops,
      "bass-1": bassDrop,
      "perc-1": percDrop,
      "ep-1": epA,
      "poly-1": pad("a"),
      "synth-1": leadA,
    }),
    /* 11 */ pattern({
      "drums-1": drumsFull,
      "drums-2": tops,
      "bass-1": bassF,
      "perc-1": percDrop,
      "ep-1": epF,
      "poly-1": pad("f"),
      "synth-1": leadF,
    }),
    /* 12 */ pattern({
      "drums-1": drumsFull,
      "drums-2": tops,
      "bass-1": bassC,
      "perc-1": percDrop,
      "ep-1": epC,
      "poly-1": pad("c"),
      "synth-1": leadC,
    }),
    /* 13 */ pattern({
      "drums-1": drumsFill,
      "drums-2": tops,
      "bass-1": bassG,
      "perc-1": percDrop,
      "ep-1": epG,
      "poly-1": pad("g"),
      "synth-1": leadG,
    }),
    // Break: the parts are all there, the rhythm section sits the slot out.
    /* 14 */ pattern(
      {
        "drums-1": drumsBreak,
        "drums-2": tops,
        "bass-1": bassA,
        "perc-1": crash,
        "ep-1": epA,
        "poly-1": pad("a"),
        "synth-1": leadA,
      },
      ["drums-1", "drums-2", "bass-1", "synth-1"],
    ),
    /* 15 */ pattern({
      "drums-1": drumsFull,
      "bass-1": bassA,
      "perc-1": percVerse,
      "poly-1": pad("a"),
    }),
  ]

  return song({
    bpm: 120,
    swing: 0.08,
    fx: { delayTime: "8n.", feedback: 0.38, reverbDecay: 2.8, pingPong: true },
    instances: [
      instance(
        "drums-1",
        "drums",
        { kick: 0.95, snare: 0.6, clap: 0.7, hat: 0.4 },
        {
          level: 0.9,
          send: 0.1,
          filter: lowpass(20000, 0.1),
          mod: mod({ drive: 0.15 }),
        },
      ),
      instance(
        "drums-2",
        "drums",
        { kick: 0.8, snare: 0.35, clap: 0.5, hat: 0.22 },
        {
          level: 0.7,
          send: 0.25,
          pan: 0.35,
          filter: highpass(900),
          // The tops shimmer: a little random on their level, so no two hats are the same.
          mod: mod({ random: { target: "level", amount: 0.35 } }),
        },
      ),
      instance(
        "perc-1",
        "perc",
        { tomLo: 0.6, tomHi: 0.5, rim: 0.45, cowbell: 0.35, shaker: 0.3, crash: 0.5 },
        {
          level: 0.7,
          send: 0.3,
          pan: -0.3,
          filter: highpass(400),
        },
      ),
      instance(
        "bass-1",
        "bass",
        {
          waveform: "sawtooth",
          filterType: "lowpass",
          cutoff: 260,
          resonance: 6,
          envMod: 0.55,
          attack: 0.003,
          decay: 0.2,
          sustain: 0.2,
          release: 0.08,
        },
        {
          level: 0.85,
          send: 0.05,
          key: key(9, "minor", 1),
          mod: mod({
            drive: 0.2,
            lfo1: lfo("cutoff", 0.125, 0.25, "triangle"),
            macros: [
              macro(0.2, [
                { key: "param:cutoff", min: 200, max: 2400 },
                { key: "param:resonance", min: 4, max: 12 },
              ]),
            ],
          }),
        },
      ),
      instance(
        "synth-1",
        "synth",
        {
          waveform: "square",
          filterType: "lowpass",
          cutoff: 1800,
          resonance: 3,
          attack: 0.005,
          decay: 0.18,
          sustain: 0.3,
          release: 0.2,
        },
        {
          level: 0.6,
          send: 0.45,
          pan: 0.2,
          key: key(9, "minor", 4),
          mod: mod({
            lfo1: lfo("pan", 0.25, 0.6, "sine"),
            random: { target: "cutoff", amount: 0.2 },
          }),
        },
      ),
      instance(
        "poly-1",
        "poly",
        {
          waveform: "sawtooth",
          filterType: "lowpass",
          cutoff: 900,
          resonance: 1,
          attack: 0.8,
          decay: 0.5,
          sustain: 0.9,
          release: 3,
        },
        {
          level: 0.4,
          send: 0.7,
          key: key(9, "minor", 3),
          mod: mod({
            lfo1: lfo("cutoff", 0.1, 0.5, "sine"),
            lfo2: lfo("pan", 0.07, 0.8, "triangle"),
          }),
        },
      ),
      instance(
        "ep-1",
        "ep",
        { tone: 1.5, bright: 4, decay: 1.2, release: 0.6 },
        {
          level: 0.55,
          send: 0.4,
          pan: -0.15,
          key: key(9, "minor", 3),
          filter: lowpass(20000, 0.1),
        },
      ),
    ],
    patterns,
    sections: [
      ["Intro", 8, [0, 0, 0, 0, 1, 1, 1, 1]],
      ["Verse", 16, [2, 3, 4, 5]],
      ["Build", 8, [6, 7, 8, 9]],
      ["Drop", 16, [10, 11, 12, 13]],
      ["Break", 8, [14]],
      ["Drop", 16, [10, 11, 12, 13]],
      ["Outro", 8, [15, 15, 15, 15, 1, 1, 0, 0]],
    ],
  })
}

// ======================================================================
// 2 · Camí de Sorra — downtempo, 88 BPM, Re dòric, swing
// ======================================================================
function camiDeSorra() {
  // Rows (D dorian, octave 3): D3 E3 F3 G3 A3 B3 C4 D4
  const CH = { d: [0, 2, 4, 6], g: [3, 5, 7], e: [1, 3, 5, 7], a: [1, 3, 4, 6] } // Dm7 G Em7 Am7
  const GTR = { d: [0, 4, 7], g: [3, 5, 7], e: [1, 5, 7], a: [1, 4, 6] }

  const kickA = drums({
    kick: "x......x..x.....",
    snare: "....x.......x...",
    hat: "x.x.x.x.x.x.x.x.",
  })
  const kickB = drums({
    kick: "x......x..x...x.",
    snare: "....x.......x..x",
    hat: "x.x.x.x.x.x.x.xx",
  })
  const kickSoft = drums({ kick: "x.........x.....", hat: "..x...x...x...x." })
  const percA = perc({ shaker: "x.x.x.x.x.x.x.x.", rim: "......x.......x." })
  const percB = perc({
    shaker: "x.xxx.x.x.xxx.x.",
    rim: "......x.......x.",
    tomLo: "..............x.",
    tomHi: "............x...",
  })
  const percIntro = perc({ shaker: "x...x...x...x..." })

  // Bass rows (D dorian, octave 1): D1 E1 F1 G1 A1 B1 C2 D2
  const bassD = bass("0.....0...7.....", "x.........x.....", "")
  const bassG = bass("3.....3...4.....", "x.........x.....", "...........x....")
  const bassE = bass("1.....1...3.....", "x.........x.....", "")
  const bassA = bass("4.....4...6.4...", "x.........x.....", "..........x.....")

  const epD = poly("ep", "d.......d.....d.", CH)
  const epG = poly("ep", "g.......g.....g.", CH)
  const epE = poly("ep", "e.......e.....e.", CH)
  const epA = poly("ep", "a.......a...a...", CH)
  const arp = (c) => {
    const [lo, mid, hi] = GTR[c]
    const t = { l: [lo], m: [mid], h: [hi], b: [lo, hi] }
    return poly("strings", "l.m.h.m.l.m.h.b.", t)
  }
  const pad = (c) => poly("poly", `${c}...............`, CH)

  const patterns = [
    /* 0 */ pattern({ "perc-1": percIntro, "ep-1": epD, "poly-1": pad("d") }),
    /* 1 */ pattern({ "perc-1": percIntro, "ep-1": epG, "poly-1": pad("g"), "drums-1": kickSoft }),
    /* 2 */ pattern({
      "drums-1": kickA,
      "perc-1": percA,
      "bass-1": bassD,
      "ep-1": epD,
      "strings-1": arp("d"),
    }),
    /* 3 */ pattern({
      "drums-1": kickA,
      "perc-1": percA,
      "bass-1": bassG,
      "ep-1": epG,
      "strings-1": arp("g"),
    }),
    /* 4 */ pattern({
      "drums-1": kickA,
      "perc-1": percA,
      "bass-1": bassE,
      "ep-1": epE,
      "strings-1": arp("e"),
    }),
    /* 5 */ pattern({
      "drums-1": kickB,
      "perc-1": percB,
      "bass-1": bassA,
      "ep-1": epA,
      "strings-1": arp("a"),
    }),
    /* 6 */ pattern({
      "drums-1": kickA,
      "perc-1": percA,
      "bass-1": bassD,
      "ep-1": epD,
      "strings-1": arp("d"),
      "poly-1": pad("d"),
    }),
    /* 7 */ pattern({
      "drums-1": kickA,
      "perc-1": percA,
      "bass-1": bassG,
      "ep-1": epG,
      "strings-1": arp("g"),
      "poly-1": pad("g"),
    }),
    /* 8 */ pattern({
      "drums-1": kickA,
      "perc-1": percA,
      "bass-1": bassE,
      "ep-1": epE,
      "strings-1": arp("e"),
      "poly-1": pad("e"),
    }),
    /* 9 */ pattern({
      "drums-1": kickB,
      "perc-1": percB,
      "bass-1": bassA,
      "ep-1": epA,
      "strings-1": arp("a"),
      "poly-1": pad("a"),
    }),
    // The bridge: the drums step out, the guitar and the pad carry it.
    /* 10 */ pattern(
      {
        "drums-1": kickA,
        "perc-1": percIntro,
        "bass-1": bassD,
        "strings-1": arp("d"),
        "poly-1": pad("d"),
      },
      ["drums-1"],
    ),
    /* 11 */ pattern(
      {
        "drums-1": kickA,
        "perc-1": percIntro,
        "bass-1": bassA,
        "strings-1": arp("a"),
        "poly-1": pad("a"),
      },
      ["drums-1"],
    ),
    /* 12 */ pattern({ "perc-1": percIntro, "ep-1": epD, "strings-1": arp("d") }),
  ]

  return song({
    bpm: 88,
    swing: 0.18,
    fx: { delayTime: "8n.", feedback: 0.45, reverbDecay: 4.5, pingPong: true, space: true },
    instances: [
      instance(
        "drums-1",
        "drums",
        { kick: 0.85, snare: 0.55, clap: 0.4, hat: 0.3 },
        {
          level: 0.85,
          send: 0.15,
          space: { angle: 0, distance: 0.4 },
          filter: lowpass(20000, 0.1),
          mod: mod({ random: { target: "level", amount: 0.25 } }),
        },
      ),
      instance(
        "perc-1",
        "perc",
        { tomLo: 0.6, tomHi: 0.5, rim: 0.4, cowbell: 0.3, shaker: 0.28, crash: 0.4 },
        {
          level: 0.65,
          send: 0.35,
          pan: 0.4,
          space: { angle: 60, distance: 0.6 },
          filter: highpass(300),
        },
      ),
      instance(
        "bass-1",
        "bass",
        {
          waveform: "square",
          filterType: "lowpass",
          cutoff: 180,
          resonance: 2,
          envMod: 0.25,
          attack: 0.01,
          decay: 0.5,
          sustain: 0.6,
          release: 0.3,
        },
        {
          level: 0.8,
          send: 0.05,
          key: key(2, "dorian", 1),
          space: { angle: 0, distance: 0.3 },
        },
      ),
      instance(
        "ep-1",
        "ep",
        { tone: 1, bright: 3, decay: 1.8, release: 1 },
        {
          level: 0.6,
          send: 0.45,
          pan: -0.3,
          key: key(2, "dorian", 3),
          space: { angle: -45, distance: 0.5 },
          filter: lowpass(20000, 0.1),
          mod: mod({ lfo1: lfo("pan", 0.1, 0.3, "sine") }),
        },
      ),
      instance(
        "strings-1",
        "strings",
        { damp: 2400, sustain: 0.985, release: 1.5 },
        {
          level: 0.6,
          send: 0.5,
          pan: 0.45,
          key: key(2, "dorian", 3),
          space: { angle: 70, distance: 0.55 },
          filter: lowpass(20000, 0.1),
          mod: mod({ random: { target: "level", amount: 0.2 } }),
        },
      ),
      instance(
        "poly-1",
        "poly",
        {
          waveform: "triangle",
          filterType: "lowpass",
          cutoff: 1400,
          resonance: 0.8,
          attack: 1.2,
          decay: 1,
          sustain: 0.8,
          release: 3.5,
        },
        {
          level: 0.35,
          send: 0.75,
          key: key(2, "dorian", 3),
          space: { angle: 180, distance: 0.9 },
          mod: mod({
            lfo1: lfo("cutoff", 0.06, 0.6, "sine"),
            lfo2: lfo("pan", 0.04, 1, "triangle"),
          }),
        },
      ),
    ],
    patterns,
    sections: [
      ["Intro", 4, [0, 1]],
      ["Verse", 16, [2, 3, 4, 5]],
      ["Chorus", 8, [6, 7, 8, 9]],
      ["Bridge", 8, [10, 10, 11, 11]],
      ["Verse", 8, [2, 3, 4, 5]],
      ["Chorus", 16, [6, 7, 8, 9]],
      ["Outro", 4, [12, 12, 0, 0]],
    ],
  })
}

// ======================================================================
// 3 · Torre de Ferro — acid techno, 130 BPM, Fa menor, two BASS-2s
// ======================================================================
function torreDeFerro() {
  const four = "x...x...x...x..."
  const drumsIntro = drums({ kick: four })
  const drumsMain = drums({ kick: four, clap: "....x.......x...", hat: "..x...x...x...x." })
  const drumsHard = drums({
    kick: four,
    clap: "....x.......x...",
    hat: "..x...x...x...x.",
    snare: "..............x.",
  })
  const drumsFill = drums({
    kick: "x...x...x...x.xx",
    clap: "....x.......xxxx",
    hat: "..x...x...x...x.",
  })
  const ride = drums({ hat: "x.x.x.x.x.x.x.x." })
  const rideBusy = drums({ hat: "xxxxxxxxxxxxxxxx" })
  const percMain = perc({ rim: "...x......x.....", shaker: ".x.x.x.x.x.x.x.x" })
  const percFill = perc({
    tomLo: "........x.x.x.x.",
    tomHi: "............xxxx",
    rim: "...x......x.....",
  })
  const crash = perc({ crash: "x...............", shaker: ".x.x.x.x.x.x.x.x" })

  // Bass rows (F minor, octave 1 / 2): F G Ab Bb C Db Eb F
  const acidA = bass("0.0.0.7.0.0.5.0.", "x...x...x...x...", "......x.....x...")
  const acidB = bass("0.0.3.0.2.0.7.5.", "x.....x...x.....", "....x......xx...")
  const acidC = bass("0.7.0.7.0.5.0.3.", "x.x.x.x.x.x.x.x.", "...x....x.....x.")
  const reply = bass("....7.5.....7.4.", "....x.......x...", ".....x.......x..")
  const replyB = bass("..7...5...3...2.", "..x...x...x...x.", "...x...x...x....")
  const drone = bass("0...............", "x...............", "xxxxxxxxxxxxxxxx")

  // Stab rows (F minor, octave 3): F3 G3 Ab3 Bb3 C4 Db4 Eb4 F4 — a minor triad hit off the beat.
  const stab = synth("..0.....0...4...")
  const stabB = synth("..0...2.0...4.7.")

  const patterns = [
    /* 0 */ pattern({ "drums-1": drumsIntro, "bass-1": drone }),
    /* 1 */ pattern({ "drums-1": drumsIntro, "bass-1": acidA, "perc-1": percMain }),
    /* 2 */ pattern({ "drums-1": drumsMain, "bass-1": acidA, "perc-1": percMain, "drums-2": ride }),
    /* 3 */ pattern({ "drums-1": drumsMain, "bass-1": acidB, "perc-1": percMain, "drums-2": ride }),
    /* 4 */ pattern({
      "drums-1": drumsFill,
      "bass-1": acidC,
      "perc-1": percFill,
      "drums-2": rideBusy,
    }),
    /* 5 */ pattern({
      "drums-1": drumsHard,
      "bass-1": acidA,
      "bass-2": reply,
      "perc-1": crash,
      "drums-2": ride,
      "synth-1": stab,
    }),
    /* 6 */ pattern({
      "drums-1": drumsHard,
      "bass-1": acidB,
      "bass-2": reply,
      "perc-1": percMain,
      "drums-2": ride,
      "synth-1": stab,
    }),
    /* 7 */ pattern({
      "drums-1": drumsHard,
      "bass-1": acidA,
      "bass-2": replyB,
      "perc-1": percMain,
      "drums-2": ride,
      "synth-1": stabB,
    }),
    /* 8 */ pattern({
      "drums-1": drumsFill,
      "bass-1": acidC,
      "bass-2": replyB,
      "perc-1": percFill,
      "drums-2": rideBusy,
      "synth-1": stabB,
    }),
    // Break: kick out, the two acid lines talk over the ride.
    /* 9 */ pattern(
      {
        "drums-1": drumsMain,
        "bass-1": acidB,
        "bass-2": reply,
        "perc-1": crash,
        "drums-2": rideBusy,
        "synth-1": stab,
      },
      ["drums-1"],
    ),
    /* 10 */ pattern(
      {
        "drums-1": drumsMain,
        "bass-1": acidC,
        "bass-2": replyB,
        "perc-1": percMain,
        "drums-2": rideBusy,
        "synth-1": stabB,
      },
      ["drums-1", "synth-1"],
    ),
    /* 11 */ pattern({ "drums-1": drumsMain, "bass-1": acidA, "perc-1": percMain }),
  ]

  return song({
    bpm: 130,
    swing: 0.03,
    fx: { delayTime: "16n", feedback: 0.5, reverbDecay: 1.6, pingPong: true },
    instances: [
      instance(
        "drums-1",
        "drums",
        { kick: 1, snare: 0.5, clap: 0.75, hat: 0.35 },
        {
          level: 0.95,
          send: 0.06,
          filter: lowpass(20000, 0.1),
          mod: mod({ drive: 0.3 }),
        },
      ),
      instance(
        "drums-2",
        "drums",
        { kick: 0.8, snare: 0.3, clap: 0.4, hat: 0.3 },
        {
          level: 0.6,
          send: 0.3,
          pan: -0.4,
          filter: highpass(1500, 1.2),
          mod: mod({ random: { target: "pan", amount: 0.5 } }),
        },
      ),
      instance(
        "perc-1",
        "perc",
        { tomLo: 0.8, tomHi: 0.7, rim: 0.5, cowbell: 0.3, shaker: 0.25, crash: 0.6 },
        {
          level: 0.7,
          send: 0.35,
          pan: 0.3,
          filter: highpass(250),
        },
      ),
      instance(
        "bass-1",
        "bass",
        {
          waveform: "sawtooth",
          filterType: "lowpass",
          cutoff: 380,
          resonance: 12,
          envMod: 0.75,
          attack: 0.003,
          decay: 0.18,
          sustain: 0.15,
          release: 0.06,
        },
        {
          level: 0.85,
          send: 0.12,
          pan: -0.15,
          key: key(5, "minor", 1),
          mod: mod({
            drive: 0.35,
            lfo1: lfo("cutoff", 0.0625, 0.45, "triangle"),
            random: { target: "cutoff", amount: 0.25 },
            macros: [
              macro(0.35, [
                { key: "param:cutoff", min: 150, max: 3500 },
                { key: "param:resonance", min: 6, max: 18 },
              ]),
              macro(0.2, [
                { key: "param:envMod", min: 0.3, max: 1 },
                { key: "param:decay", min: 0.1, max: 0.5 },
              ]),
            ],
          }),
        },
      ),
      instance(
        "bass-2",
        "bass",
        {
          waveform: "square",
          filterType: "bandpass",
          cutoff: 900,
          resonance: 8,
          envMod: 0.5,
          attack: 0.003,
          decay: 0.25,
          sustain: 0.1,
          release: 0.1,
        },
        {
          level: 0.6,
          send: 0.4,
          pan: 0.45,
          key: key(5, "minor", 2),
          mod: mod({
            drive: 0.5,
            lfo1: lfo("pan", 0.5, 0.7, "square"),
            random: { target: "cutoff", amount: 0.4 },
          }),
        },
      ),
      instance(
        "synth-1",
        "synth",
        {
          waveform: "sawtooth",
          filterType: "bandpass",
          cutoff: 2200,
          resonance: 4,
          attack: 0.002,
          decay: 0.12,
          sustain: 0.1,
          release: 0.1,
        },
        {
          level: 0.5,
          send: 0.55,
          key: key(5, "minor", 3),
          mod: mod({
            lfo1: lfo("pan", 1, 0.9, "sawtooth"),
            random: { target: "pitch", amount: 0.06 },
          }),
        },
      ),
    ],
    patterns,
    sections: [
      ["Intro", 8, [0, 0, 0, 0, 1, 1, 1, 1]],
      ["Groove", 16, [2, 2, 3, 4]],
      ["Acid", 16, [5, 6, 7, 8]],
      ["Break", 8, [9, 9, 10, 10]],
      ["Acid", 16, [5, 6, 7, 8]],
      ["Outro", 8, [11, 11, 11, 11, 1, 1, 0, 0]],
    ],
  })
}

// ======================================================================
// 4 · Marea — broken beat, 95 BPM, Mi mixolidi, two guitars
// ======================================================================
function marea() {
  // Rows (E mixolydian, octave 3): E3 F#3 G#3 A3 B3 C#4 D4 E4
  const CH = { e: [0, 2, 4, 7], a: [3, 5, 7], d: [1, 3, 6], b: [1, 4, 6] } // E, A, D (F# A D), Bm
  const LO = { e: [0, 4], a: [3, 7], d: [1, 6], b: [1, 4] }

  const beatA = drums({
    kick: "x..x..x...x.....",
    snare: "....x.......x...",
    hat: "x.xx.x.xx.x.x.x.",
  })
  const beatB = drums({
    kick: "x..x..x...x..x..",
    snare: "....x.......x..x",
    hat: "x.xx.x.xx.x.x.xx",
  })
  const beatIntro = drums({ hat: "x.xx.x.xx.x.x.x." })
  const percA = perc({
    shaker: "x.x.x.x.x.x.x.x.",
    cowbell: "......x.........",
    rim: "..x.......x.....",
  })
  const percB = perc({
    shaker: "xxx.xxx.xxx.xxx.",
    cowbell: "......x.......x.",
    rim: "..x.......x..x..",
  })
  const crash = perc({ crash: "x...............", shaker: "x.x.x.x.x.x.x.x." })

  // Bass rows (E mixolydian, octave 1): E1 F#1 G#1 A1 B1 C#2 D2 E2
  const bassE = bass("0..0..0...7..0..", "x..x..x.........", "........x.......")
  const bassA = bass("3..3..3...4..3..", "x..x..x.........", ".........x......")
  const bassD = bass("6..6..6...4..2..", "x..x..x.........", "")
  const bassB = bass("4..4..4...6..7..", "x..x..x.........", "............x...")

  // Two guitars: one strums, the other picks an octave up.
  const strum = (c) => poly("strings", `${c}...${c}.${c}...${c}...${c}.`, CH)
  const pick = (c) => {
    const [lo, hi] = LO[c]
    const [, mid] = CH[c]
    return poly("strings", "l.h.m.h.l.h.m.h.", { l: [lo], h: [hi], m: [mid] })
  }
  const ep = (c) => poly("ep", `${c}.......${c}.......`, CH)
  const pad = (c) => poly("poly", `${c}...............`, CH)

  const patterns = [
    /* 0 */ pattern({ "drums-1": beatIntro, "strings-2": pick("e"), "poly-1": pad("e") }),
    /* 1 */ pattern({
      "drums-1": beatIntro,
      "strings-2": pick("a"),
      "poly-1": pad("a"),
      "perc-1": crash,
    }),
    /* 2 */ pattern({
      "drums-1": beatA,
      "perc-1": percA,
      "bass-1": bassE,
      "strings-1": strum("e"),
      "strings-2": pick("e"),
    }),
    /* 3 */ pattern({
      "drums-1": beatA,
      "perc-1": percA,
      "bass-1": bassA,
      "strings-1": strum("a"),
      "strings-2": pick("a"),
    }),
    /* 4 */ pattern({
      "drums-1": beatA,
      "perc-1": percA,
      "bass-1": bassD,
      "strings-1": strum("d"),
      "strings-2": pick("d"),
    }),
    /* 5 */ pattern({
      "drums-1": beatB,
      "perc-1": percB,
      "bass-1": bassB,
      "strings-1": strum("b"),
      "strings-2": pick("b"),
    }),
    /* 6 */ pattern({
      "drums-1": beatA,
      "perc-1": percA,
      "bass-1": bassE,
      "strings-1": strum("e"),
      "strings-2": pick("e"),
      "ep-1": ep("e"),
      "poly-1": pad("e"),
    }),
    /* 7 */ pattern({
      "drums-1": beatA,
      "perc-1": percA,
      "bass-1": bassA,
      "strings-1": strum("a"),
      "strings-2": pick("a"),
      "ep-1": ep("a"),
      "poly-1": pad("a"),
    }),
    /* 8 */ pattern({
      "drums-1": beatA,
      "perc-1": percA,
      "bass-1": bassD,
      "strings-1": strum("d"),
      "strings-2": pick("d"),
      "ep-1": ep("d"),
      "poly-1": pad("d"),
    }),
    /* 9 */ pattern({
      "drums-1": beatB,
      "perc-1": percB,
      "bass-1": bassB,
      "strings-1": strum("b"),
      "strings-2": pick("b"),
      "ep-1": ep("b"),
      "poly-1": pad("b"),
    }),
    // Bridge: the beat and bass sit out, the piano and the pad breathe.
    /* 10 */ pattern(
      {
        "drums-1": beatA,
        "perc-1": percA,
        "bass-1": bassE,
        "strings-2": pick("e"),
        "ep-1": ep("e"),
        "poly-1": pad("e"),
      },
      ["drums-1", "bass-1"],
    ),
    /* 11 */ pattern(
      {
        "drums-1": beatA,
        "perc-1": percA,
        "bass-1": bassD,
        "strings-2": pick("d"),
        "ep-1": ep("d"),
        "poly-1": pad("d"),
      },
      ["drums-1", "bass-1"],
    ),
    /* 12 */ pattern({ "strings-2": pick("e"), "poly-1": pad("e"), "ep-1": ep("e") }),
  ]

  return song({
    bpm: 95,
    swing: 0.12,
    fx: { delayTime: "8n", feedback: 0.35, reverbDecay: 5, pingPong: true, space: true },
    instances: [
      instance(
        "drums-1",
        "drums",
        { kick: 0.9, snare: 0.65, clap: 0.4, hat: 0.35 },
        {
          level: 0.85,
          send: 0.12,
          space: { angle: 0, distance: 0.4 },
          filter: lowpass(20000, 0.1),
          mod: mod({ random: { target: "level", amount: 0.2 } }),
        },
      ),
      instance(
        "perc-1",
        "perc",
        { tomLo: 0.6, tomHi: 0.5, rim: 0.45, cowbell: 0.3, shaker: 0.3, crash: 0.45 },
        {
          level: 0.65,
          send: 0.3,
          pan: -0.35,
          space: { angle: -50, distance: 0.6 },
          filter: highpass(350),
        },
      ),
      instance(
        "bass-1",
        "bass",
        {
          waveform: "sawtooth",
          filterType: "lowpass",
          cutoff: 240,
          resonance: 3,
          envMod: 0.3,
          attack: 0.005,
          decay: 0.35,
          sustain: 0.5,
          release: 0.2,
        },
        {
          level: 0.8,
          send: 0.05,
          key: key(4, "mixolydian", 1),
          space: { angle: 0, distance: 0.3 },
        },
      ),
      instance(
        "strings-1",
        "strings",
        { damp: 2800, sustain: 0.975, release: 1.2 },
        {
          level: 0.55,
          send: 0.4,
          pan: -0.5,
          key: key(4, "mixolydian", 2),
          space: { angle: -70, distance: 0.5 },
          filter: lowpass(20000, 0.1),
          mod: mod({ random: { target: "level", amount: 0.25 } }),
        },
      ),
      instance(
        "strings-2",
        "strings",
        { damp: 4200, sustain: 0.99, release: 1.8 },
        {
          level: 0.45,
          send: 0.55,
          pan: 0.55,
          key: key(4, "mixolydian", 3),
          space: { angle: 70, distance: 0.55 },
          filter: highpass(500),
          // The picked guitar sits an octave up and shimmers with a slow pan.
          mod: mod({
            tune: 12,
            lfo1: lfo("pan", 0.08, 0.5, "sine"),
            random: { target: "level", amount: 0.2 },
          }),
        },
      ),
      instance(
        "ep-1",
        "ep",
        { tone: 2.5, bright: 5, decay: 2, release: 1.2 },
        {
          level: 0.5,
          send: 0.45,
          pan: 0.15,
          key: key(4, "mixolydian", 3),
          space: { angle: 30, distance: 0.5 },
          filter: lowpass(20000, 0.1),
        },
      ),
      instance(
        "poly-1",
        "poly",
        {
          waveform: "triangle",
          filterType: "lowpass",
          cutoff: 1100,
          resonance: 0.6,
          attack: 1.5,
          decay: 1,
          sustain: 0.85,
          release: 4,
        },
        {
          level: 0.3,
          send: 0.8,
          key: key(4, "mixolydian", 3),
          space: { angle: 180, distance: 0.95 },
          mod: mod({ lfo1: lfo("cutoff", 0.05, 0.7, "sine"), lfo2: lfo("pan", 0.03, 1, "sine") }),
        },
      ),
    ],
    patterns,
    sections: [
      ["Intro", 8, [0, 0, 1, 1]],
      ["Verse", 16, [2, 3, 4, 5]],
      ["Chorus", 16, [6, 7, 8, 9]],
      ["Bridge", 8, [10, 10, 11, 11]],
      ["Verse", 8, [2, 3, 4, 5]],
      ["Chorus", 16, [6, 7, 8, 9]],
      ["Outro", 8, [12, 12, 12, 12, 0, 0, 0, 0]],
    ],
  })
}

// ======================================================================
// 5 · Ferralla — heavy, 130 BPM, Mi menor, two driven guitars
// ======================================================================
function ferralla() {
  // Rows (E minor, octave 2): E2 F#2 G2 A2 B2 C3 D3 E3 — power chords are root + fifth (+ octave).
  const PC = { e: [0, 4, 7], g: [2, 6], a: [3, 7], c: [5, 2], d: [6, 3], b: [4, 1] }
  const chug = (c) => poly("strings", `${c}.${c}.${c}.${c}.${c}.${c}${c}.${c}.${c}`, PC)
  const gallop = (c) => poly("strings", `${c}..${c}${c}..${c}${c}..${c}${c}..${c}${c}.`, PC)
  const stab = (c) => poly("strings", `${c}...............`, PC)
  const riffA = poly("strings", "e.e.e.e.g.g.a.a.", PC)
  const riffB = poly("strings", "e.e.e.e.c.c.d.d.", PC)
  const riffC = poly("strings", "e.e.e.e.g.g.b.a.", PC)

  const drumsIntro = drums({ kick: "x...x...x...x...", hat: "x.x.x.x.x.x.x.x." })
  const drumsRiff = drums({
    kick: "x.x.....x.x.....",
    snare: "....x.......x...",
    hat: "x.x.x.x.x.x.x.x.",
  })
  const drumsDouble = drums({
    kick: "x.xxx.xxx.xxx.xx",
    snare: "....x.......x...",
    hat: "x...x...x...x...",
  })
  const drumsFill = drums({
    kick: "x.x.....x.x.x.x.",
    snare: "....x.......xxxx",
    hat: "x.x.x.x.x.x.....",
    clap: "..............xx",
  })
  const drumsBreak = drums({ kick: "x.......x.......", hat: "..x...x...x...x." })
  const crash = perc({ crash: "x..............." })
  const toms = perc({
    tomHi: "........x.x.....",
    tomLo: "..........x.x.xx",
    crash: "x...............",
  })

  // Bass rows (E minor, octave 1): E1 F#1 G1 A1 B1 C2 D2 E2
  const bassE = bass("0.0.0.0.0.0.0.0.", "x.......x.......", "")
  const bassRiffA = bass("0.0.0.0.2.2.3.3.", "x...x...x...x...", "")
  const bassRiffB = bass("0.0.0.0.5.5.6.6.", "x...x...x...x...", "")
  const bassRiffC = bass("0.0.0.0.2.2.4.3.", "x...x...x...x...", "......x.......x.")
  const bassGallop = bass("0..00..00..00..0", "x..x...x...x....", "")

  // Lead rows (E minor, octave 4): E4 F#4 G4 A4 B4 C5 D5 E5
  const leadA = synth("7.5.4.2.4.5.7...")
  const leadB = synth("2.4.5.7.5.4.2.0.")
  const leadC = synth("7...5...4.2.0...")
  const leadD = synth("0.2.4.5.7.5.4.2.")

  const patterns = [
    /* 0 */ pattern({ "drums-1": drumsIntro, "strings-1": stab("e"), "bass-1": bassE }),
    /* 1 */ pattern({
      "drums-1": drumsRiff,
      "strings-1": riffA,
      "strings-2": riffA,
      "bass-1": bassRiffA,
      "perc-1": crash,
    }),
    /* 2 */ pattern({
      "drums-1": drumsRiff,
      "strings-1": riffB,
      "strings-2": riffB,
      "bass-1": bassRiffB,
    }),
    /* 3 */ pattern({
      "drums-1": drumsRiff,
      "strings-1": riffA,
      "strings-2": riffA,
      "bass-1": bassRiffA,
    }),
    /* 4 */ pattern({
      "drums-1": drumsFill,
      "strings-1": riffC,
      "strings-2": riffC,
      "bass-1": bassRiffC,
      "perc-1": toms,
    }),
    /* 5 */ pattern({
      "drums-1": drumsRiff,
      "strings-1": chug("e"),
      "strings-2": stab("e"),
      "bass-1": bassE,
    }),
    /* 6 */ pattern({
      "drums-1": drumsRiff,
      "strings-1": chug("e"),
      "strings-2": stab("g"),
      "bass-1": bassE,
    }),
    /* 7 */ pattern({
      "drums-1": drumsRiff,
      "strings-1": chug("c"),
      "strings-2": stab("c"),
      "bass-1": bassRiffB,
    }),
    /* 8 */ pattern({
      "drums-1": drumsFill,
      "strings-1": chug("d"),
      "strings-2": stab("d"),
      "bass-1": bassRiffC,
      "perc-1": toms,
    }),
    /* 9 */ pattern({
      "drums-1": drumsDouble,
      "strings-1": gallop("e"),
      "strings-2": gallop("e"),
      "bass-1": bassGallop,
      "synth-1": leadA,
      "perc-1": crash,
    }),
    /* 10 */ pattern({
      "drums-1": drumsDouble,
      "strings-1": gallop("c"),
      "strings-2": gallop("c"),
      "bass-1": bassGallop,
      "synth-1": leadB,
    }),
    /* 11 */ pattern({
      "drums-1": drumsDouble,
      "strings-1": gallop("g"),
      "strings-2": gallop("g"),
      "bass-1": bassGallop,
      "synth-1": leadC,
    }),
    /* 12 */ pattern({
      "drums-1": drumsFill,
      "strings-1": gallop("d"),
      "strings-2": gallop("a"),
      "bass-1": bassGallop,
      "synth-1": leadD,
      "perc-1": toms,
    }),
    // Breakdown: one guitar and the kick, everyone else sits it out.
    /* 13 */ pattern(
      {
        "drums-1": drumsBreak,
        "strings-1": riffA,
        "strings-2": riffA,
        "bass-1": bassRiffA,
        "synth-1": leadA,
      },
      ["strings-2", "bass-1", "synth-1"],
    ),
    /* 14 */ pattern(
      {
        "drums-1": drumsBreak,
        "strings-1": riffB,
        "strings-2": riffB,
        "bass-1": bassRiffB,
        "synth-1": leadB,
      },
      ["strings-2", "synth-1"],
    ),
    /* 15 */ pattern({
      "drums-1": drumsRiff,
      "strings-1": stab("e"),
      "strings-2": stab("e"),
      "bass-1": bassE,
      "perc-1": crash,
    }),
  ]

  const guitar = (id, pan, drive) =>
    instance(
      id,
      "strings",
      { damp: 5200, sustain: 0.992, release: 0.6, strum: 4 },
      {
        level: 0.7,
        send: 0.08,
        pan,
        key: key(4, "minor", 2),
        filter: highpass(120, 0.8),
        mod: mod({ drive, random: { target: "level", amount: 0.12 } }),
      },
    )

  return song({
    bpm: 130,
    swing: 0,
    fx: { delayTime: "8n", feedback: 0.2, reverbDecay: 1.4 },
    // Two guitars either side, the drums and the bass dead ahead, the lead a little to the right.
    places: {
      "drums-1": [0, 0.35],
      "perc-1": [25, 0.5],
      "strings-1": [-60, 0.45],
      "strings-2": [60, 0.45],
      "bass-1": [0, 0.25],
      "synth-1": [15, 0.6],
    },
    instances: [
      instance(
        "drums-1",
        "drums",
        { kick: 1, snare: 0.85, clap: 0.5, hat: 0.45 },
        {
          level: 0.95,
          send: 0.1,
          filter: lowpass(20000, 0.1),
          mod: mod({ drive: 0.35 }),
        },
      ),
      instance(
        "perc-1",
        "perc",
        { tomLo: 0.9, tomHi: 0.8, rim: 0.5, cowbell: 0.3, shaker: 0.2, crash: 0.8 },
        {
          level: 0.8,
          send: 0.25,
          pan: 0.2,
          filter: lowpass(20000, 0.1),
        },
      ),
      guitar("strings-1", -0.55, 0.75),
      guitar("strings-2", 0.55, 0.65),
      instance(
        "bass-1",
        "bass",
        {
          waveform: "sawtooth",
          filterType: "lowpass",
          cutoff: 420,
          resonance: 2,
          envMod: 0.3,
          attack: 0.003,
          decay: 0.3,
          sustain: 0.7,
          release: 0.1,
        },
        {
          level: 0.85,
          send: 0.02,
          key: key(4, "minor", 1),
          mod: mod({ drive: 0.45 }),
        },
      ),
      instance(
        "synth-1",
        "synth",
        {
          waveform: "square",
          filterType: "lowpass",
          cutoff: 2600,
          resonance: 3,
          attack: 0.005,
          decay: 0.2,
          sustain: 0.6,
          release: 0.25,
        },
        {
          level: 0.55,
          send: 0.4,
          pan: 0.1,
          key: key(4, "minor", 4),
          mod: mod({ drive: 0.4, lfo1: lfo("pitch", 5.5, 0.03, "sine") }),
        },
      ),
    ],
    patterns,
    sections: [
      ["Intro", 4, [0]],
      ["Riff", 8, [1, 2, 3, 4]],
      ["Verse", 16, [5, 6, 7, 8]],
      ["Chorus", 8, [9, 10, 11, 12]],
      ["Breakdown", 8, [13, 13, 14, 14]],
      ["Riff", 8, [1, 2, 3, 4]],
      ["Chorus", 16, [9, 10, 11, 12]],
      ["Outro", 4, [15, 15, 15, 0]],
    ],
  })
}

// ======================================================================
// 6 · Carrer Mullat — hip hop, 85 BPM, Re menor, boom bap with swing
// ======================================================================
function carrerMullat() {
  // Rows (D minor, octave 3): D3 E3 F3 G3 A3 Bb3 C4 D4
  const CH = { d: [0, 2, 4, 6], g: [3, 5, 7, 2], b: [5, 0, 2, 4], a: [4, 6, 1, 3] } // Dm7 Gm7 Bbmaj7 Am7
  const ep = (c) => poly("ep", `${c}.......${c}...${c}...`, CH)
  const epLazy = (c) => poly("ep", `${c}...........${c}...`, CH)
  const pad = (c) => poly("poly", `${c}...............`, CH)

  const boom = drums({
    kick: "x......x..x.....",
    snare: "....x.......x...",
    hat: "x.x.x.x.x.x.x.x.",
  })
  const boomB = drums({
    kick: "x......x..x..x..",
    snare: "....x.......x..x",
    hat: "x.x.x.x.x.x.x.xx",
  })
  const boomIntro = drums({ hat: "x.x.x.x.x.x.x.x.", snare: "............x..." })
  const hatsOpen = drums({ hat: "..x...x...x...x.", clap: "....x.......x..." })
  const percA = perc({ shaker: "x.x.x.x.x.x.x.x.", rim: "......x.......x." })
  const percB = perc({
    shaker: "x.x.x.x.x.x.x.x.",
    rim: "......x.......x.",
    cowbell: "..........x.....",
  })

  // Bass rows (D minor, octave 1): D1 E1 F1 G1 A1 Bb1 C2 D2
  const bassD = bass("0......0..0.....", "x.........x.....", "")
  const bassG = bass("3......3..3..2..", "x.........x.....", ".............x..")
  const bassB = bass("5......5..5.....", "x.........x.....", "")
  const bassA = bass("4......4..4..6..", "x.........x.....", "")

  // Lead rows (D minor, octave 4): a few notes of a hook on MONO-1.
  const hookA = synth("....7.5.4.......")
  const hookB = synth("....4.2.0.......")

  const patterns = [
    /* 0 */ pattern({ "drums-1": boomIntro, "ep-1": epLazy("d"), "poly-1": pad("d") }),
    /* 1 */ pattern({
      "drums-1": boomIntro,
      "ep-1": epLazy("g"),
      "poly-1": pad("g"),
      "perc-1": percA,
    }),
    /* 2 */ pattern({
      "drums-1": boom,
      "drums-2": hatsOpen,
      "perc-1": percA,
      "bass-1": bassD,
      "ep-1": ep("d"),
    }),
    /* 3 */ pattern({
      "drums-1": boom,
      "drums-2": hatsOpen,
      "perc-1": percA,
      "bass-1": bassG,
      "ep-1": ep("g"),
    }),
    /* 4 */ pattern({
      "drums-1": boom,
      "drums-2": hatsOpen,
      "perc-1": percA,
      "bass-1": bassB,
      "ep-1": ep("b"),
    }),
    /* 5 */ pattern({
      "drums-1": boomB,
      "drums-2": hatsOpen,
      "perc-1": percB,
      "bass-1": bassA,
      "ep-1": ep("a"),
    }),
    /* 6 */ pattern({
      "drums-1": boom,
      "drums-2": hatsOpen,
      "perc-1": percA,
      "bass-1": bassD,
      "ep-1": ep("d"),
      "poly-1": pad("d"),
      "synth-1": hookA,
    }),
    /* 7 */ pattern({
      "drums-1": boom,
      "drums-2": hatsOpen,
      "perc-1": percA,
      "bass-1": bassG,
      "ep-1": ep("g"),
      "poly-1": pad("g"),
      "synth-1": hookB,
    }),
    /* 8 */ pattern({
      "drums-1": boom,
      "drums-2": hatsOpen,
      "perc-1": percA,
      "bass-1": bassB,
      "ep-1": ep("b"),
      "poly-1": pad("b"),
      "synth-1": hookA,
    }),
    /* 9 */ pattern({
      "drums-1": boomB,
      "drums-2": hatsOpen,
      "perc-1": percB,
      "bass-1": bassA,
      "ep-1": ep("a"),
      "poly-1": pad("a"),
      "synth-1": hookB,
    }),
    // Beat drop: the drums sit out one round, the piano and the bass carry it.
    /* 10 */ pattern(
      {
        "drums-1": boom,
        "drums-2": hatsOpen,
        "perc-1": percA,
        "bass-1": bassD,
        "ep-1": epLazy("d"),
        "poly-1": pad("d"),
      },
      ["drums-1", "drums-2"],
    ),
    /* 11 */ pattern(
      {
        "drums-1": boom,
        "drums-2": hatsOpen,
        "perc-1": percA,
        "bass-1": bassA,
        "ep-1": epLazy("a"),
        "poly-1": pad("a"),
      },
      ["drums-1", "drums-2"],
    ),
    /* 12 */ pattern({ "ep-1": epLazy("d"), "poly-1": pad("d"), "perc-1": percA }),
  ]

  return song({
    bpm: 85,
    swing: 0.28,
    fx: { delayTime: "8n.", feedback: 0.3, reverbDecay: 2.2, pingPong: true },
    // Piano left, hats right, shaker further left, the pad behind the listener.
    places: {
      "drums-1": [0, 0.35],
      "drums-2": [40, 0.55],
      "perc-1": [-55, 0.6],
      "bass-1": [0, 0.25],
      "ep-1": [-30, 0.5],
      "poly-1": [180, 0.9],
      "synth-1": [60, 0.7],
    },
    instances: [
      instance(
        "drums-1",
        "drums",
        { kick: 1, snare: 0.8, clap: 0.5, hat: 0.3 },
        {
          level: 0.95,
          send: 0.08,
          filter: lowpass(20000, 0.1),
          mod: mod({ drive: 0.3, random: { target: "level", amount: 0.15 } }),
        },
      ),
      instance(
        "drums-2",
        "drums",
        { kick: 0.5, snare: 0.4, clap: 0.6, hat: 0.35 },
        {
          level: 0.6,
          send: 0.3,
          pan: 0.3,
          filter: highpass(700, 0.9),
          mod: mod({ random: { target: "level", amount: 0.3 } }),
        },
      ),
      instance(
        "perc-1",
        "perc",
        { tomLo: 0.5, tomHi: 0.4, rim: 0.45, cowbell: 0.25, shaker: 0.28, crash: 0.3 },
        {
          level: 0.6,
          send: 0.3,
          pan: -0.35,
          filter: highpass(350),
        },
      ),
      instance(
        "bass-1",
        "bass",
        {
          waveform: "square",
          filterType: "lowpass",
          cutoff: 140,
          resonance: 1,
          envMod: 0.15,
          attack: 0.008,
          decay: 0.5,
          sustain: 0.7,
          release: 0.25,
        },
        {
          level: 0.9,
          send: 0,
          key: key(2, "minor", 1),
        },
      ),
      instance(
        "ep-1",
        "ep",
        { tone: 1.2, bright: 3, decay: 1.6, release: 0.9 },
        {
          level: 0.6,
          send: 0.35,
          pan: -0.15,
          key: key(2, "minor", 3),
          filter: lowpass(6000, 0.5),
          mod: mod({ random: { target: "level", amount: 0.1 } }),
        },
      ),
      instance(
        "poly-1",
        "poly",
        {
          waveform: "triangle",
          filterType: "lowpass",
          cutoff: 900,
          resonance: 0.6,
          attack: 1,
          decay: 1,
          sustain: 0.8,
          release: 3,
        },
        {
          level: 0.3,
          send: 0.7,
          key: key(2, "minor", 3),
          mod: mod({
            lfo1: lfo("cutoff", 0.08, 0.5, "sine"),
            lfo2: lfo("pan", 0.05, 0.7, "triangle"),
          }),
        },
      ),
      instance(
        "synth-1",
        "synth",
        {
          waveform: "triangle",
          filterType: "lowpass",
          cutoff: 1500,
          resonance: 1.5,
          attack: 0.01,
          decay: 0.3,
          sustain: 0.4,
          release: 0.4,
        },
        {
          level: 0.45,
          send: 0.5,
          pan: 0.25,
          key: key(2, "minor", 4),
          mod: mod({ lfo1: lfo("pan", 0.3, 0.5, "sine") }),
        },
      ),
    ],
    patterns,
    sections: [
      ["Intro", 4, [0, 1]],
      ["Verse", 16, [2, 3, 4, 5]],
      ["Hook", 8, [6, 7, 8, 9]],
      ["Verse", 16, [2, 3, 4, 5]],
      ["Drop", 4, [10, 10, 11, 11]],
      ["Hook", 8, [6, 7, 8, 9]],
      ["Outro", 4, [12, 12, 0, 0]],
    ],
  })
}

// ======================================================================
// 7 · Cavalls de Ferro — speed rock, 140 BPM, Mi blues: the bass is a rhythm guitar
// ======================================================================
function cavallsDeFerro() {
  // Rows (E blues, octave 2): E2 G2 A2 Bb2 B2 D3 E3 G3 — riffs on the blues scale, power chords on E/A/D.
  const PC = { e: [0, 4, 7], a: [2, 6], d: [5, 2], g: [1, 5] }
  const riffA = poly("strings", "e.e.e.e.e.e.a.a.", PC)
  const riffB = poly("strings", "e.e.e.e.d.d.a.a.", PC)
  const riffC = poly("strings", "e.e.e.e.g.g.a.a.", PC)
  const riffD = poly("strings", "e.e.e.e.e.e.e.e.", PC)
  const chorus = (c) => poly("strings", `${c}.${c}.${c}.${c}.${c}.${c}.${c}.${c}.`, PC)
  const stop = poly("strings", "e...............", PC)

  const drumsGo = drums({
    kick: "x.x.x.x.x.x.x.x.",
    snare: "....x.......x...",
    hat: "x.x.x.x.x.x.x.x.",
  })
  const drumsRoll = drums({
    kick: "x.x.x.x.x.x.x.x.",
    snare: "....x.......xxxx",
    hat: "x.x.x.x.x.x.x.x.",
  })
  const drumsOverkill = drums({
    kick: "xxxxxxxxxxxxxxxx",
    snare: "....x.......x...",
    hat: "x...x...x...x...",
  })
  const drumsIntro = drums({ snare: "x.x.x.x.xxxxxxxx", hat: "x.x.x.x.x.x.x.x." })
  const drumsStop = drums({ kick: "x...............", snare: "x..............." })
  const crash = perc({ crash: "x..............." })
  const crashes = perc({ crash: "x.......x.......", tomLo: "..............xx" })

  // Bass rows (E blues, octave 1): E1 G1 A1 Bb1 B1 D2 E2 G2 — Lemmy plays eighths, distorted, like a guitar.
  const bassA = bass("0.0.0.0.0.0.2.2.", "x.......x.......", "")
  const bassB = bass("0.0.0.0.5.5.2.2.", "x.......x.......", "")
  const bassC = bass("0.0.0.0.1.1.2.2.", "x.......x.......", "")
  const bassD = bass("0.0.0.0.0.0.0.0.", "x...x...x...x...", "")
  const bassWalk = bass("0.1.2.3.4.5.4.2.", "x.......x.......", "..x...x...x...x.")
  const bassStop = bass("0...............", "x...............", "")

  // Lead rows (E blues, octave 4): E4 G4 A4 Bb4 B4 D5 E5 G5
  const solo1 = synth("7.5.4.3.2.1.0...")
  const solo2 = synth("0.2.4.5.7.5.4.2.")
  const solo3 = synth("7.7.5.5.4.4.3.2.")
  const solo4 = synth("2...4...7...7.5.")

  const patterns = [
    /* 0 */ pattern({ "drums-1": drumsIntro }),
    /* 1 */ pattern({
      "drums-1": drumsGo,
      "strings-1": riffA,
      "strings-2": riffA,
      "bass-1": bassA,
      "perc-1": crash,
    }),
    /* 2 */ pattern({
      "drums-1": drumsGo,
      "strings-1": riffB,
      "strings-2": riffB,
      "bass-1": bassB,
    }),
    /* 3 */ pattern({
      "drums-1": drumsGo,
      "strings-1": riffC,
      "strings-2": riffC,
      "bass-1": bassC,
    }),
    /* 4 */ pattern({
      "drums-1": drumsRoll,
      "strings-1": riffD,
      "strings-2": riffD,
      "bass-1": bassWalk,
      "perc-1": crashes,
    }),
    /* 5 */ pattern({
      "drums-1": drumsOverkill,
      "strings-1": chorus("e"),
      "strings-2": chorus("e"),
      "bass-1": bassD,
      "perc-1": crash,
    }),
    /* 6 */ pattern({
      "drums-1": drumsOverkill,
      "strings-1": chorus("d"),
      "strings-2": chorus("d"),
      "bass-1": bassB,
    }),
    /* 7 */ pattern({
      "drums-1": drumsOverkill,
      "strings-1": chorus("a"),
      "strings-2": chorus("a"),
      "bass-1": bassA,
    }),
    /* 8 */ pattern({
      "drums-1": drumsRoll,
      "strings-1": chorus("g"),
      "strings-2": chorus("g"),
      "bass-1": bassWalk,
      "perc-1": crashes,
    }),
    /* 9 */ pattern({
      "drums-1": drumsGo,
      "strings-1": riffA,
      "strings-2": riffD,
      "bass-1": bassA,
      "synth-1": solo1,
    }),
    /* 10 */ pattern({
      "drums-1": drumsGo,
      "strings-1": riffB,
      "strings-2": riffD,
      "bass-1": bassB,
      "synth-1": solo2,
    }),
    /* 11 */ pattern({
      "drums-1": drumsGo,
      "strings-1": riffC,
      "strings-2": riffD,
      "bass-1": bassC,
      "synth-1": solo3,
    }),
    /* 12 */ pattern({
      "drums-1": drumsRoll,
      "strings-1": riffD,
      "strings-2": riffD,
      "bass-1": bassWalk,
      "synth-1": solo4,
      "perc-1": crashes,
    }),
    // The stop: one hit, everyone, and the bass alone into the next round.
    /* 13 */ pattern(
      {
        "drums-1": drumsStop,
        "strings-1": stop,
        "strings-2": stop,
        "bass-1": bassA,
        "perc-1": crash,
      },
      ["strings-2"],
    ),
    /* 14 */ pattern(
      { "drums-1": drumsStop, "strings-1": stop, "strings-2": stop, "bass-1": bassWalk },
      ["drums-1", "strings-1", "strings-2"],
    ),
    /* 15 */ pattern({
      "drums-1": drumsOverkill,
      "strings-1": chorus("e"),
      "strings-2": chorus("e"),
      "bass-1": bassD,
      "perc-1": crashes,
    }),
  ]

  const guitar = (id, pan, drive) =>
    instance(
      id,
      "strings",
      { damp: 5600, sustain: 0.99, release: 0.4, strum: 3 },
      {
        level: 0.65,
        send: 0.06,
        pan,
        key: key(4, "blues", 2),
        filter: highpass(140, 0.8),
        mod: mod({ drive, random: { target: "level", amount: 0.1 } }),
      },
    )

  return song({
    bpm: 140,
    swing: 0,
    fx: { delayTime: "8n", feedback: 0.15, reverbDecay: 1.2 },
    places: {
      "drums-1": [0, 0.35],
      "perc-1": [-20, 0.5],
      "strings-1": [-55, 0.5],
      "strings-2": [55, 0.5],
      "bass-1": [0, 0.2],
      "synth-1": [30, 0.55],
    },
    instances: [
      instance(
        "drums-1",
        "drums",
        { kick: 1, snare: 0.9, clap: 0.4, hat: 0.5 },
        {
          level: 0.95,
          send: 0.08,
          filter: lowpass(20000, 0.1),
          mod: mod({ drive: 0.4 }),
        },
      ),
      instance(
        "perc-1",
        "perc",
        { tomLo: 0.8, tomHi: 0.7, rim: 0.4, cowbell: 0.3, shaker: 0.2, crash: 0.9 },
        {
          level: 0.8,
          send: 0.2,
          filter: lowpass(20000, 0.1),
        },
      ),
      guitar("strings-1", -0.5, 0.7),
      guitar("strings-2", 0.5, 0.7),
      // The bass is the lead rhythm instrument: sawtooth, filter wide open, hard drive, up front.
      instance(
        "bass-1",
        "bass",
        {
          waveform: "sawtooth",
          filterType: "lowpass",
          cutoff: 1800,
          resonance: 1.5,
          envMod: 0.2,
          attack: 0.003,
          decay: 0.2,
          sustain: 0.8,
          release: 0.08,
        },
        {
          level: 0.95,
          send: 0.04,
          key: key(4, "blues", 1),
          mod: mod({ drive: 0.8 }),
        },
      ),
      instance(
        "synth-1",
        "synth",
        {
          waveform: "sawtooth",
          filterType: "lowpass",
          cutoff: 3200,
          resonance: 2.5,
          attack: 0.004,
          decay: 0.15,
          sustain: 0.7,
          release: 0.2,
        },
        {
          level: 0.5,
          send: 0.35,
          key: key(4, "blues", 4),
          mod: mod({ drive: 0.6, lfo1: lfo("pitch", 6, 0.04, "sine") }),
        },
      ),
    ],
    patterns,
    sections: [
      ["Intro", 2, [0]],
      ["Riff", 8, [1, 2, 3, 4]],
      ["Verse", 16, [1, 2, 3, 4]],
      ["Chorus", 8, [5, 6, 7, 8]],
      ["Solo", 8, [9, 10, 11, 12]],
      ["Stop", 2, [13, 14]],
      ["Chorus", 16, [5, 6, 7, 8]],
      ["Outro", 4, [15, 15, 15, 13]],
    ],
  })
}

// ======================================================================
// 8 · Cambra 36 — boom bap, 88 BPM, Do# menor: a dusty piano loop, a sub, a dry snare
// ======================================================================
function cambra36() {
  // Rows (C# minor, octave 3): C#3 D#3 E3 F#3 G#3 A3 B3 C#4 — the loop is a four-note motif, chopped.
  const CH = { i: [0, 2, 4], iv: [3, 5, 0], vi: [5, 0, 2], v: [4, 6, 1] } // C#m F#m A G#m
  const loopA = poly("ep", "i...i.i.....iv..", CH)
  const loopB = poly("ep", "vi..vi.v....v...", CH)
  const stabs = poly("ep", "i.......vi......", CH)
  const motif = synth("7.5.4...2.4.5...") // the "sample": a MONO-1 sine, high, repeating
  const motifB = synth("4.2.0...2...4...")
  const pad = (c) => poly("poly", `${c}...............`, CH)

  const boom = drums({
    kick: "x..x......x.....",
    snare: "....x.......x...",
    hat: "x.x.x.x.x.x.x.x.",
  })
  const boomB = drums({
    kick: "x..x......x..x..",
    snare: "....x.......x...",
    hat: "x.x.x.x.x.x.x.xx",
  })
  const boomC = drums({
    kick: "x..x......x.....",
    snare: "....x.......x..x",
    hat: "x.x.x.x.x.x.x.x.",
  })
  const intro = drums({ hat: "x.x.x.x.x.x.x.x." })
  const hatsOpen = drums({ hat: "..x...x...x...x." })
  const percA = perc({ rim: "......x.........", shaker: "x...x...x...x..." })
  const percB = perc({
    rim: "......x.......x.",
    shaker: "x...x...x...x...",
    cowbell: "...........x....",
  })

  // Bass rows (C# minor, octave 1): C#1 D#1 E1 F#1 G#1 A1 B1 C#2 — a sub that mostly holds the root.
  const subI = bass("0......0..0.....", "x.........x.....", "")
  const subIV = bass("3......3..3.....", "x.........x.....", "")
  const subVI = bass("5......5..5..4..", "x.........x.....", ".............x..")
  const subV = bass("4......4..4..0..", "x.........x.....", "")

  const patterns = [
    /* 0 */ pattern({ "drums-1": intro, "ep-1": stabs, "synth-1": motif }),
    /* 1 */ pattern({ "drums-1": intro, "ep-1": stabs, "synth-1": motifB, "perc-1": percA }),
    /* 2 */ pattern({
      "drums-1": boom,
      "drums-2": hatsOpen,
      "perc-1": percA,
      "bass-1": subI,
      "ep-1": loopA,
      "synth-1": motif,
    }),
    /* 3 */ pattern({
      "drums-1": boom,
      "drums-2": hatsOpen,
      "perc-1": percA,
      "bass-1": subIV,
      "ep-1": loopA,
      "synth-1": motif,
    }),
    /* 4 */ pattern({
      "drums-1": boom,
      "drums-2": hatsOpen,
      "perc-1": percA,
      "bass-1": subVI,
      "ep-1": loopB,
      "synth-1": motifB,
    }),
    /* 5 */ pattern({
      "drums-1": boomB,
      "drums-2": hatsOpen,
      "perc-1": percB,
      "bass-1": subV,
      "ep-1": loopB,
      "synth-1": motifB,
    }),
    /* 6 */ pattern({
      "drums-1": boomC,
      "drums-2": hatsOpen,
      "perc-1": percA,
      "bass-1": subI,
      "ep-1": loopA,
      "synth-1": motif,
      "poly-1": pad("i"),
    }),
    /* 7 */ pattern({
      "drums-1": boomC,
      "drums-2": hatsOpen,
      "perc-1": percA,
      "bass-1": subIV,
      "ep-1": loopA,
      "synth-1": motif,
      "poly-1": pad("iv"),
    }),
    /* 8 */ pattern({
      "drums-1": boomC,
      "drums-2": hatsOpen,
      "perc-1": percA,
      "bass-1": subVI,
      "ep-1": loopB,
      "synth-1": motifB,
      "poly-1": pad("vi"),
    }),
    /* 9 */ pattern({
      "drums-1": boomB,
      "drums-2": hatsOpen,
      "perc-1": percB,
      "bass-1": subV,
      "ep-1": loopB,
      "synth-1": motifB,
      "poly-1": pad("v"),
    }),
    // The drums drop out under the loop for two bars, then everything comes back.
    /* 10 */ pattern(
      {
        "drums-1": boom,
        "drums-2": hatsOpen,
        "perc-1": percA,
        "bass-1": subI,
        "ep-1": loopA,
        "synth-1": motif,
      },
      ["drums-1", "drums-2", "perc-1"],
    ),
    /* 11 */ pattern(
      {
        "drums-1": boom,
        "drums-2": hatsOpen,
        "perc-1": percA,
        "bass-1": subVI,
        "ep-1": loopB,
        "synth-1": motifB,
      },
      ["drums-1", "drums-2", "perc-1"],
    ),
    /* 12 */ pattern({ "ep-1": stabs, "synth-1": motif, "bass-1": subI }),
  ]

  return song({
    bpm: 88,
    swing: 0.16,
    fx: { delayTime: "8n.", feedback: 0.25, reverbDecay: 1.8 },
    places: {
      "drums-1": [0, 0.3],
      "drums-2": [45, 0.6],
      "perc-1": [-45, 0.6],
      "bass-1": [0, 0.2],
      "ep-1": [-25, 0.5],
      "synth-1": [30, 0.55],
      "poly-1": [180, 0.9],
    },
    instances: [
      // Hard, dry, a little dirty: the snare cracks, the kick thumps.
      instance(
        "drums-1",
        "drums",
        { kick: 1, snare: 0.95, clap: 0.4, hat: 0.25 },
        {
          level: 0.95,
          send: 0.04,
          filter: lowpass(9000, 0.5),
          mod: mod({ drive: 0.45, random: { target: "level", amount: 0.12 } }),
        },
      ),
      instance(
        "drums-2",
        "drums",
        { kick: 0.5, snare: 0.4, clap: 0.5, hat: 0.3 },
        {
          level: 0.5,
          send: 0.25,
          pan: 0.35,
          filter: highpass(900, 0.9),
          mod: mod({ random: { target: "level", amount: 0.35 } }),
        },
      ),
      instance(
        "perc-1",
        "perc",
        { tomLo: 0.5, tomHi: 0.4, rim: 0.5, cowbell: 0.3, shaker: 0.22, crash: 0.3 },
        {
          level: 0.55,
          send: 0.25,
          pan: -0.4,
          filter: highpass(400),
        },
      ),
      instance(
        "bass-1",
        "bass",
        {
          waveform: "square",
          filterType: "lowpass",
          cutoff: 120,
          resonance: 0.8,
          envMod: 0.1,
          attack: 0.01,
          decay: 0.6,
          sustain: 0.8,
          release: 0.3,
        },
        {
          level: 0.9,
          send: 0,
          key: key(1, "minor", 1),
        },
      ),
      // The "sample": a piano loop through a dusty lowpass, a touch of drive, panned off centre.
      instance(
        "ep-1",
        "ep",
        { tone: 1, bright: 2.5, decay: 1.4, release: 0.7 },
        {
          level: 0.6,
          send: 0.3,
          pan: -0.25,
          key: key(1, "minor", 3),
          filter: lowpass(3200, 0.6),
          mod: mod({ drive: 0.25, random: { target: "level", amount: 0.12 } }),
        },
      ),
      instance(
        "synth-1",
        "synth",
        {
          waveform: "sine",
          filterType: "lowpass",
          cutoff: 2400,
          resonance: 0.5,
          attack: 0.01,
          decay: 0.4,
          sustain: 0.5,
          release: 0.5,
        },
        {
          level: 0.4,
          send: 0.45,
          pan: 0.3,
          key: key(1, "minor", 4),
          mod: mod({ lfo1: lfo("pitch", 4.5, 0.03, "sine") }),
        },
      ),
      instance(
        "poly-1",
        "poly",
        {
          waveform: "sawtooth",
          filterType: "lowpass",
          cutoff: 700,
          resonance: 0.8,
          attack: 0.9,
          decay: 1,
          sustain: 0.8,
          release: 2.5,
        },
        {
          level: 0.25,
          send: 0.7,
          key: key(1, "minor", 3),
          mod: mod({ lfo1: lfo("cutoff", 0.07, 0.4, "sine") }),
        },
      ),
    ],
    patterns,
    sections: [
      ["Intro", 4, [0, 1]],
      ["Verse", 16, [2, 3, 4, 5]],
      ["Hook", 8, [6, 7, 8, 9]],
      ["Verse", 16, [2, 3, 4, 5]],
      ["Drop", 2, [10, 11]],
      ["Hook", 8, [6, 7, 8, 9]],
      ["Outro", 4, [12, 12, 0, 1]],
    ],
  })
}

// ======================================================================
// Cançons infantils — three traditional Catalan children's songs, played
// slowly by a small band: STR-6 #1 picks the tune one note at a time (octave
// 4, where the tune is bright on a guitar), STR-6 #2 strums the chords under it
// (octave 2), a soft BASS-2 on the roots, a light DR-4. The tune rows are read
// straight off the grid (every cell prints its note), so a child can follow
// the song on the panel — or change it. The melodies are written from memory
// of the common school versions; a wrong note is one cell away.
// ======================================================================

/**
 * A children's song: `tune` is the melody, one pattern string per bar over
 * the key's rows at octave 4; `chords` the strummed chords per bar
 * ("c.......g.......") over `table` at octave 2; `roots` the bass per bar
 * (rows at octave 1). `intro` bars of chords alone first, then the song
 * twice (the second verse is sung to the same tune).
 */
/** A tune line's digit is one row: "4.2." on a poly grid is a single note a column. */
const ONE_NOTE = Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7].map((r) => [String(r), [r]]))

function kidsSong({ bpm, root, tune, chords, roots, table, intro = 2 }) {
  const strumOnly = pattern({
    "drums-1": drums({ kick: "x.......x.......", hat: "..x...x...x...x." }),
    "strings-2": poly("strings", chords[0], table),
    "bass-1": bass(roots[0]),
  })
  const bars = tune.map((line, i) =>
    pattern({
      "drums-1": drums({ kick: "x.......x.......", hat: "..x...x...x...x." }),
      "strings-1": poly("strings", line, ONE_NOTE),
      "strings-2": poly("strings", chords[i], table),
      "bass-1": bass(roots[i]),
    }),
  )
  const patterns = [...bars, strumOnly]
  const song_ = bars.map((_, i) => i)
  return song({
    bpm,
    fx: { delayTime: "8n", feedback: 0.15, reverbDecay: 2 },
    instances: [
      instance(
        "strings-1",
        "strings",
        { damp: 5000, sustain: 0.99, release: 1.4, strum: 0 },
        {
          level: 0.95,
          send: 0.2,
          pan: 0.2,
          key: key(root, "major", 4),
          filter: lowpass(20000, 0.1),
        },
      ),
      instance(
        "strings-2",
        "strings",
        { damp: 4000, sustain: 0.985, release: 1.4, strum: 14 },
        {
          level: 0.5,
          send: 0.15,
          pan: -0.3,
          key: key(root, "major", 2),
          filter: lowpass(20000, 0.1),
        },
      ),
      instance(
        "bass-1",
        "bass",
        {
          waveform: "square",
          filterType: "lowpass",
          cutoff: 220,
          resonance: 0.5,
          envMod: 0.1,
          attack: 0.01,
          decay: 0.5,
          sustain: 0.6,
          release: 0.3,
        },
        { level: 0.6, send: 0, key: key(root, "major", 1) },
      ),
      instance(
        "drums-1",
        "drums",
        { kick: 0.7, snare: 0.5, clap: 0.5, hat: 0.25 },
        { level: 0.55, send: 0.1 },
      ),
    ],
    patterns,
    sections: [
      ["Intro", intro, [bars.length]],
      ["Cançó", bars.length, song_],
      ["Cançó", bars.length, song_],
    ],
  })
}

// Major-key rows at octave 4: 0 = do, 1 = re, 2 = mi, 3 = fa, 4 = sol, 5 = la, 6 = si, 7 = do'.
// Chord tables are rows at octave 2: c = I, g = V7 (root, third, fifth, seventh).
const I_V7 = { c: [0, 2, 4], g: [4, 6, 1, 3] }

/** Sol, solet (Do major): sol so-let / vi-ne'm a veu-re / … / que tinc fred. Two eighths a beat. */
function solSolet() {
  return kidsSong({
    bpm: 92,
    root: 0,
    tune: [
      // Sol, so-let, vi-ne'm a veu-re,
      "4...2.4.5.542.4.",
      // vi-ne'm a veu-re, sol, so-let,
      "5.542.4.4...2.4.",
      // vi-ne'm a veu-re que tinc fred.
      "5.542.4.5.4.2...",
    ],
    chords: ["c.......c.......", "c.......c.......", "c.......g...c..."],
    roots: ["0.......0.......", "0.......0.......", "0.......4...0..."],
    table: I_V7,
  })
}

/** Cargol, treu banya (Do major): a sol–mi–la song. */
function cargolTreuBanya() {
  return kidsSong({
    bpm: 96,
    root: 0,
    tune: [
      // Car-gol, treu ba-nya,
      "4.2.4.4.2.......",
      // pu-ja a la mun-ta-nya;
      "4.4.5.5.4.2.....",
      // car-gol bo-ver,
      "4.2.4.2.........",
      // jo tam-bé vin-dré.
      "4.4.5.4.2.......",
    ],
    chords: ["c.......c.......", "g.......c.......", "c.......c.......", "g.......c......."],
    roots: ["0.......0.......", "4.......0.......", "0.......0.......", "4.......0......."],
    table: I_V7,
  })
}

/** El gegant del Pi (Sol major): si do re si sol / do si la sol la la si sol / … */
function gegantDelPi() {
  return kidsSong({
    bpm: 100,
    root: 7,
    tune: [
      // El ge-gant del Pi, a-ra
      "2.3.4.2.0...3.2.",
      // ba-lla, a-ra ba-lla,
      "1.0.1.1.2.0.....",
      // el ge-gant del Pi, a-ra
      "2.3.4.2.0...3.2.",
      // ba-lla pel ca-mí.
      "1.0.1.2.0.......",
    ],
    chords: ["c.......c.......", "g.......c.......", "c.......c.......", "g.......c......."],
    roots: ["0.......0.......", "4.......0.......", "0.......0.......", "4.......0......."],
    table: I_V7,
  })
}

// ======================================================================
// Silenci — fingerpicking ballad, 99 BPM, La menor. Two guitars over a
// folk chord loop (Am · G · C · F): one picks an eighth-note arpeggio, the
// other strums each half bar; a square bass on the roots; drums come in
// for the second verse. Written as the accompaniment a strummer would put
// under a sixties folk song — chords and picking only, no melody.
// ======================================================================
function silenci() {
  // Picking rows (A minor, octave 2): A2 B2 C3 D3 E3 F3 G3 A3 — root, fifth, third, fifth.
  const PICK = {
    Am: "0.4.2.4.0.4.2.4.",
    G: "6.3.1.3.6.3.1.3.",
    C: "2.6.4.6.2.6.4.6.",
    F: "5.2.0.2.5.2.0.2.",
  }
  // Strum rows (octave 3): A3 B3 C4 D4 E4 F4 G4 A4.
  const STRUM = { a: [0, 2, 4], g: [1, 3, 6], c: [2, 4, 6], f: [0, 2, 5] }
  const ROOT = { Am: 0, G: 6, C: 2, F: 5 }
  const CHORDS = ["Am", "G", "C", "F"]
  const bar = (chord, withDrums) =>
    pattern({
      "strings-1": poly("strings", PICK[chord], ONE_NOTE),
      "strings-2": poly(
        "strings",
        `${chord[0].toLowerCase()}.......${chord[0].toLowerCase()}.......`,
        STRUM,
      ),
      "bass-1": bass(`${ROOT[chord]}.......${ROOT[chord]}.......`, "x..............."),
      "drums-1": drums(
        withDrums
          ? { kick: "x.......x.......", snare: "....x.......x...", hat: "..x...x...x...x." }
          : {},
      ),
    })
  const patterns = [...CHORDS.map((c) => bar(c, false)), ...CHORDS.map((c) => bar(c, true))]
  const verse = ["Am", "G", "G", "Am", "C", "F", "C", "F", "C", "C", "F", "C", "Am", "C", "G", "Am"]
  const slots = verse.map((c) => CHORDS.indexOf(c))
  return song({
    bpm: 99,
    master: 1,
    fx: { delayTime: "8n.", feedback: 0.2, reverbDecay: 2.6 },
    instances: [
      instance(
        "strings-1",
        "strings",
        { damp: 5200, sustain: 0.992, release: 1.6, strum: 0 },
        {
          level: 0.95,
          send: 0.25,
          pan: 0.15,
          key: key(9, "minor", 2),
          filter: lowpass(20000, 0.1),
        },
      ),
      instance(
        "strings-2",
        "strings",
        { damp: 3800, sustain: 0.985, release: 1.6, strum: 16 },
        { level: 0.6, send: 0.2, pan: -0.35, key: key(9, "minor", 3), filter: lowpass(20000, 0.1) },
      ),
      instance(
        "bass-1",
        "bass",
        {
          waveform: "square",
          filterType: "lowpass",
          cutoff: 200,
          resonance: 0.5,
          envMod: 0.1,
          attack: 0.01,
          decay: 0.6,
          sustain: 0.7,
          release: 0.3,
        },
        { level: 0.75, send: 0, key: key(9, "minor", 1) },
      ),
      instance(
        "drums-1",
        "drums",
        { kick: 0.7, snare: 0.45, clap: 0.4, hat: 0.22 },
        { level: 0.7, send: 0.12 },
      ),
    ],
    patterns,
    sections: [
      ["Intro", 4, [0]],
      ["Verse", 16, slots],
      ["Verse", 16, slots.map((i) => i + 4)],
      ["Outro", 2, [0]],
    ],
  })
}

// ======================================================================
// Four more "in the style of" demos, asked for from a playlist: a jump-up
// drum & bass tune, a fingerpicked folk song with hand percussion, a
// nineties boom-bap hip hop beat, and a driving seventies rock song.
// All original: their own chords and lines, only the feel is borrowed.
// ======================================================================

// ---------- Daus · Drum & bass, 174 BPM, Fa menor ----------
function daus() {
  // Rows (F minor): bass oct 1 F1 G1 Ab1 Bb1 C2 Db2 Eb2 F2; EP / pad oct 3; lead oct 4.
  const CH = { f: [0, 2, 4, 6], d: [5, 0, 2, 4], e: [6, 1, 3], b: [3, 5, 7] } // Fm7 Dbmaj7 Eb Bbm
  const hatsIntro = drums({ hat: "x.x.x.x.x.x.x.x." })
  const twoStep = drums({
    kick: "x.........x.....",
    snare: "....x.......x...",
    hat: "x.x.x.x.x.x.x.x.",
  })
  const twoStepFill = drums({
    kick: "x.........x...x.",
    snare: "....x.......x.xx",
    clap: "....x.......x...",
    hat: "x.x.x.x.x.x.x.x.",
  })
  const build = drums({
    kick: "x...x...x...x...",
    clap: "x.x.x.x.xxxxxxxx",
    hat: "xxxxxxxxxxxxxxxx",
  })
  const percDrop = perc({ shaker: "x.xxx.xxx.xxx.xx", rim: "......x.......x." })
  const percBreak = perc({ shaker: "..x...x...x...x.", crash: "x..............." })
  const sub = (a, b) => bass(a, b, "")
  const bassF = bass("0...0.0...0.7.5.", "x.........x.....", "............x...")
  const bassD = bass("5...5.5...5.4.3.", "x.........x.....", "............x...")
  const bassE = bass("6...6.6...6.5.4.", "x.........x.....", "............x...")
  const bassB = bass("3...3.3...3.2.0.", "x.........x.....", "............x...")
  const bassDrop = bass("0.0.0.0.7.7.5.3.", "x...x...x...x...", "..........x.....")
  const leadA = synth("0.2.3...7.5.3...")
  const leadB = synth("5.3.2.0...2.3...")
  const leadC = synth("7...5.3.2.0.....")
  const ep = (c) => poly("ep", `${c}.....${c}.....${c}...`, CH)
  const pad = (c) => poly("poly", `${c}...............`, CH)
  const patterns = [
    /* 0 intro */ pattern({ "drums-1": hatsIntro, "poly-1": pad("f"), "ep-1": ep("f") }),
    /* 1 intro */ pattern({ "drums-1": hatsIntro, "poly-1": pad("d"), "ep-1": ep("d") }),
    /* 2 build */ pattern({
      "drums-1": build,
      "bass-1": sub("0...............", "x..............."),
      "poly-1": pad("e"),
      "ep-1": ep("e"),
    }),
    /* 3 drop F */ pattern({
      "drums-1": twoStep,
      "perc-1": percDrop,
      "bass-1": bassF,
      "ep-1": ep("f"),
      "synth-1": leadA,
    }),
    /* 4 drop Db */ pattern({
      "drums-1": twoStep,
      "perc-1": percDrop,
      "bass-1": bassD,
      "ep-1": ep("d"),
      "synth-1": leadB,
    }),
    /* 5 drop Eb */ pattern({
      "drums-1": twoStep,
      "perc-1": percDrop,
      "bass-1": bassE,
      "ep-1": ep("e"),
      "synth-1": leadA,
    }),
    /* 6 drop Bbm fill */ pattern({
      "drums-1": twoStepFill,
      "perc-1": percDrop,
      "bass-1": bassB,
      "ep-1": ep("b"),
      "synth-1": leadC,
    }),
    /* 7 break */ pattern({
      "drums-1": hatsIntro,
      "perc-1": percBreak,
      "poly-1": pad("f"),
      "ep-1": ep("f"),
    }),
    /* 8 break */ pattern({
      "drums-1": hatsIntro,
      "poly-1": pad("b"),
      "ep-1": ep("b"),
      "synth-1": leadC,
    }),
    /* 9 drop 2 F */ pattern({
      "drums-1": twoStep,
      "perc-1": percDrop,
      "bass-1": bassDrop,
      "ep-1": ep("f"),
      "poly-1": pad("f"),
      "synth-1": leadA,
    }),
    /* 10 drop 2 Bbm */ pattern({
      "drums-1": twoStepFill,
      "perc-1": percDrop,
      "bass-1": bassB,
      "ep-1": ep("b"),
      "poly-1": pad("b"),
      "synth-1": leadB,
    }),
    /* 11 outro */ pattern({
      "drums-1": twoStep,
      "bass-1": sub("0...............", "x..............."),
      "poly-1": pad("f"),
    }),
  ]
  return song({
    bpm: 174,
    master: 0.9,
    fx: { delayTime: "8n.", feedback: 0.35, reverbDecay: 2.2 },
    instances: [
      instance(
        "drums-1",
        "drums",
        { kick: 0.9, snare: 0.8, clap: 0.45, hat: 0.3 },
        { level: 0.8, send: 0.06, mod: mod({ random: { target: "level", amount: 0.1 } }) },
      ),
      instance(
        "perc-1",
        "perc",
        { tomLo: 0.5, tomHi: 0.5, rim: 0.4, cowbell: 0.3, shaker: 0.3, crash: 0.5 },
        { level: 0.55, send: 0.3, pan: 0.3, filter: highpass(600) },
      ),
      instance(
        "bass-1",
        "bass",
        {
          waveform: "sawtooth",
          filterType: "lowpass",
          cutoff: 240,
          resonance: 4,
          envMod: 0.5,
          attack: 0.005,
          decay: 0.3,
          sustain: 0.6,
          release: 0.1,
        },
        {
          level: 0.75,
          send: 0,
          key: key(5, "minor", 1),
          mod: mod({ drive: 0.35, lfo1: lfo("cutoff", 0.25, 0.35, "sine") }),
        },
      ),
      instance(
        "ep-1",
        "ep",
        { tone: 2, bright: 5, decay: 0.9, release: 0.5 },
        { level: 0.6, send: 0.5, pan: -0.3, key: key(5, "minor", 3), filter: highpass(300) },
      ),
      instance(
        "poly-1",
        "poly",
        {
          waveform: "sawtooth",
          filterType: "lowpass",
          cutoff: 1200,
          resonance: 1,
          attack: 1.2,
          decay: 0.5,
          sustain: 0.9,
          release: 3,
        },
        {
          level: 0.55,
          send: 0.6,
          key: key(5, "minor", 3),
          mod: mod({ lfo1: lfo("cutoff", 0.08, 0.4, "sine") }),
        },
      ),
      instance(
        "synth-1",
        "synth",
        {
          waveform: "square",
          filterType: "lowpass",
          cutoff: 2200,
          resonance: 2,
          attack: 0.005,
          decay: 0.2,
          sustain: 0.3,
          release: 0.2,
        },
        {
          level: 0.5,
          send: 0.5,
          pan: 0.25,
          key: key(5, "minor", 4),
          mod: mod({ lfo1: lfo("pan", 0.5, 0.6, "sine") }),
        },
      ),
    ],
    patterns,
    sections: [
      ["Intro", 8, [0, 0, 1, 1]],
      ["Build", 8, [0, 1, 0, 1, 2, 2, 2, 2]],
      ["Drop", 16, [3, 4, 5, 6]],
      ["Break", 8, [7, 8]],
      ["Drop", 16, [9, 4, 5, 10]],
      ["Outro", 4, [11]],
    ],
  })
}

// ---------- Riera · Folk, 116 BPM, Mi menor ----------
function riera() {
  // Picking rows (E minor, octave 2): E2 F#2 G2 A2 B2 C3 D3 E3.
  const PICK = {
    Em: "0.4.2.4.0.4.2.4.",
    D: "6.3.1.3.6.3.1.3.",
    C: "5.2.0.2.5.2.0.2.",
    G: "2.6.4.6.2.6.4.6.",
  }
  // Strum rows (octave 3): E3 F#3 G3 A3 B3 C4 D4 E4.
  const STRUM = { e: [0, 2, 4], d: [1, 3, 6], c: [0, 2, 5], g: [2, 4, 6] }
  const ROOT = { Em: 0, D: 6, C: 5, G: 2 }
  const congas = perc({
    tomLo: "x..x..x...x..x..",
    tomHi: "..x.....x...x...",
    shaker: "x.x.x.x.x.x.x.x.",
  })
  const congasSoft = perc({ tomLo: "x.......x.......", shaker: "..x...x...x...x." })
  const bar = (chord, soft) =>
    pattern({
      "strings-1": poly("strings", PICK[chord], ONE_NOTE),
      "strings-2": poly(
        "strings",
        soft
          ? ""
          : `${chord[0].toLowerCase()}...${chord[0].toLowerCase()}...${chord[0].toLowerCase()}...${chord[0].toLowerCase()}...`,
        STRUM,
      ),
      // Softer bars: the bass on the one and the three only; full bars add the pickup on the four.
      "bass-1": bass(
        soft
          ? `${ROOT[chord]}.......${ROOT[chord]}.......`
          : `${ROOT[chord]}.......${ROOT[chord]}...${ROOT[chord]}...`,
        "x...............",
      ),
      "perc-1": soft ? congasSoft : congas,
    })
  const CHORDS = ["Em", "D", "C", "G"]
  const patterns = [...CHORDS.map((c) => bar(c, true)), ...CHORDS.map((c) => bar(c, false))]
  const verse = ["Em", "D", "Em", "D", "C", "G", "Em", "D"]
  const chorus = ["C", "G", "D", "Em", "C", "G", "D", "Em"]
  const soft = (list) => list.map((c) => CHORDS.indexOf(c))
  const full = (list) => list.map((c) => CHORDS.indexOf(c) + 4)
  return song({
    bpm: 116,
    master: 0.9,
    fx: { delayTime: "8n.", feedback: 0.18, reverbDecay: 2.4 },
    instances: [
      instance(
        "strings-1",
        "strings",
        { damp: 5000, sustain: 0.992, release: 1.6, strum: 0 },
        { level: 0.9, send: 0.25, pan: 0.2, key: key(4, "minor", 2), filter: lowpass(20000, 0.1) },
      ),
      instance(
        "strings-2",
        "strings",
        { damp: 3600, sustain: 0.985, release: 1.4, strum: 18 },
        {
          level: 0.65,
          send: 0.2,
          pan: -0.35,
          key: key(4, "minor", 3),
          filter: lowpass(20000, 0.1),
        },
      ),
      instance(
        "bass-1",
        "bass",
        {
          waveform: "square",
          filterType: "lowpass",
          cutoff: 180,
          resonance: 0.5,
          envMod: 0.1,
          attack: 0.01,
          decay: 0.5,
          sustain: 0.7,
          release: 0.3,
        },
        { level: 0.65, send: 0, key: key(4, "minor", 1) },
      ),
      instance(
        "perc-1",
        "perc",
        { tomLo: 0.7, tomHi: 0.55, rim: 0.4, cowbell: 0.3, shaker: 0.35, crash: 0.4 },
        { level: 0.6, send: 0.2, pan: 0.1 },
      ),
    ],
    patterns,
    sections: [
      ["Intro", 4, soft(["Em", "D"])],
      ["Verse", 8, soft(verse)],
      ["Chorus", 8, full(chorus)],
      ["Verse", 8, full(verse)],
      ["Chorus", 8, full(chorus)],
      ["Outro", 4, soft(["Em", "D", "Em", "Em"])],
    ],
  })
}

// ---------- Passos · Hip hop, 92 BPM, Re menor, swing ----------
function passos() {
  // EP rows (D minor, octave 3): D3 E3 F3 G3 A3 Bb3 C4 D4.
  const CH = { d: [0, 2, 4, 6], g: [3, 5, 7, 2], b: [5, 0, 2, 4], a: [4, 6, 1, 3] } // Dm7 Gm7 Bbmaj7 Am7
  const boom = drums({
    kick: "x..x....x.x.....",
    snare: "....x.......x...",
    hat: "x.x.x.x.x.x.x.x.",
  })
  const boomFill = drums({
    kick: "x..x....x.x...x.",
    snare: "....x.......x.x.",
    clap: "............x...",
    hat: "x.x.x.x.x.x.x.xx",
  })
  const hatsOnly = drums({ hat: "x.x.x.x.x.x.x.x." })
  const shaker = perc({ shaker: "..x...x...x...x." })
  const ep = (c) => poly("ep", `${c}.......${c}..${c}.....`, CH)
  // Bass rows (octave 1): D1 E1 F1 G1 A1 Bb1 C2 D2.
  const bassD = bass("0.....0...0...7.", "x.......x.......")
  const bassG = bass("3.....3...3...2.", "x.......x.......")
  const bassB = bass("5.....5...5...4.", "x.......x.......")
  const bassA = bass("4.....4...4...0.", "x.......x.......")
  // Hook (sine MONO-1, octave 4).
  const hookA = synth("4...2.0...2.....")
  const hookB = synth("5...4.2...0.....")
  const patterns = [
    /* 0 intro */ pattern({ "drums-1": hatsOnly, "ep-1": ep("d"), "perc-1": shaker }),
    /* 1 */ pattern({ "drums-1": boom, "ep-1": ep("d"), "bass-1": bassD, "perc-1": shaker }),
    /* 2 */ pattern({ "drums-1": boom, "ep-1": ep("g"), "bass-1": bassG, "perc-1": shaker }),
    /* 3 */ pattern({ "drums-1": boom, "ep-1": ep("b"), "bass-1": bassB, "perc-1": shaker }),
    /* 4 */ pattern({ "drums-1": boomFill, "ep-1": ep("a"), "bass-1": bassA, "perc-1": shaker }),
    /* 5 hook */ pattern({
      "drums-1": boom,
      "ep-1": ep("d"),
      "bass-1": bassD,
      "perc-1": shaker,
      "synth-1": hookA,
    }),
    /* 6 hook */ pattern({
      "drums-1": boom,
      "ep-1": ep("g"),
      "bass-1": bassG,
      "perc-1": shaker,
      "synth-1": hookB,
    }),
    /* 7 hook */ pattern({
      "drums-1": boom,
      "ep-1": ep("b"),
      "bass-1": bassB,
      "perc-1": shaker,
      "synth-1": hookA,
    }),
    /* 8 hook */ pattern({
      "drums-1": boomFill,
      "ep-1": ep("a"),
      "bass-1": bassA,
      "perc-1": shaker,
      "synth-1": hookB,
    }),
    /* 9 outro */ pattern({ "drums-1": hatsOnly, "ep-1": ep("d"), "bass-1": bassD }),
  ]
  return song({
    bpm: 92,
    swing: 0.2,
    fx: { delayTime: "8n.", feedback: 0.25, reverbDecay: 1.6 },
    instances: [
      instance(
        "drums-1",
        "drums",
        { kick: 0.9, snare: 0.8, clap: 0.45, hat: 0.28 },
        {
          level: 0.78,
          send: 0.05,
          filter: lowpass(9000, 0.5),
          mod: mod({ drive: 0.35, random: { target: "level", amount: 0.15 } }),
        },
      ),
      instance(
        "perc-1",
        "perc",
        { tomLo: 0.5, tomHi: 0.4, rim: 0.4, cowbell: 0.3, shaker: 0.25, crash: 0.3 },
        { level: 0.5, send: 0.2, pan: -0.4, filter: highpass(500) },
      ),
      instance(
        "bass-1",
        "bass",
        {
          waveform: "square",
          filterType: "lowpass",
          cutoff: 140,
          resonance: 0.6,
          envMod: 0.1,
          attack: 0.01,
          decay: 0.6,
          sustain: 0.8,
          release: 0.25,
        },
        { level: 0.7, send: 0, key: key(2, "minor", 1) },
      ),
      instance(
        "ep-1",
        "ep",
        { tone: 1, bright: 2.5, decay: 1.5, release: 0.8 },
        {
          level: 0.5,
          send: 0.3,
          pan: 0.25,
          key: key(2, "minor", 3),
          filter: lowpass(3400, 0.6),
          mod: mod({ drive: 0.2, random: { target: "level", amount: 0.1 } }),
        },
      ),
      instance(
        "synth-1",
        "synth",
        {
          waveform: "sine",
          filterType: "lowpass",
          cutoff: 2600,
          resonance: 0.5,
          attack: 0.01,
          decay: 0.4,
          sustain: 0.5,
          release: 0.5,
        },
        {
          level: 0.45,
          send: 0.45,
          pan: -0.2,
          key: key(2, "minor", 4),
          mod: mod({ lfo1: lfo("pitch", 5, 0.03, "sine") }),
        },
      ),
    ],
    patterns,
    sections: [
      ["Intro", 4, [0]],
      ["Verse", 16, [1, 2, 3, 4]],
      ["Hook", 8, [5, 6, 7, 8]],
      ["Verse", 16, [1, 2, 3, 4]],
      ["Hook", 8, [5, 6, 7, 8]],
      ["Outro", 4, [9]],
    ],
  })
}

// ---------- El Teu Camí · Rock, 132 BPM, Fa major ----------
function elTeuCami() {
  // Strum rows (F major, octave 2): F2 G2 A2 Bb2 C3 D3 E3 F3.
  const STRUM = { f: [0, 2, 4], c: [1, 4, 6], b: [0, 3, 5], d: [2, 5, 0] } // F C Bb Dm
  const ROOT = { f: 0, c: 4, b: 3, d: 5 }
  const drive = drums({
    kick: "x...x...x...x...",
    snare: "....x.......x...",
    hat: "x.x.x.x.x.x.x.x.",
  })
  const driveVerse = drums({
    kick: "x.......x.......",
    snare: "....x.......x...",
    hat: "x.x.x.x.x.x.x.x.",
  })
  const driveFill = drums({
    kick: "x...x...x...x.x.",
    snare: "....x.......x.xx",
    hat: "x.x.x.x.x.x.x.x.",
  })
  const toms = perc({
    tomLo: "..x...x...x...x.",
    tomHi: "x...x...x...x...",
    crash: "x...............",
  })
  const tomsQuiet = perc({ tomLo: "......x.......x." })
  const strumBar = (c) => poly("strings", `${c}.${c}.${c}.${c}.${c}.${c}.${c}.${c}.`, STRUM)
  const pickBar = (c) => poly("strings", `${c}...${c}...${c}...${c}...`, STRUM)
  const bassBar = (c) =>
    bass(
      `${ROOT[c]}.${ROOT[c]}.${ROOT[c]}.${ROOT[c]}.${ROOT[c]}.${ROOT[c]}.${ROOT[c]}.${ROOT[c]}.`,
      "x.......x.......",
    )
  const bassVerse = (c) =>
    bass(`${ROOT[c]}...${ROOT[c]}...${ROOT[c]}...${ROOT[c]}...`, "x.......x.......")
  // Lead rows (octave 4): F4 G4 A4 Bb4 C5 D5 E5 F5.
  const solo = [
    synth("4.5.7...5.4.2..."),
    synth("2.4.5...4.2.0..."),
    synth("7...5.4.5.7....."),
    synth("4.2.0.2.4......."),
  ]
  const verse = (c, i) =>
    pattern({
      "drums-1": i === 3 ? driveFill : driveVerse,
      "perc-1": tomsQuiet,
      "strings-1": pickBar(c),
      "bass-1": bassVerse(c),
    })
  const chorus = (c, i) =>
    pattern({
      "drums-1": i === 3 ? driveFill : drive,
      "perc-1": toms,
      "strings-1": strumBar(c),
      "strings-2": pickBar(c),
      "bass-1": bassBar(c),
    })
  const soloBar = (c, i) =>
    pattern({
      "drums-1": drive,
      "perc-1": tomsQuiet,
      "strings-1": strumBar(c),
      "bass-1": bassBar(c),
      "synth-1": solo[i],
    })
  const V = ["f", "c", "b", "c"]
  const C = ["b", "f", "c", "c"]
  const patterns = [
    ...V.map(verse), // 0–3
    ...C.map(chorus), // 4–7
    ...V.map(soloBar), // 8–11
    /* 12 intro */ pattern({ "drums-1": drive, "strings-2": pickBar("f"), "bass-1": bassBar("f") }),
    /* 13 outro */ pattern({
      "drums-1": drive,
      "perc-1": toms,
      "strings-1": strumBar("f"),
      "bass-1": bassBar("f"),
    }),
  ]
  return song({
    bpm: 132,
    fx: { delayTime: "8n", feedback: 0.15, reverbDecay: 1.8 },
    instances: [
      instance(
        "drums-1",
        "drums",
        { kick: 0.9, snare: 0.9, clap: 0.4, hat: 0.3 },
        { level: 0.72, send: 0.08, mod: mod({ drive: 0.15 }) },
      ),
      instance(
        "perc-1",
        "perc",
        { tomLo: 0.8, tomHi: 0.7, rim: 0.4, cowbell: 0.3, shaker: 0.3, crash: 0.6 },
        { level: 0.55, send: 0.2, pan: 0.2 },
      ),
      instance(
        "bass-1",
        "bass",
        {
          waveform: "sawtooth",
          filterType: "lowpass",
          cutoff: 420,
          resonance: 1,
          envMod: 0.2,
          attack: 0.005,
          decay: 0.3,
          sustain: 0.7,
          release: 0.1,
        },
        { level: 0.6, send: 0, key: key(5, "major", 1), mod: mod({ drive: 0.25 }) },
      ),
      instance(
        "strings-1",
        "strings",
        { damp: 5500, sustain: 0.98, release: 0.8, strum: 10 },
        {
          level: 0.6,
          send: 0.2,
          pan: -0.4,
          key: key(5, "major", 2),
          filter: lowpass(20000, 0.1),
          mod: mod({ drive: 0.5 }),
        },
      ),
      instance(
        "strings-2",
        "strings",
        { damp: 6000, sustain: 0.99, release: 1.2, strum: 4 },
        {
          level: 0.45,
          send: 0.3,
          pan: 0.45,
          key: key(5, "major", 3),
          filter: lowpass(20000, 0.1),
          mod: mod({ drive: 0.25 }),
        },
      ),
      instance(
        "synth-1",
        "synth",
        {
          waveform: "sawtooth",
          filterType: "lowpass",
          cutoff: 2800,
          resonance: 2,
          attack: 0.01,
          decay: 0.3,
          sustain: 0.6,
          release: 0.3,
        },
        {
          level: 0.5,
          send: 0.4,
          pan: 0.1,
          key: key(5, "major", 4),
          mod: mod({ drive: 0.4, lfo1: lfo("pitch", 5.5, 0.04, "sine") }),
        },
      ),
    ],
    patterns,
    sections: [
      ["Intro", 4, [12]],
      ["Verse", 16, [0, 1, 2, 3]],
      ["Chorus", 8, [4, 5, 6, 7]],
      ["Verse", 16, [0, 1, 2, 3]],
      ["Chorus", 8, [4, 5, 6, 7]],
      ["Solo", 8, [8, 9, 10, 11]],
      ["Chorus", 8, [4, 5, 6, 7]],
      ["Outro", 4, [13]],
    ],
  })
}

// ---------- Berlín · Techno, 128 BPM, Do menor ----------
// Minimal Berlin techno in the Kalkbrenner manner: a four-on-the-floor kick, offbeat hats, a
// rolling sixteenth bass under a slow filter, and one bouncy detuned lead motif that comes and goes.
function berlin() {
  const kick = "x...x...x...x..."
  const hats = drums({ kick, hat: "..x...x...x...x." })
  const full = drums({ kick, clap: "....x.......x...", hat: "..x...x...x...x." })
  const fullFill = drums({
    kick: "x...x...x...x.x.",
    clap: "....x.......x.xx",
    hat: "..x...x...x...x.",
  })
  const noKick = drums({ hat: "..x...x...x...x." })
  const percLight = perc({ shaker: "x.x.x.x.x.x.x.x." })
  const percFull = perc({ shaker: "xxxxxxxxxxxxxxxx", rim: "...x......x....." })
  const crash = perc({
    shaker: "xxxxxxxxxxxxxxxx",
    rim: "...x......x.....",
    crash: "x...............",
  })
  // Bass rows (C minor, octave 1): C1 D1 Eb1 F1 G1 Ab1 Bb1 C2.
  const roll = bass("0.0.0.0.0.0.0.0.", "x...x...x...x...")
  const pulse = bass("0...0...0...0...", "x...x...x...x...")
  const pulseUp = bass("0...0...0...0.7.", "x...x...x...x...")
  const rollUp = bass("0.0.0.7.0.0.0.7.", "x...x...x...x...", "......x.......x.")
  const rollAb = bass("5.5.5.5.5.5.5.7.", "x...x...x...x...")
  const rollBb = bass("6.6.6.6.6.6.3.3.", "x...x...x...x...")
  // Lead rows (octave 4): C4 D4 Eb4 F4 G4 Ab4 Bb4 C5.
  const leadA = synth("0...3.2.0...5.3.")
  const leadB = synth("7...5.3.2...0...")
  const leadC = synth("3.2.0.......2.3.")
  const leadD = synth("5...3.2.0.......")
  // Pad stabs (octave 3): Cm, Ab, Bb.
  const CH = { c: [0, 2, 4], a: [5, 0, 2], b: [6, 1, 3] }
  const stab = (c) => poly("poly", `..${c}.....${c}...${c}...`, CH)
  const pad = (c) => poly("poly", `${c}...............`, CH)
  const patterns = [
    /* 0 intro */ pattern({ "drums-1": noKick, "bass-1": pulse }),
    /* 1 intro */ pattern({ "drums-1": hats, "bass-1": pulseUp, "perc-1": percLight }),
    /* 2 build */ pattern({
      "drums-1": full,
      "bass-1": roll,
      "perc-1": percFull,
      "poly-1": stab("c"),
    }),
    /* 3 build */ pattern({
      "drums-1": fullFill,
      "bass-1": rollAb,
      "perc-1": percFull,
      "poly-1": stab("a"),
    }),
    /* 4 main */ pattern({
      "drums-1": full,
      "bass-1": roll,
      "perc-1": crash,
      "poly-1": stab("c"),
      "synth-1": leadA,
    }),
    /* 5 main */ pattern({
      "drums-1": full,
      "bass-1": rollUp,
      "perc-1": percFull,
      "poly-1": stab("c"),
      "synth-1": leadB,
    }),
    /* 6 main */ pattern({
      "drums-1": full,
      "bass-1": rollAb,
      "perc-1": percFull,
      "poly-1": stab("a"),
      "synth-1": leadC,
    }),
    /* 7 main */ pattern({
      "drums-1": fullFill,
      "bass-1": rollBb,
      "perc-1": percFull,
      "poly-1": stab("b"),
      "synth-1": leadD,
    }),
    /* 8 break */ pattern({
      "drums-1": noKick,
      "perc-1": percLight,
      "poly-1": pad("c"),
      "synth-1": leadA,
    }),
    /* 9 break */ pattern({
      "drums-1": noKick,
      "perc-1": percLight,
      "poly-1": pad("a"),
      "synth-1": leadC,
    }),
    /* 10 break end */ pattern({
      "drums-1": drums({
        kick: "x...x...x...x...",
        clap: "xxxxxxxxxxxxxxxx",
        hat: "..x...x...x...x.",
      }),
      "perc-1": percFull,
      "poly-1": pad("b"),
      "synth-1": leadD,
    }),
    /* 11 outro */ pattern({ "drums-1": hats, "bass-1": pulse, "poly-1": pad("c") }),
  ]
  return song({
    bpm: 128,
    fx: { delayTime: "8n.", feedback: 0.4, reverbDecay: 2.8, pingPong: true },
    instances: [
      instance(
        "drums-1",
        "drums",
        { kick: 0.95, snare: 0.6, clap: 0.55, hat: 0.3 },
        { level: 0.85, send: 0.05, mod: mod({ drive: 0.12 }) },
      ),
      instance(
        "perc-1",
        "perc",
        { tomLo: 0.5, tomHi: 0.5, rim: 0.45, cowbell: 0.3, shaker: 0.22, crash: 0.5 },
        { level: 0.5, send: 0.35, pan: -0.3, filter: highpass(700) },
      ),
      instance(
        "bass-1",
        "bass",
        {
          waveform: "sawtooth",
          filterType: "lowpass",
          cutoff: 300,
          resonance: 5,
          envMod: 0.45,
          attack: 0.003,
          decay: 0.16,
          sustain: 0.2,
          release: 0.06,
        },
        {
          level: 0.7,
          send: 0.05,
          key: key(0, "minor", 1),
          mod: mod({ drive: 0.2, lfo1: lfo("cutoff", 0.03, 0.5, "triangle") }),
        },
      ),
      instance(
        "poly-1",
        "poly",
        {
          waveform: "sawtooth",
          filterType: "lowpass",
          cutoff: 1400,
          resonance: 1.5,
          attack: 0.01,
          decay: 0.25,
          sustain: 0.2,
          release: 0.6,
        },
        {
          level: 0.4,
          send: 0.6,
          pan: 0.2,
          key: key(0, "minor", 3),
          mod: mod({ lfo1: lfo("cutoff", 0.12, 0.35, "sine") }),
        },
      ),
      instance(
        "synth-1",
        "synth",
        {
          waveform: "sawtooth",
          filterType: "lowpass",
          cutoff: 1900,
          resonance: 2.5,
          attack: 0.005,
          decay: 0.22,
          sustain: 0.25,
          release: 0.25,
        },
        {
          level: 0.55,
          send: 0.55,
          pan: 0.1,
          key: key(0, "minor", 4),
          mod: mod({
            drive: 0.15,
            random: { target: "pitch", amount: 0.06 },
            lfo1: lfo("pan", 0.3, 0.5, "sine"),
          }),
        },
      ),
    ],
    patterns,
    sections: [
      ["Intro", 8, [0, 0, 1, 1]],
      ["Build", 8, [2, 2, 2, 3]],
      ["Main", 16, [4, 5, 6, 7]],
      ["Break", 8, [8, 9, 8, 10]],
      ["Main", 16, [4, 5, 6, 7]],
      ["Outro", 8, [11]],
    ],
  })
}

// ---------- write ----------

const SONGS = [
  ["sol-solet.json", solSolet],
  ["cargol-treu-banya.json", cargolTreuBanya],
  ["el-gegant-del-pi.json", gegantDelPi],
  ["silenci.json", silenci],
  ["daus.json", daus],
  ["riera.json", riera],
  ["passos.json", passos],
  ["el-teu-cami.json", elTeuCami],
  ["berlin.json", berlin],
  ["nit-de-festa.json", nitDeFesta],
  ["cami-de-sorra.json", camiDeSorra],
  ["torre-de-ferro.json", torreDeFerro],
  ["marea.json", marea],
  ["ferralla.json", ferralla],
  ["carrer-mullat.json", carrerMullat],
  ["cavalls-de-ferro.json", cavallsDeFerro],
  ["cambra-36.json", cambra36],
]

mkdirSync(OUT, { recursive: true })
for (const [file, make] of SONGS) {
  const s = make()
  if (s.patterns.length > 16) throw new Error(`${file}: ${s.patterns.length} patterns`)
  for (const slot of s.chain)
    if (!s.patterns[slot]) throw new Error(`${file}: chain names slot ${slot}`)
  writeFileSync(join(OUT, file), JSON.stringify(s) + "\n")
  console.log(
    `${file}: ${s.bpm} BPM, ${s.chain.length} bars, ${s.instances.length} machines, ${s.patterns.length} patterns`,
  )
}
