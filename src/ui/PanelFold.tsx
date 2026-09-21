import { chakra, Collapsible, VStack } from "@chakra-ui/react"
import { useState, type ReactNode } from "react"
import { LuChevronDown, LuChevronUp } from "react-icons/lu"

/**
 * A row at the bottom of a unit that folds a block open: a hairline, the
 * title, a chevron. Closed by default; the content is mounted only while open.
 */
export function PanelFold({
  title,
  hint,
  first,
  children,
}: {
  title: string
  /** A muted glimpse of what is inside, printed after the title while the fold is closed. */
  hint?: string
  first?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <Collapsible.Root
      open={open}
      onOpenChange={(d) => setOpen(d.open)}
      mt={first ? "4" : "0"}
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
          {title}
          {hint && !open && (
            <chakra.span
              textTransform="none"
              letterSpacing="normal"
              fontWeight="normal"
              opacity={0.7}
              minW="0"
              overflow="hidden"
              textOverflow="ellipsis"
              whiteSpace="nowrap"
            >
              {hint}
            </chakra.span>
          )}
          <chakra.span ml="auto" flexShrink={0}>
            {open ? <LuChevronUp /> : <LuChevronDown />}
          </chakra.span>
        </chakra.button>
      </Collapsible.Trigger>
      <Collapsible.Content>
        {/* 10 px of air inside the fold. */}
        <VStack gap="4" align="stretch" p="2.5" pt="4" pb="4">
          {children}
        </VStack>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
