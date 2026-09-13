import { Button, HStack, IconButton, Input, Menu, Portal } from "@chakra-ui/react"
import { useState } from "react"
import { LuFolder, LuFolderInput, LuFolderPlus } from "react-icons/lu"

import { markEscape } from "./escapeGuard"

const NO_FOLDER = "\u0000none"
const NEW_FOLDER = "\u0000new"

/**
 * Pick a folder: none, one already in use, or a new one typed in place. As an
 * icon (on a song's row) or as a labelled button (on the save form).
 */
export function FolderPicker({
  value,
  folders,
  onChange,
  label,
  compact = false,
}: {
  value: string | null
  folders: readonly string[]
  onChange: (folder: string | null) => void
  label: string
  compact?: boolean
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft !== null && draft.trim()) onChange(draft.trim())
    setDraft(null)
  }
  if (draft !== null) {
    return (
      <HStack gap="1" flexShrink={0}>
        <Input
          size="sm"
          fontSize="md"
          rounded="sm"
          w="36"
          placeholder="Folder name"
          aria-label="New folder name"
          data-inline-field="true"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              commit()
            } else if (e.key === "Escape") {
              e.preventDefault()
              markEscape()
              setDraft(null)
            }
          }}
        />
        <Button size="sm" rounded="sm" variant="subtle" onClick={commit} aria-label="Create folder">
          <LuFolderPlus />
        </Button>
      </HStack>
    )
  }
  const select = (v: string) => {
    if (v === NEW_FOLDER) setDraft("")
    else onChange(v === NO_FOLDER ? null : v)
  }
  return (
    <Menu.Root onSelect={(d) => select(d.value)} positioning={{ placement: "bottom-end" }}>
      <Menu.Trigger asChild>
        {compact ? (
          <IconButton size="sm" variant="ghost" rounded="sm" aria-label={label}>
            <LuFolderInput />
          </IconButton>
        ) : (
          <Button size="md" variant="subtle" rounded="sm" flexShrink={0} aria-label={label}>
            <LuFolder /> {value ?? "Folder"}
          </Button>
        )}
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.RadioItemGroup value={value ?? NO_FOLDER}>
              <Menu.RadioItem value={NO_FOLDER}>
                <Menu.ItemIndicator />
                No folder
              </Menu.RadioItem>
              {folders.map((f) => (
                <Menu.RadioItem key={f} value={f}>
                  <Menu.ItemIndicator />
                  {f}
                </Menu.RadioItem>
              ))}
            </Menu.RadioItemGroup>
            <Menu.Separator />
            <Menu.Item value={NEW_FOLDER}>
              <LuFolderPlus /> New folder…
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  )
}
