# RACK

A browser-based hardware rack: a drum machine (**DR-4**), a percussion kit (**PERC-6**), a sampler
for your own files (**SMP-8**), an acid bass (**BASS-2**), a mono synth (**MONO-1**), a poly pad
(**POLY-4**), an FM electric piano (**EP-1**), plucked strings (**STR-6**), an FX unit (**FX-2**),
a four-slot pattern bank, a **SONG** timeline that lays the patterns out bar by bar, and a
transport with tempo and swing — built with Tone.js and Chakra UI v3. Every unit can be folded and
muted from its header; the FX-2 mixer has a fader and LED meter per module.

Live: https://rack.serverscel.com/

## Stack

Vite · React 19 · TypeScript (strict) · Chakra UI v3 · Tone.js 15 · Zustand · Vitest + Testing
Library · ESLint + Prettier · pnpm

## Commands

```
pnpm install
pnpm dev            # dev server on http://localhost:5173
pnpm build          # typecheck + production build into dist/
pnpm preview        # serve dist/
pnpm lint           # ESLint
pnpm test           # Vitest, single run
pnpm test:watch     # Vitest, watch mode
pnpm format         # Prettier --write
```

## Layout

```
src/audio/    engine.ts (singleton), devices/, scheduler.ts — no React here
src/state/    Zustand store: pattern bank, tempo, params, transport, song save/load
src/ui/       Chakra components: Rack, RackUnit, Knob, StepGrid, Transport, the units
src/theme/    system.ts — tokens, semantic tokens (rack.*), recipes and slot recipes
```

The layering is one-directional: UI calls engine methods; the engine never sees React. The
scheduler reads the pattern from the store on every tick, so edits during playback are heard on
the next step. No React component creates an audio node.

## Deploy

```
docker compose up -d --build     # serves dist/ with nginx on port 7273
```

## Songs

**Save** downloads a `rack-song.json` with the bank, chain, tempo and every parameter;
**Load** reads one back. `docs/rack-song.json` is an example.

SMP-8 samples are stored in the browser (IndexedDB), not in the song file — a song lists each
pad's file name, pitch, decay and level, and expects the same samples to be present.
