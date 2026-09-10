import { Button, chakra, HStack, Text, useSlotRecipe, VStack } from "@chakra-ui/react"
import { LuEraser, LuListMusic, LuPlus } from "react-icons/lu"

import { STEP_COUNT } from "../state/pattern"
import { MAX_CHAIN, PATTERN_COUNT } from "../state/patterns"
import { useRackStore } from "../state/store"
import { RackUnit } from "./RackUnit"

/**
 * SONG: the chain laid out as bars. Click a bar to cycle its pattern, × to
 * drop it, + to append the active pattern. While playing, the sounding bar is
 * outlined and fills across its 16 steps.
 */
export function TimelineUnit() {
  const recipe = useSlotRecipe({ key: "songTimeline" })
  const styles = recipe()
  const chain = useRackStore((s) => s.chain)
  const activePattern = useRackStore((s) => s.activePattern)
  const playingBar = useRackStore((s) => s.playingBar)
  const currentStep = useRackStore((s) => s.currentStep)
  const { appendToChain, setChainSlot, removeChainSlot, clearChain } = useRackStore.getState()

  const playingIndex = playingBar >= 0 && chain.length > 0 ? playingBar % chain.length : -1
  const progress = currentStep >= 0 ? ((currentStep + 1) / STEP_COUNT) * 100 : 0

  return (
    <RackUnit model="SONG" title="Timeline" icon={<LuListMusic />}>
      <VStack gap="3" align="stretch">
        <chakra.div css={styles.root}>
          <chakra.div css={styles.ruler} aria-hidden="true">
            {chain.map((_, bar) => (
              <span key={bar}>{bar + 1}</span>
            ))}
          </chakra.div>
          <chakra.div css={styles.track} role="list" aria-label="Song bars">
            {chain.map((pattern, bar) => (
              <chakra.div
                key={bar}
                role="listitem"
                css={styles.block}
                data-pattern={pattern + 1}
                data-playing={bar === playingIndex ? "" : undefined}
                tabIndex={0}
                aria-label={`Bar ${bar + 1}: pattern ${pattern + 1}`}
                onClick={() => setChainSlot(bar, (pattern + 1) % PATTERN_COUNT)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setChainSlot(bar, (pattern + 1) % PATTERN_COUNT)
                  } else if (e.key === "Delete" || e.key === "Backspace") {
                    e.preventDefault()
                    removeChainSlot(bar)
                  }
                }}
              >
                <chakra.span css={styles.number}>{pattern + 1}</chakra.span>
                {bar === playingIndex && (
                  <chakra.span css={styles.progress} style={{ width: `${progress}%` }} />
                )}
                <chakra.button
                  type="button"
                  css={styles.remove}
                  aria-label={`Remove bar ${bar + 1}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    removeChainSlot(bar)
                  }}
                >
                  ×
                </chakra.button>
              </chakra.div>
            ))}
            {chain.length < MAX_CHAIN && (
              <chakra.button
                type="button"
                css={styles.add}
                aria-label={`Add a bar of pattern ${activePattern + 1}`}
                onClick={() => appendToChain(activePattern)}
              >
                <LuPlus />
              </chakra.button>
            )}
          </chakra.div>
        </chakra.div>

        <HStack gap="3" wrap="wrap" align="center">
          <Text textStyle="silkscreen" color="rack.silkscreen.muted">
            {chain.length === 0
              ? `No bars — looping pattern ${activePattern + 1}. Click + to build a song.`
              : `${chain.length} bar${chain.length === 1 ? "" : "s"} · click a bar to change its pattern`}
          </Text>
          <Button
            size="xs"
            rounded="sm"
            variant="outline"
            onClick={clearChain}
            disabled={chain.length === 0}
            aria-label="Clear song"
            ml="auto"
          >
            <LuEraser /> Clear
          </Button>
        </HStack>
      </VStack>
    </RackUnit>
  )
}
