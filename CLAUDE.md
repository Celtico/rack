# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

`prompt-claude-code-rack.md` is the project brief (written in Catalan) and the source of truth. It defines a
strict build order:

1. ✅ The two project skills exist (`.claude/skills/chakra-ui/SKILL.md`, `.claude/skills/rack-audio/SKILL.md`).
2. ✅ Scaffold (Prompt 1): theme system, empty `RackUnit`, `Transport` (play/stop, tempo, master), store, tests.
3. Rack modules in phases (Prompt 2) — **stop after each phase for the user to test**.
   - ✅ Phase 1 — engine: master bus (`Gain` → `Compressor` −14 dB/3:1 → `Limiter` −1 dB → destination; the
     master meter reads after the limiter), FX bus (delay → reverb), per-channel sends (`drums`, `synth`),
     `Scheduler` (16-step `Tone.Sequence`, reads `store.getState().pattern` each tick, publishes the step
     via `Draw`). Devices register a `Voice` per drum through `registerVoice()` — none exist yet.
   - ✅ Phase 2 — DR-4: `DrumKit` (`src/audio/devices/drums.ts`; kick `MembraneSynth` into a light
     `Distortion`, snare/clap filtered `NoiseSynth`, hat a `MetalSynth` (808-style FM squares), per-voice level gains) registered as voices in `engine.build()`. `StepGrid`
     (slot recipe, state via `aria-pressed` / `data-accent` / `data-playing`) + `DrumMachine` unit.
   - ✅ Phase 3 — MONO-1: `MonoVoice` (`src/audio/devices/monoSynth.ts`, a `Tone.MonoSynth`; cutoff is
     `filterEnvelope.baseFrequency` because the envelope owns `filter.frequency`). Sound: every saw/square/
     triangle oscillator in the rack is a "fat" unison (`fatOscillator()` in `devices/oscillators.ts` — MONO-1
     3×18 cents, BASS-2 2×7 into a small `Distortion`, POLY-4 3×24 into a 24 dB lowpass and a slow `Chorus`);
     sine stays single. Set waveforms through `synth.set({ oscillator })`, not `oscillator.type`, so count and
     spread survive the switch. Pattern gained
     `synth: (rowIndex | null)[16]` over `SYNTH_NOTES` (C2–C3) — monophonic by construction via
     `toggleSynthNote`. `MonoSynth` unit reuses `StepGrid` with one row per note; `Knob` gained `scale="log"`.
   - ✅ Phase 4 — FX-2: `mix` (level + send per channel, `src/state/channels.ts`) and `fx` (delay time in
     transport notation, feedback, reverb decay) in the store; `engine.setFxParam()` ramps the Signals and
     **debounces** `reverb.decay` (Tone re-renders the IR). `FxUnit` UI. Master stays on the Transport.
   - ✅ Phase 5 — bank of 4, since raised to 16 (`PATTERN_COUNT`; shorter banks in old files are `padBank`ed on load; slots 5–16
     use half-tone colours generated between the previous ones, `slotColours` in the timeline recipe) (`patterns` + `activePattern`, `selectPattern()` for the one on screen), `chain`
     walked one slot per bar by the scheduler's bar counter (`resolvePlayingPattern`, `src/state/patterns.ts`),
     `playingPattern` published via Draw; while a chain plays, `setPlayhead` also moves `activePattern` to the sounding slot so open
     grids (and the bank) follow the song. Picking a bank slot sets `followSong: false` — that slot loops (the
     engine resolves with an empty chain) until "Play song" (`setFollowSong(true)`) or a bar is appended. Save/load: `toSong` / `parseSong` (`src/state/song.ts`, strict
     shape, clamped ranges; lenient where hand-written files fail: missing `fx` defaults, a missing `chain`
     becomes every slot with content in order and a missing `activePattern` the first of them, row indices
     past an instrument's eight rows are pulled to the last row, and `KIND_ALIASES` maps names like `pad`, `piano`,
     `guitar`, `kit`, `lead` to the real kinds for instances and tracks — chatbot-made songs do all of it) + `engine.syncFromStore()` after a load. `PatternBank` unit; toaster snippet.

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
   - ✅ Extra — folding animates: `Fold` (`src/ui/Fold.tsx`, Chakra `Collapsible` controlled by `open`, no
     trigger — the header buttons fold) wraps every `RackUnit` body and `MasterSection`; content stays mounted,
     `hidden` once closed. The content bleeds `1.5` so focus rings at the edges survive `overflow: hidden`.
     The whole header (and a `MasterSection`'s title row) folds on click — `foldOnClick` (`src/ui/foldOnClick.ts`)
     ignores clicks that land on the header's own buttons, so mute/grip/chevron keep working alone.
   - ✅ Extra — per-unit **finish** (vivid dark tints of one lightness with the graphite ink; the root is `finish.graphite.panel` with a soft radial glow of the tint in the top-left corner over
     `finish.graphite.panel`; slot-recipe variant that overrides the `rack.panel` / `rack.silkscreen`
     CSS variables on the unit root, tokens under `colors.finish.*`), **fold** (store `folded`, UI-only) and
     **mute** (`mix.mute`, saved; engine keeps level and mute separately) buttons in every `RackUnit` header.
   - ✅ Extra — SONG timeline (`TimelineUnit`, slot recipe registered as `songTimeline` because Chakra's own
     Timeline component owns the `timeline` key): the chain as grey bar blocks — only the sounding bar lights in its pattern colour (`colors.pattern.*`),
     click cycles the pattern, × removes, + appends the active one; the sounding bar (`playingBar % length`)
     is outlined with a 16-step progress bar. The old +1…+4 chain buttons are gone from PATTERN. A song holds
     up to `MAX_CHAIN` = 128 bars; the bars wrap into rows (`bar` slot: number above block), no sideways scroll.
   - ✅ Extra — restyle: wooden `rail` recipe either side of the rack (holes every 44px), `LevelMeter`
     (engine owns a `Tone.Meter` per channel + master, `engine.getLevels()` read from a rAF loop, 8 LED
     segments 6 dB apart via `meterScale.ts`), vertical `Fader`s on the FX-2 strips (Chakra `Slider`),
     `Display` `tone` variant (amber/red/green/blue). Step grids size cells with
     `minmax(1.25rem, 2.25rem)` and `justifyContent: start`, so they fit before they scroll; rack is `8xl`.

   - ✅ Extra — rack layout (`src/state/layout.ts`, zustand `persist` in localStorage as `rack-layout`,
     UI-only): drag-and-drop reorder (HTML5 DnD armed by the grip button, `moveWithin()` pure); the grip is
     also a `Menu` (Move up / Move down / Remove) since touch screens have no HTML5 drag — the grip is a single
     line of dots (`LuEllipsisVertical`) and the menu is the only way to remove (instances go with an Undo toast,
     FX-2 is hidden; there is no × in the header any more) / "Add unit" drawer (`src/ui/AddUnitDrawer.tsx`,
     a Chakra `Drawer` like the song library: one row per kind with its accent icon, count in the rack and an
     add button, under it one row per existing instance — tap to `scrollToUnit` (panels carry `id="unit-<id>"`),
     trash to remove — then "Put back" rows for hidden units; `removeInstanceWithUndo` in
     `src/ui/removeInstance.ts` is shared with the grip menu), Fold all / Unfold all
     (`setFolded`). Folded instances show a `MiniGrid` on the right of the header: the instance's pattern in
     miniature (one dot per step, playhead column lit; `miniGrid` slot recipe). Fixed units pass their own
     `RackUnit.preview`: FX-2 one meter per machine (`LevelMeter orientation="horizontal"`). The bank's slots reuse the
     timeline `block` — grey, lit while sounding, `data-active` outline on the slot being edited. TRANSPORT is fixed.

   - ✅ Extra — startup: `App` calls `loadDefaultSong()` (`src/ui/defaultSong.ts`) once on mount. It loads
     **an empty rack** (`emptyRack()`: no machines at all, no chain, 120 BPM — units come from "Add unit"), folded and
     **stopped** — no factory song, and not the last saved one either: songs are chosen on purpose from the
     Songs drawer, where the factory songs wait under "Demos". `autoplay(start)` only starts the clock when
     `start` is true (a loaded song); it always installs the audio-resume handlers. The coded starter groove
     (`starterTrack`) is now only the store's pre-load state.
   - ✅ Extra — top panel: `MasterUnit` is `RackUnit id="CLOCK" model="TRANSPORT" pinned` — it folds from its
     own header (no inner section row any more), has no grip, is never moved or removed, and is not in the
     reorderable stack (`MASTER_SECTIONS` in the store: CLOCK, PATTERN, SONG; Fold all / Unfold all include
     them; PATTERN and SONG start folded). `Transport` is two rows on a phone and, from `md`, one row spread
     evenly across the panel (`display: contents` dissolves the rows and groups). The bank
     and the song are two **sticky** panels right under it: `PinnedUnits` (`src/ui/PinnedUnits.tsx`, one
     `position: sticky; top: 0` box holding `RackUnit id="PATTERN"` BANK (finish `green`) and `RackUnit id="SONG"`
     SONG (finish `pink`), both `pinned`: they fold, and swap places with each other by grip, drag or menu
     (`layout.pinnedOrder`, persisted; `moveUnit`/`nudgeUnit` route pinned ids there and never into the stack;
     a pinned id outside `PINNED_UNITS`, like the transport, gets no grip), and can be hidden like FX-2
     (`HIDEABLE_UNITS` = FX-2 + the pinned ids, `layout.hidden`; "Remove from rack" in the grip menu, back via
     "Add unit → Put back"; the transport alone can never leave)), so the slots and the bars stay in view while the rack scrolls; fold either to a
     thin bar when it is in the way. `FIXED_UNITS` is now just `FX-2`; `rack-layout` persist version 3 drops the old ids.
     `autoplay()` (`src/ui/transportControl.ts`) starts the clock after the factory song loads and re-tries on the
     first pointer/key, since browsers keep audio suspended until a gesture. `installWakeLock()`
     (`src/ui/wakeLock.ts`, also from `App`) holds a Screen Wake Lock while `playing`, re-taken when the tab comes
     back, so a phone does not dim and suspend the audio. `installBackgroundAudio()` (`src/ui/backgroundAudio.ts`,
     also from `App`) plays a looped half-second silent WAV through an `<audio>` element while `playing` and
     publishes Media Session metadata and play/pause/stop handlers: a real media element is what keeps iOS and
     Android from suspending the audio session (and the Web Audio graph) when the screen locks or another app
     comes up, and it puts the rack on the lock screen.
   - ✅ Extra — **PWA**: `vite-plugin-pwa` in `vite.config.ts` (`registerType: "autoUpdate"`, manifest name RACK,
     standalone, icons in `public/icons/` rendered from `favicon.svg`; the app shell is precached, `songs/`,
     `samples/`, `midi/` and the factory song are cached stale-while-revalidate as `rack-content`). `index.html`
     carries the iOS home-screen metas and `viewport-fit=cover`. `sw.js` and the manifest must be served
     without long caching.
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
     their own components. Meters share one rAF loop (`src/ui/levels.ts`, `subscribeLevels`) and light their
     segments by flipping `data-lit` on the DOM from that loop — no React render per bounce (a meter re-rendering
     nine Chakra elements 30×/s was the biggest running cost on a phone). Step cells only transition
     `background-color`: animating the playhead's border/shadow repainted the grid for several frames per step.
     Measured on the production build at phone width, playing, unfolded: main-thread busy time went from
     1.55 s to 1.12 s per 5 s after these two changes; `contain: paint` / `will-change` on meters and grids
     gained nothing. Recipe results are `useMemo`d so memoised children keep the same `css` object.

   - ✅ Extra — **no screws** anywhere any more (the `screw` slot is gone from the `rackUnit` recipe); every
     panel has `px: 4` and the header/body sit flush inside it.
   - ✅ Extra — **phone layout** (below `md`): no rails or frame padding, panels square and edge to edge; the toolbar is a full-width strip in `rack.toolbar` grey (metal.600, a shade
     lighter than the panels; 56px buttons, `sm` text, hairlines between them, 50px / safe-area padding on top — the
     Songs and Add unit drawers' headers (and their close buttons) get the same top clearance —
     `toolbarButton` / `toolbarIconButton` in `src/ui/toolbar.ts`): one fold/unfold-all toggle, then Add unit and Songs (the library drawer,
     which also holds Load — `LoadSongButton`, .json or .mid — under the save form) — the bank only keeps the copy row (active
     slot → Copy → next slot). The CLOCK is two rows (`Transport`): run button + Tempo/Swing/Master knobs, then
     BEAT LEDs + BPM/STEP displays + OUT meter; side by side from `md`. The bank is a `repeat(8, minmax(0, 4rem))` grid (16 in a row from `xl`);
     song bars are `12` wide instead of `16` (`BAR_WIDTH` in the timeline recipe). Touch screens
     (`@media (pointer: coarse)` inside the recipes — no custom condition, Chakra's typegen would be needed for
     `_coarse`) get 28px-minimum step cells and 32px header buttons/grip. `vite.config.ts` has `server.host: true`
     so a phone on the LAN can open the dev server.

   - ✅ Extra — **drag-painting** on every `StepGrid`: a mouse/pen press toggles a cell and sets the stroke's
     state; dragging paints that state on every cell passed over (`document.elementFromPoint` on the grid's
     pointer events, state read off `aria-pressed`, pointer capture on the grid, `onClickCapture` swallows the
     click that follows a pointer press so it does not toggle back; keyboard clicks have `detail === 0` and
     pass). Touch keeps scrolling and tapping — no painting.
   - ✅ Extra — the Songs drawer lists songs as **record sleeves** (`Cover`, `src/ui/Cover.tsx`): a flat dark
     grey square (`metal.800`) with the name printed on it, a play/stop mark in the corner, an amber frame on the
     song the rack holds; the sleeve is the play/stop button. Under it the name, the meta line and a `⋯` `Menu`
     (Download, Rename, Move to folder as a nested `Menu.TriggerItem` menu reusing `FolderMenuItems` from
     `FolderPicker`, Delete); rename and "New folder…" turn that line into an inline field. Grids of
     `minmax(7.5rem, 1fr)` (`COVER_GRID`). Playing a song or a folder no longer closes the drawer.
   - ✅ Extra — **play a folder** (`src/ui/playlist.ts`): the play button on a folder row plays its songs one
     after another, round and round; each song runs its whole chain (at least `MIN_BARS` = 8 bars), then the
     next is loaded via stop → load → start (the bar counter restarts, so "bar N has begun" in a
     `useRackStore.subscribe` is the cue). Stopping the clock or playing anything else ends the run;
     `usePlaylistStore.folder` is what the drawer shows.
   - ✅ Extra — **Tone leak patch** (`src/audio/tonePatches.ts`, installed by `engine.build()`): Tone 15.1's
     `Oscillator` creates a native OscillatorNode per note and wires its `frequency`/`detune` signals into it
     but never unwires them, and standardized-audio-context keeps that connection on the (long-lived) signal
     side, so every finished node stayed reachable — ~100 oscillators/s with a hat on every sixteenth, the
     iPhone died after minutes. The patch wraps `Oscillator.prototype._start` and detaches both signals from the
     node in its `onended`. Verified with `Runtime.queryObjects` after forced GC: flat instead of thousands.

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
