import { Button, Dialog, Portal, Text, Textarea, VStack } from "@chakra-ui/react"
import { useMemo, useState } from "react"
import { LuClipboardPaste } from "react-icons/lu"

import { toaster } from "../components/ui/toaster"
import { noteName, SCALE_LABELS, solfegeName } from "../state/key"
import type { TabColumn } from "../state/tab"
import { readTab, writeTab } from "./tabImport"

const PLACEHOLDER = `e|---0---0----0---0---|
B|-----0--------0-----|
G|-2--------2---------|
D|--------------------|
A|--------------------|
E|--------------------|`

/**
 * "Paste a tab": a text tablature pasted from anywhere becomes the STR-6's
 * part — its key set to the one that holds the tab's notes, a step per column.
 * `onWritten` gets the columns, for the fretboard to show them.
 */
export function TabDialog({
  id,
  label,
  onWritten,
}: {
  id: string
  label: string
  onWritten: (columns: TabColumn[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const read = useMemo(() => readTab(text), [text])
  const { key } = read.choice
  const keyName = `${solfegeName(key.root)} ${SCALE_LABELS[key.scale].toLowerCase()} · ${noteName(key.root, key.octave)}–${noteName(key.root, key.octave + 1)}`

  const write = () => {
    const result = writeTab(id, text)
    if (!result) return
    setOpen(false)
    onWritten(result.columns)
    toaster.create({
      type: "success",
      title: `${result.columns.length} steps written into ${label}`,
      description:
        `Key ${keyName}, ${result.slots.length} pattern${result.slots.length === 1 ? "" : "s"}` +
        (result.choice.dropped > 0
          ? `; ${result.choice.dropped} note${result.choice.dropped === 1 ? "" : "s"} the key has no row for left out`
          : ""),
    })
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(d) => setOpen(d.open)}
      size="lg"
      placement="center"
      scrollBehavior="inside"
    >
      <Dialog.Trigger asChild>
        <Button size="2xs" rounded="sm" variant="outline" aria-label="Paste a tablature">
          <LuClipboardPaste /> Paste a tab
        </Button>
      </Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content bg="rack.panel" color="rack.silkscreen" rounded="sm">
            <Dialog.Header>
              <Dialog.Title textStyle="silkscreen" fontSize="sm" fontWeight="bold">
                Tab → {label}
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <VStack gap="3" align="stretch">
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={PLACEHOLDER}
                  rows={8}
                  fontFamily="mono"
                  fontSize="sm"
                  bg="blackAlpha.300"
                  borderColor="rack.panel.divider"
                  _placeholder={{ color: "rack.silkscreen.muted" }}
                  spellCheck={false}
                  aria-label="Tablature text"
                />
                <Text textStyle="silkscreen" color="rack.silkscreen.muted">
                  {read.columns.length === 0
                    ? "Six lines, the thin E on top; the digits are the frets, time runs left to right."
                    : `${read.columns.length} steps · key ${keyName} · ${read.choice.covered} note${read.choice.covered === 1 ? "" : "s"} fit` +
                      (read.choice.dropped > 0
                        ? `, ${read.choice.dropped} left out (the key has eight rows)`
                        : "")}
                </Text>
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
                colorPalette="orange"
                disabled={read.columns.length === 0}
                onClick={write}
              >
                Write into {label}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
