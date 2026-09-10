import { chakra, IconButton, useSlotRecipe, type RecipeVariantProps } from "@chakra-ui/react"
import type { ReactNode } from "react"
import { LuChevronDown, LuChevronUp, LuVolume2, LuVolumeX } from "react-icons/lu"

import { getEngine } from "../audio/engine"
import type { ChannelId } from "../state/channels"
import { useRackStore } from "../state/store"
import type { rackUnitRecipe } from "../theme/recipes/rackUnit"

type RackUnitVariants = RecipeVariantProps<typeof rackUnitRecipe>

export interface RackUnitProps extends RackUnitVariants {
  /** Model name on the silkscreen, e.g. "DR-4". Also the fold key. */
  model: string
  /** Short description next to the model, e.g. "Drum machine". */
  title?: string
  /** Mixer channel this unit feeds — gives it a mute button. */
  channel?: ChannelId
  children?: ReactNode
}

const CORNERS = ["tl", "tr", "bl", "br"] as const

export function RackUnit({ model, title, channel, units, finish, children }: RackUnitProps) {
  const recipe = useSlotRecipe({ key: "rackUnit" })
  const styles = recipe({ units, finish })
  const folded = useRackStore((s) => s.folded[model] === true)
  const muted = useRackStore((s) => (channel ? s.mix.mute[channel] : false))
  const { toggleFold, setChannelMute } = useRackStore.getState()

  const toggleMute = () => {
    if (!channel) return
    setChannelMute(channel, !muted)
    getEngine().setChannelMute(channel, !muted)
  }

  return (
    <chakra.section
      css={styles.root}
      aria-label={title ? `${model} ${title}` : model}
      data-folded={folded ? "" : undefined}
    >
      {CORNERS.map((corner) => (
        <chakra.span key={corner} css={styles.screw} data-corner={corner} aria-hidden="true" />
      ))}
      <chakra.header css={styles.header}>
        <chakra.h2 css={styles.model}>{model}</chakra.h2>
        {title && <chakra.span css={styles.title}>{title}</chakra.span>}
        <chakra.div css={styles.controls}>
          {channel && (
            <IconButton
              size="xs"
              variant="ghost"
              color="inherit"
              aria-label={muted ? `Unmute ${model}` : `Mute ${model}`}
              aria-pressed={muted}
              onClick={toggleMute}
              _pressed={{ color: "rack.led.on" }}
            >
              {muted ? <LuVolumeX /> : <LuVolume2 />}
            </IconButton>
          )}
          <IconButton
            size="xs"
            variant="ghost"
            color="inherit"
            aria-label={folded ? `Expand ${model}` : `Fold ${model}`}
            aria-expanded={!folded}
            onClick={() => toggleFold(model)}
          >
            {folded ? <LuChevronDown /> : <LuChevronUp />}
          </IconButton>
        </chakra.div>
      </chakra.header>
      <chakra.div css={styles.body} hidden={folded}>
        {children}
      </chakra.div>
    </chakra.section>
  )
}
