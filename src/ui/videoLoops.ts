import { getEngine } from "../audio/engine"
import { deleteSample, getSample, putSample } from "../audio/sampleStore"
import { useRackStore, type RackState } from "../state/store"

/** The screen's grid: the video is read at this size and no larger. */
export const VIDEO_SIZE = 20
/** Frames per second the screen and the brightness are fed at. */
export const VIDEO_FPS = 15
/** The filmstrip under the screen: this many thumbnails across the file, each this many pixels square. */
export const STRIP_FRAMES = 16
export const STRIP_SIZE = 24
/** Storage key of an instance's video, in the samples store. */
export const videoKey = (instanceId: string) => `${instanceId}:video`

type FrameListener = (frame: ImageData) => void
/** The filmstrip (one canvas, `STRIP_FRAMES` thumbnails side by side) and the file's length. */
export interface Strip {
  canvas: HTMLCanvasElement
  duration: number
}
type StripListener = (strip: Strip | null) => void

interface Loop {
  id: string
  video: HTMLVideoElement
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  url: string | null
  listeners: Set<FrameListener>
  stripListeners: Set<StripListener>
  strip: Strip | null
  timer: ReturnType<typeof setInterval> | null
  attached: boolean
  /** The loop's region, seconds — the instance's `start` / `end` (0: the file's end), kept for the element's events. */
  start: number
  end: number
}

const loops = new Map<string, Loop>()

/** The lit fraction of a frame: mean luma over its pixels, 0–1. Pure. */
export function brightnessOf(data: Uint8ClampedArray): number {
  let sum = 0
  const n = data.length / 4
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!
  }
  return n ? sum / n / 255 : 0
}

/** Does the loop start over at this bar? Every `bars` bars, from the first. */
export const restartsAt = (bar: number, bars: number): boolean => bar % Math.max(1, bars) === 0

/** Where the loop's region ends: `end` when set, else the file's length. Pure. */
export const regionEnd = (end: number, duration: number): number =>
  end > 0 && end < duration ? end : duration

const mimeOf = (name: string, type: string): string => {
  if (type) return type
  const ext = name.toLowerCase().replace(/^.*\./, "")
  return ext === "mov" ? "video/quicktime" : ext === "webm" ? "video/webm" : "video/mp4"
}

/** Draw `video` into a square of `size`, cropped to the middle (cover), at `x` on `ctx`. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  x: number,
  size: number,
) {
  const w = video.videoWidth
  const h = video.videoHeight
  if (!w || !h) return
  const side = Math.min(w, h)
  ctx.drawImage(video, (w - side) / 2, (h - side) / 2, side, side, x, 0, size, size)
}

function makeLoop(id: string): Loop {
  const video = document.createElement("video")
  video.playsInline = true
  video.preload = "auto"
  video.crossOrigin = "anonymous"
  const canvas = document.createElement("canvas")
  canvas.width = VIDEO_SIZE
  canvas.height = VIDEO_SIZE
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!
  const loop: Loop = {
    id,
    video,
    canvas,
    ctx,
    url: null,
    listeners: new Set(),
    stripListeners: new Set(),
    strip: null,
    timer: null,
    attached: false,
    start: 0,
    end: 0,
  }
  // Not the element's own `loop` (that wraps to 0): the file's end goes back to the start point.
  video.addEventListener("ended", () => {
    if (!useRackStore.getState().playing) return
    video.currentTime = loop.start
    void video.play().catch(() => {})
  })
  return loop
}

/** Draw one frame at 20×20, hand it to the screen and its brightness to the engine. */
function sample(loop: Loop): void {
  if (loop.video.readyState < 2 || loop.video.videoWidth === 0) return
  drawCover(loop.ctx, loop.video, 0, VIDEO_SIZE)
  const frame = loop.ctx.getImageData(0, 0, VIDEO_SIZE, VIDEO_SIZE)
  for (const cb of loop.listeners) cb(frame)
  getEngine().setVideoBrightness(loop.id, brightnessOf(frame.data))
}

/** While playing: a frame for the screen, and the region's end sends the loop back to its start. */
function tick(loop: Loop): void {
  const end = regionEnd(loop.end, loop.video.duration)
  if (Number.isFinite(end) && loop.video.currentTime >= end) loop.video.currentTime = loop.start
  sample(loop)
}

function startSampling(loop: Loop): void {
  if (loop.timer) return
  loop.timer = setInterval(() => tick(loop), 1000 / VIDEO_FPS)
}

function stopSampling(loop: Loop): void {
  if (loop.timer) clearInterval(loop.timer)
  loop.timer = null
}

/** Seek the stopped video to `seconds` and show that frame once the seek lands. */
function preview(loop: Loop, seconds: number): void {
  if (loop.video.readyState < 1 || useRackStore.getState().playing) return
  loop.video.currentTime = seconds
  loop.video.addEventListener("seeked", () => sample(loop), { once: true })
}

const onceLoaded = (video: HTMLVideoElement): Promise<void> =>
  new Promise((resolve, reject) => {
    if (video.readyState >= 1) return resolve()
    video.addEventListener("loadedmetadata", () => resolve(), { once: true })
    video.addEventListener("error", () => reject(new Error("video: cannot read")), { once: true })
  })

/**
 * Read `STRIP_FRAMES` frames spread across the file into one canvas — on a
 * scratch element of its own, so the playing one is never seeked. Sequential:
 * each seek waits for the last, and a source swapped meanwhile abandons it.
 */
async function buildStrip(loop: Loop, url: string): Promise<void> {
  const scratch = document.createElement("video")
  scratch.muted = true
  scratch.playsInline = true
  scratch.preload = "auto"
  scratch.src = url
  await onceLoaded(scratch)
  const duration = scratch.duration
  if (!Number.isFinite(duration) || duration <= 0) return
  const canvas = document.createElement("canvas")
  canvas.width = STRIP_FRAMES * STRIP_SIZE
  canvas.height = STRIP_SIZE
  const ctx = canvas.getContext("2d")!
  for (let i = 0; i < STRIP_FRAMES; i++) {
    if (loop.url !== url) return
    await new Promise<void>((resolve) => {
      scratch.addEventListener("seeked", () => resolve(), { once: true })
      scratch.currentTime = Math.min(duration - 0.05, ((i + 0.5) / STRIP_FRAMES) * duration)
    })
    drawCover(ctx, scratch, i * STRIP_SIZE, STRIP_SIZE)
  }
  if (loop.url !== url) return
  scratch.removeAttribute("src")
  scratch.load()
  loop.strip = { canvas, duration }
  for (const cb of loop.stripListeners) cb(loop.strip)
}

/** The element's audio into the engine, once the graph exists. Idempotent. */
function attach(loop: Loop): void {
  const engine = getEngine()
  if (loop.attached || !engine.isBuilt) return
  engine.attachVideoAudio(loop.id, loop.video)
  loop.attached = true
}

/** Run with the clock: wired in, from the start point, frames flowing. */
function startLoop(loop: Loop): void {
  attach(loop)
  loop.video.currentTime = loop.start
  void loop.video.play().catch(() => {})
  startSampling(loop)
}

/** Stopped with the clock: paused, the screen left on the start frame. */
function stopLoop(loop: Loop): void {
  loop.video.pause()
  stopSampling(loop)
  preview(loop, loop.start)
}

function setSource(loop: Loop, blob: Blob | null): void {
  if (loop.url) URL.revokeObjectURL(loop.url)
  loop.url = blob ? URL.createObjectURL(blob) : null
  loop.video.src = loop.url ?? ""
  loop.strip = null
  for (const cb of loop.stripListeners) cb(null)
  if (blob && loop.url) {
    // The start frame for the screen as soon as it can be drawn — and, if the clock is already
    // running (a file loaded mid-song, a machine added while playing), the whole loop starts.
    loop.video.addEventListener(
      "loadeddata",
      () => {
        if (useRackStore.getState().playing) startLoop(loop)
        else preview(loop, loop.start)
      },
      { once: true },
    )
    loop.video.load()
    void buildStrip(loop, loop.url).catch(() => {})
  } else {
    stopSampling(loop)
    for (const cb of loop.listeners) cb(loop.ctx.createImageData(VIDEO_SIZE, VIDEO_SIZE))
  }
}

async function ensure(id: string): Promise<Loop> {
  let loop = loops.get(id)
  if (loop) return loop
  loop = makeLoop(id)
  loops.set(id, loop)
  const stored = await getSample(videoKey(id))
  if (stored && loops.get(id) === loop) {
    setSource(loop, new Blob([stored.data], { type: mimeOf(stored.name, stored.type ?? "") }))
  }
  return loop
}

function drop(id: string): void {
  const loop = loops.get(id)
  if (!loop) return
  stopSampling(loop)
  loop.video.pause()
  setSource(loop, null)
  loops.delete(id)
}

/** Put a file on an instance: kept in the browser, shown at once, heard when the clock runs. */
export async function importVideo(
  id: string,
  name: string,
  type: string,
  data: ArrayBuffer,
): Promise<void> {
  await putSample(videoKey(id), { name, data, type })
  const loop = await ensure(id)
  setSource(loop, new Blob([data], { type: mimeOf(name, type) }))
}

export async function clearVideo(id: string): Promise<void> {
  await deleteSample(videoKey(id))
  const loop = loops.get(id)
  if (loop) setSource(loop, null)
}

/** Frames of an instance's video, as they are read. The screen draws them. */
export function subscribeFrames(id: string, cb: FrameListener): () => void {
  void ensure(id).then((loop) => {
    loop.listeners.add(cb)
    if (loop.video.readyState >= 2) sample(loop)
  })
  return () => {
    loops.get(id)?.listeners.delete(cb)
  }
}

/** The filmstrip of an instance's video: now if built, again when a file arrives, null when it goes. */
export function subscribeStrip(id: string, cb: StripListener): () => void {
  void ensure(id).then((loop) => {
    loop.stripListeners.add(cb)
    cb(loop.strip)
  })
  return () => {
    loops.get(id)?.stripListeners.delete(cb)
  }
}

/** Show the frame at `seconds` on the screen — while stopped, as the trimmer's handles move. */
export function previewAt(id: string, seconds: number): void {
  const loop = loops.get(id)
  if (loop) preview(loop, seconds)
}

// ---- Converting ----------------------------------------------------------------------------------

/** A format the browser's recorder can write. */
export interface VideoFormat {
  id: string
  label: string
  mime: string
  extension: string
}

const FORMATS: readonly VideoFormat[] = [
  { id: "mp4", label: "MP4 · H.264", mime: "video/mp4;codecs=avc1,mp4a.40.2", extension: "mp4" },
  { id: "mp4-any", label: "MP4", mime: "video/mp4", extension: "mp4" },
  { id: "webm-vp9", label: "WebM · VP9", mime: "video/webm;codecs=vp9,opus", extension: "webm" },
  { id: "webm-vp8", label: "WebM · VP8", mime: "video/webm;codecs=vp8,opus", extension: "webm" },
  { id: "webm", label: "WebM", mime: "video/webm", extension: "webm" },
]

/** The formats this browser can record — each a separate entry only when it is distinct. */
export function videoFormats(): VideoFormat[] {
  if (typeof MediaRecorder === "undefined") return []
  const out: VideoFormat[] = []
  for (const f of FORMATS) {
    if (!MediaRecorder.isTypeSupported(f.mime)) continue
    // "MP4" after "MP4 · H.264" adds nothing; same for WebM after a codec-specific WebM.
    if (out.some((o) => o.extension === f.extension && !f.mime.includes("codecs"))) continue
    out.push(f)
  }
  return out
}

/** Heights a converted video may have; the width follows the file's aspect. */
export const VIDEO_HEIGHTS = [180, 240, 360, 480] as const
/** What a file is turned into on upload: MP4 where the browser writes it, else the first WebM; small. */
export const UPLOAD_HEIGHT: (typeof VIDEO_HEIGHTS)[number] = 240
export const uploadFormat = (): VideoFormat | undefined => {
  const formats = videoFormats()
  return formats.find((f) => f.extension === "mp4") ?? formats[0]
}

export interface ConvertOptions {
  format: VideoFormat
  height: (typeof VIDEO_HEIGHTS)[number]
  /** Only the trimmed region, or the whole file. */
  region: boolean
  onProgress?: (fraction: number) => void
}

/**
 * Re-encode an instance's video in the browser: the file plays once, silently
 * to the user, into a small canvas and a recorder that writes the chosen
 * format; the result replaces the stored file. Real time — a 20 s clip takes
 * 20 s. The audio goes through a context of its own, so the rack's graph and
 * the element the rack plays are untouched. Returns the new file's name.
 */
export async function convertVideo(id: string, options: ConvertOptions): Promise<string> {
  const loop = await ensure(id)
  if (!loop.url) throw new Error("no video loaded")
  const stored = await getSample(videoKey(id))
  if (!stored) throw new Error("no video loaded")
  const { format, height, region, onProgress } = options

  const scratch = document.createElement("video")
  scratch.playsInline = true
  scratch.preload = "auto"
  scratch.src = loop.url
  await onceLoaded(scratch)
  const duration = scratch.duration
  const from = region ? loop.start : 0
  const to = region ? regionEnd(loop.end, duration) : duration
  if (!(to > from)) throw new Error("nothing to convert")

  // Picture: the file drawn into a canvas of the wanted height, frame by frame as it plays.
  const scale = height / scratch.videoHeight
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(2, Math.round((scratch.videoWidth * scale) / 2) * 2)
  canvas.height = height
  const ctx = canvas.getContext("2d")!
  const stream = canvas.captureStream(VIDEO_FPS * 2)

  // Sound: the element into a small context of its own, out as a stream track.
  const audio = new AudioContext()
  const source = audio.createMediaElementSource(scratch)
  const sink = audio.createMediaStreamDestination()
  source.connect(sink)
  for (const track of sink.stream.getAudioTracks()) stream.addTrack(track)

  const recorder = new MediaRecorder(stream, {
    mimeType: format.mime,
    videoBitsPerSecond: height * 3000,
    audioBitsPerSecond: 96_000,
  })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data)
  }
  const done = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve()
  })

  try {
    await audio.resume()
    scratch.currentTime = from
    await new Promise<void>((resolve) =>
      scratch.addEventListener("seeked", () => resolve(), { once: true }),
    )
    recorder.start(250)
    await scratch.play()
    await new Promise<void>((resolve) => {
      const draw = () => {
        ctx.drawImage(scratch, 0, 0, canvas.width, canvas.height)
        onProgress?.(Math.min(1, (scratch.currentTime - from) / (to - from)))
        if (scratch.ended || scratch.currentTime >= to) return resolve()
        requestAnimationFrame(draw)
      }
      scratch.addEventListener("ended", () => resolve(), { once: true })
      requestAnimationFrame(draw)
    })
  } finally {
    scratch.pause()
    if (recorder.state !== "inactive") recorder.stop()
    await done
    source.disconnect()
    await audio.close()
    scratch.removeAttribute("src")
    scratch.load()
  }

  const blob = new Blob(chunks, { type: format.mime.split(";")[0] })
  if (blob.size === 0) throw new Error("the recorder wrote nothing")
  const name = `${stored.name.replace(/\.[^.]+$/, "")}-${height}p.${format.extension}`
  await importVideo(id, name, blob.type, await blob.arrayBuffer())
  return name
}

const videoIds = (s: RackState) => s.instances.filter((i) => i.kind === "video").map((i) => i.id)
const barsOf = (s: RackState, id: string) => {
  const inst = s.instances.find((i) => i.id === id)
  return inst?.kind === "video" ? inst.params.bars : 1
}

/** Each loop learns its region from the store; a moved start shows its new first frame while stopped. */
function syncRegions(s: RackState): void {
  for (const loop of loops.values()) {
    const inst = s.instances.find((i) => i.id === loop.id)
    if (inst?.kind !== "video") continue
    const { start, end } = inst.params
    const moved = start !== loop.start
    loop.start = start
    loop.end = end
    if (moved && !s.playing) preview(loop, start)
  }
}

/**
 * Keeps one hidden video element per VID-1, fed from the browser's storage,
 * in step with the clock: it plays while the transport runs, starts over on
 * the first step of every `bars` bars, and stops (at its start point) with
 * it. While it plays, a frame is read at `VIDEO_FPS` for the screens and the
 * brightness, and the region's end sends it back to its start.
 */
export function installVideoLoops(): () => void {
  const sync = async (s: RackState) => {
    const ids = videoIds(s)
    for (const id of [...loops.keys()]) if (!ids.includes(id)) drop(id)
    for (const id of ids) await ensure(id)
    syncRegions(s)
  }
  void sync(useRackStore.getState())

  const unsubscribe = useRackStore.subscribe((s, prev) => {
    if (s.instances !== prev.instances) void sync(s)
    if (s.playing !== prev.playing) {
      for (const loop of loops.values()) {
        if (s.playing) startLoop(loop)
        else stopLoop(loop)
      }
    }
    // The first step of a bar the loop starts over on: back to the start point.
    if (s.playing && s.currentStep === 0 && prev.currentStep !== 0 && s.playingBar >= 0) {
      for (const loop of loops.values()) {
        if (restartsAt(s.playingBar, barsOf(s, loop.id))) loop.video.currentTime = loop.start
      }
    }
  })
  return () => {
    unsubscribe()
    for (const id of [...loops.keys()]) drop(id)
  }
}

/**
 * Start every loop's element right now — from inside the Play gesture, before
 * anything is awaited: a browser lets unmuted media play only on a user's
 * click, and the transport's own start comes back a promise later.
 */
export function playVideoLoops(): void {
  for (const loop of loops.values()) {
    if (loop.video.src) void loop.video.play().catch(() => {})
  }
}
