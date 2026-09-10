# Prompt per a Claude Code — rack d'àudio web amb Chakra UI v3

Ordre d'ús: `/init` al repo buit → **Prompt 0** (crea les skills) → **Prompt 1** (bastida) → **Prompt 2** (mòduls del rack).
Les skills s'han de crear abans de codificar, si no Claude Code escriurà Chakra v2 de memòria.

---

## Prompt 0 — crear les skills

```
Abans de tocar codi d'aplicació, crea dues skills al projecte.

1. Comprova la versió real de Chakra UI abans d'escriure res:
   - `npm view @chakra-ui/react version`
   - llegeix https://chakra-ui.com/llms.txt (i el llms-full si existeix) i
     https://chakra-ui.com/docs/get-started/installation
   No et refiïs del que recordis: l'API de la v3 no té res a veure amb la v2.

2. Crea `.claude/skills/chakra-ui/SKILL.md` amb les convencions de la v3 que hagis
   verificat: createSystem/defineConfig, ChakraProvider amb `value`, snippets del CLI,
   components compostos amb parts (Root/Trigger/Content), recipes i slot recipes,
   tokens i semantic tokens, prop `css`, i una llista explícita d'API de la v2 que
   NO s'ha d'utilitzar. Inclou exemples curts de codi, no paràgrafs teòrics.
   Afegeix una secció "si dubtes" amb els enllaços de docs a consultar.

3. Crea `.claude/skills/rack-audio/SKILL.md` amb les regles del motor d'àudio:
   Tone.js, cicle de vida dels nodes, per què els patrons van per ref i no per estat,
   scheduling amb Sequence/Draw, i la regla que cap component de React pot crear nodes
   d'àudio pel seu compte.

4. Escriu un CLAUDE.md curt amb: stack, comandes (dev, build, lint, test),
   estructura de carpetes i la norma que tota UI passa per Chakra (res de CSS solt
   ni styled-components).

Ensenya'm els tres fitxers abans de continuar.
```

Si prefereixes no delegar-ho, tens la skill de Chakra escrita a sota; enganxa-la tal qual.

---

## Prompt 1 — bastida del projecte

```
Munta el projecte:

- Vite + React 19 + TypeScript en mode estricte
- Chakra UI v3 (l'última estable) amb el seu ChakraProvider i un system propi
- Tone.js per a l'àudio, Zustand per a l'estat del patró
- Vitest + Testing Library, ESLint + Prettier
- pnpm

Estructura:
  src/audio/      → engine.ts (singleton), devices/, scheduler.ts. Zero React aquí.
  src/state/      → store de Zustand: patró, tempo, paràmetres, transport
  src/ui/         → components de Chakra (Rack, RackUnit, Knob, StepGrid, Transport)
  src/theme/      → system.ts amb tokens i recipes

El tema és un rack de hardware: superfícies fosques metàl·liques, displays ambre,
serigrafia clara i petita. Defineix-ho com a tokens semàntics (rack.panel,
rack.screw, rack.led, rack.step.on...), no com a hex escampats pels components.
Un slot recipe per a RackUnit (panel + capçalera + cos + cargols) i una recipe per
al Knob.

No implementis encara cap instrument. Vull veure la bastida amb un RackUnit buit
i el transport, i `pnpm dev` funcionant.
```

---

## Prompt 2 — mòduls del rack

```
Implementa el rack per fases. Atura't al final de cada fase perquè el provi.

Fase 1 — motor
  Un AudioEngine singleton amb: build() idempotent darrere de Tone.start(),
  bus master, bus d'FX (delay → reverb) i enviaments per canal.
  El scheduler llegeix el patró d'un ref, no de l'estat de React, i publica el pas
  actual amb Draw.schedule.

Fase 2 — DR-4, caixa de ritmes
  Bombo (MembraneSynth), caixa, clap i charles (soroll filtrat). Graella de 16
  passos amb accent visual cada 4 i indicador del pas en reproducció.

Fase 3 — MONO-1, sintetitzador
  MonoSynth amb ona, tall de filtre, ressonància i caiguda. Graella de notes de
  8 files, monofònica: una nota per columna com a màxim.

Fase 4 — FX-2 i mescla
  Enviaments per mòdul cap al bus d'FX, realimentació de l'eco, cua de la reverb,
  master.

Fase 5 — patrons
  Quatre patrons commutables i encadenables, i desar/carregar en JSON.

Requisits transversals:
- El Knob és un component accessible: role="slider", valors ARIA, fletxes del
  teclat, pointer events amb captura, touch-action none.
- Tot responsiu fins a 360 px. La graella pot fer scroll horitzontal, els
  comandaments no.
- prefers-reduced-motion respectat.
- Tests: el scheduler dispara els passos correctes amb un transport simulat, i el
  store aplica els toggles sense mutar.
- Cap `useEffect` que creï nodes d'àudio dins d'un component.
```

---

## `.claude/skills/chakra-ui/SKILL.md`

Comprovat contra Chakra UI v3.37 (agost del 2026). Ajusta la versió quan la llegeixis del `package.json`.

```markdown
---
name: chakra-ui
description: Convencions de Chakra UI v3 per a aquest projecte. Fes-la servir sempre que escriguis o modifiquis un component de UI, definaixis tokens o toquis el tema.
---

# Chakra UI v3

Aquest projecte fa servir Chakra UI v3. L'API de la v2 està obsoleta i molta és
inexistent. Si el codi que estàs a punt d'escriure et sona de la v2, para i
comprova-ho a la documentació.

## Configuració

El tema es construeix amb `createSystem` fusionant la configuració per defecte, i
s'injecta amb `value`:

    import { ChakraProvider, createSystem, defaultConfig, defineConfig } from "@chakra-ui/react"

    const config = defineConfig({
      theme: {
        tokens: { colors: { rack: { panel: { value: "#2c2e30" } } } },
        semanticTokens: { colors: { "rack.led": { value: "{colors.amber.400}" } } },
        recipes: { knob: knobRecipe },
        slotRecipes: { rackUnit: rackUnitRecipe },
      },
    })

    export const system = createSystem(defaultConfig, config)

    <ChakraProvider value={system}>...</ChakraProvider>

Els tokens sempre porten `{ value: ... }`. Es referencien com a `{colors.x.y}` dins
del tema i com a `bg="rack.panel"` als components.

## Components compostos

Els components tenen parts amb nom. No hi ha `<Modal>`, `<ModalOverlay>` per separat:

    <Dialog.Root>
      <Dialog.Trigger asChild><Button>Obre</Button></Dialog.Trigger>
      <Dialog.Positioner><Dialog.Content>...</Dialog.Content></Dialog.Positioner>
    </Dialog.Root>

El mateix patró amb Select, Menu, Popover, Accordion, Slider, Field, Tabs.
Molts porten snippets preparats; instal·la'ls amb el CLI en comptes de
reimplementar-los:

    npx @chakra-ui/cli snippet add slider

## Estils

- Props d'estil per al cas normal: `<Box bg="rack.panel" rounded="sm" p="3">`
- `css` per a selectors, pseudo-elements o variables CSS:
  `<Box css={{ "&:focus-visible": { outline: "2px solid" } }} />`
- `chakra("div")` o `chakra(Component)` per convertir qualsevol element en estilable.
- Variants → `defineRecipe` / `defineSlotRecipe` al tema, i `useRecipe` /
  `useSlotRecipe` si necessites les classes a mà. Res de condicionals d'estil
  escampats pel JSX.

## No facis servir (API de la v2)

- `extendTheme`, `theme={}` al provider, `ThemeProvider` de la v2
- `useColorMode` de Chakra → el mode de color va per `next-themes`/`ColorModeProvider`
  del snippet
- `Stack spacing` → ara és `gap`
- `isDisabled`, `isOpen`, `isChecked` → `disabled`, `open`, `checked`
- `Modal`, `Drawer` plans, `FormControl` → `Dialog.*`, `Field.*`
- `styled-system` v2, `@chakra-ui/icons` (fes servir `react-icons` o SVG propis)
- Numèrics sense unitat inventats: fes servir tokens d'espai (`p="4"`, no `p="17px"`)

## Accessibilitat

Els components de Chakra ja porten el rol i el teclat. Si construeixes un control
propi (per exemple un knob rotatiu), has de posar-hi tu `role`, els valors ARIA i
el maneig de tecles, i has de mantenir el focus visible amb `_focusVisible`.

## Si dubtes

- https://chakra-ui.com/llms.txt
- https://chakra-ui.com/docs/theming/overview
- https://chakra-ui.com/docs/components/<component>
  Comprova la versió instal·lada amb `npm ls @chakra-ui/react` abans de confiar en cap
  exemple que recordis.
```

---

## `.claude/skills/rack-audio/SKILL.md`

```markdown
---
name: rack-audio
description: Regles del motor d'àudio amb Tone.js. Fes-la servir en qualsevol canvi a src/audio, al scheduler o als paràmetres dels instruments.
---

# Motor d'àudio

## Separació

`src/audio` no importa React. Els components criden mètodes de l'engine; l'engine no
sap que existeix React.

## Arrencada

El context d'àudio només es pot obrir des d'un gest de l'usuari. `engine.build()` es
crida al primer play, és idempotent i retorna la mateixa instància sempre.

## Scheduling

- El patró viu en un ref (o es llegeix del store amb `getState()`), mai capturat pel
  closure del callback de `Tone.Sequence`: si no, toques el patró de fa deu segons.
- Tot el que soni rep el `time` del callback. Res de `Date.now()` ni de temporitzadors
  de React.
- La UI s'actualitza dins de `Draw.schedule`, mai directament des del callback d'àudio.

## Paràmetres

- Els canvis de valor van amb `rampTo` (20–50 ms) per evitar clics.
- Els nodes es creen un cop; si un paràmetre no és automatitzable, recrea el node de
  forma controlada i desconnecta el vell amb `dispose()`.

## Compatibilitat

`Tone.getTransport()` i `Tone.getDraw()` a la v15; comprova la versió del package.json
abans de fer servir `Tone.Transport` directament.
```

---

## Notes

- Chakra v3 té codemod (`@chakra-ui/codemod`) si algun dia hi migres codi de v2; digue-l'hi a Claude Code perquè no ho faci a mà.
- Val la pena posar `pnpm lint && pnpm test` com a hook de `PostToolUse` a `.claude/settings.json`, així es corregeix sol quan trenca alguna cosa.
