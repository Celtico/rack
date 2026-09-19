import { toaster } from "../components/ui/toaster"

/** What a thrown value says, for a toast: an Error's message, anything else as text. */
export const errorText = (err: unknown): string =>
  err instanceof Error ? err.message : String(err)

/** An error toast with the thrown value's text under the title. */
export function errorToast(title: string, err: unknown): void {
  toaster.create({ type: "error", title, description: errorText(err) })
}
