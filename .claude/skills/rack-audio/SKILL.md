---
name: rack-audio
description: Audio engine rules for this project, using Tone.js. Use for any change under src/audio, to the scheduler, to instrument parameters, or anywhere a React component talks to the audio engine. Also use when debugging stale patterns, clicks on parameter changes, or a transport that will not start.
---

# Audio engine

Tone.js **15.1.22** (verified via `npm view tone version`, 2026-09-10).

## Separation — the one-directional rule

`src/audio` **does not import React**. Not `useRef`, not a type. Components call engine
methods; the engine does not know React exists.

The corollary, which is the rule most often broken: **no React component may create audio
nodes.** There is no `useEffect` that instantiates a `Tone.MembraneSynth`. If a component
needs a voice, the engine already owns it and exposes a method.

## Startup

The audio context can only open from a user gesture. `engine.build()` is called on the
first play, behind `Tone.start()`, is idempotent, and always returns the same instance.

```ts
let instance: AudioEngine | null = null

export function getEngine(): AudioEngine {
  if (!instance) instance = new AudioEngine()
  return instance
}

// in the transport's play handler — a real click, not an effect
await Tone.start()
getEngine().build()
```

Calling `build()` twice must not create a second set of nodes.

## Scheduling

Three rules, each of which produces a distinct bug when broken:

**The pattern lives in a ref**, or is read with `store.getState()` inside the callback —
never captured by the `Tone.Sequence` closure. A closure-captured pattern plays whatever
was on screen when the sequence was constructed; edits during playback are silently
ignored.

```ts
// wrong — plays the pattern from ten seconds ago
const seq = new Tone.Sequence(
  (time, step) => {
    if (pattern[step]) kick.triggerAttackRelease("C1", "8n", time)
  },
  steps,
  "16n",
)

// right
const seq = new Tone.Sequence(
  (time, step) => {
    const { pattern } = useStore.getState()
    if (pattern.kick[step]) kick.triggerAttackRelease("C1", "8n", time)
  },
  steps,
  "16n",
)
```

**Everything that sounds uses the `time` argument** from the callback. No `Date.now()`, no
`setTimeout`, no React timers. The callback runs ahead of the audio clock; `time` is the
only correct schedule point.

**UI updates go through `Draw.schedule`**, never straight from the audio callback:

```ts
Tone.getDraw().schedule(() => {
  useStore.getState().setCurrentStep(step)
}, time)
```

Writing to the store directly from the audio callback repaints early and jitters.

## Parameters

- Value changes use `rampTo` with **20–50 ms**, to avoid clicks:
  `filter.frequency.rampTo(value, 0.03)`
- Nodes are created **once**. If a parameter is not automatable and the node must be
  rebuilt, do it deliberately and `dispose()` the old one — a dropped reference keeps
  running and keeps making sound.

## Tone v15 API

The transport and draw singletons are accessed through getters:

```ts
Tone.getTransport() // not Tone.Transport
Tone.getDraw() // not Tone.Draw
Tone.getDestination() // not Tone.Destination
```

The bare `Tone.Transport` properties were removed in v15. Check `package.json` before
trusting any example that uses them — most material online predates v15.

## Signal flow

Master bus, an FX bus (delay → reverb) and per-channel sends. Instruments connect to their
channel; channels connect to master and, via a send, to the FX bus. Wire this in the engine
at `build()` time, never per-component.

## Testing

The scheduler must be testable with a mocked transport: keep the step-selection logic in a
pure function that takes `(pattern, step)` and returns what to trigger, so a test can assert
the correct steps fire without a real audio context. Store toggles apply immutably.
