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
     round-robin — `PluckSynth` is not `Monophonic`, so `PolySynth` cannot host it; a column lit past six
     notes plays its first six only: a seventh would restart a string's noise at the same time, which Tone
     refuses with "Start time must be strictly greater than previous start time" — live that error ended
     the step for every later instance, and it failed the whole WAV/MP3 export).
     To check renders outside the app: with `pnpm dev --port 5199` running,
     `node scripts/render-check.mjs "http://localhost:5199/scripts/render-check.html?songs=/songs/a.json,/docs/b.json"`
     drives a headless Chrome over CDP (`--dump-dom` and `--virtual-time-budget` return before an offline
     render ends) and prints PASS/FAIL per song from `renderSong`; a render runs at about real time.
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
     `start` is true (a loaded song); it always installs the audio-resume handlers. **Every load opens
     folded**: `loadSong` sets `folded: foldedAll(ids)` — each machine, FX-2, BANK and SONG folded, the
     clock open (it used to unfold the song's machines; the user asked for a compact stack on entry, and
     Unfold all is one press away). The coded starter groove
     (`starterTrack`) is now only the store's pre-load state.
   - ✅ Extra — the **song's name on the toolbar**: `SongTitle` in `Rack.tsx`, plain silkscreen capitals
     (no display box — tried, the user wanted it without a fill) in the middle of the toolbar (the box that
     used to be the spacer before the buttons; `hideBelow="md"`, so not on a phone — the user asked for
     that). It is a button that opens the Songs panel (`usePanelStore.toggle("songs")`), and reads
     "Select a song" (`NO_SONG`) on an empty rack. It prints `useSongTitle()` (`src/ui/songTitle.ts`;
     `songTitle` is pure: the library entry's name, a demo's file name humanized, the loaded file's name,
     "Untitled", or "—" for an empty rack). A display on the transport was tried first and squeezed the
     controls at laptop widths. `humanize` is exported from `autosave.ts` for it.
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
     top-left, bottom-left, top-right — and a black diamond bottom-right, mid-sized, on white; the tile is
     rounded by a clipPath `rx="300"`; the Apple icon is the same SVG with the radius stripped, and the
     maskable one also shrinks the `art` group to 72 % about the centre so nothing of it falls outside
     Android's safe circle) by `scripts/render-icons.sh` — headless Chrome shots at 512
     and `sips` scales down; the Apple and maskable icons are full-bleed with the panel shrunk inside; the app shell is precached, `songs/`,
     `samples/`, `midi/` and the factory song are cached stale-while-revalidate as `rack-content`). `index.html`
     carries the iOS home-screen metas and `viewport-fit=cover`. `sw.js` and the manifest must be served
     without long caching. **Updates**: `installUpdates()` (`src/ui/updates.ts`, from `main.tsx`; the
     plugin's `injectRegister` is off) registers the worker through `virtual:pwa-register`
     (`workbox-window`): `autoUpdate` already means `skipWaiting` + `clientsClaim` +
     `cleanupOutdatedCaches` (a new build takes over and the old build's caches go), and on top it asks
     the server for a newer build every `UPDATE_CHECK_MS` (an hour) and whenever the tab comes back into
     view — a browser only checks by itself on a navigation, an installed app may stay open for days —
     and reloads into the new build once it is in, **after the clock stops** if it is running
     (`onNeedReload`). The manifest has no launch-screen field: iOS uses the `<link>` tags, Android
     `background_color` + icon + name; `screenshots` would be for the install dialog, not the launch. **Launch screens**: `scripts/render-splash.sh` renders `public/splash/<w>x<h>.png`
     (the logo's art over the word RACK, black on white, sized in vmin) for every iPhone / iPad size in
     both orientations with headless Chrome and prints the `apple-touch-startup-image` `<link>` tags, which
     `index.html` carries (one per size and orientation — iOS wants an exact match); `splash/**` is out of
     the precache. Android builds its own from the manifest, whose `background_color` is white for it.
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
     left, then, right-aligned from `md`, `toolbarButton` / `toolbarIconButton` (the icon-only ones — undo,
     redo, fold all — are `ghost`: no fill, the user asked) buttons from
     `src/ui/toolbar.ts`: Songs (the library drawer, which also holds Load — `LoadSongButton`, .json or
     .mid — and New song under the save form), Add unit and one fold/unfold-all toggle; on a phone the buttons
     share the width and are 36px tall with `xs` text — they were 48, the user wanted them smaller twice) — the bank only keeps the copy row (active
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
     `reverbDecay + 1` s capped at 8 (`renderPlan`, pure). **Rendered in stretches** of `CHUNK_BARS` = 16
     (`renderChunks`, pure): an offline context builds every node a stretch will ever need before it renders
     (a hat is sixteen native nodes a hit) and processes all of them on every quantum until they finish, so
     one long render cost the square of its length — measured 16 bars in 20 s, 32 in 138 s, 48+ never
     within 15 min (profiled: the clock phase is small, the native render is the quadratic part). Each
     stretch is its own engine + `OfflineContext` (`renderStretch`), started at its bar (`engine.run(0,
fromBar)` → `scheduler.seek`), with `EngineSource.timeOffset` so every LFO starts at the phase it had
     reached, rendered with the plan's tail and summed onto the mix (`mixInto`) where the tail runs under
     the next stretch; the stretches carry the master gain but bypass the glue (`engine.bypassMaster()`),
     and `applyMaster` runs the compressor + limiter (`MASTER_COMPRESSOR` / `LIMITER_DB`, shared with
     `build()`) once over the summed mix. A note held across a stretch line is released and struck again
     there. **Both encoders run in a Web Worker**: `encodeAudio(buffer, format)`
     (`src/audio/encode.ts`) copies the channels, transfers them to `src/audio/encodeWorker.ts` (a module
     worker, `new Worker(new URL(…), { type: "module" })`; `worker.format: "es"` in `vite.config.ts` since it
     loads lamejs on demand) and gets the `Blob` back; without `Worker` (tests) it encodes in place. The
     worker file's top level sets `self.onmessage`, so nothing else may import it — the shared pieces
     (`pcmSource`, `encodePcm`, the message types) live in `src/audio/encodePcm.ts`. `encodeWav`
     (`src/audio/wav.ts`, 16-bit PCM, pure)
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
     Add unit stays open after adding; the drawer closes as it did. The docked panel's **width is
     dragged** at its left edge (`ResizeHandle` in `SidePanel.tsx`: a `role="separator"` strip, pointer
     capture, arrows / Home / End on the keyboard; a 2 px line lights amber on hover, drag and focus) and
     kept in the layout store (`panelWidth`, `setPanelWidth`, `clampPanelWidth` between
     `PANEL_WIDTH_MIN` 280 and `PANEL_WIDTH_MAX` 960, default 448 = Chakra's `md`; persisted, the merge
     clamps it), never wider than leaves the rack 360 px. Desktop only — the phone drawer is untouched.
     The Songs panel's on-open work (dirty
     check, suggested name) runs from a `usePanelStore.subscribe` rather than an effect.
     Hairlines between rows and sections use `rack.panel.divider` (`metal.700`; `rack.panel.edge` is the
     panel's own colour and shows nothing): under each machine group and put-back row in Add unit, under the
     save form and the Load row, above each folder and above Demos in Songs, and under both panel headers.
     One rhythm around every hairline in Songs: 12 px (`3`) before and after; `COVER_GRID` is `pt 2 / pb 3`,
     folder and Demos sections `pt 3` and `pb 3` while closed; the Demos toggle is a folder-style row; no
     indent on a folder's grid, so all sleeves line up.
     In Add unit the machines are a **grid of tiles** (`Tile`, `TILE_GRID`: `auto-fill, minmax(7.5rem,
1fr)`, so a wider panel takes more across): the whole tile is one `chakra.button` (icon, name, title;
     "×N" top-left when some are in the rack, the `+` / undo mark top-right is decoration) — pressing
     anywhere on it adds or puts back. Under the grid, "In the rack" lists every instance in the tiles'
     order (kind icon in its accent, tap to scroll to it, trash to remove), then "Put back" as tiles.
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
     samples a frame at `VIDEO_FPS` = 15 (`willReadFrequently`) and
     sends `brightnessOf` (mean luma) to the engine — the 20×20 read is the whole per-frame cost; the
     browser's decoder does the rest, so a small clip (240 px, H.264) is what a phone wants. `VideoUnit`
     (`src/ui/VideoUnit.tsx`): the gate `StepGrid`, name display + Load/Clear (the 20×20 `VideoScreen` canvas was
     dropped at the user's request — the filmstrip is the picture; the 20×20 read still feeds the
     brightness; the frame listeners it used to fan out to were unused and are gone), the Loop bars `SegmentGroup`, filter block,
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
   - ✅ Extra — **MIC-1 · Microphone** (kind `mic`, finish `yellow`, `LuMic`): the microphone through the
     rack, and a looper. `src/audio/mic.ts` asks for one shared `MediaStream` (`getMicStream`, behind the
     panel's "Enable mic"; no echo cancellation / noise suppression / AGC) and `engine.attachMic(stream)`
     feeds every MIC-1 (`createDevice` attaches later ones itself). Device `MicInput`
     (`src/audio/devices/mic.ts`): live → liveGain, loop `Tone.Player` → loopGain, both → gate → filter →
     strip; the track is a one-row gate like VID-1's (`GATE_KINDS` / `isGateKind` in `pattern.ts`; the
     scheduler dep is now `triggerGate(id, open, time, bar, step)` for both kinds, and `hitsForStep` skips
     them). Params (`MicParams`): `loopName` / `loopBpm` (the take's tempo — playback is rate-shifted to
     the clock's), `bars` (`MIC_BARS` 1/2/4/8: the loop's length, and it starts over every that many —
     `barStart(bar, time, bpm)` at step 0 where `restartsAt`), `live` (monitor on/off, a boolean the
     parser special-cases like `loopName`), `liveLevel` / `loopLevel`, own `filterType` / `cutoff` /
     `resonance`. `bars` is any integer 1–8 (`MIC_RANGES.bars`): the segment picks 1/2/4/8 as the take's
     **most**, and a take stopped early leaves the whole bars it got. **Recording**
     (`engine.recordLoop(id, bars, onArmed?)` → `{ name, bpm, bars } | null`; `engine.stopRecording(id)`
     drops a take still waiting for its bar or ends one under way on the next bar line — the worklet
     takes `{ stopAt }` / `{ cancel }` messages; the panel shows ARMED, then "● REC n/bars" in red, and the
     Rec button reads Cancel / Stop; the engine keeps the takes under way in `takes`): an AudioWorklet
     (`src/audio/capture.worklet.js`, `rack-capture`, loaded on the first take via the Tone context's
     `addAudioWorkletModule`; its silent output goes to the destination or the graph never runs it)
     copies the input between two exact frames — from the next bar where the cycle begins
     (`scheduler.currentBar`, `transport.nextSubdivision("1m")`) for `bars` bars — so the loop sits on
     the bar, unlike a `MediaRecorder`; the take is kept as a WAV in the samples store as a **take**
     (`saveTake` → key `take:<takenAt>`, `StoredSample` carries `takenAt` / `bars` / `bpm`; `listTakes`,
     `isTakeKey`), then `setLoop`; the params get `loopKey` (the take in use — `MicInput.ready` decodes it
     back via `loadTake`, `engine.ready()` waits for it, so an offline render plays the loop while the live
     input is silent there). **Takes list** (`TakesList` in `src/ui/TakesList.tsx`, `useTakes` /
     `takesChanged` / `takeMeta` in `src/ui/takes.ts`): every recording — MIC-1 loops and SMP-8 clips (the
     sampler's Rec saves its clip as a take too) — newest first with bars · BPM · time; pressing one is
     `engine.useTake(id, key)` (a clip becomes a one-bar loop at the clock's tempo), the trash deletes it
     (and clears a MIC-1 using it); `clearLoop` only takes the loop off the player.
     The build keeps the worklet a file (`assetsInlineLimit` in `vite.config.ts`). UI `MicUnit`: gate grid, then
     the groups as **cards** (`ControlCard` in `src/ui/ControlCard.tsx`, the look of FX-2's strips: bordered
     box on a darker ground with a silkscreen title, `role="group"`; the user asked for it here) —
     on a `Grid` of `repeat(auto-fit, minmax(max(15rem, 30%), 1fr))` (as many across as fit, three at
     most, decided by the unit's own width — a viewport breakpoint squeezed them beside a wide side
     panel), the filter's Random / Reset in the Filter card's **footer** (`ControlCard.footer`: pinned to the
     bottom under a hairline, so a row of cards lines them up — the card's own actions; `FilterTools`) and
     the pattern's Plays / Random in the Level card's footer (`PatternTools`; `PartTools` composes both
     for the other units) —
     Input (OFF/LIVE/● REC display, Enable mic → Live toggle, a headphones warning: speakers feed back),
     Loop (display, Rec — starts the clock if stopped, disabled until the mic is on —, clear, bars),
     Live/Loop level knobs, filter, `PartTools`, `ModPanel`. **SMP-8 Rec**: a Rec/Stop button by Load
     (`recordClip` in `src/ui/micRecord.ts`, a `MediaRecorder` clip of up to `CLIP_MAX_SECONDS` = 10 s in
     whatever container the browser writes, then `importSample` as "Mic N.<ext>").
   - ✅ Extra — the BANK's **slot buttons head the parts matrix**: `StepGrid` gained an optional
     `header?: (step) => ReactNode` row (one element per column on the same tracks as the cells, an empty
     label cell in front), and `PartsMatrix` renders the sixteen slot blocks there — a pattern's number sits
     over its column; the matrix renders with no rows on an empty rack so the slots stay. The separate
     two-row slot grid and the "copy active → next slot" button are gone (`copyActivePatternTo` stays in the
     store, unused by the UI; Copy part / Paste to pattern cover the need).
   - ✅ Extra — the BANK's **parts matrix shows who and what**: each row carries the machine's icon
     (`StepGridRow.icon`, printed in the label in the finish's accent — `TINT_ACCENT` in the `stepGrid`
     recipe is `finishAccent`'s formula over a CSS variable) and a `tint` (`{colors.finish.<name>.panel}`,
     set as `--tint` on the row): every cell keeps the plain grey of an unlit cell (`data-tinted`:
     the matrix is not a sequencer — amber, a finish-coloured paint and a faded dashed cell were tried and
     dropped); a cell where the part has notes (`marks`, from `isTrackEmpty`; `data-marked`) prints the
     icon inside in the finish's accent, one where the part sits the slot out is the same at **30 % opacity**
     (`StepGridRow.offIcon` exists for a mark in off cells but the bank no longer uses it — a crossed
     speaker was tried), and the sounding column goes a shade lighter — an empty
     slot reads as empty. **Drag and drop in the BANK** (HTML5, mouse only — touch keeps Copy part / Paste to
     pattern in the grip menu): a slot button dragged onto another **copies** it there
     (`copyPattern(from, to)`; the source and the slot on screen stay — it used to swap by default and
     the user wanted the neighbour duplicated without moving what was there) or, with ⌥/Alt held,
     **swaps** the two patterns (`swapPatterns(a, b)`: the chain is renumbered with `swapSlots` in
     `patterns.ts` and `activePattern` follows, so nothing sounds different); a marked matrix cell
     dragged onto another cell (any row of the same kind)
     or onto a slot button copies that part there (`setTrack`). Either dropped on the **bank's own
     surface** (the group box, not a cell or slot — outlined red-dashed while over it; the whole body was
     tried and the user preferred this; `RackUnit.onDragStart` ignores drags that began on something
     inside, or every unit lit up for them) asks first
     (`ConfirmDialog`, `src/ui/ConfirmDialog.tsx`: a Chakra `Dialog` as `alertdialog`, Cancel / Empty,
     `closeOnInteractOutside` off and opened 100 ms after the drop; the surface's `dropEffect` is
     "copy" for a part and "move" for a slot — a `dropEffect` the drag's `effectAllowed` does not
     include makes the browser discard the drop silently, which is how parts fell through — the pointer's release that ends the
     drag lands right after the drop and shut a dialog that mounted inside it before it was seen)
     and then empties it: the whole pattern (`clearPattern(slot)`: every part to `emptyTrack`, who sits
     out kept) or, for a part, **that one cell** — the machine's part in the pattern it was dragged from
     (`clearPart(id, slot)`; it used to empty the machine's whole row, and the user lost every pattern
     of a guitar to it, so the row went). Cancel, Escape or a click outside do
     nothing; both are one undo step. `StepGrid` takes an optional `drag`
     (`CellDrag`: `type`, `dataOf`, `accepts`, `onDrop`), handled on the grid so the memoised cells stay
     handler-free; the cell under the drag is outlined on the DOM (`data-drop-target`); the grid's own
     `dragstart` ignores anything that is not a cell so the header buttons drag on their own. With `drag`
     set, a mouse no longer paints that grid (a press would toggle the cell it is about to pick up). Both
     drops are one undo step. **A click on a machine's name** in the matrix (`onRowSelect` /
     `selectedRow`, `data-selected` on the label, `role="button"`, the selection is `PartsMatrix` state)
     does two things: `openInstrument` in `PatternBank.tsx` pauses the song on the slot on screen
     (`setFollowSong(false)`, it keeps looping as picking a slot does) and unfolds and scrolls the panel
     into view (`scrollToUnit`) — it was a double-click, the user wanted one —, and the machine is
     selected: Delete or Backspace then **empties its part in the pattern on screen** (`clearPart(id,
activePattern)`, a toast with Undo via `undoEdit`; it used to take the whole machine out of the rack
     — the user wanted the pattern, and machines leave through the grip menu or Modules), Escape or a
     press anywhere else lets it go; the key handler skips text fields (`inTextField`, exported from
     `undoRedo.ts`).
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
   - ✅ Extra — **Random / Reset sound** — no longer in the UI (the user took them out of the header and
     then the grip menu; the panel's Filter Random/Reset and the pattern Random cover what they want). The
     store actions stay: `randomizeInstanceSound(id, rng?)` → `randomizeInstance` in `src/state/random.ts` (pure,
     rng-injected: params by kind — log-uniform for frequencies and times, tasteful sub-ranges for resonance,
     drive 0–0.6, tune ±6; a random strip filter is mostly open, a highpass never above 600 Hz; sampler pads
     are kept; LFOs, random source and macros untouched) and `resetInstanceSound(id)` (params, strip filter
     and the whole mod block back to defaults; patterns stay). One undo step each; `pushSound(id)` in
     `unitMeta` hands the engine params, filter and mod afterwards.
   - ✅ Extra — **Random part** (`PartTools`, `src/ui/PartTools.tsx`, a "Pattern N" group at the end of
     every unit's controls row; the button reads just "Random" — the group name says what it is of; the
     accessible label still says notes or beat): `randomizePart(id, rng?)` replaces the machine's track in the
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
     of room) and every unit's controls are a `Flex wrap` row with `flex="1 1 20rem"` right after it — groups
     (Wave, Filter, knobs, Envelope, Level, strip filter) flow side by side and wrap, so the panel is no
     taller than it needs and there is no gap between the grid and the knobs. The body is itself a
     **wrapping row**, not a `column`/`row` viewport breakpoint: the controls sit beside the grid while at
     least 20rem are free and drop under it otherwise — a wide docked side panel narrows the rack while the
     viewport stays `lg`, and with the breakpoint the controls were cut off at the panel's edge. The
     transport row wraps from `md` for the same reason. `StripFilterControls` is a wrapping row
     (type + curve, then Cutoff/Res).
   - ✅ Extra — the **Modulation groups are cards** too (`ControlCard`: Tone, LFO 1, LFO 2, Random, and
     each macro, on `CARD_COLUMNS` = `repeat(auto-fit, minmax(max(14rem, 22%), 1fr))` — up to four across,
     by the unit's width). Cards have `p="4"` and a bold silkscreen title.
   - ✅ Extra — **modulation** on every machine (`Instance.mod: ModParams`, model in `src/state/mod.ts`, pure,
     saved in the song — `parseMod` fills any missing piece with `MOD_DEFAULT`, the v1 lifter adds it whole;
     `clampMod`): `tune` (semitones, melodic kinds — `hasTune`; the device transposes each note with
     `transposeNote`, no signal), `drive` (0–1, the `wet` of a `Tone.Distortion` on the strip), two **LFOs**
     (`shape`, `rate` Hz, `target`, `amount`), a per-step **random** source (`target`, `amount`) and four
     **macros** (`value` + `targets: { key, min, max }[]`). Targets: `cutoff` / `pitch` / `level` / `pan` / `off`
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
     `filter:cutoff|resonance`, `mod:drive|tune`. UI: `ModPanel` (`src/ui/ModPanel.tsx`: **two** `Collapsible`
     rows at the bottom of every instance panel, "Modulation" and "Macros" — different things, so each
     behind its own fold (`PanelFold`), closed by default): Tune/Drive, LFO 1/2 (shape and
     target `NativeSelect`s, Rate/Amount `sm` knobs), Random, and four macro knobs each with its assignment
     rows (target select, Min/Max `sm` knobs, ×, "+ Assign"). The LFO shape is the synths' `WavePicker`
     (glyphs, `label="Shape"`) and the LFO / random target a `TargetPicker` `SegmentGroup` of icons (ban,
     filter, note, speaker; name as `aria-label` and `title`); the fold's content has `p="2.5"` (10 px); the groups
     (Tone, LFO 1, LFO 2, Random) sit in a `SimpleGrid` of 1 / 2 / 4 columns (`base` / `sm` / `xl`) and
     the macros in one of 1 / 2 / 4 (`base` / `sm` / `lg`), so a phone gets one tidy group per row. MONO-1 and BASS-2 gained a full amp
     **envelope** (`attack`, `sustain`, `release` params + knobs; `decay` still drives the filter envelope too).
   - ✅ Extra — SONG **sections** (`src/state/sections.ts`, pure): `Section { name, bars }` partition the
     chain exactly (`fitSections` cuts / stretches the last / drops empties; a song either has none or every
     bar is in one), saved in the song as `sections` (optional in the file — missing means none; the v1
     lifter and the MIDI import give none). The scheduler never sees them. Store: `sections`, in `SongSlice`
     (undo) and `songChanged` (autosave); the bar actions keep them in step (`+` and "+1 bar" grow the last,
     `removeChainSlot` → `withoutBar`, `repeatChain` doubles them, `clearChain` drops them, swaps/edits of a
     bar's pattern leave them alone); `addSection(name, bars, pattern?)` (bars the song had without
     sections become "Part 1" first), `removeSection`, `renameSection` (history key `section-name:<i>`),
     `setSectionBars` (grows by repeating the last bar, cuts at the end), `fillSection(i, pattern)`,
     `duplicateSection`, `moveSection(i, ±1)`, `applyStructure(sections, pattern?)` (`layOut`: the song
     replaced by a skeleton on one pattern). `STRUCTURES` (Pop song 120 bars — the user's table —, Short
     song 40, Club track 88), `SECTION_NAMES`, `SECTION_LENGTHS`. `MAX_CHAIN` is now **256**. UI
     (`TimelineUnit`): with sections each is a `section` slot with a header (`sectionHeader`: name button →
     inline `Input` with a `datalist` of the names — an input with a list is a **combobox** to ARIA —,
     "bars a–b", a `NativeSelect` for the length, a `⋮` `Menu`: Fill with pattern N (the one on screen),
     Duplicate, Move up/down, Remove) and its bars wrapping under it; the `+` bar sits after the last
     section. Under the timeline, `AddSection`: name + length + "Add section" (on the pattern on screen) and
     a "Structure" `Menu` of `STRUCTURES`. Without sections the unit looks as before ("Song bars" list).
   - ✅ Extra — SONG **play from a bar**: a ▶ button at the bottom-left of every bar block (`play` slot
     in the timeline recipe, the × keeps the top-right) runs the song from the first step of that bar:
     `playFromBar(bar)` in `transportControl.ts` sets `followSong: true` and either
     `engine.playFrom(bar)` while the clock runs (stop → `run(undefined, bar)`, the same stop/start the
     playlist does, so a held slide is released and the sequence rewinds) or `engine.start(bar)` from a
     stop (`start` now takes `fromBar`, handed to `run`, which `seek`s the scheduler).
   - ✅ Extra — SONG **bars drag** (HTML5, mouse): a bar block is `draggable` (`BAR_DRAG` in
     `dragTypes.ts`, `droppedBar`; `effectAllowed` "move", the drop's `dropEffect` "move" — a pattern
     drop stays "copy") and dropped on another bar or on the + moves there: `moveChainBar(from, to)` →
     `movedBar` (`patterns.ts`, pure: taken out and put back at `to`, so onto a later bar lands after it,
     onto an earlier one before). Sections keep their lengths (the bar takes the section at its new
     place); the song resumes; one undo step; a no-op move is not an edit. The travelling bar is dimmed
     (`data-dragging`). `dropHandlers` takes an optional `onBar` and decides by the drag's `types`, never
     by `getData` alone (the test mocks answer any type).
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
   - ✅ Extra — **stereo**. `Instance.pan` (−1…1, `PAN_RANGE`, saved; missing → 0) and `Instance.space`
     (`{ angle: −180…180°, distance: 0…1 }`, `SPACE_DEFAULT` / `clampSpace`, saved; missing → default);
     `FxParams.pingPong` and `FxParams.space` (booleans, saved, missing → false — a song from before sounds
     as it did). Engine: every strip is now trem → [`panner3d`] → `panner` (`Tone.Panner`, `panBase`
     signal carries the knob, the pan modulators sum into `panner.pan`) → `panTrim` (a gain of √2: a
     panner at the centre halves the power per channel, so without it every old song would have dropped
     3 dB) → input. **3D** (`fx.space`, "for headphones"): `wireSpace` puts a `Tone.Panner3D` (HRTF,
     inverse distance, `SPACE_NEAR`…`SPACE_FAR` units, `placeInSpace`: front is −z, right +x) before the
     panner, and disposes it when the mode is off — an HRTF per machine is not free. **Ping-pong**
     (`fx.pingPong`): a `Tone.PingPongDelay` built beside the `FeedbackDelay`, both fed the same
     time/feedback, the FX send wired to one or the other. Modulation target `pan` on every kind
     (`PAN_MOD_FRACTION` = 1: full amount swings the whole way). Store `setInstancePan` (key `pan:<id>`) /
     `setInstanceSpace` (key `space:<id>:<keys>`); `syncFromStore` pushes both. FX-2: a Pan knob per strip
     ("L 40" / "C" / "R 40"), Angle / Dist knobs while 3D is on, and a "Stereo" section with the two
     switches. `ModPanel`'s target picker gained the pan icon (`LuMoveHorizontal`).
   - ✅ Extra — the **fold chevron closes the unit header**, after the grip menu (mute, solo, ⋮, then the
     chevron), so the panel's own fold sits at the very edge.
   - ✅ Extra — a **version number** by the toolbar mark: `v<n>`, the commit count on the branch
     (`git rev-list --count HEAD`), with the short hash as the tooltip — read in `vite.config.ts` at build
     time into `define`d `__RACK_VERSION__` / `__RACK_COMMIT__` (declared in `vite-env.d.ts`); without git
     it falls back to `RACK_VERSION` / `RACK_COMMIT` from the environment, else "dev". The same `version`
     and `commit` go into the PWA manifest as informational (non-standard) fields. The Docker build
     installs git and `.dockerignore` no longer drops `.git` (34 MB), so the container shows the real number.
   - ✅ Extra — **keys**: a melodic machine's eight rows are the notes of a key. `src/state/key.ts` (pure):
     `KeyParams { root 0–11, scale, octave }`, `SCALES` (major, minor, harmonic minor, dorian,
     mixolydian, both pentatonics, blues), `keyRows(key)` (the scale's degrees from the root at the
     octave, carrying into the next octave), `clampKey`, `solfege("Eb2") → "Mib2"`. `Instance.key?` on
     `MELODIC_KINDS` (`isMelodicKind` in `pattern.ts`) — **absent means the fixed rows from before**
     (`LEGACY_ROWS` = `SYNTH_NOTES` / `BASS_NOTES` / `POLY_NOTES`), so older songs sound as they did;
     `KEY_DEFAULT[kind]` is the key each kind's fixed rows are closest to (exact for synth, bass and
     poly; ep/strings differ) and where the selector starts. `rowNotes(kind, key)` is the one place rows
     come from: the grids (`SynthGrid` / `BassGrid` / `PolyGrid`, labels in solfège, row ids the note
     names, spelled with the sharps or flats of the key's signature — `spelledWithSharps`: G major reads
     F#, F minor reads Ab; chord names in the chart importer keep their own accidental) and the scheduler, whose `rowsOf?(id)` dep the engine answers from the store per tick
     (`synthNoteAt` / `bassEventAt` / `polyNotesAt` take the rows as a third argument). Store
     `setInstanceKey(id, patch)` (history key `key:<id>:<keys>`, no-op on a kit), saved in the song
     (`clampInstanceKey` in `instances.ts`: nonsense → no key, a key on a kit is dropped), copied by
     duplicate / Copy to. UI `KeyControls` (`src/ui/KeyControls.tsx`): a "Key" group of three
     `NativeSelect`s (root as "Fa · F", scale, "Oct n") first in the controls row of MONO-1, BASS-2 and
     the poly units. The tracks keep row indices, so a change of key re-pitches every lit cell. A
     free-text "Notes" fold per module was built the same day and taken out at the user's request.
   - ✅ Extra — the toolbar's add button is labelled **"Modules"** (rack icon + "Modules", beside "Songs";
     it was "Add" and before that "Add unit"); the panel it opens is titled "Modules" too. Ids, files and
     store names keep `add` / `AddUnit`.

   - ✅ Extra — **tidy-up** (one pass over the whole tree, no behaviour change): shared homes for what
     was written more than once — `src/ui/format.ts` (every knob/fader readout: `formatPercent`,
     `formatHz`, `formatSeconds(v, decimals)`…), `src/ui/ControlGroup.tsx` (the "silkscreen title over
     controls" column every unit's groups are made of; `heading` props pass `title={heading ? … : undefined}`),
     `src/ui/errors.ts` (`errorText` / `errorToast`), `src/state/parse.ts` (the song parsers' primitives and
     `SongParseError`, shared by `song.ts` and `songV1.ts`), `src/audio/devices/gate.ts` (`StepGate`, the
     one-row gate VID-1 and MIC-1 share, and `setFilterParam` for a device's own filter type/cutoff/Q),
     `RAMP` once in `src/audio/types.ts`, `restartsAt` in `patterns.ts`, `GateGrid` in `TrackGrids.tsx`,
     `useInstanceLabel` / `isNumberOption` in `unitMeta`, `clamp` from `params.ts` everywhere, and
     `selectInstance` (now `Pick<RackState, "instances">`, so the engine's source state fits) for every
     look-up by id, including a private `engine.deviceOf(id, kind)`. Dead exports went (`LFO_COUNT`,
     `isPolyKind`, `resetBuiltinSongs`, `subscribeFrames`, `SynthNote` / `BassNote`), and symbols used only
     in their own file lost their `export`, so `pnpm dlx knip` now reports only `scripts/render-check.mjs`
     (a documented tool it cannot see).

   - ✅ Extra — **composed demos** (`scripts/make-songs.mjs`, `node scripts/make-songs.mjs` writes them
     into `public/songs/` and they are listed first in `public/songs/index.json`): four songs that use
     the whole rack — keys on every melodic machine (rows read as the score), named sections over
     64–80-bar chains, parts that sit a slot out (`muted`) for breaks, two instances of a kind (a second
     DR-4 as "tops", two BASS-2s in call and response, two STR-6s as strummed and picked guitars, the
     second tuned an octave up), strip filters (highpass on the tops and perc), pan and 3D placement
     with `space` on, ping-pong echo, LFOs on cutoff and pan, per-step random on level / cutoff / pitch,
     macros on the acid bass, drive, swing. Parts are written as strings (`"x...x..."` for a kit row,
     `"0.2.4..."` for a note row of key-row indices, `"a...a."` + a chord table for a poly grid) so a
     part reads like a drum sheet. Nit de Festa (house, 120, La menor), Camí de Sorra (downtempo, 88, Re
     dòric), Torre de Ferro (acid techno, 130, Fa menor), Marea (broken beat, 95, Mi mixolidi), and,
     asked for later, Ferralla (heavy, 130, Mi menor: two driven STR-6s on power-chord riffs, chugs and
     gallops, double-kick chorus, a breakdown) and Carrer Mullat (hip hop, 85, Re menor, swing 0.28: boom
     bap, Dm7 / Gm7 / Bbmaj7 / Am7 on EP-1, a square sub, a MONO-1 hook), Cavalls de Ferro (speed rock, 140,
     Mi blues: the BASS-2 is the rhythm guitar — sawtooth, filter open, drive 0.8, eighths — under two
     driven STR-6s, a double-kick chorus, a solo, a stop) and Cambra 36 (boom bap, 88, Do# menor, swing
     0.16: a chopped EP-1 loop through a dusty 3.2 kHz lowpass with drive, a sine MONO-1 motif as the
     "sample", a sub, a cracking dry snare) — all four in 3D (`song({ places })`
     in the generator puts machines at `[angle, distance]` and switches `fx.space` on). The song
     test parses every file in `public/songs/` and checks sections fit the chain and every part names a
     machine of the song.

   - ✅ Extra — **chord chart import** ("From a chord chart" in the Songs panel, `ChordChartButton` in
     `src/ui/ChordChartButton.tsx`; the model in `src/state/chordChart.ts`, pure). Paste the text of a
     Cifra Club / Ultimate Guitar page: `parseChart` reads section names (`[Intro]`, `Refrão:`, `Verse 2`,
     any `[bracketed]` line), lines that are chord names (a line whose first token is a chord and at least
     three fifths of whose tokens are; `2x` repeats it), `Tom:` (root and mode) and `Capotraste n`, and
     skips lyrics and tablature. `parseChord` knows international and Brazilian spellings (`D7+` = maj7,
     `A4` = sus4, `m7(b5)`, `°`, `add9`, `(9)`, slash basses). `chordRows(chord, key)` is the
     equivalence: every chord tone on the lowest row of its pitch class at or above the root's row;
     tones the key has no row for are `dropped` and shown. The dialog shows the table (chord · notes ·
     rows · bass row · left out) live for the chosen key, with the page's own key and capo filled in, then
     `chartToSong` builds the song: a pattern per distinct bar (1 or 2 chords a bar), STR-6 strumming
     the rows (`STRUMS`, at octave 2, where a guitar sits), EP-1 on 1 and 3, POLY-4 held, BASS-2 on the root (or the slash bass) on the
     beats with an accent on 1, DR-4 with a `BEATS` preset, the chart's sections on SONG; every melodic
     machine gets the key and the capo as its `mod.tune`. Loaded like a MIDI file (`loadSong` +
     `syncFromStore`, the library link cleared, the chart's first line as the unsaved name).

   - ✅ Extra — **STR-6 plays like a guitar**: `Strings` (`polySynths.ts`) strums a chord one string at a
     time, `strum` ms apart (new `StringsParams.strum`, 0–40, default 12, "Strum" knob, a macro target;
     `clampParams` lays the defaults under a strings params object so older songs get it), low to high on
     one stroke and high to low on the next (`down` flips per trigger), each strike a hair off in pitch
     (±4 cents, passed as Hz) and force (velocity 0.8–1), held a quarter note; the six plucks go through a
     body (peaking +3 dB at 240 Hz, a highpass at 80 Hz under it — the low strings and the wood voice
     piled up into mud below that, which is why octave 3 sounded cleaner) and a lowpass at 5 kHz that takes the plastic top off a plain
     Karplus-Strong (`attackNoise` stays 1: it is the _duration_ of the pluck burst, and shortened to
     0.35 the string was a click and sounded like a drum); under them a `wood` voice (six `Synth`
     triangles, one per string and taken over with it — a `PolySynth` of twelve ran dry on chugs —
     through a 900 Hz lowpass, −20 dB, a 1.2 s decay) plays the same
     strikes: a plucked-string model is all attack and no fundamental, and this is the weight it lacks.
     Each string is held a whole bar (`"1m"`): held a quarter, the release ramp (the loop's resonance to
     nothing) cut every chord dead at half a second, a gated thud — measured with a probe render: −90 dB
     at 1 s before, −12 dB at 1 s now, a ringing string. Defaults: damp 4500, sustain 0.99, release 1.4,
     strum 14. The chart importer gives its guitar a dry send (0.12) and the folk strum by default. The whole strum
     is kept inside a sixteenth at any tempo (spacing capped at 60 ms over the strings). All six strings
     struck at once was what made it sound like a toy.

   - ✅ Extra — **STR-6 sampled guitars** (the user found the string model poor: "un SMP-8 però amb
     guitarra"). `StringsParams.sound` (`STRINGS_SOUNDS` = `nylon` / `electric` / `model` in
     `params.ts`; default **nylon**, so older songs and the demos play the recording — except the
     heavy ones: the driven STR-6s of Ferralla and Cavalls de Ferro are `sound: "model"` in
     `make-songs.mjs`, the user preferred the plucked strings there (electric was tried and taken
     out); `parseSong` checks it, `clampParams` falls back to the default, Random sound keeps it).
     Recordings are CC0: FreePats' Spanish Classical Guitar (nylon) and
     Karoryfer's Black And Green Guitars (the green Gretsch, electric), one note about every three
     semitones from E2 to G5 as mono 96 kbps MP3 (4 s, faded, peak −1 dBFS; 1.2 MB in all) in
     `public/samples/guitar/<sound>/<Note>.mp3` + `LICENSE.txt`, built by
     `scripts/make-guitar-samples.sh` (curl + bsdtar + ffmpeg; FreePats has no A#2 / C#3, so the
     nylon set steps by twos there; Karoryfer's file names sit an octave up). `src/audio/guitarSamples.ts`:
     `GUITAR_NOTES`, `guitarSampleUrl`, `fetchGuitarSample` (bytes fetched once per session, shared by
     every instance and render; a failed fetch is forgotten). `Strings` (`polySynths.ts`) builds a
     `Tone.Sampler` (attack 2 ms, release = the Release knob, −11 dB) through a lowpass the Damp knob
     drives (`dampToCutoff` = damp × 2.5, capped 16 kHz) when the sound is sampled — `loadSound`
     decodes each note through the sampler's own context (an offline render decodes into its own
     graph) and `add`s it; the sampler is used once every fetch has settled (`samplerReady`), the
     model plays until then; `ready()` is what `engine.ready()` awaits for a render. A switch of
     sound disposes the old sampler; the strum, order, ±4 cents and velocity are the same code path
     for both. Sustain (the model's ring) only shows for the model. UI: a "Sound" `NativeSelect`
     first in the STR-6 controls. The service worker's `rack-content` cache holds 160 entries now.
     Checked with `render-check`: Sol solet rendered −17.7 dB RMS with the nylon guitar at −9 dB
     against −20.2 with the model, hence −11 (a scratch copy of the song with `sound: "model"` under
     `docs/` was the comparison).
   - ✅ Extra — **note names in the cells**: every melodic grid (MONO-1, BASS-2's note rows, POLY-4, EP-1,
     STR-6) prints the row's solfège name without the octave ("Sol", "Fa#") inside each cell, on or off
     (`StepGridRow.text`, `solfegeShort` in `key.ts`; `data-text` on the cell, `2xs` semibold silkscreen,
     faint while off and dark ink on a lit cell) — so a child can lay out "Sol solet" by name without
     reading the labels across. The row labels read "Sol2 · G" (`noteLabel`): the letter a chord poster
     uses beside the solfège, so a poster's "G" finds its row. Both follow the key like the labels did.
     Widest cell text is 19 px at the cells' 20 px minimum; touch screens never go under 28.
   - ✅ Extra — **STR-6 fretboard**: under the guitar's controls, a `Fretboard` (`src/ui/Fretboard.tsx`,
     slot recipe `fretboard`) draws a neck as SVG — six strings (high E on top), twelve frets, inlay
     markers — with one dot per grid row at the lowest fret that reaches its note in standard tuning
     (`positionOf` in `src/ui/fretPositions.ts`, pure, with `midiOf`; rows off the neck get no dot), the
     solfège name printed in it. The dots of the sounding column light amber from a store subscription
     on the DOM (`data-on` on the dot's `<g>`), no render per step. The file is `fretPositions.ts`, not
     `fretboard.ts`: macOS would not tell that apart from `Fretboard.tsx`, and `tsc` refused. It sits in
     its own **fold** ("Fretboard", `PanelFold` — moved out of `ModPanel.tsx` into `src/ui/PanelFold.tsx`;
     `ModPanel` takes `first={false}` after it) above Modulation. The dots are **buttons**
     (`role="button"`, pointer down or Enter/Space): `strikeNote` (`src/ui/strikeNote.ts`) sounds the
     note now through `engine.playNotes(id, notes)` (which `Tone.start()`s and builds on first use, so
     it works before the clock has ever run) and, **while the clock runs, toggles it in the sounding
     step** of the pattern on screen — tap along to write the tune, tap a note that is there to take it
     out (the user asked for a toggle, not add-only); stopped, it only sounds. A struck dot flashes
     (`data-hit`, 180 ms). Synthetic clicks from a script never start audio (no gesture), which is why
     the browser check needed a real click. Each dot carries its **fret number** at its top right
     (`fretTag` slot, amber mono; an open string's "0" sits on the left, off the nut) — the number a
     guitar tablature prints on that string's line, so a tab can be read against the neck (the user
     brought one and asked how to understand it). The name text is `text[data-name]` so the lit-dot
     rules leave the tag alone. **Every string and fret is a press target** (`place` slot: an
     invisible `rect` per string × fret 0–12, `role="button"`, "String 1 fret 3" — string 1 is the high
     E as a tab counts them; drawn under the dots): pressed, it sounds the note there (`noteAt` in
     `fretPositions.ts`, spelled with the key's sharps or flats) on the pointer's press, and the
     **click** that follows opens the `PlaceMenu` (a Chakra `Menu`, controlled, anchored through
     `positioning.getAnchorRect`, in a `Portal`; the sound goes on the press for latency, the menu on
     the click so the press that opened it is over before the menu listens for presses outside; a
     fresh `Menu.Root` per open, `key={menuKey}`): the note's name and "string N · fret F", then
     **Add to the fretboard** — a **mark**: a dot outlined amber (`data-mark`, same `dot` slot) with
     the name and fret number, kept in `Fretboard` state in the order placed (UI-only, not saved);
     Add is offered on a row dot's place too, the user asked for the open strings — **Remove from the
     fretboard** on a marked place (Delete with the mark focused does the same), and **Add to STR-6
     #n** — the note into the pattern on screen at its **next free step** (`nextFreeStep` /
     `appendNote` in `strikeNote.ts`: the step after the last column holding anything; a tab read
     left to right writes itself). **When the key has no row for the note** (the open strings, most
     of the time — "no em deixa ficar 0"), `planAppend(id, midi)` looks for a key that holds it
     together with every pitch already in the part (`pickKeyForPitches` in `tab.ts`, preferring the
     current root and scale so often only the octave moves), the item reads "· step N · key → La
     major · oct 3", and `applyAppend` re-indexes the part's rows so every note keeps its pitch, sets
     the key and writes the note as one undo step (`beginStroke` / `endStroke`) and
     `syncFromStore`s; disabled with the reason only when the bar is full or no eight-row key holds
     them all. A **ghost dot** (`ghost` slot: dashed amber ring, the note's name) follows a mouse
     over the neck (`onPointerEnter` on the place rects, `pointerType === "mouse"` only, cleared
     on the SVG's `pointerleave`), so where a press will land is seen before it lands — the user
     reported marks "falling on the wrong string"; the hit areas were checked against the drawn
     lines with `elementFromPoint` and match, so the fix is feedback. A row dot's click opens the same menu while the clock is stopped (running, the
     tap records, as before). Above the neck: **Play** plays the marks one after another, an eighth
     apart at the clock's tempo (`engine.playNotes(id, notes, spacing)` schedules them `spacing`
     seconds apart), **Clear** takes them all off, and **Key notes** hides or puts back the key's
     row dots all at once; a single row dot goes with **Remove from the fretboard** on its place, or
     Delete with it focused (`hiddenRows`, UI-only — read as fixed marks that could not be taken
     off, they got in the scratchpad's way; the user asked twice). **Reading aids** (the user pasted
     an ASCII tab and asked for a drawing they could interpret): the strings' names at the left of
     the nut as a tab writes them (`STRING_NAMES` = E A D G B e, low to high, the thin E on top;
     `stringName` slot, mono bold), every fret's number under the neck (0–12; the inlay frets and 0
     at full opacity, the rest at 55 %), and under the neck a **tablature readout** of the marks in
     the order they were put (`tabLines(notes, columns = 16)` in `fretPositions.ts`, pure: six lines
     "e|-3-…|", three characters a column, on the displays' dark readout — `tab` slot, mono `xs`,
     scrolls sideways when long). **Paste a tab** (`TabDialog`, `src/ui/TabDialog.tsx`, a button in
     the fold's row; the user could not get an arpeggio in by hand): a text tablature pasted from
     anywhere — `parseTab` in `src/state/tab.ts` (pure): lines that look like tab lines are grouped
     six at a time (a system, the thin E on top), the body after the first `|` is scanned column by
     column, a digit (two digits read together) is a note on that string, columns with a note are the
     steps, notes in one column a chord; systems follow in time — is written by `writeTab`
     (`src/ui/tabImport.ts`): `pickKeyFor` tries every root × scale × octave and keeps the key whose
     eight rows hold the most of the tab's distinct pitches (ties: a root on the tab's lowest note,
     then the plainer scale), `setInstanceKey` sets it, `tabToPatterns` lays the columns a step
     each, sixteen a pattern, `setTrack` writes them into the slot on screen and the ones after it
     (more than one → the chain becomes those slots), `engine.syncFromStore()`; notes the key has
     no row for are left out and counted. The dialog shows the read live ("16 steps · key La minor ·
     A3–A4 · 3 notes fit"), the toast repeats it, and the tab's notes go on the neck as marks.
     **Every melodic machine takes a tab** (the user asked for MONO-1): `writeTab` builds the track
     by kind (`trackFor`) — the chord grids (STR-6, POLY-4, EP-1) take every note of a column,
     MONO-1 and BASS-2 one note a step, the **highest** of a column (the melody sits on top of a
     tab's chords; BASS-2 gets no accents or slides); a kit returns null. The button sits in a
     "Tab" group after `PartTools` on MONO-1, BASS-2, POLY-4 and EP-1; STR-6 keeps it in its
     fretboard fold. **Time from the characters** (the user's half-bar arpeggio came out as eight
     consecutive sixteenths and left the bar half empty): `TabColumn` carries a `step` — the body's
     inner `|` split it into bars, a bar's characters are spread over sixteen steps (`floor(pos ×
16 / span)`), the first note starts its bar (what precedes it is the writer's margin), bars and
     systems carry on into the next pattern; when that would land two struck columns on one step (a
     bar written wider than its beats, no inner bar lines — the first arpeggio the user pasted, 16
     notes over 42 characters), the columns go one step each as before. `tabToPatterns` places by
     `step`, so a tab of eighths fills its bar. The
     marks
     are a scratchpad for reading a tablature — press the tab's positions, see their names, hear
     them. Two earlier shapes were built and taken out the same hour: a step-picker popover per dot,
     and a double-press to remove. **Tests**: under jsdom only the first Chakra menu opened in a
     document takes its items' presses (a later one, even from a fresh mount, ignores them — a real
     browser does not, checked by hand), so `Fretboard.test.tsx` opens one menu, "Add to STR-6" lives
     in `FretboardWrite.test.tsx`, and the next-free-step rule is unit-tested in
     `strikeNote.test.ts`; opening a menu in a test is press + click + `findByRole("menu")` + a
     30 ms wait. The neck
     **runs the whole width of the panel** (`scroller` slot: the SVG is `w: full`, `minW: 36rem`, and
     scrolls sideways inside the scroller when the panel is narrower — a phone), so on a wide rack the
     dots come out large.
   - ✅ Extra — **children's songs** as demos (`kidsSong` in `scripts/make-songs.mjs`, listed first in
     `index.json` as "· Infantil"): Sol, solet (Do, 92), Cargol, treu banya (Do, 96), El gegant del Pi
     (Sol, 100). STR-6 #1 picks the tune one note a column at octave 4 (the tune lines are digit strings
     over `ONE_NOTE`), STR-6 #2 strums I / V7 at octave 2, a square BASS-2 on the roots, a light DR-4;
     two intro bars of chords, then the song twice. The tunes are written from memory of the common
     school versions (no score was found online to check them against) — a wrong note is one cell away.
     **Silenci · Fingerpicking** (`silenci()`, 99 BPM, La menor, 38 bars): the accompaniment the user
     asked for under a sixties folk song (they brought its tab) — a picked eighth-note arpeggio (root,
     fifth, third, fifth) at octave 2, a second STR-6 strumming each half bar at octave 3, a square
     bass on the roots, drums from the second verse, over Am · G · C · F in the song's order. Chords
     and a generic picking pattern only, **no melody** and not the song's name: the demos ship CC0
     and the song is under copyright; the user's own copy with the title lives in `docs/`
     (never committed). Four more from a playlist the user pasted, the same way — the feel, own
     chords and lines, neutral names: **Daus · Drum & bass** (174, Fa menor: two-step DR-4, shaker
     PERC-6, a reese-ish saw BASS-2 with slides and a cutoff LFO, EP-1 stabs, POLY-4 pad, a square
     MONO-1 lead panned by an LFO; Intro / Build / Drop / Break / Drop / Outro, 60 bars), **Riera ·
     Folk** (116, Mi menor: picked and strummed STR-6s, congas on PERC-6 toms, 40 bars), **Passos ·
     Hip hop** (92, swing 0.2, Re menor: boom bap with drive and random level, EP-1 Dm7 / Gm7 /
     Bbmaj7 / Am7 through a dusty lowpass, square sub, sine MONO-1 hook, 56 bars) and **El Teu
     Camí · Rock** (132, Fa major: driving eighths, PERC-6 toms and crash in the chorus, saw bass on
     eighths, two driven STR-6s strumming and picking F · C · Bb · Dm, a saw MONO-1 solo, 72 bars).
     **Balanced by numbers**: `scripts/render-check.html` now prints a `STATS` line per song after
     `PASS` — peak and RMS in dBFS, and RMS/peak per four bars — so a mix can be judged without ears
     (a dip is a section that dropped out, a flat top the limiter working). Reference: Nit de Festa
     sits at −12.5 dB RMS in its full sections, breaks at −26, peaks around −1. The six new demos
     were rendered, levelled and rendered again until: full sections −12.5…−15 (Silenci and Riera,
     ballads, −15…−16), verses 1.5–2 dB under choruses, intros 3–15 dB under, peaks ≤ 0 (Passos
     and El Teu Camí started at −12 RMS with peaks at +2, the limiter never resting; Berlín's intro
     started as loud as its main — now four bars without the kick). The generator's instance calls
     are multi-line after Prettier, so edits to them are made with whitespace-tolerant regexes
     checked to match exactly once, never with plain string replaces (a first pass silently did
     nothing). The old hand-made `kamuffel-style.json` (a 16-bar loop) stays; **Berlín · Techno** (`berlin()`,
     128, Do menor, 64 bars) is the generated one the user asked for when they pasted Altes Kamuffel:
     four-on-the-floor with offbeat hats, a rolling sixteenth saw bass under a very slow triangle
     LFO on the cutoff, POLY-4 offbeat stabs, one bouncy saw MONO-1 motif with a little random pitch
     and a pan LFO, ping-pong delay; Intro / Build / Main / Break (no kick, a clap roll into the drop)
     / Main / Outro.

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

GitHub Pages: `.github/workflows/pages.yml` runs the tests and `BASE_PATH=/rack/ pnpm build` on every
push to `main` and publishes `dist/` at https://celtico.github.io/rack/. `BASE_PATH` becomes Vite's
`base`, so anything under `public/` must be reached through `import.meta.env.BASE_URL`, never a
leading `/`.

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
  pointer events with capture (a turn also ends when a move arrives with no button down or the capture
  is lost — a release outside the window used to leave the knob turning on the next pass over it; the
  side panel's resize handle does the same), `touch-action: none`, visible focus via `_focus` (any focus, pointer included —
  the user wants a knob just turned to stay marked; the `Fader` thumb does the same) and `data-active` while
  it is being turned (the pointer line lights amber).
- Responsive down to 360 px. The step grid may scroll horizontally; the controls may not.
- Respect `prefers-reduced-motion`.
- Tests to keep green: the scheduler fires the correct steps under a mocked transport, and store toggles
  apply without mutation.
