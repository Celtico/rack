import { Button, chakra, HStack, Menu, Portal, useSlotRecipe } from "@chakra-ui/react"
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react"
import { LuEraser, LuKeyRound, LuPlay } from "react-icons/lu"

import { getEngine } from "../audio/engine"
import { instanceLabel } from "../state/instances"
import {
  noteLabel,
  SCALE_LABELS,
  solfegeName,
  solfegeShort,
  spelledWithSharps,
  type KeyParams,
} from "../state/key"
import { rowNotes, STEP_COUNT } from "../state/pattern"
import { selectInstance, selectTrack, useRackStore, type RackState } from "../state/store"
import {
  FRET_COUNT,
  MARKER_FRETS,
  midiOf,
  noteAt,
  positionOf,
  STRING_COUNT,
  STRING_NAMES,
  tabLines,
} from "./fretPositions"
import { applyAppend, nextFreeStep, planAppend, strikeNote, type AppendPlan } from "./strikeNote"
import { TabDialog } from "./TabDialog"

// Geometry, in SVG units: the nut, then FRET_COUNT frets of FRET_W; the high E on top.
const NUT_X = 62
const FRET_W = 44
const STRING_GAP = 22
const TOP = 16
const DOT_R = 10
const WIDTH = NUT_X + FRET_COUNT * FRET_W + 8
const NECK_BOTTOM = TOP + (STRING_COUNT - 1) * STRING_GAP
const HEIGHT = NECK_BOTTOM + 26
/** How long a struck dot stays lit. */
const HIT_MS = 180

const fretX = (fret: number) => NUT_X + fret * FRET_W
/** A dot sits between two frets, or just before the nut for an open string. */
const dotX = (fret: number) => (fret === 0 ? NUT_X - DOT_R - 5 : NUT_X + (fret - 0.5) * FRET_W)
/** Model string 0 is the low E, drawn at the bottom. */
const stringY = (string: number) => TOP + (STRING_COUNT - 1 - string) * STRING_GAP

const FRETS = Array.from({ length: FRET_COUNT + 1 }, (_, i) => i)
const STRINGS = Array.from({ length: STRING_COUNT }, (_, i) => i)

const sameRows = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((r, i) => r === b[i])

/** A note the user put on the neck by hand: a string and fret, kept in the order they were placed. */
interface Mark {
  string: number
  fret: number
}
const markKey = (m: Mark) => `${m.string}:${m.fret}`

/** The place the menu hangs from: a string and fret, the note there, its row if the key has one. */
interface Picked extends Mark {
  note: string
  row: number | null
  rect: { x: number; y: number; width: number; height: number }
}

/**
 * What a press on the neck opens: the note at that string and fret, then Add
 * (a mark on the neck) or Remove (the mark there), and "Add to STR-6" — the
 * note into the pattern on screen at its next free step, a tab read left to
 * right. Disabled, with the reason, when the key has no row for the note or
 * the pattern is full.
 */
function PlaceMenu({
  id,
  picked,
  marked,
  removable,
  onClose,
  onAdd,
  onRemove,
}: {
  id: string
  picked: Picked | null
  /** The place holds a mark (Add is not offered again). */
  marked: boolean
  /** Something can be taken off the place: a mark, or one of the key's dots. */
  removable: boolean
  onClose: () => void
  onAdd: (place: Mark) => void
  onRemove: (place: Mark) => void
}) {
  const label = useRackStore((s) => {
    const inst = selectInstance(s, id)
    return inst ? instanceLabel(inst, s.instances) : "STR-6"
  })
  // The plan for "Add to STR-6": the next free step, and the key it takes when the current one has
  // no row for the note (re-read whenever the part changes under the open menu).
  const track = useRackStore((s) => selectTrack(s, id))
  const plan = useMemo(
    () => (picked ? planAppend(id, midiOf(picked.note)!) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `track` is what the plan reads
    [id, picked, track],
  )
  // The menu closes (and `picked` goes) before the item's select arrives: act on the last place.
  const last = useRef<{ place: Picked; plan: AppendPlan | null } | null>(null)
  useEffect(() => {
    if (picked) last.current = { place: picked, plan }
  }, [picked, plan])
  const act = (value: string) => {
    const it = last.current
    if (!it) return
    if (value === "add") onAdd(it.place)
    else if (value === "remove") onRemove(it.place)
    else if (value === "write" && it.plan) applyAppend(id, it.plan)
  }
  const keyName = (k: KeyParams) =>
    `${solfegeName(k.root)} ${SCALE_LABELS[k.scale].toLowerCase()} · oct ${k.octave}`
  return (
    <Menu.Root
      open={picked !== null}
      onOpenChange={(d) => {
        if (!d.open) onClose()
      }}
      onSelect={(d) => act(d.value)}
      positioning={{ placement: "bottom-start", getAnchorRect: () => picked?.rect ?? null }}
    >
      <Portal>
        <Menu.Positioner>
          <Menu.Content bg="rack.panel" color="rack.silkscreen" rounded="sm" minW="14rem">
            {picked && (
              <Menu.ItemGroup>
                <Menu.ItemGroupLabel textStyle="silkscreen" color="rack.silkscreen.muted">
                  {noteLabel(picked.note)} · string {STRING_COUNT - picked.string} · fret{" "}
                  {picked.fret}
                </Menu.ItemGroupLabel>
                {!marked && <Menu.Item value="add">Add to the fretboard</Menu.Item>}
                {removable && <Menu.Item value="remove">Remove from the fretboard</Menu.Item>}
                <Menu.Item value="write" disabled={plan === null}>
                  Add to {label}
                  {plan === null
                    ? track && "chords" in track && nextFreeStep(track.chords) === null
                      ? " — the pattern is full"
                      : " — no key holds it with the notes already there"
                    : plan.key
                      ? ` · step ${plan.step + 1} · key → ${keyName(plan.key)}`
                      : ` · step ${plan.step + 1}`}
                </Menu.Item>
              </Menu.ItemGroup>
            )}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  )
}

/**
 * Where STR-6's notes fall on a guitar: the machine's eight rows as dots on a
 * neck, each on the lowest fret that reaches it, its name printed inside. The
 * dots of the column that is sounding light up — on the DOM, from a store
 * subscription, like the grid's playhead: no render per step. A dot pressed
 * strikes its note (`strikeNote`) and flashes.
 *
 * Any other place on the neck, pressed, sounds its note and opens the
 * `PlaceMenu`: Add puts a **mark** there, Remove takes it off, "Add to STR-6"
 * writes the note into the pattern. The marks are a scratchpad for reading a
 * tablature — press the tab's positions, see their names, and "Play" plays
 * them in the order they were put, an eighth apart. They are not saved.
 */
export function Fretboard({ id }: { id: string }) {
  const key = useRackStore((s) => selectInstance(s, id)?.key)
  const label = useRackStore((s) => {
    const inst = selectInstance(s, id)
    return inst ? instanceLabel(inst, s.instances) : "STR-6"
  })
  const recipe = useSlotRecipe({ key: "fretboard" })
  const styles = useMemo(() => recipe(), [recipe])
  const dots = useMemo(
    () =>
      rowNotes("strings", key)
        .map((note, row) => ({ row, note, position: positionOf(note) }))
        .filter((d) => d.position !== null),
    [key],
  )
  const sharps = key ? spelledWithSharps(key) : false

  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    const svg = ref.current
    if (!svg) return
    let lit: readonly number[] = []
    const light = (s: RackState) => {
      const track = selectTrack(s, id)
      const rows =
        s.currentStep >= 0 && track && "chords" in track
          ? (track.chords[s.currentStep % STEP_COUNT] ?? [])
          : []
      if (sameRows(rows, lit)) return
      for (const r of lit) svg.querySelector(`[data-row="${r}"]`)?.removeAttribute("data-on")
      for (const r of rows) svg.querySelector(`[data-row="${r}"]`)?.setAttribute("data-on", "")
      lit = rows
    }
    light(useRackStore.getState())
    return useRackStore.subscribe(light)
  }, [id])

  const flash = (el: Element) => {
    el.setAttribute("data-hit", "")
    window.setTimeout(() => el.removeAttribute("data-hit"), HIT_MS)
  }
  // The key's row dots can be taken off one by one (Remove on the dot, or Delete with it focused)
  // or all at once: read as fixed marks that could not be removed, they got in the scratchpad's
  // way. "Key notes" puts them all back.
  const [hiddenRows, setHiddenRows] = useState<ReadonlySet<number>>(new Set())
  const hideRow = (row: number) => setHiddenRows((h) => new Set(h).add(row))
  const shownDots = useMemo(() => dots.filter((d) => !hiddenRows.has(d.row)), [dots, hiddenRows])
  const anyKeyShown = shownDots.length > 0
  const toggleKey = () => setHiddenRows(anyKeyShown ? new Set(dots.map((d) => d.row)) : new Set())
  const rowAt = useMemo(
    () => new Map(shownDots.map((d) => [markKey(d.position!), d.row])),
    [shownDots],
  )
  const [picked, setPicked] = useState<Picked | null>(null)
  // A fresh menu each time one opens: reopened, Chakra's menu stopped taking its items' presses.
  const [menuKey, setMenuKey] = useState(0)
  const rowOfMidi = useMemo(() => new Map(dots.map((d) => [midiOf(d.note)!, d.row])), [dots])
  const openMenu = (el: Element, string: number, fret: number) => {
    const note = noteAt(string, fret, sharps)
    const { x, y, width, height } = el.getBoundingClientRect()
    setMenuKey((k) => k + 1)
    setPicked({
      string,
      fret,
      note,
      row: rowOfMidi.get(midiOf(note)!) ?? null,
      rect: { x, y, width, height },
    })
  }
  // A row dot: the press sounds it (and records while the clock runs); the click that follows opens
  // the menu while the clock is stopped. The sound goes on the press for the latency, the menu on
  // the click so the press that opened it is over before the menu listens for presses outside.
  const strike = (el: Element, row: number, note: string) => {
    strikeNote(id, row, note)
    flash(el)
  }
  const stopped = () => useRackStore.getState().currentStep < 0
  const menuOnDot = (el: Element, note: string) => {
    if (!stopped()) return
    const p = positionOf(note)!
    openMenu(el, p.string, p.fret)
  }
  const onPointerDown = (row: number, note: string) => (e: PointerEvent<SVGGElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    strike(e.currentTarget, row, note)
  }
  const onDotClick = (note: string) => (e: MouseEvent<SVGGElement>) =>
    menuOnDot(e.currentTarget, note)
  const onKeyDown = (row: number, note: string) => (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault()
      hideRow(row)
      return
    }
    if (e.key !== "Enter" && e.key !== " ") return
    e.preventDefault()
    strike(e.currentTarget, row, note)
    menuOnDot(e.currentTarget, note)
  }

  // A ghost of the note under the pointer: which string and fret a press would take, before it
  // lands — the user could not tell where a click had gone.
  const [hover, setHover] = useState<Mark | null>(null)

  // The marks, in the order they were put. A press on any place (a mark included) sounds the note
  // there and opens the menu; Add and Remove in it put a mark on the neck and take it off.
  const [marks, setMarks] = useState<Mark[]>([])
  const marked = useMemo(() => new Set(marks.map(markKey)), [marks])
  const addMark = (mark: Mark) =>
    setMarks((m) => (m.some((k) => markKey(k) === markKey(mark)) ? m : [...m, mark]))
  const removeMark = (mark: Mark) => setMarks((m) => m.filter((k) => markKey(k) !== markKey(mark)))
  const sound = (el: Element, string: number, fret: number) => {
    void getEngine().playNotes(id, [noteAt(string, fret, sharps)])
    flash(el)
  }
  const onPlacePointerDown =
    (string: number, fret: number) => (e: PointerEvent<SVGRectElement | SVGGElement>) => {
      if (e.button !== 0) return
      e.preventDefault()
      sound(e.currentTarget, string, fret)
    }
  const onPlaceClick =
    (string: number, fret: number) => (e: MouseEvent<SVGRectElement | SVGGElement>) =>
      openMenu(e.currentTarget, string, fret)
  const onPlaceKeyDown =
    (string: number, fret: number) => (e: KeyboardEvent<SVGRectElement | SVGGElement>) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault()
        removeMark({ string, fret })
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        sound(e.currentTarget, string, fret)
        openMenu(e.currentTarget, string, fret)
      }
    }
  // Play the marks one after another, an eighth apart at the clock's tempo.
  const playMarks = () => {
    const eighth = 30 / useRackStore.getState().bpm
    void getEngine().playNotes(
      id,
      marks.map((m) => noteAt(m.string, m.fret, sharps)),
      eighth,
    )
  }

  return (
    <>
      <HStack gap="2">
        <Button
          size="2xs"
          rounded="sm"
          variant="solid"
          colorPalette="orange"
          disabled={marks.length === 0}
          onClick={playMarks}
          aria-label="Play the notes on the fretboard"
        >
          <LuPlay /> Play
        </Button>
        <Button
          size="2xs"
          rounded="sm"
          variant="outline"
          disabled={marks.length === 0}
          onClick={() => setMarks([])}
          aria-label="Take every note off the fretboard"
        >
          <LuEraser /> Clear
        </Button>
        <Button
          size="2xs"
          rounded="sm"
          variant={anyKeyShown ? "subtle" : "outline"}
          aria-pressed={anyKeyShown}
          onClick={toggleKey}
          aria-label="Show the key's notes on the fretboard"
        >
          <LuKeyRound /> Key notes
        </Button>
        <TabDialog
          id={id}
          label={label}
          // The tab's notes go on the neck too, each place once, in the order they are struck.
          onWritten={(columns) => {
            const seen = new Set<string>()
            const next: Mark[] = []
            for (const note of columns.flat()) {
              const k = markKey(note)
              if (seen.has(k)) continue
              seen.add(k)
              next.push({ string: note.string, fret: note.fret })
            }
            setMarks(next)
          }}
        />
        <chakra.span textStyle="silkscreen" color="rack.silkscreen.muted">
          Press a place on the neck to hear its note, add it here or to the pattern
        </chakra.span>
      </HStack>
      <chakra.div css={styles.scroller}>
        <chakra.svg
          ref={ref}
          css={styles.root}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="group"
          aria-label="Fretboard: where the notes fall on a guitar; press a note to play it"
          onPointerLeave={() => setHover(null)}
        >
          {FRETS.map((fret) =>
            fret === 0 ? (
              <chakra.line
                key={fret}
                css={styles.nut}
                x1={NUT_X}
                x2={NUT_X}
                y1={TOP}
                y2={NECK_BOTTOM}
              />
            ) : (
              <chakra.line
                key={fret}
                css={styles.fret}
                x1={fretX(fret)}
                x2={fretX(fret)}
                y1={TOP}
                y2={NECK_BOTTOM}
              />
            ),
          )}
          {MARKER_FRETS.map((fret) =>
            fret === 12 ? (
              <g key={fret}>
                <chakra.circle css={styles.marker} cx={dotX(fret)} cy={stringY(3.5)} r={3} />
                <chakra.circle css={styles.marker} cx={dotX(fret)} cy={stringY(1.5)} r={3} />
              </g>
            ) : (
              <chakra.circle
                key={fret}
                css={styles.marker}
                cx={dotX(fret)}
                cy={stringY(2.5)}
                r={3}
              />
            ),
          )}
          {STRINGS.map((string) => (
            <chakra.line
              key={string}
              css={styles.string}
              x1={NUT_X}
              x2={fretX(FRET_COUNT)}
              y1={stringY(string)}
              y2={stringY(string)}
            />
          ))}
          {/* Every fret's number under the neck, the inlay frets brighter; "0" under the open strings. */}
          {FRETS.map((fret) => (
            <chakra.text
              key={fret}
              css={styles.fretNumber}
              data-inlay={fret === 0 || MARKER_FRETS.includes(fret as 3) ? "" : undefined}
              x={dotX(fret)}
              y={HEIGHT - 6}
            >
              {fret}
            </chakra.text>
          ))}
          {/* The strings' names at the left, as a tab writes them: the thin E is "e", on top. */}
          {STRINGS.map((string) => (
            <chakra.text key={string} css={styles.stringName} x={6} y={stringY(string)}>
              {STRING_NAMES[string]}
            </chakra.text>
          ))}
          {/* One press target per string and fret (the nut's left for an open string), under the dots. */}
          {STRINGS.map((string) =>
            FRETS.map((fret) => (
              <chakra.rect
                key={`${string}:${fret}`}
                css={styles.place}
                role="button"
                tabIndex={-1}
                aria-label={`String ${STRING_COUNT - string} fret ${fret}`}
                x={fret === 0 ? 0 : fretX(fret - 1)}
                y={stringY(string) - STRING_GAP / 2}
                width={fret === 0 ? NUT_X : FRET_W}
                height={STRING_GAP}
                onPointerDown={onPlacePointerDown(string, fret)}
                onPointerEnter={(e) => e.pointerType === "mouse" && setHover({ string, fret })}
                onClick={onPlaceClick(string, fret)}
                onKeyDown={onPlaceKeyDown(string, fret)}
              />
            )),
          )}
          {hover && !marked.has(markKey(hover)) && (
            <chakra.g css={styles.ghost} aria-hidden="true">
              <circle cx={dotX(hover.fret)} cy={stringY(hover.string)} r={DOT_R} />
              <text x={dotX(hover.fret)} y={stringY(hover.string)}>
                {solfegeShort(noteAt(hover.string, hover.fret, sharps))}
              </text>
            </chakra.g>
          )}
          {shownDots.map(({ row, note, position }) => (
            <chakra.g
              key={row}
              css={styles.dot}
              data-row={row}
              role="button"
              tabIndex={0}
              aria-label={`${noteLabel(note)}, string ${STRING_COUNT - position!.string} fret ${position!.fret}`}
              onPointerDown={onPointerDown(row, note)}
              onClick={onDotClick(note)}
              onKeyDown={onKeyDown(row, note)}
            >
              <circle cx={dotX(position!.fret)} cy={stringY(position!.string)} r={DOT_R} />
              <text data-name="" x={dotX(position!.fret)} y={stringY(position!.string)}>
                {solfegeShort(note)}
              </text>
              {/* The fret, as a tablature writes it — the number a tab prints on this string's line. */}
              <chakra.text
                css={styles.fretTag}
                // An open string's "0" goes on the dot's left: on the right it would sit on the nut.
                x={dotX(position!.fret) + (position!.fret === 0 ? -DOT_R - 1 : DOT_R + 1)}
                y={stringY(position!.string) - DOT_R + 2}
                textAnchor={position!.fret === 0 ? "end" : "start"}
              >
                {position!.fret}
              </chakra.text>
            </chakra.g>
          ))}
          {marks.map((mark) => {
            const note = noteAt(mark.string, mark.fret, sharps)
            return (
              <chakra.g
                key={markKey(mark)}
                css={styles.dot}
                data-mark=""
                role="button"
                tabIndex={0}
                aria-label={`${noteLabel(note)}, string ${STRING_COUNT - mark.string} fret ${mark.fret}, on the fretboard`}
                onPointerDown={onPlacePointerDown(mark.string, mark.fret)}
                onClick={onPlaceClick(mark.string, mark.fret)}
                onKeyDown={onPlaceKeyDown(mark.string, mark.fret)}
              >
                <circle cx={dotX(mark.fret)} cy={stringY(mark.string)} r={DOT_R} />
                <text data-name="" x={dotX(mark.fret)} y={stringY(mark.string)}>
                  {solfegeShort(note)}
                </text>
                <chakra.text
                  css={styles.fretTag}
                  x={dotX(mark.fret) + (mark.fret === 0 ? -DOT_R - 1 : DOT_R + 1)}
                  y={stringY(mark.string) - DOT_R + 2}
                  textAnchor={mark.fret === 0 ? "end" : "start"}
                >
                  {mark.fret}
                </chakra.text>
              </chakra.g>
            )
          })}
        </chakra.svg>
      </chakra.div>
      {/* The marks as a tablature, in the order they were put — what a tab site prints. */}
      <chakra.pre css={styles.tab} aria-label="The notes on the fretboard as a tablature">
        {tabLines(marks).join("\n")}
      </chakra.pre>
      <PlaceMenu
        key={menuKey}
        id={id}
        picked={picked}
        marked={picked !== null && marked.has(markKey(picked))}
        removable={picked !== null && (marked.has(markKey(picked)) || rowAt.has(markKey(picked)))}
        onClose={() => setPicked(null)}
        onAdd={addMark}
        // Remove takes the mark off; with none there, the key's dot on that place.
        onRemove={(place) => {
          if (marked.has(markKey(place))) removeMark(place)
          else {
            const row = rowAt.get(markKey(place))
            if (row !== undefined) hideRow(row)
          }
        }}
      />
    </>
  )
}
