import { chakra, IconButton, useSlotRecipe, type RecipeVariantProps } from "@chakra-ui/react"
import { useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react"
import {
  LuChevronDown,
  LuChevronUp,
  LuGripVertical,
  LuVolume2,
  LuVolumeX,
  LuX,
} from "react-icons/lu"

import { getEngine } from "../audio/engine"
import type { ChannelId } from "../state/channels"
import { FIXED_UNITS, useLayoutStore, UNIT_IDS, type UnitId } from "../state/layout"
import { useRackStore } from "../state/store"
import type { rackUnitRecipe } from "../theme/recipes/rackUnit"
import { Scope } from "./Scope"

type RackUnitVariants = RecipeVariantProps<typeof rackUnitRecipe>

export interface RackUnitProps extends RackUnitVariants {
  /** Model name on the silkscreen, e.g. "DR-4". Also the unit's id for fold, order and removal. */
  model: UnitId
  /** Short description next to the model, e.g. "Drum machine". */
  title?: string
  /** Mixer channel this unit feeds — gives it a mute button and a scope when folded. */
  channel?: ChannelId
  /** Pictogram of what the unit is, before the model name. */
  icon?: ReactNode
  children?: ReactNode
}

const CORNERS = ["tl", "tr", "bl", "br"] as const
const DRAG_TYPE = "application/x-rack-unit"

const isUnitId = (v: string): v is UnitId => UNIT_IDS.includes(v as UnitId)

export function RackUnit({ model, title, channel, icon, units, finish, children }: RackUnitProps) {
  const recipe = useSlotRecipe({ key: "rackUnit" })
  const styles = recipe({ units, finish })
  const folded = useRackStore((s) => s.folded[model] === true)
  const muted = useRackStore((s) => (channel ? s.mix.mute[channel] : false))
  const { toggleFold, setChannelMute } = useRackStore.getState()
  const { moveUnit, nudgeUnit, hideUnit } = useLayoutStore.getState()
  // The grip arms dragging; the whole panel is only draggable while it is held.
  const [armed, setArmed] = useState(false)
  const [over, setOver] = useState(false)
  const removable = !FIXED_UNITS.includes(model)

  const setMute = (next: boolean) => {
    if (!channel) return
    setChannelMute(channel, next)
    getEngine().setChannelMute(channel, next)
  }

  const remove = () => {
    setMute(true)
    hideUnit(model)
  }

  const onDragStart = (e: DragEvent) => {
    e.dataTransfer.setData(DRAG_TYPE, model)
    e.dataTransfer.effectAllowed = "move"
  }
  const onDragOver = (e: DragEvent) => {
    if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setOver(true)
  }
  const onDrop = (e: DragEvent) => {
    const source = e.dataTransfer.getData(DRAG_TYPE)
    setOver(false)
    if (!isUnitId(source) || source === model) return
    e.preventDefault()
    moveUnit(source, model)
  }
  const onGripKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowUp") nudgeUnit(model, -1)
    else if (e.key === "ArrowDown") nudgeUnit(model, 1)
    else return
    e.preventDefault()
  }

  return (
    <chakra.section
      css={styles.root}
      aria-label={title ? `${model} ${title}` : model}
      data-folded={folded ? "" : undefined}
      data-drop-target={over ? "" : undefined}
      draggable={armed}
      onDragStart={onDragStart}
      onDragEnd={() => setArmed(false)}
      onDragOver={onDragOver}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      {CORNERS.map((corner) => (
        <chakra.span key={corner} css={styles.screw} data-corner={corner} aria-hidden="true" />
      ))}
      <chakra.header css={styles.header}>
        <chakra.button
          type="button"
          css={styles.grip}
          aria-label={`Move ${model} (drag, or arrow keys)`}
          onPointerDown={() => setArmed(true)}
          onPointerUp={() => setArmed(false)}
          onKeyDown={onGripKey}
        >
          <LuGripVertical />
        </chakra.button>
        {icon && (
          <chakra.span css={styles.icon} aria-hidden="true">
            {icon}
          </chakra.span>
        )}
        <chakra.h2 css={styles.model}>{model}</chakra.h2>
        {title && <chakra.span css={styles.title}>{title}</chakra.span>}
        {folded && channel && (
          <chakra.span css={styles.scope}>
            <Scope channel={channel} />
          </chakra.span>
        )}
        <chakra.div css={styles.controls}>
          {channel && (
            <IconButton
              size="xs"
              variant="ghost"
              color="inherit"
              aria-label={muted ? `Unmute ${model}` : `Mute ${model}`}
              aria-pressed={muted}
              onClick={() => setMute(!muted)}
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
          {removable && (
            <IconButton
              size="xs"
              variant="ghost"
              color="inherit"
              aria-label={`Remove ${model} from the rack`}
              onClick={remove}
            >
              <LuX />
            </IconButton>
          )}
        </chakra.div>
      </chakra.header>
      <chakra.div css={styles.body} hidden={folded}>
        {children}
      </chakra.div>
    </chakra.section>
  )
}
