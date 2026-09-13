import {
  chakra,
  IconButton,
  Menu,
  Portal,
  useSlotRecipe,
  type RecipeVariantProps,
} from "@chakra-ui/react"
import { useState, type DragEvent, type ReactNode } from "react"
import {
  LuArrowDown,
  LuArrowUp,
  LuChevronDown,
  LuChevronUp,
  LuEllipsisVertical,
  LuVolume2,
  LuVolumeX,
  LuX,
} from "react-icons/lu"

import { getEngine } from "../audio/engine"
import { isHideableUnit, isPinnedUnit, useLayoutStore } from "../state/layout"
import { useRackStore } from "../state/store"
import type { rackUnitRecipe } from "../theme/recipes/rackUnit"
import { Fold } from "./Fold"
import { foldOnClick } from "./foldOnClick"
import { MiniGrid } from "./MiniGrid"
import { removeInstanceWithUndo, unitDomId } from "./removeInstance"

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
  /** Always there: no grip, no fold, no remove. */
  fixed?: boolean
  /**
   * Folds but is never removed. The sticky panels (`PINNED_UNITS`) also swap
   * places with each other through the grip; anything else pinned has no grip.
   */
  pinned?: boolean
  children?: ReactNode
}

const DRAG_TYPE = "application/x-rack-unit"

export function RackUnit({
  id,
  model,
  title,
  instance = false,
  icon,
  preview,
  fixed = false,
  pinned = false,
  units,
  finish,
  children,
}: RackUnitProps) {
  const recipe = useSlotRecipe({ key: "rackUnit" })
  const styles = recipe({ units, finish })
  const folded = useRackStore((s) => !fixed && s.folded[id] === true)
  const muted = useRackStore((s) => s.instances.find((i) => i.id === id)?.mute ?? false)
  const { toggleFold, setInstanceMute } = useRackStore.getState()
  const { moveUnit, nudgeUnit, hideUnit } = useLayoutStore.getState()
  // The grip arms dragging; the whole panel is only draggable while it is held.
  const [armed, setArmed] = useState(false)
  const [over, setOver] = useState(false)
  // Instances are removed, FX-2 / BANK / SONG are hidden (and put back from "Add unit"); the transport stays.
  const removable = !fixed && (instance || isHideableUnit(id))
  const movable = !fixed && (!pinned || isPinnedUnit(id))

  const setMute = (next: boolean) => {
    setInstanceMute(id, next)
    getEngine().setInstanceMute(id, next)
  }

  const remove = () => {
    if (instance) removeInstanceWithUndo(id, model)
    else hideUnit(id)
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
  // The grip's menu: what drag does, for keyboards and touch screens (no HTML5 drag there).
  const onGripSelect = (value: string) => {
    if (value === "up") nudgeUnit(id, -1)
    else if (value === "down") nudgeUnit(id, 1)
    else if (value === "remove") remove()
  }

  return (
    <chakra.section
      id={unitDomId(id)}
      css={styles.root}
      aria-label={title ? `${model} ${title}` : model}
      data-folded={folded ? "" : undefined}
      data-drop-target={over ? "" : undefined}
      draggable={armed}
      onDragStart={onDragStart}
      onDragEnd={() => setArmed(false)}
      onDragOver={movable ? onDragOver : undefined}
      onDragLeave={() => setOver(false)}
      onDrop={movable ? onDrop : undefined}
    >
      {/* The whole header folds the unit; its own buttons are excluded by `foldOnClick`. */}
      <chakra.header
        css={styles.header}
        data-foldable={fixed ? undefined : ""}
        onClick={fixed ? undefined : foldOnClick(() => toggleFold(id))}
      >
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
          {!fixed && (
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
          )}
        </chakra.div>
        {movable && (
          <Menu.Root
            onSelect={(details) => onGripSelect(details.value)}
            positioning={{ placement: "bottom-end" }}
          >
            <Menu.Trigger asChild>
              <chakra.button
                type="button"
                css={styles.grip}
                aria-label={`Move ${model}`}
                onPointerDown={() => setArmed(true)}
                onPointerUp={() => setArmed(false)}
              >
                <LuEllipsisVertical />
              </chakra.button>
            </Menu.Trigger>
            <Portal>
              <Menu.Positioner>
                <Menu.Content>
                  <Menu.Item value="up">
                    <LuArrowUp /> Move up
                  </Menu.Item>
                  <Menu.Item value="down">
                    <LuArrowDown /> Move down
                  </Menu.Item>
                  {removable && (
                    <Menu.Item value="remove" color="fg.error">
                      <LuX /> Remove from rack
                    </Menu.Item>
                  )}
                </Menu.Content>
              </Menu.Positioner>
            </Portal>
          </Menu.Root>
        )}
      </chakra.header>
      <Fold open={!folded}>
        <chakra.div css={styles.body}>{children}</chakra.div>
      </Fold>
    </chakra.section>
  )
}
