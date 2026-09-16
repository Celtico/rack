import { MAX_CHAIN } from "./patterns"

/**
 * A named run of bars of the song: "Intro, 8 bars". Sections partition the
 * chain from its first bar to its last — a song either has none (bars only)
 * or every bar is in one. Nothing here sounds: the scheduler reads the chain.
 */
export interface Section {
  name: string
  bars: number
}

export const SECTION_NAME_MAX = 24
/** Names offered when adding a section; anything else can be typed. */
export const SECTION_NAMES = [
  "Intro",
  "Verse",
  "Pre-chorus",
  "Chorus",
  "Bridge",
  "Build",
  "Drop",
  "Break",
  "Outro",
] as const
/** Lengths offered for a section. */
export const SECTION_LENGTHS = [1, 2, 4, 8, 12, 16, 24, 32] as const

export interface Structure {
  name: string
  sections: readonly Section[]
}

const s = (name: string, bars: number): Section => ({ name, bars })

/** Whole-song skeletons, laid out in one go and filled section by section afterwards. */
export const STRUCTURES: readonly Structure[] = [
  {
    name: "Pop song · 120 bars",
    sections: [
      s("Intro", 8),
      s("Verse 1", 16),
      s("Pre-chorus", 8),
      s("Chorus", 16),
      s("Verse 2", 16),
      s("Pre-chorus", 8),
      s("Chorus", 16),
      s("Bridge", 8),
      s("Final chorus", 16),
      s("Outro", 8),
    ],
  },
  {
    name: "Short song · 40 bars",
    sections: [
      s("Intro", 4),
      s("Verse", 8),
      s("Chorus", 8),
      s("Verse", 8),
      s("Chorus", 8),
      s("Outro", 4),
    ],
  },
  {
    name: "Club track · 88 bars",
    sections: [
      s("Intro", 16),
      s("Build", 8),
      s("Drop", 16),
      s("Break", 8),
      s("Build", 8),
      s("Drop", 16),
      s("Outro", 16),
    ],
  },
]

/** A section's name as stored: trimmed and cut to `SECTION_NAME_MAX`. */
export const sectionName = (name: string): string => name.trim().slice(0, SECTION_NAME_MAX)

export interface SectionSpan extends Section {
  /** First bar of the section in the chain. */
  start: number
}

/** Where each section sits on the chain. */
export function sectionSpans(sections: readonly Section[]): SectionSpan[] {
  let start = 0
  return sections.map((section) => {
    const span = { ...section, start }
    start += section.bars
    return span
  })
}

/** Index of the section holding bar `bar`, or -1. */
export function sectionAt(sections: readonly Section[], bar: number): number {
  let start = 0
  for (const [i, section] of sections.entries()) {
    if (bar < start + section.bars) return bar >= start ? i : -1
    start += section.bars
  }
  return -1
}

/**
 * Sections made to cover a chain of `length` bars exactly: cut where they run
 * past it, the last one stretched over what they leave, empty ones dropped;
 * none at all when there are none or the chain is empty.
 */
export function fitSections(sections: readonly Section[], length: number): Section[] {
  if (length <= 0 || sections.length === 0) return []
  const out: Section[] = []
  let covered = 0
  for (const section of sections) {
    if (covered >= length) break
    const bars = Math.min(Math.trunc(section.bars), length - covered)
    if (bars <= 0) continue
    out.push({ name: sectionName(section.name), bars })
    covered += bars
  }
  if (covered < length) {
    const last = out[out.length - 1]
    if (last) out[out.length - 1] = { ...last, bars: last.bars + length - covered }
    else out.push({ name: "", bars: length })
  }
  return out
}

/** After a bar left the chain: the section holding it is one shorter, an emptied one goes. */
export function withoutBar(sections: readonly Section[], bar: number): Section[] {
  const at = sectionAt(sections, bar)
  if (at < 0) return [...sections]
  return sections.flatMap((section, i) =>
    i !== at ? [section] : section.bars > 1 ? [{ ...section, bars: section.bars - 1 }] : [],
  )
}

/** After `count` bars were appended to the chain: the last section grows by them (none: still none). */
export function grownLast(sections: readonly Section[], count: number): Section[] {
  const last = sections[sections.length - 1]
  if (!last || count <= 0) return [...sections]
  return [...sections.slice(0, -1), { ...last, bars: last.bars + count }]
}

/** The chain a structure lays out, every bar on `pattern`, with the sections that name it. */
export function layOut(
  structure: readonly Section[],
  pattern: number,
): { chain: number[]; sections: Section[] } {
  const total = Math.min(
    MAX_CHAIN,
    structure.reduce((n, section) => n + Math.max(0, Math.trunc(section.bars)), 0),
  )
  return {
    chain: Array.from({ length: total }, () => pattern),
    sections: fitSections(structure, total),
  }
}
