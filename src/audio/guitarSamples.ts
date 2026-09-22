import type { StringsSound } from "../state/params"

/** A STR-6 sound that is a recording rather than the string model. */
export type SampledSound = Exclude<StringsSound, "model">

export const isSampledSound = (sound: StringsSound): sound is SampledSound => sound !== "model"

/**
 * The notes each sampled guitar was recorded at — one file per note under
 * `public/samples/guitar/<sound>/<note>.mp3`, built by `scripts/make-guitar-samples.sh` from
 * CC0 libraries (see the LICENSE.txt there). About every three semitones from E2 to G5: the
 * sampler repitches from the nearest one, so no note is shifted more than a semitone and a half.
 */
export const GUITAR_NOTES: Readonly<Record<SampledSound, readonly string[]>> = {
  nylon: [
    "E2",
    "G2",
    "A2",
    "C3",
    "D3",
    "E3",
    "G3",
    "Bb3",
    "Db4",
    "E4",
    "G4",
    "Bb4",
    "Db5",
    "E5",
    "G5",
  ],
  electric: [
    "E2",
    "G2",
    "Bb2",
    "Db3",
    "E3",
    "G3",
    "Bb3",
    "Db4",
    "E4",
    "G4",
    "Bb4",
    "Db5",
    "E5",
    "G5",
  ],
}

export const guitarSampleUrl = (
  sound: SampledSound,
  note: string,
  base: string = import.meta.env.BASE_URL,
): string => `${base}samples/guitar/${sound}/${note}.mp3`

const bytes = new Map<string, Promise<ArrayBuffer>>()

/**
 * A note's file, fetched once per session: every STR-6 and every offline render decodes the
 * same bytes into its own context. A fetch that failed is forgotten, so the next try asks again.
 */
export function fetchGuitarSample(sound: SampledSound, note: string): Promise<ArrayBuffer> {
  const url = guitarSampleUrl(sound, note)
  let pending = bytes.get(url)
  if (!pending) {
    pending = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`${url}: ${res.status}`)
      return res.arrayBuffer()
    })
    pending.catch(() => bytes.delete(url))
    bytes.set(url, pending)
  }
  return pending
}
