import { getEngine } from "../audio/engine"
import { DRUM_VOICES, type DrumVoiceId } from "../state/pattern"
import { DRUM_LEVELS_DEFAULT, selectPattern, useRackStore } from "../state/store"
import { KitUnit } from "./KitUnit"

const VOICE_LABELS: Record<DrumVoiceId, string> = {
  kick: "Kick",
  snare: "Snare",
  clap: "Clap",
  hat: "Hat",
}

/** DR-4: four drum voices on a 16-step grid. */
export function DrumMachine() {
  const drums = useRackStore((s) => selectPattern(s).drums)
  const currentStep = useRackStore((s) => s.currentStep)
  const levels = useRackStore((s) => s.drumLevels)
  const { toggleDrumStep, setDrumLevel } = useRackStore.getState()

  const changeLevel = (voice: DrumVoiceId, level: number) => {
    setDrumLevel(voice, level)
    getEngine().setDrumLevel(voice, level)
  }

  return (
    <KitUnit
      model="DR-4"
      title="Drum machine"
      finish="red"
      channel="drums"
      voices={DRUM_VOICES}
      labels={VOICE_LABELS}
      rows={drums}
      levels={levels}
      defaultLevels={DRUM_LEVELS_DEFAULT}
      currentStep={currentStep}
      onToggle={toggleDrumStep}
      onLevel={changeLevel}
    />
  )
}
