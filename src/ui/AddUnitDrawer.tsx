import { Box, Button, chakra, HStack, IconButton, Text, VStack } from "@chakra-ui/react"
import type { ReactNode } from "react"
import {
  LuLayoutGrid,
  LuListMusic,
  LuPlus,
  LuServer,
  LuSlidersHorizontal,
  LuTimer,
  LuTrash2,
  LuUndo2,
} from "react-icons/lu"

import { getEngine } from "../audio/engine"
import { instanceLabel, KIND_MODEL, KIND_TITLE } from "../state/instances"
import { useLayoutStore, type HideableUnitId } from "../state/layout"
import { KINDS, type Kind } from "../state/pattern"
import { useRackStore } from "../state/store"
import { finishAccent, type Finish } from "../theme/recipes/rackUnit"
import { removeInstanceWithUndo, scrollToUnit } from "./removeInstance"
import { loadFactoryKit } from "./samplerKits"
import { useDocked, usePanelStore } from "./panels"
import { SidePanel } from "./SidePanel"
import { toolbarButton } from "./toolbar"
import { KIND_FINISH, kindIcon } from "./unitMeta"

/** Same pictograms, names and finishes the hideable units wear in their headers. */
const HIDEABLE: Record<
  HideableUnitId,
  { name: string; title: string; finish: Finish; icon: ReactNode }
> = {
  CLOCK: { name: "TRANSPORT", title: "Clock", finish: "graphite", icon: <LuTimer /> },
  "FX-2": {
    name: "FX-2",
    title: "Mix · Echo · Reverb",
    finish: "yellow",
    icon: <LuSlidersHorizontal />,
  },
  PATTERN: { name: "BANK", title: "Patterns", finish: "green", icon: <LuLayoutGrid /> },
  SONG: { name: "SONG", title: "Timeline", finish: "pink", icon: <LuListMusic /> },
}

/** A pictogram in the finish's accent, lifted so it reads on the dark panel. */
function Pictogram({ finish, children }: { finish?: Finish; children: ReactNode }) {
  return (
    <Box
      as="span"
      display="inline-flex"
      fontSize="2xl"
      w="8"
      justifyContent="center"
      color={finish ? finishAccent(finish) : "rack.silkscreen.muted"}
      aria-hidden="true"
    >
      {children}
    </Box>
  )
}

interface RowProps {
  icon: ReactNode
  name: string
  title: string
  /** How many are in the rack, printed after the title when any. */
  count?: number
  actionLabel: string
  actionIcon: ReactNode
  onAction: () => void
}

/** A whole row is the button: icon, name, title — the mark at the end only says what a press does. */
function Row({ icon, name, title, count, actionLabel, actionIcon, onAction }: RowProps) {
  return (
    <chakra.li display="flex">
      <chakra.button
        type="button"
        display="flex"
        alignItems="center"
        gap="3"
        w="full"
        minW="0"
        py="2"
        px="2"
        mx="-2"
        rounded="sm"
        textAlign="left"
        cursor="pointer"
        transitionProperty="background-color"
        transitionDuration="fast"
        _hover={{ bg: "whiteAlpha.50" }}
        _focusVisible={{ outline: "2px solid", outlineColor: "rack.led.on", outlineOffset: "-2px" }}
        _motionReduce={{ transition: "none" }}
        // A machine already in the rack: its row sits on a grey ground.
        data-present={count ? "" : undefined}
        css={{ "&[data-present]": { bg: "metal.700", _hover: { bg: "metal.600" } } }}
        aria-label={actionLabel}
        onClick={onAction}
      >
        {icon}
        <VStack gap="0.5" align="flex-start" minW="0" flex="1">
          <Text fontWeight="medium" lineClamp={1}>
            {name}
          </Text>
          <Text textStyle="silkscreen" color="rack.silkscreen.muted">
            {title}
            {count ? ` · ×${count} in the rack` : ""}
          </Text>
        </VStack>
        <Box
          as="span"
          display="grid"
          placeItems="center"
          boxSize="8"
          rounded="sm"
          bg="rack.led.off"
          color="rack.led.on"
          flexShrink={0}
          aria-hidden="true"
        >
          {actionIcon}
        </Box>
      </chakra.button>
    </chakra.li>
  )
}

/** One machine already in the rack: tap the name to scroll to it, or take it out. */
function InstanceRow({ id, label, onGo }: { id: string; label: string; onGo: () => void }) {
  return (
    <HStack
      as="li"
      gap="2"
      py="1.5"
      // Indented under its machine, with a hairline of its own that starts at the indent.
      ml="11"
      align="center"
      borderTopWidth="1px"
      borderColor="rack.panel.divider"
    >
      <Button
        size="xs"
        variant="ghost"
        rounded="sm"
        flex="1"
        justifyContent="flex-start"
        color="rack.silkscreen"
        aria-label={`Go to ${label}`}
        onClick={() => {
          scrollToUnit(id)
          onGo()
        }}
      >
        {/* A branch of the machine above it, as in a tree. */}
        <Box as="span" color="rack.silkscreen.muted" fontFamily="display" aria-hidden="true">
          └
        </Box>
        {label}
      </Button>
      <IconButton
        size="xs"
        variant="ghost"
        rounded="sm"
        color="fg.error"
        aria-label={`Remove ${label}`}
        onClick={() => removeInstanceWithUndo(id, label)}
      >
        <LuTrash2 />
      </IconButton>
    </HStack>
  )
}

/**
 * "Add unit" as a drawer, like the song library: one row per kind of machine
 * (add as many as you like) with the ones already in the rack listed under it
 * — tap one to scroll to it, or take it out — then the panels that were
 * hidden, to put back.
 */
export function AddUnitPanel() {
  const instances = useRackStore((s) => s.instances)
  const hidden = useLayoutStore((s) => s.hidden)
  const { showUnit } = useLayoutStore.getState()
  const { addInstance } = useRackStore.getState()
  const { close } = usePanelStore.getState()
  // Docked beside the rack the panel is not in the way: it stays open for the next machine.
  const docked = useDocked()
  const done = () => {
    if (!docked) close()
  }

  const countOf = new Map<Kind, number>()
  for (const inst of instances) countOf.set(inst.kind, (countOf.get(inst.kind) ?? 0) + 1)

  const add = (kind: Kind) => {
    const inst = addInstance(kind)
    getEngine().addInstance(inst)
    // A new sampler comes with the factory kit; pads are then replaced one by one.
    if (kind === "sampler") void loadFactoryKit(inst.id, true).catch(() => {})
    done()
  }

  const putBack = (id: HideableUnitId) => {
    showUnit(id)
    done()
  }

  return (
    <SidePanel id="add" title="Add unit">
      <Text textStyle="silkscreen" color="rack.silkscreen.muted" mb="1">
        New machine
      </Text>
      {/* One group per kind — the machine and its instances — a hairline under each. */}
      <VStack as="ul" gap="0" align="stretch" listStyleType="none" aria-label="Machines" mb="4">
        {KINDS.map((kind) => (
          <VStack
            as="li"
            key={kind}
            gap="0"
            align="stretch"
            borderBottomWidth="1px"
            borderColor="rack.panel.divider"
          >
            <VStack as="ul" gap="0" align="stretch" listStyleType="none">
              <Row
                icon={<Pictogram finish={KIND_FINISH[kind]}>{kindIcon(kind)}</Pictogram>}
                name={KIND_MODEL[kind]}
                title={KIND_TITLE[kind]}
                count={countOf.get(kind) ?? 0}
                actionLabel={`Add ${KIND_MODEL[kind]}`}
                actionIcon={<LuPlus />}
                onAction={() => add(kind)}
              />
              {instances
                .filter((i) => i.kind === kind)
                .map((i) => (
                  <InstanceRow
                    key={i.id}
                    id={i.id}
                    label={instanceLabel(i, instances)}
                    onGo={() => done()}
                  />
                ))}
            </VStack>
          </VStack>
        ))}
      </VStack>

      {hidden.length > 0 && (
        <>
          <Text textStyle="silkscreen" color="rack.silkscreen.muted" mb="1">
            Put back
          </Text>
          <VStack
            as="ul"
            gap="0"
            align="stretch"
            listStyleType="none"
            aria-label="Hidden units"
            css={{ "& > li": { borderBottomWidth: "1px", borderColor: "rack.panel.divider" } }}
          >
            {hidden.map((id) => (
              <Row
                key={id}
                icon={<Pictogram finish={HIDEABLE[id].finish}>{HIDEABLE[id].icon}</Pictogram>}
                name={HIDEABLE[id].name}
                title={HIDEABLE[id].title}
                actionLabel={`Put back ${HIDEABLE[id].name}`}
                actionIcon={<LuUndo2 />}
                onAction={() => putBack(id)}
              />
            ))}
          </VStack>
        </>
      )}
    </SidePanel>
  )
}

/** The toolbar button that opens (and closes) the Add unit panel. */
export function AddUnitButton() {
  const open = usePanelStore((s) => s.panel === "add")
  const { toggle } = usePanelStore.getState()
  return (
    <Button
      {...toolbarButton}
      aria-expanded={open}
      aria-pressed={open}
      onClick={() => toggle("add")}
    >
      <LuServer /> Add
      <Box as="span" hideBelow="md">
        &nbsp;unit
      </Box>
    </Button>
  )
}
