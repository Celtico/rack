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
     lowpass, ADSR), EP-1 (`PolySynth<FMSynth>`, tone/bright/decay/release; `maxPolyphony` 16 and an `8n` hold — Tone gives
     every struck note a fresh voice and frees it only once silent, so 3-note chords every eighth with a
     long decay overran the old limit of 8 and dropped notes, heard as the part cutting out; POLY-4 has 12), STR-6 (six `PluckSynth`
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
     click cycles the pattern, a digit typed on a focused bar picks the pattern by number (two quick digits
     join into 10–16: `typeSlotDigit` in `src/ui/typeSlot.ts`, pure, `DIGIT_JOIN_MS` = 800), × removes, + appends the active one; the sounding bar (`playingBar % length`)
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
     (`setFolded`). Folded instances show, on the right of the header, a `MiniGrid`: the instance's
     pattern in miniature as an LED matrix on a small display (3 px round dots, on = `rack.led.on` with the
     `stepOn` glow; `miniGrid` slot recipe; the playhead arithmetic in `MiniGrid.tsx` includes the 4 px
     padding) — no meter: the matrix shows what plays. Folded BANK shows `MiniBank` (16 slot LEDs: `data-dim`
     = has a pattern, `data-active` = on screen, `data-on` = sounding) and folded SONG `MiniSong` (one LED per
     bar of the chain, 16 to a row, the sounding one lit), both on the `miniGrid` recipe. The folded transport
     shows its run switch (`RunButton`, `src/ui/RunButton.tsx`, shared with the `Transport` body; header
     buttons never fold the panel, `foldOnClick`) and, with it, FX-2 too, `LevelMeter size="sm" orientation="horizontal"` — a row of 3 px lit dots (`meter` recipe
     compound variant) — on phones too (the user wants every signal indicator kept when folded). Fixed units pass their own
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
     and the song are two panels right under it (they used to be sticky; the user asked for that to go, so
     they scroll with the rack): `PinnedUnits` (`src/ui/PinnedUnits.tsx`, one
     box holding `RackUnit id="PATTERN"` BANK (finish `green`) and `RackUnit id="SONG"`
     SONG (finish `pink`), both `pinned`: they fold, and swap places with each other by grip, drag or menu
     (`layout.pinnedOrder`, persisted; `moveUnit`/`nudgeUnit` route pinned ids there and never into the stack;
     a pinned id outside `PINNED_UNITS`, like the transport, gets no grip), and can be hidden like FX-2
     (`HIDEABLE_UNITS` = FX-2 + the pinned ids, `layout.hidden`; "Remove from rack" in the grip menu, back via
     "Add unit → Put back"; the transport (`TRANSPORT_UNIT` = CLOCK) is hideable too — its grip only holds
     "Remove from rack", it never moves. A fresh browser shows every panel (`hidden` defaults to `[]`; an
     all-hidden first visit was tried and dropped); the persist `merge` returns `current` untouched when
     nothing is stored)); fold either to a thin bar when it is in the way. **An empty rack shows the demos**: `DemoShelf` (`src/ui/DemoShelf.tsx`, a `rackUnit`-styled
     section of the built-in songs as `SongCover` sleeves — `COVER_GRID` / `songLength` live in
     `src/ui/coverGrid.ts`, shared with the Songs panel) renders only when nothing is visible at all (no instance,
     transport, bank, song or FX-2 — someone took everything out); playing one loads its machines, puts back
     every hidden panel (`showAll()`) and the shelf goes. `FIXED_UNITS` is now just `FX-2`; `rack-layout` persist version 3 drops the old ids.
     `autoplay()` (`src/ui/transportControl.ts`) starts the clock after the factory song loads and re-tries on the
     first pointer/key, since browsers keep audio suspended until a gesture. `installWakeLock()`
     (`src/ui/wakeLock.ts`, also from `App`) holds a Screen Wake Lock while `playing`, re-taken when the tab comes
     back, so a phone does not dim and suspend the audio. `installBackgroundAudio()` (`src/ui/backgroundAudio.ts`,
     also from `App`) plays a looped half-second silent WAV through an `<audio>` element while `playing` and
     publishes Media Session metadata and play/pause/stop handlers: a real media element is what keeps iOS and
     Android from suspending the audio session (and the Web Audio graph) when the screen locks or another app
     comes up, and it puts the rack on the lock screen.
   - ✅ Extra — **PWA**: `vite-plugin-pwa` in `vite.config.ts` (`registerType: "autoUpdate"`, manifest name RACK,
     standalone, icons in `public/icons/` rendered from `favicon.svg` (the user's own logo, from `~/Desktop/logo.svg`: three black tiles —
     top-left, bottom-left, top-right — on an amber angular sweep: the Figma export shades it with a
     `foreignObject` conic-gradient that no image context renders, so `favicon.svg` rebuilds it as a fan of
     180 wedges (`#FFAA00` at the bottom, fading clockwise into the dark ground `#121314`); the tile is rounded by
     a clipPath `rx="300"`, and the full-bleed variants are the same SVG with the radius stripped, filling
     the square — the tiles sit inside the maskable safe zone as drawn) by `scripts/render-icons.sh` — headless Chrome shots at 512
     and `sips` scales down; the Apple and maskable icons are full-bleed with the panel shrunk inside; the app shell is precached, `songs/`,
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
     `Rack` renders `layout.order` (fixed units + instance ids, `syncUnits`); its "Add unit" panel shows ×count for kinds present in the rack
     on a grey row (`data-present`, `metal.700`) and colours icons by finish (rows are never dimmed). `InstanceUnit` picks the panel
     by kind; per-kind finish/icon/labels live in `src/ui/unitMeta.tsx`. Song is **version 2**
     (`instances` + `patterns[].tracks`); `src/state/songV1.ts` lifts v1 files (each channel the file names → `${kind}-1`; unnamed ones are not created).
     Zustand selectors must return stored values — a `.map()` in a selector loops React (`FxUnit`).
   - ✅ Extra — playhead performance: nothing but the moving parts subscribes to `currentStep`. `StepGrid` no
     longer renders for a step at all: a store subscription in an effect flips `data-playing` on the cells of
     the old and new column on the DOM (like the meters); `StepCell` is `memo`ised and gets one stable
     `onToggle` (a ref inside `StepGrid`), and each unit's grid is its own component owning the track
     subscription (`KitGrid` / `SynthGrid` / `BassGrid` in `src/ui/TrackGrids.tsx`, `PolyGrid`), so a bar
     change re-renders grids, not units. Measured with Chrome long tasks while "Open Road" played, six units
     unfolded: before, a ~70 ms React commit on every sixteenth (934 ms busy per 5 s; with 4× CPU throttling
     the audio lost the beat); after, three ~70 ms tasks per 10 s, one per bar change (218 ms busy per 10 s). `MiniGrid` draws a
     separate `MiniPlayhead` bar over memoised cells; Transport's `StepReadout` and SONG's `BarProgress` are
     their own components. Meters share one rAF loop (`src/ui/levels.ts`, `subscribeLevels`) and light their
     segments by flipping `data-lit` on the DOM from that loop — no React render per bounce (a meter re-rendering
     nine Chakra elements 30×/s was the biggest running cost on a phone). Step cells only transition
     `background-color`: animating the playhead's border/shadow repainted the grid for several frames per step.
     Measured on the production build at phone width, playing, unfolded: main-thread busy time went from
     1.55 s to 1.12 s per 5 s after these two changes; `contain: paint` / `will-change` on meters and grids
     gained nothing. Recipe results are `useMemo`d so memoised children keep the same `css` object.

   - ✅ Extra — a folded unit's **thumbnail sits on the left on a phone** (right after the nameplate) and
     **on the right on a desktop** (by the controls): `preview` is `ml: { base: 0, md: auto }` and `controls`
     drop their `ml: auto` from `md` when a preview precedes them.
   - ✅ Extra — a **folded unit on a phone shows no text**: the `model` slot is `display: none` below `md`
     under `[data-folded]` (the title already hides below `sm`); the icon, the thumbnail and the buttons stay.
   - ✅ Extra — the step grids' **sticky row labels** sit on a band of `finish.graphite.panel` — what every
     unit root is painted with — that fades out to the right (`bgImage` on the `label` slot), so
     cells scrolling under them vanish rather than show through; the label stretches to the row's height and
     bleeds a full row gap (`my: -2.5` / `py: 2.5`, the grid pads `py: 2.5` for it — a lit cell's glow reaches
     past its box) so the band is
     unbroken from top to bottom. The `backdropFilter: blur` that did this
     before is gone — a backdrop blur per label was GPU work on a phone.
   - ✅ Extra — **phone CPU pass** (after the modulation work): (1) an LFO's `Tone.LFO` exists only while
     its target reaches something — `Strip.lfos` holds `null` for "off" (two free-running oscillators per
     machine were the biggest new always-on cost); (2) `Fold` and the `ModPanel` collapsible are
     `lazyMount unmountOnExit`, so a folded unit (how the rack opens) mounts no grid, knobs or per-step
     playhead work — grid scroll position is lost on fold, accepted; (3) units subscribe to their **label
     string** (`instanceLabel(inst, s.instances)`) and `RackUnit` to a sibling key string instead of the
     whole `instances` list, so turning a knob on one machine no longer re-renders every unit; (4) the
     levels loop (`subscribeLevels(source, cb)`) reads only the analysers someone shows (`engine.getLevel`);
     (5) `MiniPlayhead` mounts while the clock runs and moves on the DOM (`data-step`, `left`) from a store
     subscription, no render per step. `Strip.id` and `hooksOf(device)` replace the strip-by-identity and
     device-narrowing repeats in the engine.
   - ✅ Extra — **no screws** anywhere any more (the `screw` slot is gone from the `rackUnit` recipe); every
     panel has `px: 4` and the header/body sit flush inside it.
   - ✅ Extra — **phone layout** (below `md`): no rails or frame padding, panels square and edge to edge,
     the toolbar panel alone drops the panel shadow below `md` (its 1 px inset top highlight sat at the
     very top of the screen as a stray bright line; the other panels keep it); the toolbar is the rack's first panel (`ToolbarPanel`, `src/ui/ToolbarPanel.tsx`: a `section` styled with the
     `rackUnit` root, 50px / safe-area padding on top on a phone — the Songs and Add unit drawers' headers (and
     their close buttons) get the same top clearance — the rack's mark (`favicon.svg` as an `img`) at the
     left, then, right-aligned from `md`, `toolbarButton` / `toolbarIconButton` buttons from
     `src/ui/toolbar.ts`: Songs (the library drawer, which also holds Load — `LoadSongButton`, .json or
     .mid — and New song under the save form), Add unit and one fold/unfold-all toggle; on a phone the buttons
     share the width and are 48px tall) — the bank only keeps the copy row (active
     slot → Copy → next slot). The CLOCK is two rows (`Transport`): run button + Tempo/Swing/Master knobs, then
     BEAT LEDs + BPM/STEP displays + OUT meter; side by side from `md`. The bank is a `repeat(8, minmax(0, 4rem))` grid (16 in a row from `xl`);
     song bars are `12` wide instead of `16` (`BAR_WIDTH` in the timeline recipe). Touch screens
     (`@media (pointer: coarse)` inside the recipes — no custom condition, Chakra's typegen would be needed for
     `_coarse`) get 28px-minimum step cells, 32px header buttons/grip, 44px-minimum knobs (`knob` recipe;
     `Knob` also uses a 100px sweep for `pointerType === "touch"` instead of 150, and blocks the iOS callout)
     and a bigger FX-2 `Fader` (128px tall, 8px track, 28×20px thumb, a 40px-wide touch strip on the control). `vite.config.ts` has `server.host: true`
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
     `minmax(7.5rem, 1fr)` (`COVER_GRID`). Folder groups start folded (`openFolders`); saving into a folder opens it. Playing a song or a folder no longer closes the drawer.
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

   - ✅ Extra — **Export WAV / MP3** from a sleeve's `⋯` menu (`src/ui/exportAudio.ts`, one `toaster.promise`
     from "Rendering…" to done). `renderSong()` (`src/audio/render.ts`) builds a **second `AudioEngine`** from the
     song (`clampSong`, the store's own clamps — `parseSong` is lenient and a zero reverb decay throws in
     Tone) in an explicit `Tone.OfflineContext`: **not `Tone.Offline`**, which swaps the global context for
     the whole awaited callback, so a Play / Add unit / load meanwhile would build live nodes into the
     throwaway context; here `setContext(ctx)` wraps one synchronous `build()` + `run(0)` (the `Tone.Sequence` is a node and
     must be born in the offline context — armed outside the window it ticked the live clock and the render
     came out silent) + the scheduled stop, restored in a `finally`; then `ready()` and `ctx.render()`. The engine takes an `EngineSource` (`getState` + optional `onStep`; the
     default reads the store and publishes the playhead) and keeps the context it was built in (`this.transport`,
     never `Tone.getTransport()`: `Tone.Offline` restores the live context _before_ rendering, so anything
     global would hit the live clock). `engine.ready()` awaits the reverb IR and the samplers' stored samples
     (`SamplerKit.ready`, decoded through the player's own context); `run(0)` starts the offline clock, which
     stops a millisecond before the last bar line, and a transport `"stop"` releases a held BASS-2 slide
     (`engine.release(time)`). The chain plays once (a chainless song loops `LOOP_BARS` = 4), plus a tail of
     `reverbDecay + 1` s capped at 8 (`renderPlan`, pure). `encodeWav` (`src/audio/wav.ts`, 16-bit PCM, pure)
     and `encodeMp3` (`src/audio/mp3.ts`, `@breezystack/lamejs` loaded on first use, 192 kbps, yields to the
     event loop between blocks). The scheduler reaches Draw through its sequence's context and skips it when
     `onStep` is absent. **The oscillator leak patch skips offline contexts**: detaching a signal inside an
     offline render silences that node for the whole take (a release under ~0.3 s ended the oscillator
     mid-render — MONO-1, BASS-2, POLY-4 and EP-1 came out silent until this). Sampler pads render whatever
     samples the browser holds under the instance ids, as a load would. A background tab renders slowly (the
     offline clock yields with `setTimeout`, throttled to 1 s).

   - ✅ Extra — **side panels** (`src/ui/SidePanel.tsx`, `src/ui/panels.ts`): Add unit and Songs are one
     `SidePanel` each (`AddUnitPanel` / `SongsPanel`, their toolbar buttons `AddUnitButton` / `SongsButton`),
     driven by `usePanelStore` (`panel: "add" | "songs" | null`, UI-only) so only one is ever open. Below `lg`
     it is the Chakra `Drawer` as before; from `lg` (`useDocked()`) it is an `aside` docked to the rack's
     right — `Rack` is a `Flex` of the `Container` (`flex: 1`) and the two panels — `w="md"`, sticky, full
     viewport height, scrolling on its own, Escape closes it (the inline-field guard still applies). Docked,
     Add unit stays open after adding; the drawer closes as it did. The Songs panel's on-open work (dirty
     check, suggested name) runs from a `usePanelStore.subscribe` rather than an effect.
     Hairlines between rows and sections use `rack.panel.divider` (`metal.700`; `rack.panel.edge` is the
     panel's own colour and shows nothing): under each machine group and put-back row in Add unit, under the
     save form and the Load row, above each folder and above Demos in Songs, and under both panel headers.
     One rhythm around every hairline in Songs: 12 px (`3`) before and after; `COVER_GRID` is `pt 2 / pb 3`,
     folder and Demos sections `pt 3` and `pb 3` while closed; the Demos toggle is a folder-style row; no
     indent on a folder's grid, so all sleeves line up.
     In Add unit every row is one full-width `chakra.button` (icon, name, title; the `+` / undo mark at the
     end is decoration) — pressing anywhere on it adds or puts back; an instance row under a machine carries
     its own hairline starting at its indent (`ml="11"` + `borderTop`).
     Sleeves (`Cover`) print no name any more (it is under the sleeve): they show a vinyl record —
     `VINYL` gradient layers: spindle hole + `amber.500` label, a conic sheen, `repeating-radial-gradient`
     grooves — drawn on a `::after` so the spin (`cover-spin`, while `playing`, off under reduced motion)
     does not fight the centring transform; hover brightens the whole sleeve with a filter.

   - ✅ Extra — **solo** per machine (headphones button next to mute in every instance header): store
     `solo: Record<id, true>` (UI-only, not saved — `loadSong` and `removeInstance` clear it;
     `silencedBySolo(solo, id)` is the pure rule), engine `Strip.solo` + `setInstanceSolo()`, which
     re-applies every strip's gain (`gainOf`: muted → 0, soloed → level, someone else soloed → 0);
     `addInstance` / `removeInstance` / `syncFromStore` keep the others in step. A unit silenced by another's
     solo carries `data-silenced` on its root and its nameplate (`data-part="nameplate"`) and preview fade;
     the buttons stay bright. An offline render ignores solo (`solo: {}` in `renderSong`).
   - ✅ Extra — **New song** row in the Songs panel, under Load ("Start from nothing", `NewSongButton`): `newSong()` in
     `src/ui/defaultSong.ts` stops the clock, loads `emptyRack()`, folds the fixed panels (`foldedAll([])`),
     `showAll()`s hidden panels and drops the library link — the rack as on a first visit — and returns a
     `ReplacedRack` that the toast's Undo hands to `restoreRack()`.

   - ✅ Extra — **Copy to** in every machine's grip menu (a nested `Menu.Root` like the sleeves' "Move to
     folder"): "A new <MODEL>" → `duplicateInstance(id)` (same sound, mix and every pattern of the part,
     inserted right after the source in `instances`; `layout.placeAfter(newId, id)` puts the panel under it,
     the engine gets `addInstance`), or one of the other machines of the kind → `copyInstance(from, to)`
     (params + every pattern's track copied, the target keeps level/send/mute; the engine gets
     `setInstanceParams`). Both are one undo step. Under it, **Copy part / Paste part**: "Copy part
     (pattern N)" puts a deep copy of this machine's track in the pattern on screen into
     `useClipboardStore` (`src/ui/clipboard.ts`, UI-only, with a "DR-4 #2 · pattern 3" label); "Paste part"
     drops it on the pattern on screen and "Paste to pattern ▸ 1…16" on any bank slot — both via
     `store.setTrack(id, slot, track)` (copies again; false across kinds, so paste is disabled unless the
     clipboard holds this kind). One undo step each.
   - ✅ Extra — **filter type** on MONO-1, BASS-2 and POLY-4: `filterType` (`FILTER_TYPES` = lowpass /
     highpass / bandpass / notch in `params.ts`, saved in the song; `parseSong` and the v1 lifter default
     missing ones to `lowpass`). Devices set `filter.type` live (a plain property, no ramp). `FilterControls`
     (`src/ui/FilterControls.tsx`): a `NativeSelect` over a `FilterCurve` — the 24 dB (two-stage) biquad
     response drawn from the Web Audio formulas in `src/ui/filterCurve.ts` (pure; lowpass/highpass read Q in
     dB as the spec does, bandpass/notch as a plain Q; POLY-4 has no resonance knob, its fixed
     `PAD_FILTER_Q` is exported from `polySynths.ts` for the curve). Log axis 20 Hz–20 kHz, +24…−48 dB, the
     cutoff marked. POLY-4 gained a `resonance` param (default 1.2, the fixed Q it had).
   - ✅ Extra — **strip filter** on every other kind (DR-4, PERC-6, SMP-8, EP-1, STR-6 —
     `STRIP_FILTER_KINDS` / `hasStripFilter` in `instances.ts`): `Instance.filter?: FilterParams`
     (`{ type, cutoff, resonance }`, `FILTER_DEFAULT` wide open: lowpass at 20 kHz, Q 0.1; `FILTER_RANGES`
     40 Hz–20 kHz), saved in the song (`parseFilter`, missing → default; the v1 lifter adds it), clamped by
     `clampFilter`. The engine builds a 24 dB `Tone.Filter` between the device and the strip input
     (`Strip.filter`, the device gets it as its output); `setInstanceFilter()` sets the type and ramps
     frequency/Q; `syncFromStore` pushes it. Store `setInstanceFilter(id, patch)` (no-op on a synth), history
     key `filter:<id>:<keys>`. UI: `StripFilterControls` (`FilterControls` + Cutoff/Res knobs, `changeFilter`
     in `unitMeta`) in `KitUnit`, `SamplerUnit` and `PolyUnit` (ep/strings); kit and sampler knobs are the
     default size now (they were `sm`) and kits are `units={3}`. `clampParams` lays the defaults under a synth's
     params, so an in-memory instance from before a field existed (HMR) gets it on its next edit; the curve
     draws an unknown type as lowpass rather than NaN.
   - ✅ Extra — **VID-1 · Video loop** (kind `video`, finish `cyan`, `LuClapperboard`): a video file the
     user loads (kept in the samples store under `${id}:video`, `StoredSample.type` carries its media type)
     whose **soundtrack is the instrument** — a "loop manager with audio filters". Track: a one-voice kit
     (`KIT_KINDS` includes `video`, `VIDEO_VOICES = ["gate"]`) whose 16 steps open the gate for a sixteenth
     each (starts all on; an all-open gate counts as "empty"). Params (`VideoParams`): `videoName`,
     `bars` (`VIDEO_BARS` 1/2/4/8, the loop restarts every N bars), `start` / `end` (seconds; `end` 0 = the file's end — the
     **trimmer** under the screen: a filmstrip of `STRIP_FRAMES` = 16 thumbnails (`buildStrip`, on a scratch
     element, sequential seeks, `drawCover` squares of the middle of each frame) with a two-thumb `Slider`
     over it for the in/out points; a moved handle `previewAt`s that frame while stopped; the loop runs
     from `start`, the 15 fps `tick` sends it back to `start` at `regionEnd(end, duration)`, an `ended`
     event does the same, the element is not `loop`ed; Reset/Random sound keep name, bars, start and end), `filterType` / `cutoff` / `resonance`
     (its own filter, like the synths — not a strip filter), `toCutoff` (the frame's brightness moves the
     cutoff by ±90 % × amount). Audio (`src/audio/devices/videoLoop.ts`, `VideoLoop`): source → gate →
     filter → strip; `attach(element)` turns the UI's `<video>` into a `MediaElementAudioSourceNode` of
     the engine's context (once per element; `engine.attachVideoAudio`), the scheduler's `triggerVideo(id, open, time)` dep
     calls `gateStep(open, time)` **every step** (a muted part sends `false`) and the device moves the gate
     only on a change (4 ms ramp) — per-step open/close left a dip between lit steps and a gap under swing;
     `reset(time)` shuts it on stop, `hitsForStep` skips video tracks, `voice("gate")` is only the
     audition; `setBrightness` (`engine.setVideoBrightness`)
     feeds a signal summed into the filter's frequency. An offline render has no element: VID-1 is silent
     there. UI (`src/ui/videoLoops.ts`, `installVideoLoops()` from `App`): one hidden `<video>` per VID-1
     (`playsInline`, `loop`), fed from storage as a blob URL; plays while the transport runs, rewinds on
     stop, and on step 0 of a bar where `restartsAt(bar, bars)` jumps to 0; while playing a 20×20 canvas
     samples a frame at `VIDEO_FPS` = 15 (`willReadFrequently`), fans it to `subscribeFrames` listeners and
     sends `brightnessOf` (mean luma) to the engine — the 20×20 read is the whole per-frame cost; the
     browser's decoder does the rest, so a small clip (240 px, H.264) is what a phone wants. `VideoUnit`
     (`src/ui/VideoUnit.tsx`): the gate `StepGrid`, name display + Load/Clear (the 20×20 `VideoScreen` canvas was
     dropped at the user's request — the filmstrip is the picture; the 20×20 read still feeds the
     brightness, `subscribeFrames` stays for anything that wants frames), the Loop bars `SegmentGroup`, filter block,
     Cutoff/Res/"Video→cut" knobs, `PartTools`, `ModPanel` (no tune; LFO targets cutoff/level). Random
     sound keeps the file and the loop length. **Converter** (`convertVideo`): the file plays once on a scratch element (audio through an
     `AudioContext` of its own into a `MediaStreamAudioDestinationNode`, picture drawn per frame into a
     canvas of the chosen height, `captureStream`) and a `MediaRecorder` writes the chosen format —
     `videoFormats()` lists what `MediaRecorder.isTypeSupported` accepts (MP4/H.264 on Safari and recent
     Chrome, WebM VP9/VP8 elsewhere), `VIDEO_HEIGHTS` 180–480p; real time; the result replaces the stored
     file (`importVideo`) and is named `<name>-<h>p.<ext>`. **Every upload is converted at once** to
     `uploadFormat()` (MP4 if writable, else the first WebM) at `UPLOAD_HEIGHT` = 240p, with a loading
     toast counting %. There is no manual converter in the panel any more (the user asked for it to go;
     `videoFormats` / `VIDEO_HEIGHTS` / the `region` option remain in `videoLoops.ts` for a caller). This is what makes HEVC `.mov` from a phone usable everywhere and cheap to decode.
   - ✅ Extra — the BANK's **slot buttons head the parts matrix**: `StepGrid` gained an optional
     `header?: (step) => ReactNode` row (one element per column on the same tracks as the cells, an empty
     label cell in front), and `PartsMatrix` renders the sixteen slot blocks there — a pattern's number sits
     over its column; the matrix renders with no rows on an empty rack so the slots stay. The separate
     two-row slot grid and the "copy active → next slot" button are gone (`copyActivePatternTo` stays in the
     store, unused by the UI; Copy part / Paste to pattern cover the need).
   - ✅ Extra — a folded unit's `MiniGrid` goes **dark while the machine is not heard** (`selectSilent`: sits
     the sounding slot out, muted, or silenced by another's solo) — the matrix shows what plays, not the part.
   - ✅ Extra — **parts per pattern**: `Pattern.muted?: string[]` — instance ids that keep their part but
     sit that slot out (`isMutedIn`, `togglePartMute` in `pattern.ts`; `withTrack` now spreads the pattern
     so the list survives edits, `withoutTrack` drops the id). Saved in the song (`parseSong` keeps only known
     ids, a missing list means everyone plays; `toSong` writes it when non-empty). The scheduler skips a muted
     part (`hitsForStep` too) and hands a silenced BASS-2 a rest every step so a held slide lets go. Store
     `togglePartMute(id, slot?)` (the slot on screen by default), one undo step; `copyActivePatternTo`
     carries it. UI: a "Plays / Sits out" toggle in every unit's "Pattern N" group, and in BANK a **parts
     matrix** (`PartsMatrix` in `PatternBank.tsx`): the `StepGrid` reused with one row per machine and one
     column per slot, lit where the part plays — `columnName="pattern"` for the cells' names and
     `playheadOf={(s) => s.playingPattern}` so the sounding slot's column lights (both new optional props).
   - ✅ Extra — **autosave + versions**. `installAutosave()` (`src/ui/autosave.ts`, from `App`): a
     `useRackStore.subscribe` debounced `AUTOSAVE_MS` = 1.5 s after any song-field change (`songChanged`,
     reference checks) writes the song by itself — the library entry the rack holds is `update`d; a song in
     no list (fresh rack with machines, imported file, edited demo) is `save`d as a new entry named by
     `autosaveName` (the file's name, "<Demo> · mine", or "Song N"); an empty rack is left alone. A load is
     never an edit: `loadSong` bumps `store.loads` (UI-only counter) and the subscription resets its
     serialized baseline (also on a `nowPlaying` change). `autosavedAt` in the library store feeds the
     panel's "saved by itself · time" line. Versions: `STORES.versions` (DB version 3), `SongVersion
     { id, entryId, savedAt, song }`; `update(id, song, keep?)` keeps the replaced song as a version unless
     one was kept within `VERSION_GAP_MS` (2 min; `keep` forces it), identical songs write nothing, at most
     `MAX_VERSIONS` = 30 per entry (oldest dropped), versions go with a removed entry; `loadVersions(id)`
     (lazy, into `versions[id]`), `keepVersion(id)` (dedupes), `removeVersion(id)`. The Songs panel's
     "changed since saved" box (Update / Discard) is gone; in its place, for the current entry, a
     "<name> · saved by itself" line with an "N versions" toggle listing time · BPM · length, Load (keeps the
     current state as a version first, then loads it — the autosave then makes it current) and delete.
     Tests fake only the clock (`toFake: ["Date"]`, plus `setTimeout` for the debounce): fake-indexeddb
     delivers through real timers.
   - ✅ Extra — **Random / Reset sound** buttons in every machine's header (dice and rotate icons, next to
     mute/solo, on every screen size — a phone's header fits them): `randomizeInstanceSound(id, rng?)` → `randomizeInstance` in `src/state/random.ts` (pure,
     rng-injected: params by kind — log-uniform for frequencies and times, tasteful sub-ranges for resonance,
     drive 0–0.6, tune ±6; a random strip filter is mostly open, a highpass never above 600 Hz; sampler pads
     are kept; LFOs, random source and macros untouched) and `resetInstanceSound(id)` (params, strip filter
     and the whole mod block back to defaults; patterns stay). One undo step each; `pushSound(id)` in
     `unitMeta` hands the engine params, filter and mod afterwards.
   - ✅ Extra — **Random notes / Random beat** (`PartTools`, `src/ui/PartTools.tsx`, a "Pattern N" group at
     the end of every unit's controls row): `randomizePart(id, rng?)` replaces the machine's track in the
     pattern on screen with `randomTrack(kind, rng)` from `src/state/randomPart.ts` (pure, rng-injected):
     a line that walks the scale rows in small steps and rests off the beat (`randomLine`), an acid line
     with accents and slides only into a following note (`randomBass`), chords of stacked thirds on the
     beat (`randomChords`), a kick-on-the-one / snare-on-the-backbeat groove for DR-4, sparse PERC-6, the
     first two pads busier on SMP-8. One undo step. Beside it a "Filter" group with **Random** / **Reset**:
     `randomizeFilter(id, rng?)` / `resetFilter(id)` act on the synth's own filter params (`randomSynthFilter`
     in `random.ts`) or on the strip filter (`randomFilter` / `FILTER_DEFAULT`), then `pushSound`.
   - ✅ Extra — **wave glyphs**: the synths' Wave control is `WavePicker` (`src/ui/WavePicker.tsx`), a
     `SegmentGroup` whose items draw one cycle of each waveform (`WaveGlyph`, inline SVG in `currentColor`,
     `aria-label` / `title` from `WAVE_LABELS`) instead of "Saw" / "Sqr" text.
   - ✅ Extra — **unit layout**: the step grid is `flex: 0 1 auto` (its cells' width, scrolling when short
     of room) and every unit's controls are a `Flex wrap` row with `flex="1"` right after it — groups (Wave,
     Filter, knobs, Envelope, Level, strip filter) flow side by side and wrap, so the panel is no taller than
     it needs and there is no gap between the grid and the knobs. `StripFilterControls` is a wrapping row
     (type + curve, then Cutoff/Res).
   - ✅ Extra — **modulation** on every machine (`Instance.mod: ModParams`, model in `src/state/mod.ts`, pure,
     saved in the song — `parseMod` fills any missing piece with `MOD_DEFAULT`, the v1 lifter adds it whole;
     `clampMod`): `tune` (semitones, melodic kinds — `hasTune`; the device transposes each note with
     `transposeNote`, no signal), `drive` (0–1, the `wet` of a `Tone.Distortion` on the strip), two **LFOs**
     (`shape`, `rate` Hz, `target`, `amount`), a per-step **random** source (`target`, `amount`) and four
     **macros** (`value` + `targets: { key, min, max }[]`). Targets: `cutoff` / `pitch` / `level` / `off`
     (`modTargetsFor(kind)`: pitch only where voices carry a `detune` signal — synth, bass, poly, ep).
     Engine: the strip is device → [filter] → drive → trem → input; the modulators are Tone signals summed
     into the target (`Strip.filterBase`, `tremBase` and PolyPad's `cutoff` signal carry the knob's own value
     because a signal connected to a Tone signal/param overrides its value); `Tone.LFO` ×2 with
     `min/max = ±modSwing()` (cutoff: ±90 % of the cutoff, re-ranged when it moves via `setCutoffHz`;
     pitch: ±1200 cents; level: ±0.9), a `Tone.Signal` for random set with `setValueAtTime` from the
     scheduler's new `onTick(time)` (`engine.stepMod`). Devices implement `ModHooks` (`setTune`,
     `cutoffInput`, `pitchInputs`; kits none). `engine.setInstanceMod(id, mod)` re-applies the whole block
     (`applyMod`, rewiring only when a target changes). Store: `setInstanceMod` (tune/drive), `setInstanceLfo`,
     `setInstanceRandom`, `setMacroTargets`, and `setMacro(id, n, value)` which moves the macro's targets
     (`macroPatches` → params / strip filter / tune+drive) in one history step and returns the patches for the
     engine (`changeMacro` in `unitMeta`). Macro target keys: `param:<key>` from `macroTargetsFor(kind)`,
     `filter:cutoff|resonance`, `mod:drive|tune`. UI: `ModPanel` (`src/ui/ModPanel.tsx`, a `Collapsible`
     "Modulation" row at the bottom of every instance panel, closed by default): Tune/Drive, LFO 1/2 (shape and
     target `NativeSelect`s, Rate/Amount `sm` knobs), Random, and four macro knobs each with its assignment
     rows (target select, Min/Max `sm` knobs, ×, "+ Assign"). The LFO shape is the synths' `WavePicker`
     (glyphs, `label="Shape"`) and the LFO / random target a `TargetPicker` `SegmentGroup` of icons (ban,
     filter, note, speaker; name as `aria-label` and `title`); the fold's content has `p="2.5"` (10 px); the groups
     (Tone, LFO 1, LFO 2, Random) sit in a `SimpleGrid` of 1 / 2 / 4 columns (`base` / `sm` / `xl`) and
     the macros in one of 1 / 2 / 4 (`base` / `sm` / `lg`), so a phone gets one tidy group per row. MONO-1 and BASS-2 gained a full amp
     **envelope** (`attack`, `sustain`, `release` params + knobs; `decay` still drives the filter envelope too).
   - ✅ Extra — SONG **repeat**: "+1 bar" (`repeatLastBar`, the last bar once more) and "×2"
     (`repeatChain`, the chain after itself, cut at `MAX_CHAIN`) next to Clear; both resume the song and are
     one undo step.
   - ✅ Extra — **undo / redo** of everything a song holds (`SongSlice` = what `toSong` saves, `activePattern`
     included so an undone edit is seen). `src/state/history.ts` is pure (`record` / `undo` / `redo`,
     `HISTORY_LIMIT` 100, `COALESCE_MS` 300: edits with the same key that close together are one step — the
     store keys knob turns `params:<id>:<keys>`, `level:<id>`, `send:<id>`, `fx:<key>`, `bpm`, `swing`, `master`;
     grid toggles, chain edits, mute and add/remove instance never coalesce — except inside a **stroke**:
     `StepGrid` calls `beginStroke()` on a mouse/pen press and `endStroke()` when it lifts, and every edit in
     between is one step (`store.stroke`, a counter, keys them `stroke:<n>` with an `Infinity` window)). Every editing action spreads
     `remember(state, key)` into its result; `loadSong` clears the history. `store.undo()` / `redo()` are pure
     and the UI (`undoEdit` / `redoEdit` in `src/ui/undoRedo.ts`) calls `engine.syncFromStore()` after them.
     `installUndoKeys()` (from `App`): ⌘Z / Ctrl+Z, ⇧⌘Z / Ctrl+Y, skipped inside text fields; `UndoRedoButtons`
     sit after the mark on the toolbar (`hideBelow="md"`: not on a phone), disabled via `selectCanUndo` /
     `selectCanRedo`.

   - ✅ Extra — the FX-2 **fader is wide** on every pointer: track `w: 2.5` (`3` coarse), thumb 32×20 px
     (36×24 coarse), the control padded `px: 3` so the cap has room.
   - ✅ Extra — FX-2's **strips are cards**: each machine's meter, fader and send sit in a bordered box
     (`blackAlpha.300`, `rack.panel.divider`) headed by the kind's icon in its finish accent and its label.
   - ✅ Extra — the toolbar's add button is labelled just **"Add"** (rack icon + "Add"); the panel it opens
     is titled "Add machine". Ids, files and store names keep `add` / `AddUnit`.

**All extras above are done.** Other ideas: LCD readouts per synth, drag-reorder on the timeline, per-step
velocity on the kits.

**The brief is fully implemented.** Anything from here is polish or new scope — confirm with the user first.

Read the skills before touching UI or audio: without the Chakra skill loaded, Chakra UI **v2** API gets
written from memory, and v3 is a different library.

Chakra CLI snippets (`provider`, `toaster`) live in `src/components/ui/` — that is where the CLI writes
them; they are generated code, not ours. One deliberate change: `toaster.tsx` always renders
`Toast.CloseTrigger` (the snippet gates it on `closable`) — the user wants every toast dismissable.

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
  pointer events with capture, `touch-action: none`, visible focus via `_focus` (any focus, pointer included —
  the user wants a knob just turned to stay marked; the `Fader` thumb does the same) and `data-active` while
  it is being turned (the pointer line lights amber).
- Responsive down to 360 px. The step grid may scroll horizontally; the controls may not.
- Respect `prefers-reduced-motion`.
- Tests to keep green: the scheduler fires the correct steps under a mocked transport, and store toggles
  apply without mutation.
