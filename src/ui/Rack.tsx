import { Box, Button, Container, HStack, Menu, Portal, VStack } from "@chakra-ui/react"
import { useEffect, type ReactNode } from "react"
import { LuChevronsDownUp, LuChevronsUpDown, LuPlus, LuSlidersHorizontal } from "react-icons/lu"

import { getEngine } from "../audio/engine"
import { KIND_MODEL, KIND_TITLE } from "../state/instances"
import { FIXED_UNITS, isFixedUnit, useLayoutStore, type FixedUnitId } from "../state/layout"
import { KINDS, type Kind } from "../state/pattern"
import { MASTER_SECTIONS, useRackStore } from "../state/store"
import type { Finish } from "../theme/recipes/rackUnit"
import { FxUnit } from "./FxUnit"
import { InstanceUnit } from "./InstanceUnit"
import { MasterUnit } from "./MasterUnit"
import { KIND_FINISH, kindIcon } from "./unitMeta"

const FIXED: Record<FixedUnitId, ReactNode> = {
  "FX-2": <FxUnit />,
}

/** Same pictograms the fixed units wear in their headers. */
const FIXED_ICON: Record<FixedUnitId, ReactNode> = {
  "FX-2": <LuSlidersHorizontal />,
}

const isKind = (v: string): v is Kind => (KINDS as readonly string[]).includes(v)

/** A menu entry with its pictogram in front. */
function MenuIcon({ finish, children }: { finish?: Finish; children: ReactNode }) {
  // A machine's icon wears its finish colour, lifted so it reads on the dark menu.
  const color = finish
    ? `oklch(from {colors.finish.${finish}.panel} 0.74 calc(c * 2.4) h)`
    : "fg.muted"
  return (
    <Box as="span" display="inline-flex" fontSize="lg" color={color} aria-hidden="true">
      {children}
    </Box>
  )
}

/** The rack itself: the units in the user's order, with a small toolbar above. */
export function Rack() {
  const instances = useRackStore((s) => s.instances)
  const order = useLayoutStore((s) => s.order)
  const hidden = useLayoutStore((s) => s.hidden)
  const { showUnit, syncUnits } = useLayoutStore.getState()
  const { setFolded, addInstance } = useRackStore.getState()

  // Keep the layout's order in step with the instances that exist.
  const ids = [...FIXED_UNITS, ...instances.map((i) => i.id)]
  useEffect(() => {
    syncUnits(ids)
    // ids is derived from instances; re-sync only when the set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join("|")])

  const visible = order.filter((id) =>
    isFixedUnit(id) ? !hidden.includes(id) : instances.some((i) => i.id === id),
  )
  const kindOf = new Map(instances.map((i) => [i.id, i.kind]))
  // How many of each kind are in the rack — the menu dims the kinds that are not.
  const countOf = new Map<Kind, number>()
  for (const inst of instances) countOf.set(inst.kind, (countOf.get(inst.kind) ?? 0) + 1)

  const onAdd = (value: string) => {
    if (isKind(value)) {
      const inst = addInstance(value)
      getEngine().addInstance(inst)
    } else if (isFixedUnit(value)) {
      showUnit(value)
    }
  }

  return (
    <Container as="main" maxW="8xl" px={{ base: "2", md: "6" }} py={{ base: "4", md: "8" }}>
      <HStack gap="2" mb="3" justify="flex-end" wrap="wrap">
        <Button
          size="xs"
          variant="subtle"
          rounded="sm"
          onClick={() => setFolded([...MASTER_SECTIONS, ...visible], true)}
        >
          <LuChevronsDownUp /> Fold all
        </Button>
        <Button
          size="xs"
          variant="subtle"
          rounded="sm"
          onClick={() => setFolded([...MASTER_SECTIONS, ...visible], false)}
        >
          <LuChevronsUpDown /> Unfold all
        </Button>
        <Menu.Root onSelect={(details) => onAdd(details.value)}>
          <Menu.Trigger asChild>
            <Button size="xs" variant="subtle" rounded="sm">
              <LuPlus /> Add unit
            </Button>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content>
                <Menu.ItemGroup>
                  <Menu.ItemGroupLabel>New machine</Menu.ItemGroupLabel>
                  {KINDS.map((kind) => {
                    const count = countOf.get(kind) ?? 0
                    return (
                      <Menu.Item key={kind} value={kind} opacity={count ? 1 : 0.5}>
                        <MenuIcon finish={KIND_FINISH[kind]}>{kindIcon(kind)}</MenuIcon>
                        {KIND_MODEL[kind]} · {KIND_TITLE[kind]}
                        {count > 0 && (
                          <Box as="span" ml="auto" pl="3" fontSize="xs" color="fg.muted">
                            ×{count}
                          </Box>
                        )}
                      </Menu.Item>
                    )
                  })}
                </Menu.ItemGroup>
                {hidden.length > 0 && (
                  <Menu.ItemGroup>
                    <Menu.ItemGroupLabel>Put back</Menu.ItemGroupLabel>
                    {hidden.map((id) => (
                      <Menu.Item key={id} value={id}>
                        <MenuIcon>{FIXED_ICON[id]}</MenuIcon>
                        {id}
                      </Menu.Item>
                    ))}
                  </Menu.ItemGroup>
                )}
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      </HStack>

      <Box
        bg="rack.frame"
        borderXWidth={{ base: "6px", md: "10px" }}
        borderColor="rack.rail"
        rounded="md"
        p={{ base: "2", md: "3" }}
        shadow="panel"
      >
        <VStack gap={{ base: "2", md: "3" }} align="stretch">
          <MasterUnit />
          {visible.map((id) => (
            <Box key={id}>
              {isFixedUnit(id) ? FIXED[id] : <InstanceUnit id={id} kind={kindOf.get(id)!} />}
            </Box>
          ))}
        </VStack>
      </Box>
    </Container>
  )
}
