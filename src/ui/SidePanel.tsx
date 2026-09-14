import { Box, CloseButton, Drawer, HStack, Portal, Text } from "@chakra-ui/react"
import { useEffect, useRef, type ReactNode } from "react"

import { escapeIsForField } from "./escapeGuard"
import { useDocked, usePanelStore, type PanelId } from "./panels"

/** Same top clearance as the toolbar: on a phone the drawer reaches under the status bar. */
const PHONE_TOP = "max(50px, env(safe-area-inset-top))"

interface SidePanelProps {
  id: PanelId
  title: string
  children: ReactNode
}

/**
 * One of the toolbar's panels (Add unit, Songs). On a phone it is a drawer
 * over the rack; on a desktop it is a column docked to the rack's right, the
 * rack narrowing to make room, so both stay in reach. Either way only one
 * panel is open at a time — `usePanelStore` sees to that.
 */
export function SidePanel({ id, title, children }: SidePanelProps) {
  const open = usePanelStore((s) => s.panel === id)
  const { close } = usePanelStore.getState()
  const docked = useDocked()

  if (docked) {
    return open ? (
      <DockedPanel title={title} onClose={close}>
        {children}
      </DockedPanel>
    ) : null
  }

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(d) => {
        if (!d.open) close()
      }}
      onEscapeKeyDown={(e) => {
        if (escapeIsForField()) e.preventDefault()
      }}
      placement="end"
      size="sm"
    >
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content bg="rack.panel" color="rack.silkscreen">
            <Drawer.Header
              borderBottomWidth="1px"
              borderColor="rack.panel.divider"
              pt={{ base: PHONE_TOP, md: "4" }}
            >
              <Drawer.Title textStyle="silkscreen" fontSize="sm">
                {title}
              </Drawer.Title>
              <Drawer.CloseTrigger asChild>
                <CloseButton
                  size="sm"
                  position="absolute"
                  // Rides down with the header's phone clearance.
                  top={{ base: `calc(${PHONE_TOP} - 4px)`, md: "3" }}
                  right="3"
                />
              </Drawer.CloseTrigger>
            </Drawer.Header>
            <Drawer.Body px="4" py="3">
              {children}
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  )
}

/** The desktop form: a sticky column beside the rack, scrolling on its own, Escape closes it. */
function DockedPanel({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  // Focus lands in the panel as it opens, as it would in a drawer, and goes back where it came
  // from (the toolbar button) when the panel closes.
  useEffect(() => {
    const before = document.activeElement
    ref.current?.focus()
    return () => {
      if (before instanceof HTMLElement && before.isConnected) before.focus()
    }
  }, [])
  // Escape closes the panel wherever the focus is, as the drawer's document-level handler did.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || escapeIsForField()) return
      onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])
  return (
    <Box
      as="aside"
      ref={ref}
      tabIndex={-1}
      outline="none"
      aria-label={title}
      w="md"
      flexShrink={0}
      position="sticky"
      top="0"
      // A full column, like a sidebar, however little is in it.
      minH="100dvh"
      maxH="100dvh"
      overflowY="auto"
      bg="rack.panel"
      color="rack.silkscreen"
      borderLeftWidth="1px"
      borderColor="rack.panel.edge"
      shadow="panel"
    >
      <HStack
        as="header"
        px="4"
        py="4"
        // Stays put while the panel's body scrolls under it.
        position="sticky"
        top="0"
        zIndex="1"
        bg="rack.panel"
        borderBottomWidth="1px"
        borderColor="rack.panel.divider"
      >
        <Text textStyle="silkscreen" fontSize="sm" fontWeight="semibold">
          {title}
        </Text>
        <CloseButton size="sm" ml="auto" aria-label={`Close ${title}`} onClick={onClose} />
      </HStack>
      <Box px="4" py="3">
        {children}
      </Box>
    </Box>
  )
}
