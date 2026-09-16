import { Box, chakra, CloseButton, Drawer, HStack, Portal, Text } from "@chakra-ui/react"
import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"

import {
  PANEL_WIDTH_MAX,
  PANEL_WIDTH_MIN,
  clampPanelWidth,
  useLayoutStore,
} from "../state/layout"
import { escapeIsForField } from "./escapeGuard"
import { useDocked, usePanelStore, type PanelId } from "./panels"

/** Arrow keys on the resize handle move the edge by this much (Shift: five times). */
const RESIZE_STEP = 16

const swallowClick = (e: MouseEvent) => {
  e.stopPropagation()
  e.preventDefault()
}

/**
 * The docked panel's left edge: drag it to make the panel wider or narrower
 * (the rack takes the rest). A separator to the keyboard, arrows resize it.
 */
function ResizeHandle({ width, title }: { width: number; title: string }) {
  const { setPanelWidth } = useLayoutStore.getState()
  // The width when the drag began and where the pointer was: the new width is the old one plus
  // how far the pointer went left (the edge is on the panel's left).
  const drag = useRef<{ x: number; width: number } | null>(null)

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    drag.current = { x: e.clientX, width }
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.setAttribute("data-active", "")
    // The click that ends the drag must reach nothing: the pointer may let go over a panel row
    // (which adds a machine) or a rack control. Swallowed at the document, once.
    document.addEventListener("click", swallowClick, { capture: true, once: true })
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    setPanelWidth(d.width + (d.x - e.clientX))
  }
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = null
    e.currentTarget.removeAttribute("data-active")
    // No click follows a cancelled drag: let the guard go on the next turn.
    setTimeout(() => document.removeEventListener("click", swallowClick, { capture: true }), 0)
  }
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = RESIZE_STEP * (e.shiftKey ? 5 : 1)
    // The handle sits on the left: the left arrow widens the panel.
    if (e.key === "ArrowLeft") setPanelWidth(width + step)
    else if (e.key === "ArrowRight") setPanelWidth(width - step)
    else if (e.key === "Home") setPanelWidth(PANEL_WIDTH_MAX)
    else if (e.key === "End") setPanelWidth(PANEL_WIDTH_MIN)
    else return
    e.preventDefault()
  }

  return (
    <chakra.div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${title}`}
      aria-valuemin={PANEL_WIDTH_MIN}
      aria-valuemax={PANEL_WIDTH_MAX}
      aria-valuenow={width}
      tabIndex={0}
      title="Drag to resize"
      position="absolute"
      top="0"
      bottom="0"
      left="-1"
      w="2"
      cursor="col-resize"
      touchAction="none"
      zIndex="2"
      // A thin line down the edge that lights up under the pointer, while dragging and on focus.
      _before={{
        content: '""',
        position: "absolute",
        top: 0,
        bottom: 0,
        left: "50%",
        w: "2px",
        transform: "translateX(-50%)",
        bg: "transparent",
        transitionProperty: "background-color",
        transitionDuration: "fast",
      }}
      _hover={{ _before: { bg: "rack.led.on" } }}
      _focusVisible={{ outline: "none", _before: { bg: "rack.led.on" } }}
      css={{ "&[data-active]::before": { bg: "rack.led.on" } }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
    />
  )
}

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
  // The width the user dragged it to (persisted with the layout); the rack takes the rest.
  const width = clampPanelWidth(useLayoutStore((s) => s.panelWidth))
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
      style={{ width }}
      // Never wider than leaves the rack a phone's width beside it.
      maxW="calc(100vw - 360px)"
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
      <ResizeHandle width={width} title={title} />
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
