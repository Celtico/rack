/** How long the object URL stays valid: Safari and Firefox start a download after `click()` returns. */
const REVOKE_AFTER_MS = 60_000

/** Trigger a browser download of a blob under a file name. */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.style.display = "none"
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS)
}

/** Trigger a browser download of `text` as a JSON file. */
export function downloadJson(filename: string, text: string): void {
  downloadBlob(filename, new Blob([text], { type: "application/json" }))
}
