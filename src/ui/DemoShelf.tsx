import { chakra, Grid, Text, useSlotRecipe } from "@chakra-ui/react"
import { useEffect, useState } from "react"

import { useLayoutStore } from "../state/layout"
import { builtinKey } from "../state/songLibrary"
import { loadBuiltinSong, loadBuiltinSongs, type BuiltinSong } from "./builtinSongs"
import { COVER_GRID, songLength } from "./coverGrid"
import { SongCover } from "./SongLibrary"

/**
 * What an empty rack shows on arrival: the demo songs as record sleeves, in a
 * panel of the same metal as the units. Playing one brings the whole rack with
 * it — its machines and every panel that was put away (transport, bank, song,
 * FX-2) — and the shelf gives way.
 */
export function DemoShelf() {
  const recipe = useSlotRecipe({ key: "rackUnit" })
  const styles = recipe()
  const [demos, setDemos] = useState<BuiltinSong[]>([])
  useEffect(() => {
    void loadBuiltinSongs().then(setDemos)
  }, [])
  if (demos.length === 0) return null
  return (
    <chakra.section css={styles.root} aria-label="Demos">
      <Text textStyle="silkscreen" color="rack.silkscreen.muted" pt="3">
        Demos · pick one to play, or add a unit
      </Text>
      <Grid as="ul" {...COVER_GRID} aria-label="Demo songs">
        {demos.map((b) => (
          <SongCover
            key={b.file}
            songKey={builtinKey(b.file)}
            name={b.name}
            meta={`${b.bpm} BPM · ${songLength(b.bars)}`}
            getSong={() => loadBuiltinSong(b.file)}
            onPlay={() => useLayoutStore.getState().showAll()}
          />
        ))}
      </Grid>
    </chakra.section>
  )
}
