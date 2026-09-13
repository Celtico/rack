/**
 * When Escape just cancelled an inline field (a rename, a new folder name),
 * the drawer or dialog around it must stay open. The dialog hears Escape on
 * the document, before or after the field does, so the field leaves a
 * timestamp (`markEscape`) and the container checks `escapeIsForField()` in
 * its `onEscapeKeyDown` and vetoes the close.
 */
let escapedAt = 0

export const markEscape = (): void => {
  escapedAt = Date.now()
}

export const escapeIsForField = (): boolean =>
  Date.now() - escapedAt < 200 ||
  document.activeElement?.getAttribute("data-inline-field") === "true"
