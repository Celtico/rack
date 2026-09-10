import { getEngine } from "../audio/engine"
import { PERC_VOICES, type PercVoiceId } from "../state/pattern"
import { PERC_LEVELS_DEFAULT, selectPattern, useRackStore } from "../state/store"
import { KitUnit } from "./KitUnit"

const VOICE_LABELS: Record<PercVoiceId, string> = {
  tomLo: "Tom lo",
  tomHi: "Tom hi",
  rim: "Rim",
  cowbell: "Cowbell",
  shaker: "Shaker",
  crash: "Crash",
}

/** PERC-6: six percussion voices on a 16-step grid. */
export function PercUnit() {
  const perc = useRackStore((s) => selectPattern(s).perc)
  const currentStep = useRackStore((s) => s.currentStep)
  const levels = useRackStore((s) => s.percLevels)
  const { togglePercStep, setPercLevel } = useRackStore.getState()

  const changeLevel = (voice: PercVoiceId, level: number) => {
    setPercLevel(voice, level)
    getEngine().setPercLevel(voice, level)
  }

  return (
    <KitUnit
      model="PERC-6"
      title="Percussion"
      finish="rust"
      channel="perc"
      voices={PERC_VOICES}
      labels={VOICE_LABELS}
      rows={perc}
      levels={levels}
      defaultLevels={PERC_LEVELS_DEFAULT}
      currentStep={currentStep}
      onToggle={togglePercStep}
      onLevel={changeLevel}
    />
  )
}
