import {
  Button,
  CloseButton,
  Drawer,
  HStack,
  IconButton,
  Input,
  Portal,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useEffect, useRef, useState, type FormEvent } from "react"
import { LuDownload, LuLibrary, LuPencil, LuPlay, LuSave, LuSquare, LuTrash2 } from "react-icons/lu"

import { getEngine } from "../audio/engine"
import { toaster } from "../components/ui/toaster"
import { serializeSong, type Song } from "../state/song"
import { builtinKey, songFileName, useLibraryStore, type LibraryEntry } from "../state/songLibrary"
import { toSong, useRackStore } from "../state/store"
import { loadBuiltinSong, loadBuiltinSongs, type BuiltinSong } from "./builtinSongs"
import { downloadJson } from "./download"
import { toolbarButton } from "./toolbar"
import { startTransport, stopTransport } from "./transportControl"

/**
 * When Escape just cancelled a rename, the drawer must stay open. The dialog
 * hears Escape on the document, before or after the field does, so the field
 * leaves a timestamp and the drawer checks it (or that the field still has focus).
 */
let escapedRenameAt = 0
const escapeIsForRename = () =>
  Date.now() - escapedRenameAt < 200 ||
  document.activeElement?.getAttribute("aria-label")?.startsWith("New name for ") === true

const when = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })

const length = (bars: number) => (bars ? `${bars} bar${bars === 1 ? "" : "s"}` : "loop")

/**
 * Play a song from the top: stop (rewinds), load, start. The audio context is
 * asked to run first thing, still inside the tap — iOS only honours that from
 * a gesture, and it may have silenced the context in the background while the
 * clock kept "playing".
 */
async function playSong(key: string, getSong: () => Promise<Song>, name: string, done: () => void) {
  const engine = getEngine()
  try {
    void engine.resumeAudio()
    const song = await getSong()
    stopTransport()
    const { loadSong, setFollowSong } = useRackStore.getState()
    loadSong(song)
    setFollowSong(true)
    useLibraryStore.getState().setNowPlaying(key)
    engine.syncFromStore()
    await startTransport()
    done()
    toaster.create({ type: "info", title: "Playing", description: name })
  } catch (err) {
    toaster.create({
      type: "error",
      title: "Could not play",
      description: err instanceof Error ? err.message : String(err),
    })
  }
}

interface RowProps {
  /** Identifies the song in `nowPlaying`: the entry id, or a `builtinKey`. */
  songKey: string
  name: string
  /** Under the name: tempo, length, when. */
  meta: string
  getSong: () => Promise<Song>
  /** Absent for built-in songs, which cannot be deleted. */
  onDelete?: () => void
  /** Absent for built-in songs, which cannot be renamed. */
  onRename?: (name: string) => void
  onPlayed: () => void
}

/**
 * One song of the list, with play / download and, for the user's own, delete.
 * The song the rack holds is outlined; its button stops the clock while it
 * runs, and starts the song over when it is stopped.
 */
function Row({ songKey, name, meta, getSong, onDelete, onRename, onPlayed }: RowProps) {
  const current = useLibraryStore((s) => s.nowPlaying === songKey)
  const playing = useRackStore((s) => s.playing) && current
  // Renaming happens in place: the name becomes a field until Enter, blur or Escape.
  const [draft, setDraft] = useState<string | null>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  // Set while the field is being closed on purpose, so the blur that moving focus causes
  // does not commit what Escape meant to throw away.
  const closing = useRef(false)
  const endRename = (commit: boolean) => {
    if (closing.current) return
    closing.current = true
    // Focus goes to the row before the field unmounts: left to the drawer's focus trap, it
    // would land on the close button and the tail of the Enter keystroke would press it.
    rowRef.current?.focus()
    if (commit && draft !== null && onRename) onRename(draft)
    setDraft(null)
  }
  const startRename = () => {
    closing.current = false
    setDraft(name)
  }
  const download = async () => {
    try {
      downloadJson(songFileName(name), serializeSong(await getSong()))
    } catch (err) {
      toaster.create({
        type: "error",
        title: "Could not download",
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return (
    <HStack
      as="li"
      ref={rowRef}
      tabIndex={-1}
      outline="none"
      gap="2"
      py="2"
      px="2"
      mx="-2"
      rounded="sm"
      borderBottomWidth="1px"
      borderColor="rack.panel.edge"
      align="center"
      aria-current={current ? "true" : undefined}
      // The song the rack holds: a faint amber wash and an LED-coloured name.
      bg={current ? "rack.led.off" : undefined}
      css={{ "&[aria-current] .song-name": { color: "rack.led.on" } }}
    >
      <VStack gap="0.5" align="flex-start" minW="0" flex="1">
        {draft === null ? (
          <Text className="song-name" fontWeight="medium" lineClamp={1} title={name}>
            {name}
          </Text>
        ) : (
          <Input
            size="sm"
            fontSize="md"
            rounded="sm"
            value={draft}
            aria-label={`New name for ${name}`}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => endRename(true)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== "Escape") return
              e.preventDefault()
              if (e.key === "Escape") escapedRenameAt = Date.now()
              endRename(e.key === "Enter")
            }}
          />
        )}
        <Text textStyle="silkscreen" color="rack.silkscreen.muted">
          {playing ? "Playing · " : ""}
          {meta}
        </Text>
      </VStack>
      <IconButton
        size="sm"
        variant={playing ? "solid" : "subtle"}
        colorPalette="orange"
        rounded="sm"
        aria-label={playing ? `Stop ${name}` : `Play ${name}`}
        aria-pressed={playing}
        onClick={() =>
          playing ? stopTransport() : void playSong(songKey, getSong, name, onPlayed)
        }
      >
        {playing ? <LuSquare /> : <LuPlay />}
      </IconButton>
      <IconButton
        size="sm"
        variant="ghost"
        rounded="sm"
        aria-label={`Download ${name}`}
        onClick={() => void download()}
      >
        <LuDownload />
      </IconButton>
      {onRename && (
        <IconButton
          size="sm"
          variant="ghost"
          rounded="sm"
          aria-label={`Rename ${name}`}
          onClick={startRename}
        >
          <LuPencil />
        </IconButton>
      )}
      {onDelete && (
        <IconButton
          size="sm"
          variant="ghost"
          rounded="sm"
          color="fg.error"
          aria-label={`Delete ${name}`}
          onClick={onDelete}
        >
          <LuTrash2 />
        </IconButton>
      )}
    </HStack>
  )
}

/** A song the user saved: deletable, with an Undo toast. */
function SavedRow({ entry, onPlayed }: { entry: LibraryEntry; onPlayed: () => void }) {
  const { remove, restore, rename } = useLibraryStore.getState()
  const del = async () => {
    const removed = await remove(entry.id)
    if (!removed) return
    toaster.create({
      type: "info",
      title: `${removed.name} deleted`,
      action: { label: "Undo", onClick: () => void restore(removed) },
    })
  }
  return (
    <Row
      songKey={entry.id}
      name={entry.name}
      meta={`${entry.song.bpm} BPM · ${length(entry.song.chain.length)} · ${when(entry.savedAt)}`}
      getSong={() => Promise.resolve(entry.song)}
      onDelete={() => void del()}
      onRename={(name) => void rename(entry.id, name)}
      onPlayed={onPlayed}
    />
  )
}

/**
 * The song library, in a drawer: the songs shipped with the rack, then the
 * user's own — save what is in the rack under a name, and play, download or
 * delete anything saved before. Saved songs live in IndexedDB; nothing leaves
 * the browser unless it is downloaded.
 */
export function SongLibrary() {
  const entries = useLibraryStore((s) => s.entries)
  const loaded = useLibraryStore((s) => s.loaded)
  const unsaved = useLibraryStore((s) => s.nowPlaying === null)
  const unsavedName = useLibraryStore((s) => s.unsavedName)
  const bpm = useRackStore((s) => s.bpm)
  const { refresh, save } = useLibraryStore.getState()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [builtins, setBuiltins] = useState<BuiltinSong[]>([])

  useEffect(() => {
    if (!open) return
    if (!loaded) void refresh()
    void loadBuiltinSongs().then(setBuiltins)
  }, [open, loaded, refresh])

  // What the rack holds is in no list: on opening, offer a name — the file it came from, or a numbered one.
  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (next && unsaved && !name) setName(unsavedName ?? `Song ${entries.length + 1} · ${bpm} BPM`)
  }

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    const entry = await save(name, toSong(useRackStore.getState()))
    setName("")
    toaster.create({ type: "success", title: "Song saved", description: entry.name })
  }

  const close = () => setOpen(false)

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(d) => onOpenChange(d.open)}
      onEscapeKeyDown={(e) => {
        if (escapeIsForRename()) e.preventDefault()
      }}
      placement="end"
      size="sm"
    >
      <Drawer.Trigger asChild>
        <Button {...toolbarButton}>
          <LuLibrary /> Songs
        </Button>
      </Drawer.Trigger>
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content bg="rack.panel" color="rack.silkscreen">
            <Drawer.Header borderBottomWidth="1px" borderColor="rack.panel.edge">
              <Drawer.Title textStyle="silkscreen" fontSize="sm">
                Songs
              </Drawer.Title>
              <Drawer.CloseTrigger asChild>
                <CloseButton size="sm" position="absolute" top="3" right="3" />
              </Drawer.CloseTrigger>
            </Drawer.Header>
            <Drawer.Body px="4" py="3">
              <VStack
                as="form"
                gap="2"
                align="stretch"
                onSubmit={onSave}
                mb="4"
                // Unsaved: the form lights up so it is not missed.
                p={unsaved ? "3" : undefined}
                mx={unsaved ? "-3" : undefined}
                rounded="sm"
                bg={unsaved ? "rack.led.off" : undefined}
              >
                <Text
                  textStyle="silkscreen"
                  color={unsaved ? "rack.led.on" : "rack.silkscreen.muted"}
                >
                  {unsaved ? "Playing now · not in the library" : "Save what is in the rack"}
                </Text>
                <HStack gap="2">
                  <Input
                    size="md"
                    // 16px: under that, iOS Safari zooms the page when the field takes focus.
                    fontSize="md"
                    rounded="sm"
                    placeholder="Song name"
                    aria-label="Song name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <Button type="submit" size="md" rounded="sm" colorPalette="orange" flexShrink={0}>
                    <LuSave /> Save
                  </Button>
                </HStack>
              </VStack>

              {builtins.length > 0 && (
                <>
                  <Text textStyle="silkscreen" color="rack.silkscreen.muted" mb="1">
                    Built in
                  </Text>
                  <VStack
                    as="ul"
                    gap="0"
                    align="stretch"
                    listStyleType="none"
                    aria-label="Built-in songs"
                    mb="4"
                  >
                    {builtins.map((b) => (
                      <Row
                        key={b.file}
                        songKey={builtinKey(b.file)}
                        name={b.name}
                        meta={`${b.bpm} BPM · ${length(b.bars)} · built in`}
                        getSong={() => loadBuiltinSong(b.file)}
                        onPlayed={close}
                      />
                    ))}
                  </VStack>
                </>
              )}

              <Text textStyle="silkscreen" color="rack.silkscreen.muted" mb="1">
                Saved
              </Text>
              {loaded && entries.length === 0 && (
                <Text textStyle="silkscreen" color="rack.silkscreen.muted">
                  Nothing saved yet.
                </Text>
              )}
              <VStack as="ul" gap="0" align="stretch" listStyleType="none" aria-label="Saved songs">
                {entries.map((entry) => (
                  <SavedRow key={entry.id} entry={entry} onPlayed={close} />
                ))}
              </VStack>
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  )
}
