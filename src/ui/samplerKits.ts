import { getEngine } from "../audio/engine"
import type { InstanceOf } from "../state/instances"
import { PAD_IDS } from "../state/pattern"
import { useRackStore } from "../state/store"

/**
 * The factory kit for SMP-8: eight CC0 one-shots served from `public/samples/`
 * (see the LICENSE.txt there), one per pad in this order.
 */
export const FACTORY_KIT = [
  { name: "Kick", file: "kick.wav" },
  { name: "Snare", file: "snare.wav" },
  { name: "Clap", file: "clap.wav" },
  { name: "Hat closed", file: "hat-closed.wav" },
  { name: "Hat open", file: "hat-open.wav" },
  { name: "Tom low", file: "tom-low.wav" },
  { name: "Tom high", file: "tom-high.wav" },
  { name: "Cymbal", file: "cymbal.wav" },
] as const

const KIT_URL = `${import.meta.env.BASE_URL}samples/bounce/`

/**
 * Fetch the factory kit into the pads of a sampler instance: bytes into the
 * browser's sample store (and the player, if the graph is built), names into
 * the song. `onlyEmpty` leaves pads that already hold a sample alone — what a
 * freshly added SMP-8 gets, so the user replaces sounds pad by pad from there.
 * Rejects on the first file that cannot be fetched.
 */
export async function loadFactoryKit(id: string, onlyEmpty = false): Promise<void> {
  const engine = getEngine()
  const { setInstanceParams } = useRackStore.getState()
  for (let i = 0; i < PAD_IDS.length; i++) {
    const pad = PAD_IDS[i]!
    const { name, file } = FACTORY_KIT[i]!
    const current = useRackStore.getState().instances.find((x) => x.id === id) as
      InstanceOf<"sampler"> | undefined
    if (!current) return
    if (onlyEmpty && current.params[pad].name !== null) continue
    const res = await fetch(`${KIT_URL}${file}`)
    if (!res.ok) throw new Error(`${file}: ${res.status}`)
    await engine.importSample(id, pad, name, await res.arrayBuffer())
    const inst = useRackStore.getState().instances.find((x) => x.id === id) as
      InstanceOf<"sampler"> | undefined
    if (!inst) return
    setInstanceParams(id, { [pad]: { ...inst.params[pad], name } })
  }
}
