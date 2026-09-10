# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

`prompt-claude-code-rack.md` is the project brief (written in Catalan) and the source of truth. It defines a
strict build order:

1. ✅ The two project skills exist (`.claude/skills/chakra-ui/SKILL.md`, `.claude/skills/rack-audio/SKILL.md`).
2. ✅ Scaffold (Prompt 1): theme system, empty `RackUnit`, `Transport` (play/stop, tempo, master), store, tests.
3. Rack modules in phases (Prompt 2) — **stop after each phase for the user to test**.
   - ✅ Phase 1 — engine: master bus, FX bus (delay → reverb), per-channel sends (`drums`, `synth`),
     `Scheduler` (16-step `Tone.Sequence`, reads `store.getState().pattern` each tick, publishes the step
     via `Draw`). Devices register a `Voice` per drum through `registerVoice()` — none exist yet.
   - ✅ Phase 2 — DR-4: `DrumKit` (`src/audio/devices/drums.ts`; kick `MembraneSynth`, snare/clap/hat
     filtered `NoiseSynth`, per-voice level gains) registered as voices in `engine.build()`. `StepGrid`
     (slot recipe, state via `aria-pressed` / `data-accent` / `data-playing`) + `DrumMachine` unit.
   - ✅ Phase 3 — MONO-1: `MonoVoice` (`src/audio/devices/monoSynth.ts`, a `Tone.MonoSynth`; cutoff is
     `filterEnvelope.baseFrequency` because the envelope owns `filter.frequency`). Pattern gained
     `synth: (rowIndex | null)[16]` over `SYNTH_NOTES` (C2–C3) — monophonic by construction via
     `toggleSynthNote`. `MonoSynth` unit reuses `StepGrid` with one row per note; `Knob` gained `scale="log"`.
   - ✅ Phase 4 — FX-2: `mix` (level + send per channel, `src/state/channels.ts`) and `fx` (delay time in
     transport notation, feedback, reverb decay) in the store; `engine.setFxParam()` ramps the Signals and
     **debounces** `reverb.decay` (Tone re-renders the IR). `FxUnit` UI. Master stays on the Transport.
   - ✅ Phase 5 — bank of 4 (`patterns` + `activePattern`, `selectPattern()` for the one on screen), `chain`
     walked one slot per bar by the scheduler's bar counter (`resolvePlayingPattern`, `src/state/patterns.ts`),
     `playingPattern` published via Draw. Save/load: `toSong` / `parseSong` (`src/state/song.ts`, strict
     shape, clamped ranges) + `engine.syncFromStore()` after a load. `PatternBank` unit; toaster snippet.

   - ✅ Extra — swing: `swingOffset()` in the scheduler delays odd steps up to ⅓ of a sixteenth (store
     `swing` 0–1, SWING knob on the Transport, saved in the song; older song files default to 0).

   - ✅ Extra — PERC-6 (`PercKit`, `src/audio/devices/perc.ts`: toms, rim, cowbell, shaker, crash on
     channel `perc`). Kits share the `Kit` interface, `kitRows()` and the generic `KitUnit` UI; songs saved
     without a kit/channel load with empty rows and default levels (`parseNumbers` defaults).
   - ✅ Extra — BASS-2 (`BassVoice`, `src/audio/devices/bass.ts`): 303-style `MonoSynth`; per-step accent
     (velocity + wider filter sweep) and slide (gate held into the next step, `setNote` glide, no re-attack).
     The scheduler calls `triggerBass` on _every_ step, rests included, so a held slide can release.
   - ✅ Extra — polyphonic instruments sharing `Pattern.poly[instrument]: number[][16]`, `togglePolyNote`,
     `PolyGrid` and `PolyInstrument` (`src/audio/devices/polySynths.ts`): POLY-4 (`PolySynth<Synth>` →
     lowpass, ADSR), EP-1 (`PolySynth<FMSynth>`, tone/bright/decay/release), STR-6 (six `PluckSynth`
     round-robin — `PluckSynth` is not `Monophonic`, so `PolySynth` cannot host it).
   - ✅ Extra — SMP-8 (`SamplerKit`, `src/audio/devices/sampler.ts`): eight `Player`s; sample bytes live in
     IndexedDB (`src/audio/sampleStore.ts`), the song keeps only name/pitch/decay/level per pad.
     `engine.importSample()` persists first, decodes if the graph exists; `build()` reloads from storage.
   - ✅ Extra — per-unit **finish** (vivid dark tints of one lightness with the graphite ink; the root is `finish.graphite.panel` with a soft radial glow of the tint in the top-left corner over
     `finish.graphite.panel`; slot-recipe variant that overrides the `rack.panel` / `rack.silkscreen`
     CSS variables on the unit root, tokens under `colors.finish.*`), **fold** (store `folded`, UI-only) and
     **mute** (`mix.mute`, saved; engine keeps level and mute separately) buttons in every `RackUnit` header.
   - ✅ Extra — SONG timeline (`TimelineUnit`, slot recipe registered as `songTimeline` because Chakra's own
     Timeline component owns the `timeline` key): the chain as grey bar blocks — only the sounding bar lights in its pattern colour (`colors.pattern.*`),
     click cycles the pattern, × removes, + appends the active one; the sounding bar (`playingBar % length`)
     is outlined with a 16-step progress bar. The old +1…+4 chain buttons are gone from PATTERN.
   - ✅ Extra — restyle: wooden `rail` recipe either side of the rack (holes every 44px), `LevelMeter`
     (engine owns a `Tone.Meter` per channel + master, `engine.getLevels()` read from a rAF loop, 8 LED
     segments 6 dB apart via `meterScale.ts`), vertical `Fader`s on the FX-2 strips (Chakra `Slider`),
     `Display` `tone` variant (amber/red/green/blue). Step grids size cells with
     `minmax(1.25rem, 2.25rem)` and `justifyContent: start`, so they fit before they scroll; rack is `8xl`.

   - ✅ Extra — rack layout (`src/state/layout.ts`, zustand `persist` in localStorage as `rack-layout`,
     UI-only): drag-and-drop reorder (HTML5 DnD armed by the grip button, `moveWithin()` pure), arrow-key
     nudge, remove (× — instances are removed with an Undo toast, PATTERN/SONG/FX-2 are hidden) / "Add
     unit" menu (new machine of any kind, or put a hidden fixed unit back), Fold all / Unfold all
     (`setFolded`). Folded instances show a `MiniGrid` on the right of the header: the instance's pattern in
     miniature (one dot per step, playhead column lit; `miniGrid` slot recipe). Fixed units pass their own
     `RackUnit.preview`: TRANSPORT the master meter, FX-2 one meter per machine (`LevelMeter orientation="horizontal"`),
     SONG the chain and PATTERN the bank as small squares (`songTimeline` `mini` slots; the bank's big slots reuse
     `block` too — grey, lit while sounding, `data-active` outline on the slot being edited). TRANSPORT is fixed.

   - ✅ Extra — factory song: `App` calls `loadDefaultSong()` (`src/ui/defaultSong.ts`) once on mount, which
     fetches `public/-rack-song.json`, `loadSong`s it and `engine.syncFromStore()`s; a missing/broken file leaves
     the coded starter groove (`starterTrack`) in place. The rack starts with every unit folded
     (`foldedAll`, also re-applied after the factory song loads); a user-loaded song unfolds its machines.
   - ✅ Extra — **instances** (any number of each machine, e.g. two DR-4s). `src/state/instances.ts`:
     `Instance { id: "${kind}-${n}", kind, params, level, send, mute }` (discriminated by `Kind`, one
     `KindParams` per kind, `clampParams`, `instanceLabel` → "DR-4" or "DR-4 #2"). `Pattern.tracks` is
     keyed by instance id (`Track` union per kind; `emptyTrack` / `starterTrack`, `toggleKitStep` /
     `toggleTrackNote` / `toggleBassFlag`, `rowsOf()` for string-keyed kit rows). Store actions take the
     instance id (`toggleStep`, `toggleNote`, `toggleFlag`, `setInstanceParams/Level/Send/Mute`,
     `addInstance`, `removeInstance` → `RemovedInstance` for `restoreInstance` — the × button's Undo toast).
     Engine keeps a `Strip` (input, send, meter, device) per id; `addInstance` / `removeInstance` build
     and dispose devices live; `syncFromStore()` reconciles after a load. Sample keys are `${id}:${pad}`.
     `Rack` renders `layout.order` (fixed units + instance ids, `syncUnits`); its "Add unit" menu dims kinds absent
     from the rack, shows ×count for present ones and colours icons by finish. `InstanceUnit` picks the panel
     by kind; per-kind finish/icon/labels live in `src/ui/unitMeta.tsx`. Song is **version 2**
     (`instances` + `patterns[].tracks`); `src/state/songV1.ts` lifts v1 files (each channel the file names → `${kind}-1`; unnamed ones are not created).
     Zustand selectors must return stored values — a `.map()` in a selector loops React (`FxUnit`).
   - ✅ Extra — playhead performance: nothing but the moving parts subscribes to `currentStep`. `StepGrid` reads
     it itself and its `StepCell`s are `memo`ised (two cells per row re-render per step); `MiniGrid` draws a
     separate `MiniPlayhead` bar over memoised cells; Transport's `StepReadout` and SONG's `BarProgress` are
     their own components. Meters share one rAF loop (`src/ui/levels.ts`, `subscribeLevels`). Recipe results
     are `useMemo`d so memoised children keep the same `css` object.

**All extras above are done.** Other ideas: LCD readouts per synth, drag-reorder on the timeline, per-step
velocity on the kits.

**The brief is fully implemented.** Anything from here is polish or new scope — confirm with the user first.

Read the skills before touching UI or audio: without the Chakra skill loaded, Chakra UI **v2** API gets
written from memory, and v3 is a different library.

Chakra CLI snippets (`provider`, `toaster`) live in `src/components/ui/` — that is where the CLI writes
them; they are generated code, not ours.

## What this project is

A web audio "rack" — a browser-based hardware-rack emulation with a drum machine (DR-4), a mono synth
(MONO-1), an FX unit (FX-2) and a step sequencer/transport.

## Stack

Vite · React 19 · TypeScript (strict) · Chakra UI v3 · Tone.js · Zustand · Vitest + Testing Library ·
ESLint + Prettier · **pnpm**

## Commands

```
pnpm dev            # Vite dev server (http://localhost:5173)
pnpm build          # tsc -b && vite build
pnpm lint           # ESLint
pnpm test           # Vitest, single run
pnpm test <path>    # single test file
pnpm test -t "name" # single test by name
pnpm test:watch     # Vitest, watch mode
pnpm format         # Prettier --write
```

Deploy: `docker compose up -d --build` (nginx on host port 7273). Production: https://rack.serverscel.com/

## Architecture

```
src/audio/   engine.ts (singleton), devices/, scheduler.ts  — ZERO React imports here
src/state/   Zustand store: pattern, tempo, params, transport
src/ui/      Chakra components (Rack, RackUnit, Knob, StepGrid, Transport)
src/theme/   system.ts — tokens, semantic tokens, recipes
```

The layering rule is one-directional: UI calls engine methods; the engine has no knowledge of React.

### Audio engine rules (see `.claude/skills/rack-audio/SKILL.md` once created)

- `engine.build()` is idempotent, runs behind a user gesture (`Tone.start()`), always returns the same instance.
- **No React component may create audio nodes.** No `useEffect` that instantiates Tone nodes.
- The scheduler reads the pattern from a ref (or `store.getState()`), never from a closure-captured React value —
  otherwise the sequence plays a stale pattern.
- Everything that sounds uses the `time` argument from the Tone callback. No `Date.now()`, no React timers.
- UI updates from the audio callback go through `Draw.schedule`.
- Parameter changes use `rampTo` (20–50 ms) to avoid clicks. Nodes are created once; recreating one means
  `dispose()` on the old.
- Tone v15: `Tone.getTransport()` / `Tone.getDraw()`, not `Tone.Transport` — check the installed version.

### UI rules (see `.claude/skills/chakra-ui/SKILL.md` once created)

All UI goes through Chakra. No loose CSS files, no styled-components.

- Theme via `createSystem(defaultConfig, defineConfig({...}))`, injected as `<ChakraProvider value={system}>`.
  Tokens always carry `{ value: ... }`.
- The rack look (dark metallic panels, amber displays, small light silkscreen) lives in **semantic tokens**
  (`rack.panel`, `rack.screw`, `rack.led`, `rack.step.on`…), not hex values scattered through components.
- Variants go in `defineRecipe` / `defineSlotRecipe` in the theme — a slot recipe for `RackUnit`
  (panel + header + body + screws), a recipe for `Knob` — not conditional styles in JSX.
- Compound components use named parts (`Dialog.Root` / `Dialog.Trigger` / `Dialog.Content`, same for Select,
  Menu, Popover, Accordion, Slider, Field, Tabs). Install snippets with `npx @chakra-ui/cli snippet add <name>`
  rather than reimplementing them.
- **Banned v2 API:** `extendTheme`, `theme={}` on the provider, Chakra's `useColorMode` (the rack is
  always dark: `index.html` carries `class="dark"`, there is no colour-mode provider), `Stack spacing` (now `gap`), `isDisabled`/`isOpen`/`isChecked`
  (now `disabled`/`open`/`checked`), flat `Modal`/`Drawer`/`FormControl` (now `Dialog.*`/`Field.*`),
  `@chakra-ui/icons` (use `react-icons` or own SVGs), arbitrary pixel values instead of space tokens.
- When unsure, check https://chakra-ui.com/llms.txt and `npm ls @chakra-ui/react` — do not trust remembered examples.

## Cross-cutting requirements

- `Knob` is a hand-built accessible control: `role="slider"`, ARIA value props, arrow-key handling,
  pointer events with capture, `touch-action: none`, visible focus via `_focusVisible`.
- Responsive down to 360 px. The step grid may scroll horizontally; the controls may not.
- Respect `prefers-reduced-motion`.
- Tests to keep green: the scheduler fires the correct steps under a mocked transport, and store toggles
  apply without mutation.
