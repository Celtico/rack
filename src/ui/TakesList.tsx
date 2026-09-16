import { Button, chakra, HStack, IconButton, Text, VStack } from "@chakra-ui/react"
import { LuTrash2 } from "react-icons/lu"

import { deleteSample, type Take } from "../audio/sampleStore"
import { takeMeta, takesChanged, useTakes } from "./takes"

/**
 * Every recording the microphone has made — MIC-1 loops and SMP-8 clips —
 * newest first: pick one to use, or throw it away. `using` is the key in use
 * here; `onUse` puts a take to work and `onDelete` is told when the one in use
 * is gone.
 */
export function TakesList({
  using,
  onUse,
  onDeleted,
}: {
  using: string | null
  onUse: (take: Take) => void
  onDeleted: (key: string) => void
}) {
  const takes = useTakes()
  const remove = async (key: string) => {
    await deleteSample(key)
    takesChanged()
    onDeleted(key)
  }
  if (takes.length === 0)
    return (
      <Text textStyle="silkscreen" color="rack.silkscreen.muted">
        No takes yet — Rec keeps every one here.
      </Text>
    )
  return (
    <VStack
      as="ul"
      gap="0"
      align="stretch"
      listStyleType="none"
      aria-label="Takes"
      w="full"
      maxH="40"
      overflowY="auto"
      borderWidth="1px"
      borderColor="rack.panel.divider"
      rounded="sm"
    >
      {takes.map((t) => (
        <HStack
          as="li"
          key={t.key}
          gap="2"
          px="2"
          py="1"
          borderBottomWidth="1px"
          borderColor="rack.panel.divider"
          data-using={t.key === using ? "" : undefined}
          css={{ "&:last-of-type": { borderBottomWidth: 0 }, "&[data-using]": { bg: "metal.700" } }}
        >
          <Button
            size="xs"
            variant="ghost"
            rounded="sm"
            flex="1"
            minW="0"
            justifyContent="flex-start"
            color="rack.silkscreen"
            aria-pressed={t.key === using}
            aria-label={`Use ${t.name} (${takeMeta(t)})`}
            onClick={() => onUse(t)}
          >
            <chakra.span overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
              {t.name}
            </chakra.span>
            <chakra.span textStyle="silkscreen" color="rack.silkscreen.muted" ml="auto" pl="2">
              {takeMeta(t)}
            </chakra.span>
          </Button>
          <IconButton
            size="xs"
            variant="ghost"
            rounded="sm"
            color="fg.error"
            aria-label={`Delete ${t.name}`}
            onClick={() => void remove(t.key)}
          >
            <LuTrash2 />
          </IconButton>
        </HStack>
      ))}
    </VStack>
  )
}
