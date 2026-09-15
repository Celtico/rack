import type { Kind } from "../state/pattern"
import { BassUnit } from "./BassUnit"
import { KitUnit } from "./KitUnit"
import { MonoSynth } from "./MonoSynth"
import { PolyUnit } from "./PolyUnit"
import { SamplerUnit } from "./SamplerUnit"
import { VideoUnit } from "./VideoUnit"

/** The panel for one machine, by kind. */
export function InstanceUnit({ id, kind }: { id: string; kind: Kind }) {
  switch (kind) {
    case "drums":
    case "perc":
      return <KitUnit id={id} />
    case "sampler":
      return <SamplerUnit id={id} />
    case "synth":
      return <MonoSynth id={id} />
    case "bass":
      return <BassUnit id={id} />
    case "poly":
    case "ep":
    case "strings":
      return <PolyUnit id={id} />
    case "video":
      return <VideoUnit id={id} />
  }
}
