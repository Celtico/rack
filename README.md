# RACK

A browser-based hardware rack: a drum machine (**DR-4**), a percussion kit (**PERC-6**), a sampler
for your own files (**SMP-8**), an acid bass (**BASS-2**), a mono synth (**MONO-1**), a poly pad
(**POLY-4**), an FM electric piano (**EP-1**), plucked strings (**STR-6**), an FX unit (**FX-2**),
a sixteen-slot pattern bank, a **SONG** timeline that lays the patterns out bar by bar, and a
transport with tempo and swing — built with Tone.js and Chakra UI v3. **Add unit** puts any number
of each machine in the rack (two DR-4s, three samplers…), each with its own patterns, mixer strip
and settings. The transport, pattern bank and song timeline share a fixed top panel (each section folds on its own) and the rack starts playing by itself. Every machine can be folded (showing its pattern in miniature; FX-2 shows every level), muted, removed (with
Undo) and dragged into any order; the FX-2 mixer has a fader and LED meter per machine. The
arrangement is remembered by the browser.

Live: https://rack.serverscel.com/ · https://celtico.github.io/rack/

`.github/workflows/pages.yml` builds with the base path Pages reports (`/rack/` on github.io, `/`
with a custom domain) and publishes `dist/` to GitHub Pages on every push to `main` (Settings → Pages → Source: "GitHub Actions", once). Without `BASE_PATH`
the build is served from `/`, as the Docker image does.

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

The rack starts with `public/-rack-song.json` (fetched at load; if it is missing, the built-in groove plays).
**Save** downloads a `rack-song.json` with the machines in the rack, the bank, chain, tempo and
every parameter; **Load** reads one back. Files saved before machines could be duplicated (version
1) still load: each channel the file names becomes the first machine of its kind — nothing else is added. `docs/rack-song.json` is an
example.

SMP-8 samples are stored in the browser (IndexedDB), not in the song file — a song lists each
pad's file name, pitch, decay and level, and expects the same samples to be present.
