import {
  Button,
  chakra,
  HStack,
  IconButton,
  Input,
  Menu,
  NativeSelect,
  Portal,
  Text,
  useSlotRecipe,
  VStack,
  type SystemStyleObject,
} from "@chakra-ui/react"
import { useCallback, useRef, useState, type DragEvent, type KeyboardEvent } from "react"
import {
  LuArrowDown,
  LuArrowUp,
  LuCopy,
  LuEllipsisVertical,
  LuEraser,
  LuLayoutList,
  LuPaintBucket,
  LuPlus,
  LuRepeat,
  LuRepeat1,
  LuRepeat2,
  LuTrash2,
} from "react-icons/lu"

import { STEP_COUNT } from "../state/pattern"
import { MAX_CHAIN, PATTERN_COUNT } from "../state/patterns"
import {
  SECTION_LENGTHS,
  SECTION_NAMES,
  sectionSpans,
  STRUCTURES,
  type SectionSpan,
} from "../state/sections"
import { useRackStore } from "../state/store"
import { droppedPattern, PATTERN_DRAG, useClearOnDragEnd } from "./dragTypes"
import { typeSlotDigit, type TypedDigit } from "./typeSlot"

/** What a bank slot dragged into the timeline lands on. */
type DropSpot = { kind: "bar"; bar: number } | { kind: "add" } | { kind: "section"; index: number }
const sameSpot = (a: DropSpot | null, b: DropSpot) =>
  a !== null &&
  a.kind === b.kind &&
  (a.kind !== "bar" || a.bar === (b as { bar: number }).bar) &&
  (a.kind !== "section" || a.index === (b as { index: number }).index)

/**
 * Drag-and-drop handlers for one spot: a bank slot dropped on a bar sets that
 * bar's pattern, on the + appends a bar of it, on a section's name fills the
 * section with it. `over` outlines the spot under the drag.
 */
function dropHandlers(
  spot: DropSpot,
  over: DropSpot | null,
  setOver: (spot: DropSpot | null) => void,
  onDrop: (pattern: number) => void,
) {
  return {
    "data-drop-target": sameSpot(over, spot) ? "" : undefined,
    onDragOver: (e: DragEvent<HTMLElement>) => {
      if (!e.dataTransfer.types.includes(PATTERN_DRAG)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = "copy"
      if (!sameSpot(over, spot)) setOver(spot)
    },
    onDragLeave: () => {
      if (sameSpot(over, spot)) setOver(null)
    },
    onDrop: (e: DragEvent<HTMLElement>) => {
      setOver(null)
      const pattern = droppedPattern(e.dataTransfer)
      if (pattern === null) return
      e.preventDefault()
      e.stopPropagation()
      onDrop(pattern)
    },
  }
}

/** The fill across the sounding bar's 16 steps; only this re-renders per step. */
function BarProgress({ css }: { css: SystemStyleObject | undefined }) {
  const currentStep = useRackStore((s) => s.currentStep)
  const progress = currentStep >= 0 ? ((currentStep + 1) / STEP_COUNT) * 100 : 0
  return <chakra.span css={css} style={{ width: `${progress}%` }} />
}

type Styles = Record<string, SystemStyleObject | undefined>

const NAME_LIST_ID = "song-section-names"

/**
 * A section's header: its name (click to rename), its length as a select, and a
 * menu with what else can be done to it — fill with the pattern on screen,
 * duplicate, move, remove.
 */
function SectionHeader({
  styles,
  index,
  span,
  count,
  over,
  setOver,
}: {
  styles: Styles
  index: number
  span: SectionSpan
  count: number
  over: DropSpot | null
  setOver: (spot: DropSpot | null) => void
}) {
  const activePattern = useRackStore((s) => s.activePattern)
  const { renameSection, setSectionBars, fillSection, duplicateSection, moveSection, removeSection } =
    useRackStore.getState()
  const [draft, setDraft] = useState<string | null>(null)
  const full = useRackStore((s) => s.chain.length >= MAX_CHAIN)
  const label = span.name || `Section ${index + 1}`
  // The offered lengths, plus the section's own when it is none of them.
  const lengths = SECTION_LENGTHS.includes(span.bars as (typeof SECTION_LENGTHS)[number])
    ? SECTION_LENGTHS
    : [...SECTION_LENGTHS, span.bars].sort((a, b) => a - b)

  const commit = (keep: boolean) => {
    if (draft !== null && keep) renameSection(index, draft)
    setDraft(null)
  }
  const onSelect = (value: string) => {
    if (value === "fill") fillSection(index, activePattern)
    else if (value === "duplicate") duplicateSection(index)
    else if (value === "up") moveSection(index, -1)
    else if (value === "down") moveSection(index, 1)
    else if (value === "remove") removeSection(index)
  }

  return (
    <chakra.div css={styles.sectionHeader}>
      {draft === null ? (
        <chakra.button
          type="button"
          css={styles.sectionName}
          aria-label={`Rename section ${label}`}
          title="Click to rename · drop a bank slot here to fill the section with it"
          onClick={() => setDraft(span.name)}
          {...dropHandlers({ kind: "section", index }, over, setOver, (p) =>
            fillSection(index, p),
          )}
        >
          {label}
        </chakra.button>
      ) : (
        <Input
          size="xs"
          rounded="sm"
          w="40"
          value={draft}
          list={NAME_LIST_ID}
          aria-label={`New name for section ${label}`}
          data-inline-field="true"
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(true)}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== "Escape") return
            e.preventDefault()
            commit(e.key === "Enter")
          }}
        />
      )}
      <chakra.span css={styles.sectionMeta}>
        bars {span.start + 1}–{span.start + span.bars}
      </chakra.span>
      <NativeSelect.Root size="xs" w="24">
        <NativeSelect.Field
          value={span.bars}
          aria-label={`Length of ${label}`}
          onChange={(e) => setSectionBars(index, Number(e.target.value))}
        >
          {lengths.map((n) => (
            <option key={n} value={n}>
              {n} bar{n === 1 ? "" : "s"}
            </option>
          ))}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
      <Menu.Root onSelect={(d) => onSelect(d.value)} positioning={{ placement: "bottom-start" }}>
        <Menu.Trigger asChild>
          <IconButton size="xs" variant="ghost" rounded="sm" aria-label={`Options for ${label}`}>
            <LuEllipsisVertical />
          </IconButton>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content>
              <Menu.Item value="fill">
                <LuPaintBucket /> Fill with pattern {activePattern + 1}
              </Menu.Item>
              <Menu.Item value="duplicate" disabled={full}>
                <LuCopy /> Duplicate
              </Menu.Item>
              <Menu.Item value="up" disabled={index === 0}>
                <LuArrowUp /> Move up
              </Menu.Item>
              <Menu.Item value="down" disabled={index >= count - 1}>
                <LuArrowDown /> Move down
              </Menu.Item>
              <Menu.Item value="remove" color="fg.error">
                <LuTrash2 /> Remove section
              </Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
    </chakra.div>
  )
}

/** The row that adds a section (name, length, on the pattern on screen) or lays out a whole structure. */
function AddSection() {
  const activePattern = useRackStore((s) => s.activePattern)
  const full = useRackStore((s) => s.chain.length >= MAX_CHAIN)
  const { addSection, applyStructure } = useRackStore.getState()
  const [name, setName] = useState("")
  const [bars, setBars] = useState<number>(8)

  const add = () => {
    addSection(name, bars)
    setName("")
  }

  return (
    <HStack gap="2" wrap="wrap" align="center">
      <Input
        size="xs"
        rounded="sm"
        w="36"
        value={name}
        list={NAME_LIST_ID}
        placeholder="Section name"
        aria-label="Name of the new section"
        data-inline-field="true"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || full) return
          e.preventDefault()
          add()
        }}
      />
      <datalist id={NAME_LIST_ID}>
        {SECTION_NAMES.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <NativeSelect.Root size="xs" w="24">
        <NativeSelect.Field
          value={bars}
          aria-label="Length of the new section"
          onChange={(e) => setBars(Number(e.target.value))}
        >
          {SECTION_LENGTHS.map((n) => (
            <option key={n} value={n}>
              {n} bar{n === 1 ? "" : "s"}
            </option>
          ))}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
      <Button
        size="xs"
        rounded="sm"
        variant="outline"
        onClick={add}
        disabled={full}
        aria-label={`Add a section of ${bars} bars of pattern ${activePattern + 1}`}
      >
        <LuPlus /> Add section
      </Button>
      {/* A whole song's skeleton in one go, every bar on the pattern on screen; replaces the song. */}
      <Menu.Root
        onSelect={(d) => {
          const structure = STRUCTURES.find((s) => s.name === d.value)
          if (structure) applyStructure(structure.sections)
        }}
      >
        <Menu.Trigger asChild>
          <Button size="xs" rounded="sm" variant="outline" aria-label="Lay out a song structure">
            <LuLayoutList /> Structure
          </Button>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content>
              {STRUCTURES.map((s) => (
                <Menu.Item key={s.name} value={s.name}>
                  {s.name}
                </Menu.Item>
              ))}
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
    </HStack>
  )
}

/**
 * SONG: the chain laid out as bars, grouped under their sections when the song
 * has any (Intro 8, Verse 16…). Click a bar to cycle its pattern, or type the
 * pattern's number on it, × to drop it, + to append the active pattern. While
 * playing, the sounding bar is outlined and fills across its 16 steps.
 */
export function TimelineUnit() {
  const recipe = useSlotRecipe({ key: "songTimeline" })
  const styles = recipe()
  const chain = useRackStore((s) => s.chain)
  const sections = useRackStore((s) => s.sections)
  const activePattern = useRackStore((s) => s.activePattern)
  const playingBar = useRackStore((s) => s.playingBar)
  const followSong = useRackStore((s) => s.followSong)
  const {
    appendToChain,
    repeatLastBar,
    repeatChain,
    setChainSlot,
    removeChainSlot,
    clearChain,
    setFollowSong,
  } = useRackStore.getState()
  const full = chain.length >= MAX_CHAIN
  // The last digit typed on a bar, so "1" then "3" makes 13.
  const typed = useRef<TypedDigit | null>(null)
  // The spot a bank slot is being dragged over.
  const [over, setOver] = useState<DropSpot | null>(null)
  const clearOver = useCallback(() => setOver(null), [])
  useClearOnDragEnd(over !== null, clearOver)

  const onBarKeyDown = (bar: number, pattern: number) => (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      setChainSlot(bar, (pattern + 1) % PATTERN_COUNT)
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault()
      removeChainSlot(bar)
    } else if (!e.altKey && !e.ctrlKey && !e.metaKey) {
      const hit = typeSlotDigit(typed.current, e.key, bar, e.timeStamp)
      if (!hit) return
      e.preventDefault()
      typed.current = hit.pending
      setChainSlot(bar, hit.slot)
    }
  }

  // A slot picked from the bank loops on its own: no bar of the song is sounding then.
  const playingIndex =
    followSong && playingBar >= 0 && chain.length > 0 ? playingBar % chain.length : -1

  // Without sections the whole chain is one nameless group.
  const spans = sectionSpans(sections)
  const groups: SectionSpan[] =
    spans.length > 0 ? spans : [{ name: "", bars: chain.length, start: 0 }]

  const bar = (index: number) => {
    const pattern = chain[index]!
    return (
      <chakra.div key={index} css={styles.bar}>
        <chakra.span css={styles.ruler} aria-hidden="true">
          {index + 1}
        </chakra.span>
        <chakra.div
          role="listitem"
          css={styles.block}
          data-pattern={pattern + 1}
          data-playing={index === playingIndex ? "" : undefined}
          tabIndex={0}
          aria-label={`Bar ${index + 1}: pattern ${pattern + 1}`}
          onClick={() => setChainSlot(index, (pattern + 1) % PATTERN_COUNT)}
          onKeyDown={onBarKeyDown(index, pattern)}
          {...dropHandlers({ kind: "bar", bar: index }, over, setOver, (p) =>
            setChainSlot(index, p),
          )}
        >
          <chakra.span css={styles.number}>{pattern + 1}</chakra.span>
          {index === playingIndex && <BarProgress css={styles.progress} />}
          <chakra.button
            type="button"
            css={styles.remove}
            aria-label={`Remove bar ${index + 1}`}
            onClick={(e) => {
              e.stopPropagation()
              removeChainSlot(index)
            }}
          >
            ×
          </chakra.button>
        </chakra.div>
      </chakra.div>
    )
  }

  return (
    <VStack gap="3" align="stretch">
      <chakra.div css={styles.root}>
        {groups.map((span, i) => (
          <chakra.section
            key={i}
            css={styles.section}
            aria-label={spans.length > 0 ? span.name || `Section ${i + 1}` : undefined}
          >
            {spans.length > 0 && (
              <SectionHeader
                styles={styles}
                index={i}
                span={span}
                count={spans.length}
                over={over}
                setOver={setOver}
              />
            )}
            <chakra.div
              css={styles.track}
              role="list"
              aria-label={spans.length > 0 ? `${span.name || `Section ${i + 1}`} bars` : "Song bars"}
            >
              {Array.from({ length: span.bars }, (_, b) => bar(span.start + b))}
              {/* The + after the last bar: one more bar of the pattern on screen, joining the last section. */}
              {i === groups.length - 1 && !full && (
                <chakra.div css={styles.bar}>
                  <chakra.span css={styles.ruler} aria-hidden="true">
                    {chain.length + 1}
                  </chakra.span>
                  <chakra.button
                    type="button"
                    css={styles.add}
                    aria-label={`Add a bar of pattern ${activePattern + 1}`}
                    onClick={() => appendToChain(activePattern)}
                    {...dropHandlers({ kind: "add" }, over, setOver, appendToChain)}
                  >
                    <LuPlus />
                  </chakra.button>
                </chakra.div>
              )}
            </chakra.div>
          </chakra.section>
        ))}
      </chakra.div>

      <AddSection />

      <HStack gap="3" wrap="wrap" align="center">
        <Text textStyle="silkscreen" color="rack.silkscreen.muted">
          {chain.length === 0
            ? `No bars — looping pattern ${activePattern + 1}. Click + to build a song, or lay out a structure.`
            : followSong
              ? `${chain.length} bar${chain.length === 1 ? "" : "s"}${sections.length > 0 ? ` in ${sections.length} section${sections.length === 1 ? "" : "s"}` : ""} · click a bar to change its pattern, or type its number`
              : `Looping pattern ${activePattern + 1} — the song is paused`}
        </Text>
        {chain.length > 0 && !followSong && (
          <Button
            size="xs"
            rounded="sm"
            variant="solid"
            colorPalette="orange"
            onClick={() => setFollowSong(true)}
            aria-label="Resume the song"
          >
            <LuRepeat /> Play song
          </Button>
        )}
        {/* More of the same: the last bar once more, or the whole song after itself. */}
        <Button
          size="xs"
          rounded="sm"
          variant="outline"
          onClick={repeatLastBar}
          disabled={chain.length === 0 || full}
          aria-label="Repeat the last bar"
          ml="auto"
        >
          <LuRepeat1 /> +1 bar
        </Button>
        <Button
          size="xs"
          rounded="sm"
          variant="outline"
          onClick={repeatChain}
          disabled={chain.length === 0 || full}
          aria-label="Repeat the whole song once more"
        >
          <LuRepeat2 /> ×2
        </Button>
        <Button
          size="xs"
          rounded="sm"
          variant="outline"
          onClick={clearChain}
          disabled={chain.length === 0}
          aria-label="Clear song"
        >
          <LuEraser /> Clear
        </Button>
      </HStack>
    </VStack>
  )
}
