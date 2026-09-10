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
import { toaster } from "../components/ui/toaster"
import { HIDEABLE_UNITS, isFixedUnit, useLayoutStore } from "../state/layout"
import { useRackStore } from "../state/store"
import type { rackUnitRecipe } from "../theme/recipes/rackUnit"
import { MiniGrid } from "./MiniGrid"

type RackUnitVariants = RecipeVariantProps<typeof rackUnitRecipe>

export interface RackUnitProps extends RackUnitVariants {
  /** Unit id: a fixed unit name or an instance id. Keys fold state, order and removal. */
  id: string
  /** Model name on the silkscreen, e.g. "DR-4 #2". */
  model: string
  /** Short description next to the model, e.g. "Drum machine". */
  title?: string
  /** True for machines: gives the header a mute button and a pattern thumbnail when folded. */
  instance?: boolean
  /** Pictogram of what the unit is, before the model name. */
  icon?: ReactNode
  /** What the header shows while folded. Machines default to their pattern thumbnail. */
  preview?: ReactNode
  children?: ReactNode
}

const CORNERS = ["tl", "tr", "bl", "br"] as const
const DRAG_TYPE = "application/x-rack-unit"

export function RackUnit({
  id,
  model,
  title,
  instance = false,
  icon,
  preview,
  units,
  finish,
  children,
}: RackUnitProps) {
  const recipe = useSlotRecipe({ key: "rackUnit" })
  const styles = recipe({ units, finish })
  const folded = useRackStore((s) => s.folded[id] === true)
  const muted = useRackStore((s) => s.instances.find((i) => i.id === id)?.mute ?? false)
  const { toggleFold, setInstanceMute, removeInstance, restoreInstance } = useRackStore.getState()
  const { moveUnit, nudgeUnit, hideUnit } = useLayoutStore.getState()
  // The grip arms dragging; the whole panel is only draggable while it is held.
  const [armed, setArmed] = useState(false)
  const [over, setOver] = useState(false)
  const removable = instance || (isFixedUnit(id) && HIDEABLE_UNITS.includes(id))

  const setMute = (next: boolean) => {
    setInstanceMute(id, next)
    getEngine().setInstanceMute(id, next)
  }

  const remove = () => {
    if (!instance) {
      hideUnit(id)
      return
    }
    const removed = removeInstance(id)
    if (!removed) return
    getEngine().removeInstance(id)
    toaster.create({
      type: "info",
      title: `${model} removed`,
      description: "Its patterns went with it.",
      action: {
        label: "Undo",
        onClick: () => {
          restoreInstance(removed)
          getEngine().addInstance(removed.instance)
        },
      },
    })
  }

  const onDragStart = (e: DragEvent) => {
    e.dataTransfer.setData(DRAG_TYPE, id)
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
    if (!source || source === id) return
    e.preventDefault()
    moveUnit(source, id)
  }
  const onGripKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowUp") nudgeUnit(id, -1)
    else if (e.key === "ArrowDown") nudgeUnit(id, 1)
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
        {icon && (
          <chakra.span css={styles.icon} aria-hidden="true">
            {icon}
          </chakra.span>
        )}
        <chakra.h2 css={styles.model}>{model}</chakra.h2>
        {title && <chakra.span css={styles.title}>{title}</chakra.span>}
        {folded && (preview || instance) && (
          <chakra.span css={styles.preview} data-part="preview">
            {preview ?? <MiniGrid id={id} label={model} />}
          </chakra.span>
        )}
        <chakra.div css={styles.controls}>
          {instance && (
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
            // Chakra's ghost button paints a box while "expanded"; on a light finish it reads as a black square.
            _expanded={{ bg: "transparent" }}
            onClick={() => toggleFold(id)}
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
      </chakra.header>
      <chakra.div css={styles.body} hidden={folded}>
        {children}
      </chakra.div>
    </chakra.section>
  )
}
