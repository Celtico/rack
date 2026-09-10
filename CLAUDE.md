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
   - ✅ Extra — per-unit **finish** (slot-recipe variant that overrides the `rack.panel` / `rack.silkscreen`
     CSS variables on the unit root, tokens under `colors.finish.*`), **fold** (store `folded`, UI-only) and
     **mute** (`mix.mute`, saved; engine keeps level and mute separately) buttons in every `RackUnit` header.
   - ✅ Extra — SONG timeline (`TimelineUnit`, slot recipe registered as `songTimeline` because Chakra's own
     Timeline component owns the `timeline` key): the chain as coloured bar blocks (`colors.pattern.*`),
     click cycles the pattern, × removes, + appends the active one; the sounding bar (`playingBar % length`)
     is outlined with a 16-step progress bar. The old +1…+4 chain buttons are gone from PATTERN.
   - ⏳ Next: the rest of the restyle — wood rails, LCD variants, faders, LED meters. No Reason names,
     logos or layouts.

**The brief is fully implemented.** Anything from here is polish or new scope — confirm with the user first.

Read the skills before touching UI or audio: without the Chakra skill loaded, Chakra UI **v2** API gets
written from memory, and v3 is a different library.

Chakra CLI snippets (`provider`, `color-mode`) live in `src/components/ui/` — that is where the CLI writes
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
- **Banned v2 API:** `extendTheme`, `theme={}` on the provider, Chakra's `useColorMode` (color mode comes from
  `next-themes`/the `ColorModeProvider` snippet), `Stack spacing` (now `gap`), `isDisabled`/`isOpen`/`isChecked`
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
