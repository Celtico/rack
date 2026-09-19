import { HStack, NativeSelect } from "@chakra-ui/react"

import {
  isScaleName,
  KEY_RANGES,
  PITCH_NAMES,
  SCALE_LABELS,
  SCALE_NAMES,
  SOLFEGE_NAMES,
} from "../state/key"
import { KEY_DEFAULT, type MelodicKind } from "../state/pattern"
import { selectInstance, useRackStore } from "../state/store"
import { ControlGroup } from "./ControlGroup"

const OCTAVES = Array.from(
  { length: KEY_RANGES.octave.max - KEY_RANGES.octave.min + 1 },
  (_, i) => KEY_RANGES.octave.min + i,
)

/**
 * A melodic machine's key: root, scale and the octave of the lowest row. The
 * grid's rows are the key's notes — pick the key a score is in and every row
 * reads as a note of it. Until a key is picked the selects show the one the
 * kind's fixed rows are closest to.
 */
export function KeyControls({ id, kind }: { id: string; kind: MelodicKind }) {
  const key = useRackStore((s) => selectInstance(s, id)?.key) ?? KEY_DEFAULT[kind]
  const { setInstanceKey } = useRackStore.getState()
  return (
    <ControlGroup title="Key">
      <HStack gap="2" wrap="wrap">
        <NativeSelect.Root size="sm" w="28">
          <NativeSelect.Field
            aria-label="Root note"
            value={key.root}
            onChange={(e) => setInstanceKey(id, { root: Number(e.target.value) })}
          >
            {PITCH_NAMES.map((name, i) => (
              <option key={name} value={i}>
                {SOLFEGE_NAMES[i]} · {name}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
        <NativeSelect.Root size="sm" w="40">
          <NativeSelect.Field
            aria-label="Scale"
            value={key.scale}
            onChange={(e) => {
              if (isScaleName(e.target.value)) setInstanceKey(id, { scale: e.target.value })
            }}
          >
            {SCALE_NAMES.map((name) => (
              <option key={name} value={name}>
                {SCALE_LABELS[name]}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
        <NativeSelect.Root size="sm" w="24">
          <NativeSelect.Field
            aria-label="Octave"
            value={key.octave}
            onChange={(e) => setInstanceKey(id, { octave: Number(e.target.value) })}
          >
            {OCTAVES.map((o) => (
              <option key={o} value={o}>
                Oct {o}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </HStack>
    </ControlGroup>
  )
}
