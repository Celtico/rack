import {
  Button,
  Checkbox,
  Dialog,
  HStack,
  Input,
  NativeSelect,
  Portal,
  SegmentGroup,
  Table,
  Text,
  Textarea,
  VStack,
  Wrap,
} from "@chakra-ui/react"
import { useMemo, useState } from "react"
import { LuMusic2 } from "react-icons/lu"

import { getEngine } from "../audio/engine"
import { toaster } from "../components/ui/toaster"
import {
  BEAT_LABELS,
  BEATS,
  CHART_DEFAULTS,
  chartToSong,
  equivalences,
  parseChart,
  rowName,
  STRUM_LABELS,
  STRUMS,
  type Beat,
  type ChartOptions,
  type Strum,
} from "../state/chordChart"
import { PITCH_NAMES, SOLFEGE_NAMES, solfege, type KeyParams } from "../state/key"
import { BPM_MAX, BPM_MIN } from "../state/params"
import { useLibraryStore } from "../state/songLibrary"
import { useRackStore } from "../state/store"
import { ControlGroup } from "./ControlGroup"
import { errorText } from "./errors"

const CAPOS = Array.from({ length: 8 }, (_, i) => i)
/** "F#" → "Fa# · F#": a note of a chord with both spellings. */
const noteLabel = (n: string) => `${solfege(n)} · ${n}`
const PLACEHOLDER = `Paste the chart here — section names, chord lines, lyrics:

Tom: Eb
Capotraste na 1ª casa

[Intro] D7+ D9 A4 G

[Verse]
D7+        D9        A4    G
Shakedown 1979, cool kids never have the time`

/**
 * "Chord chart", in the Songs panel: paste the text of a chord page (Cifra
 * Club, Ultimate Guitar…), pick the key and the capo, and read the table of
 * equivalences — each chord as its notes and as the rows of the key that
 * carry them — before the chart becomes a song in the rack: a pattern per
 * bar of chords, the guitar strumming them, the bass on the root, a beat
 * under it, the chart's sections on the SONG panel. Every melodic machine
 * gets the key, so its rows read as the chart does; the capo is its Tune.
 */
export function ChordChartButton({ onImported }: { onImported?: (name: string) => void }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [options, setOptions] = useState<ChartOptions>(CHART_DEFAULTS)
  const [name, setName] = useState("")
  const chart = useMemo(() => parseChart(text), [text])
  const table = useMemo(() => equivalences(chart, options.key), [chart, options.key])
  const bars = chart.sections.reduce((n, s) => n + s.chords.length, 0) / options.chordsPerBar

  const setKey = (patch: Partial<KeyParams>) =>
    setOptions((o) => ({ ...o, key: { ...o.key, ...patch } }))
  const setParts = (patch: Partial<ChartOptions["parts"]>) =>
    setOptions((o) => ({ ...o, parts: { ...o.parts, ...patch } }))

  /** The pasted text's own key and capo, when the page states them, go straight into the selects. */
  const paste = (value: string) => {
    setText(value)
    const found = parseChart(value)
    setOptions((o) => ({
      ...o,
      capo: found.capo ?? o.capo,
      key: {
        ...o.key,
        ...(found.root !== undefined ? { root: found.root } : {}),
        ...(found.scale ? { scale: found.scale } : {}),
      },
    }))
    if (!name) {
      const title = /^\s*([^\n]{2,60})/.exec(value)?.[1]?.trim()
      if (title && !/^tom\s*:|^capo|^\[/i.test(title)) setName(title)
    }
  }

  const importChart = () => {
    try {
      const { song } = chartToSong(chart, options)
      const title = name.trim() || "Chord chart"
      useLibraryStore.getState().setNowPlaying(null)
      useLibraryStore.getState().setUnsavedName(title)
      useRackStore.getState().loadSong(song)
      getEngine().syncFromStore()
      toaster.create({
        type: "success",
        title: `Chart imported · ${song.chain.length || 1} bar${song.chain.length === 1 ? "" : "s"}`,
        description: `${table.length} chords on ${song.instances.length} machines, key ${SOLFEGE_NAMES[options.key.root]} ${options.key.scale}${options.capo ? `, capo ${options.capo}` : ""}.`,
        duration: 8000,
      })
      onImported?.(title)
      setOpen(false)
    } catch (err) {
      toaster.create({
        type: "error",
        title: "Could not import the chart",
        description: errorText(err),
      })
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(d) => setOpen(d.open)}
      size="xl"
      placement="center"
      scrollBehavior="inside"
    >
      <Dialog.Trigger asChild>
        <Button size="sm" variant="subtle" rounded="sm" flexShrink={0}>
          <LuMusic2 /> Chord chart
        </Button>
      </Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content bg="rack.panel" color="rack.silkscreen" rounded="sm">
            <Dialog.Header>
              <Dialog.Title textStyle="silkscreen" fontSize="sm" fontWeight="bold">
                Chord chart → rack
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <VStack gap="4" align="stretch">
                <Textarea
                  value={text}
                  onChange={(e) => paste(e.target.value)}
                  placeholder={PLACEHOLDER}
                  rows={8}
                  fontFamily="display"
                  fontSize="sm"
                  bg="blackAlpha.300"
                  borderColor="rack.panel.divider"
                  _placeholder={{ color: "rack.silkscreen.muted" }}
                  aria-label="Chord chart text"
                />

                <Wrap gap="4" align="flex-end">
                  <ControlGroup title="Name">
                    <Input
                      size="sm"
                      w="48"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Song"
                      aria-label="Song name"
                    />
                  </ControlGroup>
                  <ControlGroup title="Key">
                    <HStack gap="2">
                      <NativeSelect.Root size="sm" w="28">
                        <NativeSelect.Field
                          aria-label="Root note"
                          value={options.key.root}
                          onChange={(e) => setKey({ root: Number(e.target.value) })}
                        >
                          {PITCH_NAMES.map((n, i) => (
                            <option key={n} value={i}>
                              {SOLFEGE_NAMES[i]} · {n}
                            </option>
                          ))}
                        </NativeSelect.Field>
                        <NativeSelect.Indicator />
                      </NativeSelect.Root>
                      <NativeSelect.Root size="sm" w="28">
                        <NativeSelect.Field
                          aria-label="Scale"
                          value={options.key.scale}
                          onChange={(e) =>
                            setKey({ scale: e.target.value === "minor" ? "minor" : "major" })
                          }
                        >
                          <option value="major">Major</option>
                          <option value="minor">Minor</option>
                        </NativeSelect.Field>
                        <NativeSelect.Indicator />
                      </NativeSelect.Root>
                    </HStack>
                  </ControlGroup>
                  <ControlGroup title="Capo → Tune">
                    <NativeSelect.Root size="sm" w="24">
                      <NativeSelect.Field
                        aria-label="Capo fret"
                        value={options.capo}
                        onChange={(e) =>
                          setOptions((o) => ({ ...o, capo: Number(e.target.value) }))
                        }
                      >
                        {CAPOS.map((c) => (
                          <option key={c} value={c}>
                            {c === 0 ? "None" : `Fret ${c}`}
                          </option>
                        ))}
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </ControlGroup>
                  <ControlGroup title="Tempo">
                    <Input
                      size="sm"
                      w="20"
                      type="number"
                      min={BPM_MIN}
                      max={BPM_MAX}
                      value={options.bpm}
                      onChange={(e) =>
                        setOptions((o) => ({ ...o, bpm: Number(e.target.value) || o.bpm }))
                      }
                      aria-label="Tempo, BPM"
                    />
                  </ControlGroup>
                  <ControlGroup title="Chords per bar">
                    <SegmentGroup.Root
                      size="sm"
                      value={String(options.chordsPerBar)}
                      onValueChange={(d) =>
                        setOptions((o) => ({ ...o, chordsPerBar: d.value === "2" ? 2 : 1 }))
                      }
                    >
                      <SegmentGroup.Indicator />
                      <SegmentGroup.Item value="1">
                        <SegmentGroup.ItemText>1</SegmentGroup.ItemText>
                        <SegmentGroup.ItemHiddenInput />
                      </SegmentGroup.Item>
                      <SegmentGroup.Item value="2">
                        <SegmentGroup.ItemText>2</SegmentGroup.ItemText>
                        <SegmentGroup.ItemHiddenInput />
                      </SegmentGroup.Item>
                    </SegmentGroup.Root>
                  </ControlGroup>
                  <ControlGroup title="Guitar">
                    <NativeSelect.Root size="sm" w="36">
                      <NativeSelect.Field
                        aria-label="Strum"
                        value={options.strum}
                        onChange={(e) =>
                          setOptions((o) => ({ ...o, strum: e.target.value as Strum }))
                        }
                      >
                        {STRUMS.map((s) => (
                          <option key={s} value={s}>
                            {STRUM_LABELS[s]}
                          </option>
                        ))}
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </ControlGroup>
                  <ControlGroup title="Drums">
                    <NativeSelect.Root size="sm" w="32">
                      <NativeSelect.Field
                        aria-label="Beat"
                        value={options.beat}
                        onChange={(e) =>
                          setOptions((o) => ({ ...o, beat: e.target.value as Beat }))
                        }
                      >
                        {BEATS.map((b) => (
                          <option key={b} value={b}>
                            {BEAT_LABELS[b]}
                          </option>
                        ))}
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </ControlGroup>
                  <ControlGroup title="Machines">
                    <HStack gap="4" wrap="wrap">
                      {(
                        [
                          ["bass", "BASS-2"],
                          ["guitar", "STR-6"],
                          ["piano", "EP-1"],
                          ["pad", "POLY-4"],
                        ] as const
                      ).map(([part, label]) => (
                        <Checkbox.Root
                          key={part}
                          size="sm"
                          checked={options.parts[part]}
                          onCheckedChange={(d) => setParts({ [part]: d.checked === true })}
                        >
                          <Checkbox.HiddenInput />
                          <Checkbox.Control />
                          <Checkbox.Label>{label}</Checkbox.Label>
                        </Checkbox.Root>
                      ))}
                    </HStack>
                  </ControlGroup>
                </Wrap>

                {/* The equivalences: what the chart's chords are on the rack's grids. */}
                {table.length > 0 ? (
                  <VStack gap="2" align="stretch">
                    <Text textStyle="silkscreen" color="rack.silkscreen.muted">
                      Equivalences · rows 0–7 of the key {SOLFEGE_NAMES[options.key.root]}{" "}
                      {options.key.scale}, octave {options.key.octave} (EP-1 / POLY-4; STR-6 one
                      down, BASS-2 two down)
                    </Text>
                    <Table.Root size="sm" variant="line" interactive={false}>
                      <Table.Header>
                        <Table.Row>
                          <Table.ColumnHeader>Chord</Table.ColumnHeader>
                          <Table.ColumnHeader>Notes</Table.ColumnHeader>
                          <Table.ColumnHeader>Rows</Table.ColumnHeader>
                          <Table.ColumnHeader>Bass</Table.ColumnHeader>
                          <Table.ColumnHeader>Left out</Table.ColumnHeader>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {table.map((e) => (
                          <Table.Row key={e.chord} color={e.unknown ? "red.300" : undefined}>
                            <Table.Cell fontFamily="display">{e.chord}</Table.Cell>
                            <Table.Cell>
                              {e.unknown
                                ? "not a chord the rack knows"
                                : e.notes.map(noteLabel).join(", ")}
                            </Table.Cell>
                            <Table.Cell>
                              {e.rows.map((r) => `${r} (${rowName(options.key, r)})`).join(", ")}
                            </Table.Cell>
                            <Table.Cell>
                              {e.bassRow === null
                                ? e.unknown
                                  ? ""
                                  : "rest"
                                : `${e.bassRow} (${rowName({ ...options.key, octave: 1 }, e.bassRow)})`}
                            </Table.Cell>
                            <Table.Cell color="amber.400">{e.dropped.join(", ")}</Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Root>
                    <Text textStyle="silkscreen" color="rack.silkscreen.muted">
                      {chart.sections
                        .map(
                          (s) => `${s.name} ${Math.ceil(s.chords.length / options.chordsPerBar)}`,
                        )
                        .join(" · ")}{" "}
                      — {Math.ceil(bars)} bars
                    </Text>
                  </VStack>
                ) : (
                  <Text textStyle="silkscreen" color="rack.silkscreen.muted">
                    No chord lines yet — a line of chord names such as "D7+ D9 A4 G".
                  </Text>
                )}
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button size="sm" rounded="sm" variant="outline">
                  Cancel
                </Button>
              </Dialog.ActionTrigger>
              <Button
                size="sm"
                rounded="sm"
                variant="solid"
                colorPalette="amber"
                disabled={!table.length || table.some((e) => e.unknown)}
                onClick={importChart}
              >
                Put it in the rack
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
