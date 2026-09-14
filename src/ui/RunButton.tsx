import { IconButton, type IconButtonProps } from "@chakra-ui/react"
import { LuPlay, LuSquare } from "react-icons/lu"

import { useRackStore } from "../state/store"
import { startTransport, stopTransport } from "./transportControl"

/**
 * The clock's run switch: play, or stop while it runs. Lives on the transport
 * panel and, folded, in its header next to the OUT meter, so the rack can be
 * started and stopped without opening it.
 */
export function RunButton({ size = "lg", ...rest }: Omit<IconButtonProps, "aria-label">) {
  const playing = useRackStore((s) => s.playing)
  return (
    <IconButton
      aria-label={playing ? "Stop" : "Play"}
      aria-pressed={playing}
      onClick={() => (playing ? stopTransport() : startTransport())}
      size={size}
      variant="subtle"
      colorPalette={playing ? "orange" : "gray"}
      rounded="sm"
      {...rest}
    >
      {playing ? <LuSquare /> : <LuPlay />}
    </IconButton>
  )
}
