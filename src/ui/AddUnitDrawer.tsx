import {
  Box,
  Button,
  CloseButton,
  Drawer,
  HStack,
  IconButton,
  Portal,
  Text,
  VStack,
} from "@chakra-ui/react"
import { Fragment, useState, type ReactNode } from "react"
import {
  LuLayoutGrid,
  LuListMusic,
  LuPlus,
  LuSlidersHorizontal,
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
import { toolbarButton } from "./toolbar"
import { KIND_FINISH, kindIcon } from "./unitMeta"

/** Same pictograms, names and finishes the hideable units wear in their headers. */
const HIDEABLE: Record<
  HideableUnitId,
  { name: string; title: string; finish: Finish; icon: ReactNode }
> = {
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
  /** How many are in the rack — dims the row when none. */
  count?: number
  actionLabel: string
  actionIcon: ReactNode
  onAction: () => void
}

function Row({ icon, name, title, count, actionLabel, actionIcon, onAction }: RowProps) {
  return (
    <HStack
      as="li"
      gap="3"
      py="2"
      borderBottomWidth="1px"
      borderColor="rack.panel.edge"
      align="center"
      opacity={count === 0 ? 0.6 : 1}
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
      <IconButton
        size="sm"
        variant="subtle"
        colorPalette="orange"
        rounded="sm"
        aria-label={actionLabel}
        onClick={onAction}
      >
        {actionIcon}
      </IconButton>
    </HStack>
  )
}

/** One machine already in the rack: tap the name to scroll to it, or take it out. */
function InstanceRow({ id, label, onGo }: { id: string; label: string; onGo: () => void }) {
  return (
    <HStack as="li" gap="2" py="1.5" pl="11" align="center">
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
export function AddUnitDrawer() {
  const instances = useRackStore((s) => s.instances)
  const hidden = useLayoutStore((s) => s.hidden)
  const { showUnit } = useLayoutStore.getState()
  const { addInstance } = useRackStore.getState()
  const [open, setOpen] = useState(false)

  const countOf = new Map<Kind, number>()
  for (const inst of instances) countOf.set(inst.kind, (countOf.get(inst.kind) ?? 0) + 1)

  const add = (kind: Kind) => {
    const inst = addInstance(kind)
    getEngine().addInstance(inst)
    // A new sampler comes with the factory kit; pads are then replaced one by one.
    if (kind === "sampler") void loadFactoryKit(inst.id, true).catch(() => {})
    setOpen(false)
  }

  const putBack = (id: HideableUnitId) => {
    showUnit(id)
    setOpen(false)
  }

  return (
    <Drawer.Root open={open} onOpenChange={(d) => setOpen(d.open)} placement="end" size="sm">
      <Drawer.Trigger asChild>
        <Button {...toolbarButton}>
          <LuPlus /> Add
          <Box as="span" hideBelow="md">
            &nbsp;unit
          </Box>
        </Button>
      </Drawer.Trigger>
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content bg="rack.panel" color="rack.silkscreen">
            <Drawer.Header
              borderBottomWidth="1px"
              borderColor="rack.panel.edge"
              // On a phone the drawer reaches under the status bar: same top clearance as the toolbar.
              pt={{ base: "max(50px, env(safe-area-inset-top))", md: "4" }}
            >
              <Drawer.Title textStyle="silkscreen" fontSize="sm">
                Add unit
              </Drawer.Title>
              <Drawer.CloseTrigger asChild>
                <CloseButton
                  size="sm"
                  position="absolute"
                  // Rides down with the header's phone clearance.
                  top={{ base: "calc(max(50px, env(safe-area-inset-top)) - 4px)", md: "3" }}
                  right="3"
                />
              </Drawer.CloseTrigger>
            </Drawer.Header>
            <Drawer.Body px="4" py="3">
              <Text textStyle="silkscreen" color="rack.silkscreen.muted" mb="1">
                New machine
              </Text>
              <VStack
                as="ul"
                gap="0"
                align="stretch"
                listStyleType="none"
                aria-label="Machines"
                mb="4"
              >
                {KINDS.map((kind) => (
                  <Fragment key={kind}>
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
                          onGo={() => setOpen(false)}
                        />
                      ))}
                  </Fragment>
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
                  >
                    {hidden.map((id) => (
                      <Row
                        key={id}
                        icon={
                          <Pictogram finish={HIDEABLE[id].finish}>{HIDEABLE[id].icon}</Pictogram>
                        }
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
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  )
}
