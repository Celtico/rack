import {
  Button,
  Grid,
  HStack,
  IconButton,
  Input,
  Menu,
  Portal,
  Text,
  VStack,
} from "@chakra-ui/react"
import { useEffect, useRef, useState, type FormEvent } from "react"
import {
  LuChevronDown,
  LuChevronRight,
  LuChevronUp,
  LuDownload,
  LuEllipsis,
  LuFileAudio,
  LuFolder,
  LuFolderInput,
  LuFolderPlus,
  LuHistory,
  LuLibrary,
  LuPencil,
  LuPlay,
  LuSave,
  LuSquare,
  LuTrash2,
  LuUndo2,
} from "react-icons/lu"

import { getEngine } from "../audio/engine"
import { toaster } from "../components/ui/toaster"
import { serializeSong, type Song } from "../state/song"
import {
  builtinKey,
  folderNames,
  songFileName,
  useLibraryStore,
  type LibraryEntry,
  type SongVersion,
} from "../state/songLibrary"
import { toSong, useRackStore } from "../state/store"
import { loadBuiltinSong, loadBuiltinSongs, type BuiltinSong } from "./builtinSongs"
import { downloadJson } from "./download"
import { markEscape } from "./escapeGuard"
import { exportSongAudio, type AudioFormat } from "./exportAudio"
import { Cover } from "./Cover"
import { COVER_GRID, songLength } from "./coverGrid"
import { FolderMenuItems, FolderPicker, NEW_FOLDER } from "./FolderPicker"
import { LoadSongButton } from "./LoadSongButton"
import { NewSongButton } from "./NewSongButton"
import { playFolder, stopPlaylist, usePlaylistStore } from "./playlist"
import { usePanelStore } from "./panels"
import { SidePanel } from "./SidePanel"
import { toolbarButton } from "./toolbar"
import { startTransport, stopTransport } from "./transportControl"

const when = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })

/**
 * Play a song from the top: stop (rewinds), load, start. The audio context is
 * asked to run first thing, still inside the tap — iOS only honours that from
 * a gesture, and it may have silenced the context in the background while the
 * clock kept "playing".
 */
async function playSong(key: string, getSong: () => Promise<Song>, name: string) {
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
    toaster.create({ type: "info", title: "Playing", description: name })
  } catch (err) {
    toaster.create({
      type: "error",
      title: "Could not play",
      description: err instanceof Error ? err.message : String(err),
    })
  }
}

interface SongCoverProps {
  /** Identifies the song in `nowPlaying`: the entry id, or a `builtinKey`. */
  songKey: string
  name: string
  /** Under the name: tempo, length, when. */
  meta: string
  getSong: () => Promise<Song>
  /** Runs when the sleeve is pressed to play — not for a download or an export. */
  onPlay?: () => void
  /** Absent for built-in songs, which cannot be deleted. */
  onDelete?: () => void
  /** Absent for built-in songs, which cannot be renamed. */
  onRename?: (name: string) => void
  /** Absent for built-in songs, which live in no folder. */
  onMove?: (folder: string | null) => void
  folder?: string | null
  folders?: readonly string[]
}

/** What the line under a sleeve has turned into for a moment: a field for a new name, or a new folder. */
type Draft = { kind: "rename" | "folder"; value: string }

/**
 * One song as a record sleeve: the cover plays it (and stops it while it runs),
 * name and meta sit under it, and a small menu holds download, rename, move to
 * a folder and delete. The song the rack holds wears an amber frame. The drawer
 * stays open through all of it.
 */
export function SongCover({
  songKey,
  name,
  meta,
  getSong,
  onPlay,
  onDelete,
  onRename,
  onMove,
  folder = null,
  folders = [],
}: SongCoverProps) {
  const current = useLibraryStore((s) => s.nowPlaying === songKey)
  const playing = useRackStore((s) => s.playing) && current
  // Renaming and naming a new folder happen in place: a field until Enter, blur or Escape.
  const [draft, setDraft] = useState<Draft | null>(null)
  const itemRef = useRef<HTMLDivElement>(null)
  // Set while the field is being closed on purpose, so the blur that moving focus causes
  // does not commit what Escape meant to throw away.
  const closing = useRef(false)
  const endDraft = (commit: boolean) => {
    if (closing.current) return
    closing.current = true
    // Focus goes to the item before the field unmounts: left to the drawer's focus trap, it
    // would land on the close button and the tail of the Enter keystroke would press it.
    itemRef.current?.focus()
    if (commit && draft !== null) {
      const value = draft.value.trim()
      if (draft.kind === "rename" && onRename && value) onRename(value)
      if (draft.kind === "folder" && onMove && value) onMove(value)
    }
    setDraft(null)
  }
  const startDraft = (kind: Draft["kind"]) => {
    closing.current = false
    setDraft({ kind, value: kind === "rename" ? name : "" })
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
  const exportAudio = async (format: AudioFormat) => {
    try {
      await exportSongAudio(await getSong(), name, format)
    } catch (err) {
      toaster.create({
        type: "error",
        title: "Could not export",
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }
  const act = (value: string) => {
    if (value === "download") void download()
    else if (value === "wav" || value === "mp3") void exportAudio(value)
    else if (value === "rename") startDraft("rename")
    else if (value === "delete") onDelete?.()
    else if (value === NEW_FOLDER) startDraft("folder")
  }

  return (
    <VStack
      as="li"
      ref={itemRef}
      tabIndex={-1}
      outline="none"
      gap="1.5"
      align="center"
      minW="0"
      aria-current={current ? "true" : undefined}
    >
      <Cover
        name={name}
        playing={playing}
        aria-label={playing ? `Stop ${name}` : `Play ${name}`}
        aria-pressed={playing}
        data-current={current ? "" : undefined}
        data-playing={playing ? "" : undefined}
        onClick={() => {
          if (playing) {
            stopTransport()
            return
          }
          onPlay?.()
          void playSong(songKey, getSong, name)
        }}
      />
      {draft === null ? (
        <HStack gap="0" align="flex-start" w="full" minW="0">
          <VStack gap="0" align="flex-start" alignContent="flex-start" flex="1" minW="0" pt="0.5">
            <Text
              className="song-name"
              srOnly={false}
              fontSize="xs"
              fontWeight="medium"
              lineClamp={1}
              title={name}
              color={current ? "rack.led.on" : "rack.silkscreen"}
            >
              {name}
            </Text>
            <Text textStyle="silkscreen" fontSize="2xs" color="rack.silkscreen.muted" lineClamp={1}>
              {playing ? "Playing · " : ""}
              {meta}
            </Text>
          </VStack>
          <Menu.Root onSelect={(d) => act(d.value)} positioning={{ placement: "bottom-end" }}>
            <Menu.Trigger asChild>
              <IconButton
                size="xs"
                variant="ghost"
                rounded="sm"
                color="rack.silkscreen.muted"
                aria-label={`More for ${name}`}
              >
                <LuEllipsis />
              </IconButton>
            </Menu.Trigger>
            <Portal>
              <Menu.Positioner>
                <Menu.Content>
                  <Menu.Item value="download">
                    <LuDownload /> Download
                  </Menu.Item>
                  {/* Rendered offline from the saved song, not from what the rack plays. */}
                  <Menu.Item value="wav">
                    <LuFileAudio /> Export WAV
                  </Menu.Item>
                  <Menu.Item value="mp3">
                    <LuFileAudio /> Export MP3
                  </Menu.Item>
                  {onRename && (
                    <Menu.Item value="rename">
                      <LuPencil /> Rename
                    </Menu.Item>
                  )}
                  {onMove && (
                    <Menu.Root
                      onSelect={(d) => act(d.value)}
                      positioning={{ placement: "right-start", gutter: -2 }}
                    >
                      <Menu.TriggerItem>
                        <LuFolderInput /> Move to folder
                        <Text as="span" ml="auto" pl="2">
                          <LuChevronRight />
                        </Text>
                      </Menu.TriggerItem>
                      <Portal>
                        <Menu.Positioner>
                          <Menu.Content>
                            <FolderMenuItems value={folder} folders={folders} onChange={onMove} />
                          </Menu.Content>
                        </Menu.Positioner>
                      </Portal>
                    </Menu.Root>
                  )}
                  {onDelete && (
                    <Menu.Item value="delete" color="fg.error">
                      <LuTrash2 /> Delete
                    </Menu.Item>
                  )}
                </Menu.Content>
              </Menu.Positioner>
            </Portal>
          </Menu.Root>
        </HStack>
      ) : (
        <HStack gap="1" w="full">
          <Input
            size="sm"
            fontSize="md"
            rounded="sm"
            value={draft.value}
            placeholder={draft.kind === "folder" ? "Folder name" : undefined}
            aria-label={draft.kind === "rename" ? `New name for ${name}` : "New folder name"}
            data-inline-field="true"
            autoFocus
            onChange={(e) => setDraft({ ...draft, value: e.target.value })}
            onBlur={() => endDraft(true)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== "Escape") return
              e.preventDefault()
              if (e.key === "Escape") markEscape()
              endDraft(e.key === "Enter")
            }}
          />
          {draft.kind === "folder" && (
            <IconButton
              size="sm"
              rounded="sm"
              variant="subtle"
              aria-label="Create folder"
              // Pointer down, not click: the field's blur would commit and unmount this first.
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => endDraft(true)}
            >
              <LuFolderPlus />
            </IconButton>
          )}
        </HStack>
      )}
    </VStack>
  )
}

/** A song the user saved: deletable (with an Undo toast), renamable, movable between folders. */
function SavedCover({ entry, folders }: { entry: LibraryEntry; folders: readonly string[] }) {
  const { remove, restore, rename, setFolder } = useLibraryStore.getState()
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
    <SongCover
      songKey={entry.id}
      name={entry.name}
      meta={`${entry.song.bpm} BPM · ${songLength(entry.song.chain.length)} · ${when(entry.savedAt)}`}
      getSong={() => Promise.resolve(entry.song)}
      onDelete={() => void del()}
      onRename={(name) => void rename(entry.id, name)}
      onMove={(folder) => void setFolder(entry.id, folder)}
      folder={entry.folder ?? null}
      folders={folders}
    />
  )
}

/** The toolbar button that opens (and closes) the Songs panel. */
export function SongsButton() {
  const open = usePanelStore((s) => s.panel === "songs")
  const { toggle } = usePanelStore.getState()
  return (
    <Button
      {...toolbarButton}
      aria-expanded={open}
      aria-pressed={open}
      onClick={() => toggle("songs")}
    >
      <LuLibrary /> Songs
    </Button>
  )
}

/**
 * The song library, in a side panel: the songs shipped with the rack, then the
 * user's own — save what is in the rack under a name, and play, download or
 * delete anything saved before. Saved songs live in IndexedDB; nothing leaves
 * the browser unless it is downloaded.
 */
export function SongsPanel() {
  const entries = useLibraryStore((s) => s.entries)
  const loaded = useLibraryStore((s) => s.loaded)
  const { refresh, save } = useLibraryStore.getState()
  const open = usePanelStore((s) => s.panel === "songs")
  const [builtins, setBuiltins] = useState<BuiltinSong[]>([])
  const [showDemos, setShowDemos] = useState(false)
  // The saved song the rack holds, and whether the rack has drifted from it — checked when the
  // drawer opens (not on every step: comparing whole songs is not free).
  const nowPlaying = useLibraryStore((s) => s.nowPlaying)
  const current = entries.find((e) => e.id === nowPlaying) ?? null
  const autosavedAt = useLibraryStore((s) => s.autosavedAt)
  const versions = useLibraryStore((s) => (current ? s.versions[current.id] : undefined))
  const [showVersions, setShowVersions] = useState(false)
  // Folders start folded; one opens on its row, or when a song has just been saved into it.
  const [openFolders, setOpenFolders] = useState<ReadonlySet<string>>(new Set())
  const playingFolder = usePlaylistStore((s) => s.folder)
  const unsaved = useLibraryStore((s) => s.nowPlaying === null)
  const [name, setName] = useState("")
  const [saveFolder, setSaveFolder] = useState<string | null>(null)
  const folders = folderNames(entries)
  const toggleFolder = (f: string) =>
    setOpenFolders((prev) => {
      const next = new Set(prev)
      if (next.has(f)) next.delete(f)
      else next.add(f)
      return next
    })

  useEffect(() => {
    if (!open) return
    if (!loaded) void refresh()
    void loadBuiltinSongs().then(setBuiltins)
  }, [open, loaded, refresh])

  // The moment the panel opens, when what the rack holds is in no list: offer a name for it —
  // the file it came from, or a numbered one.
  useEffect(
    () =>
      usePanelStore.subscribe((s, prev) => {
        if (s.panel !== "songs" || prev.panel === "songs") return
        const lib = useLibraryStore.getState()
        if (lib.nowPlaying === null)
          setName(
            (n) =>
              n ||
              (lib.unsavedName ??
                `Song ${lib.entries.length + 1} · ${useRackStore.getState().bpm} BPM`),
          )
      }),
    [],
  )

  // The versions of the song the rack holds, read once the panel shows them.
  useEffect(() => {
    if (!open || !current || versions !== undefined) return
    void useLibraryStore.getState().loadVersions(current.id)
  }, [open, current, versions])

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    const entry = await save(name, toSong(useRackStore.getState()), saveFolder)
    setName("")
    if (entry.folder) setOpenFolders((prev) => new Set(prev).add(entry.folder!))
    toaster.create({ type: "success", title: "Song saved", description: entry.name })
  }

  // Put an earlier state back in the rack. What the rack holds now is kept as a version first,
  // so nothing is lost; the autosave then makes the old state the current one.
  const loadVersion = async (version: SongVersion) => {
    if (!current) return
    await useLibraryStore.getState().keepVersion(current.id)
    useRackStore.getState().loadSong(version.song)
    getEngine().syncFromStore()
    toaster.create({
      type: "info",
      title: `${current.name} · version from ${when(version.savedAt)}`,
      description: "In the rack now. The state it replaced is in the list too.",
    })
  }

  return (
    <SidePanel id="songs" title="Songs">
      {/* The rack holds a saved song: it saves itself, and its earlier states wait here. */}
      {current && (
        <VStack
          gap="2"
          align="stretch"
          pb="3"
          mb="3"
          borderBottomWidth="1px"
          borderColor="rack.panel.divider"
          role="group"
          aria-label={`${current.name} versions`}
        >
          <HStack gap="2" align="center">
            <Text textStyle="silkscreen" color="rack.silkscreen.muted" flex="1" minW="0">
              {current.name} · saved by itself
              {autosavedAt ? ` · ${when(autosavedAt)}` : ""}
            </Text>
            <Button
              size="xs"
              variant="ghost"
              rounded="sm"
              aria-expanded={showVersions}
              onClick={() => setShowVersions((v) => !v)}
            >
              <LuHistory /> {versions ? versions.length : "…"} version
              {versions?.length === 1 ? "" : "s"}
              {showVersions ? <LuChevronUp /> : <LuChevronDown />}
            </Button>
          </HStack>
          {showVersions && (
            <VStack as="ul" gap="1" align="stretch" listStyleType="none" m="0" p="0">
              {versions?.length === 0 && (
                <Text textStyle="silkscreen" color="rack.silkscreen.muted">
                  No earlier versions yet — one is kept each time the song changes.
                </Text>
              )}
              {versions?.map((v) => (
                <HStack as="li" key={v.id} gap="2" align="center">
                  <Text textStyle="silkscreen" flex="1" minW="0" lineClamp={1}>
                    {when(v.savedAt)} · {v.song.bpm} BPM · {songLength(v.song.chain.length)}
                  </Text>
                  <Button
                    size="xs"
                    variant="subtle"
                    rounded="sm"
                    onClick={() => void loadVersion(v)}
                    aria-label={`Load the version from ${when(v.savedAt)}`}
                  >
                    <LuUndo2 /> Load
                  </Button>
                  <IconButton
                    size="xs"
                    variant="ghost"
                    aria-label={`Delete the version from ${when(v.savedAt)}`}
                    onClick={() => void useLibraryStore.getState().removeVersion(v.id)}
                  >
                    <LuTrash2 />
                  </IconButton>
                </HStack>
              ))}
            </VStack>
          )}
        </VStack>
      )}
      <VStack
        as="form"
        gap="2"
        align="stretch"
        onSubmit={onSave}
        pb="3"
        mb="3"
        borderBottomWidth="1px"
        borderColor="rack.panel.divider"
        // Unsaved: the form lights up so it is not missed.
        p={unsaved ? "3" : undefined}
        mx={unsaved ? "-3" : undefined}
        rounded="sm"
        bg={unsaved ? "rack.led.off" : undefined}
      >
        <Text textStyle="silkscreen" color={unsaved ? "rack.led.on" : "rack.silkscreen.muted"}>
          {unsaved ? "Playing now · not in the library yet" : "Save a copy under another name"}
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
          <FolderPicker
            value={saveFolder}
            folders={folders}
            label="Folder to save into"
            onChange={setSaveFolder}
          />
          <Button type="submit" size="md" rounded="sm" colorPalette="orange" flexShrink={0}>
            <LuSave /> Save
          </Button>
        </HStack>
      </VStack>

      {/* A file from this device: a rack song, or a MIDI file put onto the grid. */}
      <HStack
        gap="3"
        pb="3"
        mb="3"
        align="center"
        borderBottomWidth="1px"
        borderColor="rack.panel.divider"
      >
        <Text textStyle="silkscreen" color="rack.silkscreen.muted" flex="1">
          From a file on this device
        </Text>
        <LoadSongButton onLoaded={setName} />
      </HStack>

      {/* Start over: the rack as it opens the first time. */}
      <HStack
        gap="3"
        pb="3"
        mb="3"
        align="center"
        borderBottomWidth="1px"
        borderColor="rack.panel.divider"
      >
        <Text textStyle="silkscreen" color="rack.silkscreen.muted" flex="1">
          Start from nothing
        </Text>
        <NewSongButton onNew={() => setName("")} />
      </HStack>

      <Text textStyle="silkscreen" color="rack.silkscreen.muted" mb="1">
        Saved
      </Text>
      {loaded && entries.length === 0 && (
        <Text textStyle="silkscreen" color="rack.silkscreen.muted">
          Nothing saved yet.
        </Text>
      )}
      {/* Songs at the top level first, then one collapsible group per folder. */}
      <Grid as="ul" {...COVER_GRID} aria-label="Saved songs">
        {entries
          .filter((e) => !e.folder)
          .map((entry) => (
            <SavedCover key={entry.id} entry={entry} folders={folders} />
          ))}
      </Grid>
      {folders.map((folder: string) => {
        const inside = entries.filter((e) => e.folder === folder)
        const isOpen = openFolders.has(folder)
        return (
          <VStack
            key={folder}
            align="stretch"
            gap="0"
            pt="3"
            // Closed, the row itself needs the room before the next hairline; open, the grid has it.
            pb={isOpen ? "0" : "3"}
            borderTopWidth="1px"
            borderColor="rack.panel.divider"
          >
            <HStack gap="1" mx="-2">
              <Button
                size="sm"
                variant="ghost"
                rounded="sm"
                justifyContent="flex-start"
                px="2"
                flex="1"
                minW="0"
                color="rack.silkscreen"
                aria-expanded={isOpen}
                aria-label={`${isOpen ? "Fold" : "Expand"} folder ${folder}`}
                onClick={() => toggleFolder(folder)}
              >
                <LuFolder /> {folder}
                <Text as="span" textStyle="silkscreen" color="rack.silkscreen.muted" ml="1">
                  {inside.length}
                </Text>
                <Text as="span" ml="auto" color="rack.silkscreen.muted">
                  {isOpen ? <LuChevronUp /> : <LuChevronDown />}
                </Text>
              </Button>
              {/* The whole folder, one song after another, round and round. */}
              <IconButton
                size="sm"
                variant={playingFolder === folder ? "solid" : "subtle"}
                colorPalette="orange"
                rounded="sm"
                aria-label={
                  playingFolder === folder ? `Stop folder ${folder}` : `Play folder ${folder}`
                }
                aria-pressed={playingFolder === folder}
                onClick={() => {
                  if (playingFolder === folder) {
                    stopPlaylist()
                    stopTransport()
                  } else {
                    void playFolder(folder, inside)
                  }
                }}
              >
                {playingFolder === folder ? <LuSquare /> : <LuPlay />}
              </IconButton>
            </HStack>
            {isOpen && (
              <Grid as="ul" {...COVER_GRID} aria-label={`Songs in ${folder}`}>
                {inside.map((entry) => (
                  <SavedCover key={entry.id} entry={entry} folders={folders} />
                ))}
              </Grid>
            )}
          </VStack>
        )
      })}

      {/* The songs shipped with the rack, at the bottom: a row like a folder's, same spacing. */}
      {builtins.length > 0 && (
        <VStack
          align="stretch"
          gap="0"
          pt="3"
          pb={showDemos ? "0" : "3"}
          borderTopWidth="1px"
          borderColor="rack.panel.divider"
        >
          <HStack gap="1" mx="-2">
            <Button
              size="sm"
              variant="ghost"
              rounded="sm"
              justifyContent="flex-start"
              px="2"
              flex="1"
              minW="0"
              color="rack.silkscreen"
              aria-expanded={showDemos}
              aria-label={`${showDemos ? "Fold" : "Expand"} demos`}
              onClick={() => setShowDemos((v) => !v)}
            >
              <LuLibrary /> Demos
              <Text as="span" textStyle="silkscreen" color="rack.silkscreen.muted" ml="1">
                {builtins.length}
              </Text>
              <Text as="span" ml="auto" color="rack.silkscreen.muted">
                {showDemos ? <LuChevronUp /> : <LuChevronDown />}
              </Text>
            </Button>
          </HStack>
          {showDemos && (
            <Grid as="ul" {...COVER_GRID} aria-label="Demo songs">
              {builtins.map((b) => (
                <SongCover
                  key={b.file}
                  songKey={builtinKey(b.file)}
                  name={b.name}
                  meta={`${b.bpm} BPM · ${songLength(b.bars)}`}
                  getSong={() => loadBuiltinSong(b.file)}
                />
              ))}
            </Grid>
          )}
        </VStack>
      )}
    </SidePanel>
  )
}
