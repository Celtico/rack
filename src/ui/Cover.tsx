import { chakra } from "@chakra-ui/react"
import type { ComponentProps } from "react"
import { LuPlay, LuSquare } from "react-icons/lu"

/**
 * A record sleeve: a plain, flat dark grey square with the song's name printed
 * on it. It is a button — the song's play/stop — with a play (or stop) mark in
 * the corner; `data-playing` marks a sounding song, `data-current` (an amber
 * frame) the one the rack holds.
 */
export function Cover({
  name,
  playing,
  ...rest
}: { name: string; playing: boolean } & ComponentProps<typeof chakra.button>) {
  return (
    <chakra.button
      type="button"
      position="relative"
      w="full"
      aspectRatio="1"
      rounded="xs"
      overflow="hidden"
      cursor="pointer"
      textAlign="left"
      bg="metal.800"
      transitionProperty="background-color"
      transitionDuration="fast"
      _hover={{ bg: "metal.700" }}
      _focusVisible={{ outline: "2px solid", outlineColor: "rack.led.on", outlineOffset: "2px" }}
      _motionReduce={{ transition: "none" }}
      css={{ "&[data-current]": { boxShadow: "0 0 0 2px {colors.rack.led.on}" } }}
      {...rest}
    >
      <chakra.span
        position="absolute"
        left="2.5"
        right="8"
        bottom="2.5"
        fontFamily="display"
        fontWeight="bold"
        fontSize="sm"
        lineHeight="shorter"
        color="cream.100"
        lineClamp={3}
        aria-hidden="true"
      >
        {name}
      </chakra.span>
      <chakra.span
        position="absolute"
        right="2.5"
        bottom="2.5"
        display="grid"
        placeItems="center"
        fontSize="md"
        color={playing ? "rack.led.on" : "rack.silkscreen.muted"}
        aria-hidden="true"
      >
        {playing ? <LuSquare /> : <LuPlay />}
      </chakra.span>
    </chakra.button>
  )
}
