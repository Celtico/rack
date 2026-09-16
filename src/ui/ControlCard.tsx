import { Box, Text, VStack, type StackProps } from "@chakra-ui/react"
import type { ReactNode } from "react"

/**
 * A group of controls on its own card — the look FX-2's strips have: a
 * bordered box on a darker ground, a silkscreen title, the controls under it,
 * and, when given, a `footer` pinned to the bottom under a hairline (buttons
 * that act on the group: Random, Reset…) — cards in a row line their footers up.
 * `title` names the group for the reader and for assistive tech.
 */
export function ControlCard({
  title,
  footer,
  children,
  ...rest
}: { title?: string; footer?: ReactNode } & Omit<StackProps, "title">) {
  return (
    <VStack
      gap="2.5"
      align="flex-start"
      p="4"
      rounded="sm"
      bg="blackAlpha.300"
      borderWidth="1px"
      borderColor="rack.panel.divider"
      role="group"
      aria-label={title}
      {...rest}
    >
      {title && (
        <Text textStyle="silkscreen" fontWeight="bold" color="rack.silkscreen">
          {title}
        </Text>
      )}
      {children}
      {footer && (
        <Box w="full" mt="auto" pt="3" borderTopWidth="1px" borderColor="rack.panel.divider">
          {footer}
        </Box>
      )}
    </VStack>
  )
}
