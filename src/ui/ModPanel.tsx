import {
  Button,
  chakra,
  Collapsible,
  HStack,
  IconButton,
  NativeSelect,
  SegmentGroup,
  SimpleGrid,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useState, type ReactNode } from "react"
import {
  LuBan,
  LuChevronDown,
  LuChevronUp,
  LuFilter,
  LuMusic,
  LuPlus,
  LuVolume2,
  LuX,
} from "react-icons/lu"

import { hasStripFilter, type Instance } from "../state/instances"
import {
  hasTune,
  LFO_SHAPES,
  MACRO_COUNT,
  macroTargetsFor,
  MOD_RANGES,
  modTargetsFor,
  type MacroTarget,
  type ModTarget,
} from "../state/mod"
import { selectInstance, useRackStore } from "../state/store"
import { Knob } from "./Knob"
import { WavePicker } from "./WavePicker"
import {
  changeLfo,
  changeMacro,
  changeMacroTargets,
  changeMod,
  changeRandom,
  formatPercent,
} from "./unitMeta"

const TARGET_LABELS: Readonly<Record<ModTarget, string>> = {
  off: "Off",
  cutoff: "Cutoff",
  pitch: "Pitch",
  level: "Level",
}
/** What each target is drawn as: nothing, the filter, a note, a speaker. */
const TARGET_ICONS: Readonly<Record<ModTarget, ReactNode>> = {
  off: <LuBan />,
  cutoff: <LuFilter />,
  pitch: <LuMusic />,
  level: <LuVolume2 />,
}

const formatSemitones = (v: number) => `${v > 0 ? "+" : ""}${v} st`
const formatHzShort = (v: number) => (v < 1 ? `${v.toFixed(2)} Hz` : `${v.toFixed(1)} Hz`)
const isTarget = (v: string | null): v is ModTarget =>
  ["off", "cutoff", "pitch", "level"].includes(v as ModTarget)

function Label({ children }: { children: string }) {
  return (
    <Text textStyle="silkscreen" color="rack.silkscreen.muted">
      {children}
    </Text>
  )
}

/** Where a modulator goes, as a row of icons; the name is the tooltip and the accessible label. */
function TargetPicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: ModTarget
  options: readonly ModTarget[]
  onChange: (target: ModTarget) => void
}) {
  return (
    <VStack gap="2" align="flex-start">
      <Label>{label}</Label>
      <SegmentGroup.Root
        size="sm"
        value={value}
        onValueChange={(d) => {
          if (isTarget(d.value) && options.includes(d.value)) onChange(d.value)
        }}
      >
        <SegmentGroup.Indicator />
        {options.map((t) => (
          <SegmentGroup.Item key={t} value={t} aria-label={TARGET_LABELS[t]}>
            <SegmentGroup.ItemText title={TARGET_LABELS[t]} display="flex" alignItems="center">
              {TARGET_ICONS[t]}
            </SegmentGroup.ItemText>
            <SegmentGroup.ItemHiddenInput />
          </SegmentGroup.Item>
        ))}
      </SegmentGroup.Root>
    </VStack>
  )
}

/** One LFO: shape, rate, where it goes and how far. */
function LfoBlock({ id, inst, index }: { id: string; inst: Instance; index: 0 | 1 }) {
  const lfo = inst.mod.lfo[index]
  const targets = modTargetsFor(inst.kind)
  return (
    <VStack gap="2" align="flex-start">
      <Label>{`LFO ${index + 1}`}</Label>
      <HStack gap="4" wrap="wrap" align="flex-end">
        <WavePicker
          label="Shape"
          value={lfo.shape}
          options={LFO_SHAPES}
          onChange={(shape) => changeLfo(id, index, { shape })}
        />
        <TargetPicker
          label="To"
          value={lfo.target}
          options={targets}
          onChange={(target) => changeLfo(id, index, { target })}
        />
        <Knob
          size="sm"
          label="Rate"
          scale="log"
          value={lfo.rate}
          min={MOD_RANGES.rate.min}
          max={MOD_RANGES.rate.max}
          step={0.01}
          defaultValue={1}
          format={formatHzShort}
          onChange={(rate) => changeLfo(id, index, { rate })}
        />
        <Knob
          size="sm"
          label="Amount"
          value={lfo.amount}
          min={0}
          max={1}
          step={0.01}
          defaultValue={0.5}
          format={formatPercent}
          onChange={(amount) => changeLfo(id, index, { amount })}
        />
      </HStack>
    </VStack>
  )
}

/** One macro knob and the list of what it moves. */
function MacroBlock({ id, inst, index }: { id: string; inst: Instance; index: number }) {
  const macro = inst.mod.macros[index]!
  const infos = macroTargetsFor(inst.kind, hasStripFilter(inst.kind))
  const infoOf = (key: string) => infos.find((i) => i.key === key)
  const free = infos.filter((i) => !macro.targets.some((t) => t.key === i.key))
  const setTargets = (targets: MacroTarget[]) => changeMacroTargets(id, index, targets)
  const edit = (n: number, patch: Partial<MacroTarget>) =>
    setTargets(macro.targets.map((t, i) => (i === n ? { ...t, ...patch } : t)))

  return (
    <VStack gap="2" align="flex-start" minW="0">
      <Knob
        label={`Macro ${index + 1}`}
        value={macro.value}
        min={0}
        max={1}
        step={0.01}
        defaultValue={0}
        format={formatPercent}
        onChange={(value) => changeMacro(id, index, value)}
      />
      {macro.targets.map((t, n) => {
        const info = infoOf(t.key)
        return (
          <HStack key={t.key} gap="2" align="flex-end" wrap="wrap">
            <NativeSelect.Root size="xs" w="28">
              <NativeSelect.Field
                aria-label={`Macro ${index + 1} target ${n + 1}`}
                value={t.key}
                onChange={(e) => {
                  const next = infoOf(e.target.value)
                  if (next) edit(n, { key: next.key, min: next.min, max: next.max })
                }}
              >
                {infos
                  .filter((i) => i.key === t.key || !macro.targets.some((o) => o.key === i.key))
                  .map((i) => (
                    <option key={i.key} value={i.key}>
                      {i.label}
                    </option>
                  ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
            {info && (
              <>
                <Knob
                  size="sm"
                  label="Min"
                  value={t.min}
                  min={info.min}
                  max={info.max}
                  step={(info.max - info.min) / 200}
                  defaultValue={info.min}
                  onChange={(min) => edit(n, { min })}
                />
                <Knob
                  size="sm"
                  label="Max"
                  value={t.max}
                  min={info.min}
                  max={info.max}
                  step={(info.max - info.min) / 200}
                  defaultValue={info.max}
                  onChange={(max) => edit(n, { max })}
                />
              </>
            )}
            <IconButton
              size="xs"
              variant="ghost"
              aria-label={`Remove ${info?.label ?? t.key} from macro ${index + 1}`}
              onClick={() => setTargets(macro.targets.filter((_, i) => i !== n))}
            >
              <LuX />
            </IconButton>
          </HStack>
        )
      })}
      {free.length > 0 && (
        <Button
          size="xs"
          variant="ghost"
          rounded="sm"
          aria-label={`Assign a parameter to macro ${index + 1}`}
          onClick={() => {
            const first = free[0]!
            setTargets([...macro.targets, { key: first.key, min: first.min, max: first.max }])
          }}
        >
          <LuPlus /> Assign
        </Button>
      )}
    </VStack>
  )
}

/**
 * The modulation of one machine, folded under its controls: tune and drive,
 * two LFOs, a per-step random source and four macros that move the knobs.
 */
export function ModPanel({ id }: { id: string }) {
  const inst = useRackStore((s) => selectInstance(s, id))
  const [open, setOpen] = useState(false)
  if (!inst) return null
  const { mod } = inst
  const targets = modTargetsFor(inst.kind)

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={(d) => setOpen(d.open)}
      mt="4"
      lazyMount
      unmountOnExit
    >
      <Collapsible.Trigger asChild>
        <chakra.button
          type="button"
          display="flex"
          alignItems="center"
          gap="2"
          w="full"
          py="1"
          borderTopWidth="1px"
          borderColor="rack.panel.divider"
          color="rack.silkscreen.muted"
          textStyle="silkscreen"
          cursor="pointer"
          _hover={{ color: "rack.silkscreen" }}
          _focusVisible={{
            outline: "2px solid",
            outlineColor: "rack.led.on",
            outlineOffset: "2px",
          }}
          aria-expanded={open}
        >
          Modulation
          <chakra.span ml="auto">{open ? <LuChevronUp /> : <LuChevronDown />}</chakra.span>
        </chakra.button>
      </Collapsible.Trigger>
      <Collapsible.Content>
        {/* 10 px of air inside the fold, and between the groups. */}
        <VStack gap="6" align="stretch" p="2.5" pt="4">
          {/* One group per row on a phone, two from `sm`, four on a wide rack: nothing wraps ragged. */}
          <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} gap={{ base: "5", md: "8" }}>
            <VStack gap="2" align="flex-start">
              <Label>Tone</Label>
              <HStack gap="4" wrap="wrap">
                {hasTune(inst.kind) && (
                  <Knob
                    label="Tune"
                    value={mod.tune}
                    min={MOD_RANGES.tune.min}
                    max={MOD_RANGES.tune.max}
                    step={1}
                    defaultValue={0}
                    format={formatSemitones}
                    onChange={(tune) => changeMod(id, { tune })}
                  />
                )}
                <Knob
                  label="Drive"
                  value={mod.drive}
                  min={0}
                  max={1}
                  step={0.01}
                  defaultValue={0}
                  format={formatPercent}
                  onChange={(drive) => changeMod(id, { drive })}
                />
              </HStack>
            </VStack>
            <LfoBlock id={id} inst={inst} index={0} />
            <LfoBlock id={id} inst={inst} index={1} />
            <VStack gap="2" align="flex-start">
              <Label>Random</Label>
              <HStack gap="4" wrap="wrap" align="flex-end">
                <TargetPicker
                  label="To"
                  value={mod.random.target}
                  options={targets}
                  onChange={(target) => changeRandom(id, { target })}
                />
                <Knob
                  size="sm"
                  label="Amount"
                  value={mod.random.amount}
                  min={0}
                  max={1}
                  step={0.01}
                  defaultValue={0.5}
                  format={formatPercent}
                  onChange={(amount) => changeRandom(id, { amount })}
                />
              </HStack>
            </VStack>
          </SimpleGrid>
          <VStack gap="2" align="flex-start">
            <Label>Macros</Label>
            <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} gap={{ base: "5", md: "8" }} w="full">
              {Array.from({ length: MACRO_COUNT }, (_, i) => (
                <MacroBlock key={i} id={id} inst={inst} index={i} />
              ))}
            </SimpleGrid>
          </VStack>
        </VStack>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
