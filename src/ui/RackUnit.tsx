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
  LuChevronRight,
  LuChevronUp,
  LuClipboardCopy,
  LuClipboardPaste,
  LuCopy,
  LuCopyPlus,
  LuDices,
  LuEllipsisVertical,
  LuHeadphones,
  LuRotateCcw,
  LuVolume2,
  LuVolumeX,
  LuX,
} from "react-icons/lu"

import { getEngine } from "../audio/engine"
import { toaster } from "../components/ui/toaster"
import { instanceLabel } from "../state/instances"
import { isHideableUnit, isPinnedUnit, useLayoutStore } from "../state/layout"
import { PATTERN_COUNT } from "../state/patterns"
import {
  copyTrack,
  selectInstance,
  selectTrack,
  silencedBySolo,
  useRackStore,
} from "../state/store"
import type { rackUnitRecipe } from "../theme/recipes/rackUnit"
import { useClipboardStore } from "./clipboard"
import { Fold } from "./Fold"
import { foldOnClick } from "./foldOnClick"
import { MiniGrid } from "./MiniGrid"
import { removeInstanceWithUndo, scrollToUnit, unitDomId } from "./removeInstance"
import { pushSound } from "./unitMeta"

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
  const soloed = useRackStore((s) => s.solo[id] === true)
  // Another machine is soloed and this one is not: it plays on but is not heard.
  const silenced = useRackStore((s) => instance && silencedBySolo(s.solo, id))
  const {
    toggleFold,
    setInstanceMute,
    setInstanceSolo,
    copyInstance,
    duplicateInstance,
    setTrack,
    resetInstanceSound,
    randomizeInstanceSound,
  } = useRackStore.getState()
  const activePattern = useRackStore((s) => s.activePattern)
  const part = useClipboardStore((s) => s.part)
  const { moveUnit, nudgeUnit, hideUnit, placeAfter } = useLayoutStore.getState()
  // The other machines of this kind — where this one's sound and part can be copied to. Selected as
  // one string, so a knob turned on another unit does not re-render every header in the rack.
  const kind = useRackStore((s) => (instance ? selectInstance(s, id)?.kind : undefined))
  const siblingKey = useRackStore((s) =>
    kind
      ? s.instances
          .filter((i) => i.kind === kind && i.id !== id)
          .map((i) => `${i.id}\u0000${instanceLabel(i, s.instances)}`)
          .join("\u0001")
      : "",
  )
  const siblings = siblingKey
    ? siblingKey.split("\u0001").map((s) => {
        const [sid, label] = s.split("\u0000") as [string, string]
        return { id: sid, label }
      })
    : []
  // The clipboard holds a part of this kind: it can be pasted here.
  const pasteable = kind !== undefined && part !== null && part.track.kind === kind
  // The grip arms dragging; the whole panel is only draggable while it is held.
  const [armed, setArmed] = useState(false)
  const [over, setOver] = useState(false)
  // Instances are removed; the transport, FX-2, BANK and SONG are hidden (and put back from "Add unit").
  const removable = !fixed && (instance || isHideableUnit(id))
  // The transport is pinned outside the swap pair: it has a grip for its menu, but never moves.
  const movable = !fixed && (!pinned || isPinnedUnit(id))

  const setMute = (next: boolean) => {
    setInstanceMute(id, next)
    getEngine().setInstanceMute(id, next)
  }
  const setSolo = (next: boolean) => {
    setInstanceSolo(id, next)
    getEngine().setInstanceSolo(id, next)
  }

  const remove = () => {
    if (instance) removeInstanceWithUndo(id, model)
    else hideUnit(id)
  }
  // "Copy to": onto another machine of the kind, or into a new one right under this.
  const copyTo = (target: string) => {
    if (target === "new") {
      const made = duplicateInstance(id)
      if (!made) return
      placeAfter(made.id, id)
      getEngine().addInstance(made)
      const label = instanceLabel(made, useRackStore.getState().instances)
      toaster.create({
        type: "success",
        title: `${model} copied`,
        description: `Now also ${label}.`,
      })
      scrollToUnit(made.id)
      return
    }
    if (!copyInstance(id, target)) return
    const to = useRackStore.getState().instances.find((i) => i.id === target)
    if (to) getEngine().setInstanceParams(target, to.params)
    const label = to ? instanceLabel(to, useRackStore.getState().instances) : target
    toaster.create({
      type: "success",
      title: `${model} copied to ${label}`,
      description: "Its sound and every pattern of its part. Undo with ⌘Z.",
    })
  }

  // Copy / paste a part: this machine's track in one bank slot, through the rack's clipboard.
  const copyPart = () => {
    const track = selectTrack(useRackStore.getState(), id)
    if (!track) return
    const from = `${model} · pattern ${activePattern + 1}`
    useClipboardStore.getState().setPart({ track: copyTrack(track), from })
    toaster.create({ type: "info", title: "Part copied", description: from })
  }
  const pastePart = (slot: number) => {
    if (!part || !setTrack(id, slot, part.track)) return
    toaster.create({
      type: "success",
      title: `Pasted on ${model} · pattern ${slot + 1}`,
      description: `From ${part.from}. Undo with ⌘Z.`,
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
  // The grip's menu: what drag does, for keyboards and touch screens (no HTML5 drag there).
  const randomSound = () => {
    randomizeInstanceSound(id)
    pushSound(id)
  }
  const factorySound = () => {
    resetInstanceSound(id)
    pushSound(id)
  }
  const onGripSelect = (value: string) => {
    if (value === "up") nudgeUnit(id, -1)
    else if (value === "down") nudgeUnit(id, 1)
    else if (value === "remove") remove()
    else if (value === "copy-part") copyPart()
    else if (value === "paste-part") pastePart(activePattern)
  }

  return (
    <chakra.section
      id={unitDomId(id)}
      css={styles.root}
      aria-label={title ? `${model} ${title}` : model}
      data-folded={folded ? "" : undefined}
      data-silenced={silenced ? "" : undefined}
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
        {/* `data-part="nameplate"`: what fades while another unit's solo silences this one. */}
        {icon && (
          <chakra.span css={styles.icon} data-part="nameplate" aria-hidden="true">
            {icon}
          </chakra.span>
        )}
        <chakra.h2 css={styles.model} data-part="nameplate">
          {model}
        </chakra.h2>
        {title && (
          <chakra.span css={styles.title} data-part="nameplate">
            {title}
          </chakra.span>
        )}
        {folded && (preview || instance) && (
          <chakra.span css={styles.preview} data-part="preview">
            {/* A folded machine: its pattern in miniature — the matrix shows what plays; no meter. */}
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
          {instance && (
            <IconButton
              size="xs"
              variant="ghost"
              color="inherit"
              aria-label={soloed ? `Unsolo ${model}` : `Solo ${model}`}
              aria-pressed={soloed}
              onClick={() => setSolo(!soloed)}
              _pressed={{ color: "rack.led.on" }}
            >
              <LuHeadphones />
            </IconButton>
          )}
          {instance && (
            <>
              {/* The sound only: the part in the grid stays. Both are one undo step. */}
              <IconButton
                size="xs"
                variant="ghost"
                color="inherit"
                aria-label={`Random sound for ${model}`}
                title="Random sound"
                onClick={randomSound}
              >
                <LuDices />
              </IconButton>
              <IconButton
                size="xs"
                variant="ghost"
                color="inherit"
                aria-label={`Reset ${model} to factory sound`}
                title="Factory sound"
                onClick={factorySound}
              >
                <LuRotateCcw />
              </IconButton>
            </>
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
        {(movable || removable) && (
          <Menu.Root
            onSelect={(details) => onGripSelect(details.value)}
            positioning={{ placement: "bottom-end" }}
          >
            <Menu.Trigger asChild>
              <chakra.button
                type="button"
                css={styles.grip}
                aria-label={movable ? `Move ${model}` : `Options for ${model}`}
                onPointerDown={() => movable && setArmed(true)}
                onPointerUp={() => setArmed(false)}
              >
                <LuEllipsisVertical />
              </chakra.button>
            </Menu.Trigger>
            <Portal>
              <Menu.Positioner>
                <Menu.Content>
                  {movable && (
                    <>
                      <Menu.Item value="up">
                        <LuArrowUp /> Move up
                      </Menu.Item>
                      <Menu.Item value="down">
                        <LuArrowDown /> Move down
                      </Menu.Item>
                    </>
                  )}
                  {instance && (
                    <Menu.Root
                      onSelect={(d) => copyTo(d.value)}
                      positioning={{ placement: "right-start", gutter: -2 }}
                    >
                      <Menu.TriggerItem>
                        <LuCopy /> Copy to
                        <chakra.span ml="auto" pl="2">
                          <LuChevronRight />
                        </chakra.span>
                      </Menu.TriggerItem>
                      <Portal>
                        <Menu.Positioner>
                          <Menu.Content>
                            <Menu.Item value="new">
                              <LuCopyPlus /> A new {model.replace(/ #\d+$/, "")}
                            </Menu.Item>
                            {siblings.map((s) => (
                              <Menu.Item key={s.id} value={s.id}>
                                {s.label}
                              </Menu.Item>
                            ))}
                          </Menu.Content>
                        </Menu.Positioner>
                      </Portal>
                    </Menu.Root>
                  )}
                  {instance && (
                    <>
                      <Menu.Item value="copy-part">
                        <LuClipboardCopy /> Copy part (pattern {activePattern + 1})
                      </Menu.Item>
                      {/* Paste lands on the pattern on screen, or on any slot of the bank. */}
                      <Menu.Item value="paste-part" disabled={!pasteable}>
                        <LuClipboardPaste /> Paste part{pasteable ? ` from ${part!.from}` : ""}
                      </Menu.Item>
                      {pasteable && (
                        <Menu.Root
                          onSelect={(d) => pastePart(Number(d.value))}
                          positioning={{ placement: "right-start", gutter: -2 }}
                        >
                          <Menu.TriggerItem>
                            <LuClipboardPaste /> Paste to pattern
                            <chakra.span ml="auto" pl="2">
                              <LuChevronRight />
                            </chakra.span>
                          </Menu.TriggerItem>
                          <Portal>
                            <Menu.Positioner>
                              <Menu.Content maxH="60vh" overflowY="auto">
                                {Array.from({ length: PATTERN_COUNT }, (_, i) => (
                                  <Menu.Item key={i} value={String(i)}>
                                    Pattern {i + 1}
                                    {i === activePattern ? " · on screen" : ""}
                                  </Menu.Item>
                                ))}
                              </Menu.Content>
                            </Menu.Positioner>
                          </Portal>
                        </Menu.Root>
                      )}
                    </>
                  )}
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
