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
      fontSize="3xl"
      w="10"
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

/** Tiles side by side, as many as fit the panel's width, wrapping — the panel can be dragged wide. */
const TILE_GRID = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(7.5rem, 1fr))",
  gap: "2",
  listStyleType: "none",
} as const

/** A whole tile is the button: icon, name, title — the mark in the corner only says what a press does. */
function Tile({ icon, name, title, count, actionLabel, actionIcon, onAction }: RowProps) {
  return (
    <chakra.li display="flex">
      <chakra.button
        type="button"
        position="relative"
        display="flex"
        flexDirection="column"
        alignItems="center"
        gap="1"
        w="full"
        minW="0"
        px="2"
        pt="4"
        pb="3"
        rounded="sm"
        borderWidth="1px"
        borderColor="rack.panel.divider"
        bg="blackAlpha.300"
        textAlign="center"
        cursor="pointer"
        transitionProperty="background-color"
        transitionDuration="fast"
        _hover={{ bg: "whiteAlpha.50" }}
        _focusVisible={{ outline: "2px solid", outlineColor: "rack.led.on", outlineOffset: "-2px" }}
        _motionReduce={{ transition: "none" }}
        // A machine already in the rack: its tile sits on a grey ground.
        data-present={count ? "" : undefined}
        css={{ "&[data-present]": { bg: "metal.700", _hover: { bg: "metal.600" } } }}
        aria-label={actionLabel}
        onClick={onAction}
      >
        {icon}
        <Text fontWeight="medium" lineClamp={1} maxW="full">
          {name}
        </Text>
        <Text textStyle="silkscreen" color="rack.silkscreen.muted" lineClamp={2}>
          {title}
        </Text>
        {/* How many are in the rack, top-left; what a press does, top-right. */}
        {count ? (
          <Box
            as="span"
            position="absolute"
            top="1.5"
            left="2"
            textStyle="silkscreen"
            color="rack.led.on"
            aria-hidden="true"
          >
            ×{count}
          </Box>
        ) : null}
        <Box
          as="span"
          position="absolute"
          top="1.5"
          right="1.5"
          display="grid"
          placeItems="center"
          boxSize="5"
          rounded="sm"
          bg="rack.led.off"
          color="rack.led.on"
          fontSize="xs"
          aria-hidden="true"
        >
          {actionIcon}
        </Box>
      </chakra.button>
    </chakra.li>
  )
}

/** One machine already in the rack: tap the name to scroll to it, or take it out. */
function InstanceRow({
  id,
  icon,
  label,
  onGo,
}: {
  id: string
  icon: ReactNode
  label: string
  onGo: () => void
}) {
  return (
    <HStack
      as="li"
      gap="2"
      py="1"
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
        {icon}
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
 * "Modules" as a drawer, like the song library: one tile per kind of machine
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
    <SidePanel id="add" title="Modules">
      <Text textStyle="silkscreen" color="rack.silkscreen.muted" mb="2">
        New machine
      </Text>
      {/* One tile per kind, as many across as the panel's width takes. */}
      <chakra.ul
        {...TILE_GRID}
        aria-label="Machines"
        pb="3"
        mb="3"
        borderBottomWidth="1px"
        borderColor="rack.panel.divider"
      >
        {KINDS.map((kind) => (
          <Tile
            key={kind}
            icon={<Pictogram finish={KIND_FINISH[kind]}>{kindIcon(kind)}</Pictogram>}
            name={KIND_MODEL[kind]}
            title={KIND_TITLE[kind]}
            count={countOf.get(kind) ?? 0}
            actionLabel={`Add ${KIND_MODEL[kind]}`}
            actionIcon={<LuPlus />}
            onAction={() => add(kind)}
          />
        ))}
      </chakra.ul>

      {instances.length > 0 && (
        <>
          <Text textStyle="silkscreen" color="rack.silkscreen.muted" mb="1">
            In the rack
          </Text>
          {/* The machines in the rack, in the order of the tiles: tap to scroll to one, or take it out. */}
          <VStack
            as="ul"
            gap="0"
            align="stretch"
            listStyleType="none"
            aria-label="Machines in the rack"
            pb="3"
            mb="3"
            borderBottomWidth="1px"
            borderColor="rack.panel.divider"
          >
            {KINDS.flatMap((kind) =>
              instances
                .filter((i) => i.kind === kind)
                .map((i) => (
                  <InstanceRow
                    key={i.id}
                    id={i.id}
                    icon={
                      <Box
                        as="span"
                        display="inline-flex"
                        color={finishAccent(KIND_FINISH[kind])}
                        aria-hidden="true"
                      >
                        {kindIcon(kind)}
                      </Box>
                    }
                    label={instanceLabel(i, instances)}
                    onGo={() => done()}
                  />
                )),
            )}
          </VStack>
        </>
      )}

      {hidden.length > 0 && (
        <>
          <Text textStyle="silkscreen" color="rack.silkscreen.muted" mb="2">
            Put back
          </Text>
          <chakra.ul {...TILE_GRID} aria-label="Hidden units">
            {hidden.map((id) => (
              <Tile
                key={id}
                icon={<Pictogram finish={HIDEABLE[id].finish}>{HIDEABLE[id].icon}</Pictogram>}
                name={HIDEABLE[id].name}
                title={HIDEABLE[id].title}
                actionLabel={`Put back ${HIDEABLE[id].name}`}
                actionIcon={<LuUndo2 />}
                onAction={() => putBack(id)}
              />
            ))}
          </chakra.ul>
        </>
      )}
    </SidePanel>
  )
}

/** The toolbar button that opens (and closes) the Add machine panel. */
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
      <LuServer /> Modules
    </Button>
  )
}
