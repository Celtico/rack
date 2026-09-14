import { chakra } from "@chakra-ui/react"
import type { ComponentProps } from "react"
import { LuPlay, LuSquare } from "react-icons/lu"

/**
 * The face of the record, back to front: the spindle hole and the label, a
 * soft sheen where the light catches the vinyl, and the grooves.
 */
const VINYL = [
  "radial-gradient(circle, {colors.metal.950} 0 4%, {colors.amber.500} 4% 21%, {colors.metal.950} 21% 23%, transparent 23%)",
  "conic-gradient(from 20deg, transparent 0 8%, {colors.whiteAlpha.200} 17%, transparent 26%, transparent 54%, {colors.whiteAlpha.100} 63%, transparent 72%)",
  "repeating-radial-gradient(circle, {colors.metal.950} 0 1.5px, {colors.metal.800} 1.5px 3px)",
].join(", ")

/**
 * A record sleeve: a flat grey square, a shade lighter than the drawer, with
 * the record showing in it — the name is printed under the sleeve, not on it.
 * It is a button — the song's play/stop — with a play (or stop) mark in the
 * corner; `data-playing` marks a sounding song (its record turns),
 * `data-current` (an amber frame) the one the rack holds.
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
      bg="metal.700"
      transitionProperty="filter"
      transitionDuration="fast"
      // Lift the whole sleeve, record included, so the two keep their contrast.
      _hover={{ filter: "brightness(1.15)" }}
      _focusVisible={{ outline: "2px solid", outlineColor: "rack.led.on", outlineOffset: "2px" }}
      _motionReduce={{ transition: "none" }}
      css={{
        "&[data-current]": { boxShadow: "0 0 0 2px {colors.rack.led.on}" },
        "@keyframes cover-spin": { to: { transform: "rotate(360deg)" } },
      }}
      title={name}
      {...rest}
    >
      {/* The record. Its placement is a transform, so the face — a pseudo-element — is what spins. */}
      <chakra.span
        position="absolute"
        top="11%"
        left="50%"
        w="78%"
        aspectRatio="1"
        transform="translateX(-50%)"
        css={{
          "&::after": {
            content: '""',
            position: "absolute",
            inset: 0,
            rounded: "full",
            backgroundImage: VINYL,
            boxShadow: "0 2px 6px {colors.blackAlpha.700}",
            animation: playing ? "cover-spin 1.8s linear infinite" : "none",
            "@media (prefers-reduced-motion: reduce)": { animation: "none" },
          },
        }}
        aria-hidden="true"
      />
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
