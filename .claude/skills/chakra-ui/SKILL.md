---
name: chakra-ui
description: Chakra UI v3 conventions for this project. Use whenever you write or modify a UI component, define tokens or semantic tokens, author a recipe or slot recipe, or touch src/theme. Also use when something you are about to write "feels familiar" from Chakra v2 — v3 removed or renamed most of that API.
---

# Chakra UI v3

This project uses Chakra UI **v3.37.0** (verified via `npm view @chakra-ui/react version`,
2026-09-10). The v2 API is gone, not deprecated: most of it does not exist as an export.
If the code you are about to write feels familiar from v2, stop and check the docs.

Stack context: **Vite + React 19**, no Next.js. Ignore any Chakra doc snippet that talks
about `app/layout.tsx`, Server Components, or `"use client"` — none of it applies here.

## The system

The theme is built with `createSystem`, merging `defaultConfig`, and injected via `value`:

```ts
// src/theme/system.ts
import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react"

const config = defineConfig({
  theme: {
    tokens: {
      colors: { rack: { panel: { value: "#2c2e30" } } },
    },
    semanticTokens: {
      colors: { "rack.led": { value: "{colors.amber.400}" } },
    },
    recipes: { knob: knobRecipe },
    slotRecipes: { rackUnit: rackUnitRecipe },
  },
})

export const system = createSystem(defaultConfig, config)
```

```tsx
// src/main.tsx
<ChakraProvider value={system}>
  <App />
</ChakraProvider>
```

Tokens **always** carry `{ value: ... }`. Reference them as `{colors.x.y}` inside the theme
and as plain props on components: `bg="rack.panel"`.

## Where the rack look lives

Dark metallic panels, amber displays, small light silkscreen. All of it goes in **semantic
tokens** — `rack.panel`, `rack.screw`, `rack.led`, `rack.step.on` — never as hex values
scattered through components. A hex literal in a `.tsx` file is a bug.

## Recipes

Variants belong in the theme, not in JSX conditionals.

```ts
import { defineRecipe } from "@chakra-ui/react"

export const knobRecipe = defineRecipe({
  base: { borderRadius: "full", touchAction: "none" },
  variants: {
    size: {
      sm: { boxSize: "8" },
      md: { boxSize: "12" },
    },
  },
  defaultVariants: { size: "md" },
})
```

Slot recipes for multi-part components — `RackUnit` is panel + header + body + screws:

```ts
import { defineSlotRecipe } from "@chakra-ui/react"

export const rackUnitRecipe = defineSlotRecipe({
  slots: ["root", "header", "body", "screw"],
  base: {
    root: { bg: "rack.panel", rounded: "sm" },
    header: { color: "rack.silkscreen", fontSize: "xs", letterSpacing: "wide" },
    body: { p: "4" },
    screw: { bg: "rack.screw", boxSize: "3", rounded: "full" },
  },
  variants: {
    units: {
      1: { root: { minH: "24" } },
      2: { root: { minH: "44" } },
    },
  },
  defaultVariants: { units: 1 },
})
```

Consume with `useRecipe({ key: "knob" })` / `useSlotRecipe({ key: "rackUnit" })`, or bind at
definition with `chakra("button", knobRecipe)`.

## Compound components use named parts

There is no flat `<Modal>` + `<ModalOverlay>`. Every compound component exposes parts:

```tsx
<Dialog.Root>
  <Dialog.Trigger asChild>
    <Button>Open</Button>
  </Dialog.Trigger>
  <Dialog.Positioner>
    <Dialog.Content>…</Dialog.Content>
  </Dialog.Positioner>
</Dialog.Root>
```

Same shape for `Select`, `Menu`, `Popover`, `Accordion`, `Slider`, `Field`, `Tabs`.
Most ship a prepared snippet — install it rather than reimplementing:

```bash
npx @chakra-ui/cli snippet add slider
```

With no arguments the CLI adds the recommended set (`provider`, `toaster`, `tooltip`) and
installs `next-themes` for you. In a Vite project it writes to `src/components/ui/`.

## Styling

- Style props for the normal case: `<Box bg="rack.panel" rounded="sm" p="3">`
- `css` for selectors, pseudo-elements, CSS variables:
  `<Box css={{ "&:focus-visible": { outline: "2px solid" } }} />`
- `chakra("div")` / `chakra(Component)` to make anything styleable.
- Space tokens, never invented pixels: `p="4"`, not `p="17px"`.
- `colorPalette` for interactive components, not v2's `colorScheme`.

## Banned — this is v2 API

| v2 (do not write)                     | v3                                              |
| ------------------------------------- | ----------------------------------------------- |
| `extendTheme`, `theme={}` on provider | `createSystem` + `value={system}`               |
| Chakra's `useColorMode`               | `next-themes` / the `ColorModeProvider` snippet |
| `Stack spacing`                       | `Stack gap`                                     |
| `isDisabled` / `isOpen` / `isChecked` | `disabled` / `open` / `checked`                 |
| flat `Modal`, `Drawer`, `FormControl` | `Dialog.*`, `Drawer.*`, `Field.*`               |
| `colorScheme`                         | `colorPalette`                                  |
| `@chakra-ui/icons`                    | `react-icons` or own SVGs                       |

`extendTheme is not exported` at build time means you wrote v2.

## Responsive

Mobile-first. This project must work down to **360 px**.

```tsx
<SimpleGrid columns={{ base: 1, md: 2 }} gap="4" />
<Stack direction={{ base: "column", md: "row" }} gap="4" />
```

The step grid may scroll horizontally; the controls may not.

## Accessibility

Chakra's own components carry role and keyboard handling — do not override it. What you
must supply yourself:

- Icon-only buttons: `aria-label`.
- **Custom controls you hand-build** (the `Knob`): you own `role="slider"`, the ARIA value
  props (`aria-valuenow` / `aria-valuemin` / `aria-valuemax` / `aria-valuetext`), arrow-key
  handling, pointer events with capture, `touch-action: none`, and a visible focus ring via
  `_focusVisible`. Chakra gives you none of this for a `Box`.
- Respect `prefers-reduced-motion`.

## Global CSS

`globalCss` lives in the config, not a stylesheet. No loose CSS files, no styled-components:

```ts
defineConfig({
  globalCss: {
    // iOS Safari zooms the viewport when a focused field is under 16px.
    "input, select, textarea": { fontSize: "16px" },
  },
})
```

## If in doubt

- https://chakra-ui.com/llms.txt
- https://chakra-ui.com/docs/theming/overview
- https://chakra-ui.com/docs/theming/recipes and `/slot-recipes`
- https://chakra-ui.com/docs/components/<component>

Check the installed version with `npm ls @chakra-ui/react` before trusting any example you
remember.
