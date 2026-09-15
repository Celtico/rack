import {
  Button,
  chakra,
  HStack,
  Text,
  useSlotRecipe,
  VStack,
  type SystemStyleObject,
} from "@chakra-ui/react"
import { useRef, type KeyboardEvent } from "react"
import { LuEraser, LuPlus, LuRepeat, LuRepeat1, LuRepeat2 } from "react-icons/lu"

import { STEP_COUNT } from "../state/pattern"
import { MAX_CHAIN, PATTERN_COUNT } from "../state/patterns"
import { useRackStore } from "../state/store"
import { typeSlotDigit, type TypedDigit } from "./typeSlot"

/** The fill across the sounding bar's 16 steps; only this re-renders per step. */
function BarProgress({ css }: { css: SystemStyleObject | undefined }) {
  const currentStep = useRackStore((s) => s.currentStep)
  const progress = currentStep >= 0 ? ((currentStep + 1) / STEP_COUNT) * 100 : 0
  return <chakra.span css={css} style={{ width: `${progress}%` }} />
}

/**
 * SONG: the chain laid out as bars. Click a bar to cycle its pattern, or type
 * the pattern's number on it, × to drop it, + to append the active pattern.
 * While playing, the sounding bar is outlined and fills across its 16 steps.
 */
export function TimelineUnit() {
  const recipe = useSlotRecipe({ key: "songTimeline" })
  const styles = recipe()
  const chain = useRackStore((s) => s.chain)
  const activePattern = useRackStore((s) => s.activePattern)
  const playingBar = useRackStore((s) => s.playingBar)
  const followSong = useRackStore((s) => s.followSong)
  const {
    appendToChain,
    repeatLastBar,
    repeatChain,
    setChainSlot,
    removeChainSlot,
    clearChain,
    setFollowSong,
  } = useRackStore.getState()
  const full = chain.length >= MAX_CHAIN
  // The last digit typed on a bar, so "1" then "3" makes 13.
  const typed = useRef<TypedDigit | null>(null)

  const onBarKeyDown = (bar: number, pattern: number) => (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      setChainSlot(bar, (pattern + 1) % PATTERN_COUNT)
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault()
      removeChainSlot(bar)
    } else if (!e.altKey && !e.ctrlKey && !e.metaKey) {
      const hit = typeSlotDigit(typed.current, e.key, bar, e.timeStamp)
      if (!hit) return
      e.preventDefault()
      typed.current = hit.pending
      setChainSlot(bar, hit.slot)
    }
  }

  // A slot picked from the bank loops on its own: no bar of the song is sounding then.
  const playingIndex =
    followSong && playingBar >= 0 && chain.length > 0 ? playingBar % chain.length : -1

  return (
    <VStack gap="3" align="stretch">
      <chakra.div css={styles.root}>
        <chakra.div css={styles.track} role="list" aria-label="Song bars">
          {chain.map((pattern, bar) => (
            <chakra.div key={bar} css={styles.bar}>
              <chakra.span css={styles.ruler} aria-hidden="true">
                {bar + 1}
              </chakra.span>
              <chakra.div
                role="listitem"
                css={styles.block}
                data-pattern={pattern + 1}
                data-playing={bar === playingIndex ? "" : undefined}
                tabIndex={0}
                aria-label={`Bar ${bar + 1}: pattern ${pattern + 1}`}
                onClick={() => setChainSlot(bar, (pattern + 1) % PATTERN_COUNT)}
                onKeyDown={onBarKeyDown(bar, pattern)}
              >
                <chakra.span css={styles.number}>{pattern + 1}</chakra.span>
                {bar === playingIndex && <BarProgress css={styles.progress} />}
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
            </chakra.div>
          ))}
          {chain.length < MAX_CHAIN && (
            <chakra.div css={styles.bar}>
              <chakra.span css={styles.ruler} aria-hidden="true">
                {chain.length + 1}
              </chakra.span>
              <chakra.button
                type="button"
                css={styles.add}
                aria-label={`Add a bar of pattern ${activePattern + 1}`}
                onClick={() => appendToChain(activePattern)}
              >
                <LuPlus />
              </chakra.button>
            </chakra.div>
          )}
        </chakra.div>
      </chakra.div>

      <HStack gap="3" wrap="wrap" align="center">
        <Text textStyle="silkscreen" color="rack.silkscreen.muted">
          {chain.length === 0
            ? `No bars — looping pattern ${activePattern + 1}. Click + to build a song.`
            : followSong
              ? `${chain.length} bar${chain.length === 1 ? "" : "s"} · click a bar to change its pattern, or type its number`
              : `Looping pattern ${activePattern + 1} — the song is paused`}
        </Text>
        {chain.length > 0 && !followSong && (
          <Button
            size="xs"
            rounded="sm"
            variant="solid"
            colorPalette="orange"
            onClick={() => setFollowSong(true)}
            aria-label="Resume the song"
          >
            <LuRepeat /> Play song
          </Button>
        )}
        {/* More of the same: the last bar once more, or the whole song after itself. */}
        <Button
          size="xs"
          rounded="sm"
          variant="outline"
          onClick={repeatLastBar}
          disabled={chain.length === 0 || full}
          aria-label="Repeat the last bar"
          ml="auto"
        >
          <LuRepeat1 /> +1 bar
        </Button>
        <Button
          size="xs"
          rounded="sm"
          variant="outline"
          onClick={repeatChain}
          disabled={chain.length === 0 || full}
          aria-label="Repeat the whole song once more"
        >
          <LuRepeat2 /> ×2
        </Button>
        <Button
          size="xs"
          rounded="sm"
          variant="outline"
          onClick={clearChain}
          disabled={chain.length === 0}
          aria-label="Clear song"
        >
          <LuEraser /> Clear
        </Button>
      </HStack>
    </VStack>
  )
}
