import { chakra } from "@chakra-ui/react"
import { useEffect, useRef } from "react"

import { getEngine } from "../audio/engine"
import type { ChannelId } from "../state/channels"

export interface ScopeProps {
  channel: ChannelId
  width?: number
  height?: number
}

/**
 * A little oscilloscope of one channel, drawn on a canvas every animation
 * frame from the engine's analyser. The stroke colour is whatever `color` the
 * canvas inherits, so it follows the unit's silkscreen.
 */
export function Scope({ channel, width = 160, height = 28 }: ScopeProps) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext("2d")
    if (!el || !ctx) return
    const dpr = window.devicePixelRatio || 1
    el.width = width * dpr
    el.height = height * dpr
    ctx.scale(dpr, dpr)

    let frame = 0
    const draw = () => {
      const samples = getEngine().getWaveform(channel)
      ctx.clearRect(0, 0, width, height)
      ctx.strokeStyle = getComputedStyle(el).color
      ctx.lineWidth = 1.5
      ctx.beginPath()
      const mid = height / 2
      if (samples) {
        for (let i = 0; i < samples.length; i++) {
          const x = (i / (samples.length - 1)) * width
          const y = mid - (samples[i] ?? 0) * (mid - 1)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
      } else {
        ctx.moveTo(0, mid)
        ctx.lineTo(width, mid)
      }
      ctx.stroke()
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [channel, width, height])

  return (
    <chakra.canvas
      ref={canvas}
      role="img"
      aria-label={`${channel} waveform`}
      color="rack.display.fg"
      bg="rack.display.bg"
      rounded="xs"
      borderWidth="1px"
      borderColor="rack.panel.edge"
      style={{ width, height }}
    />
  )
}
