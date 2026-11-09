# Ardatir — Design

*A watch over Arda.* A static website where you travel through the space and time of Tolkien's world and watch its events play out as animated, low-poly isometric dioramas, told by narration in our own words.

**The goal: people should be amazed, and feel good learning these stories.** Every choice is weighed against that: beauty and craft over feature count, warmth over spectacle, clarity over density. A visitor who knows nothing of Tolkien should come away delighted and curious; one who knows the books well should find them treated with care and accuracy.

## 1. How the project is built: three phases

1. **Content.** Every age, event, character, place, journey and narration script, written and validated as data in `content/`. This is the source of truth; everything else reads from it.
2. **Platform.** The site itself: three.js stages, the HUD, navigation, the time cursor, the cross-views. Built against the real content, not toy data.
3. **Event production.** Each event is brought to life one at a time: terrain, staging, character animation, sound and narration recordings.

Each event's `status` records how far it has come (see §4.3), so the phases can overlap: the platform can ship while most events are still outlines.

## 2. Three zoom levels, each with its own clock

| Level | What you see | Timeline spans | What moves |
|---|---|---|---|
| **Cosmos** | Arda as a floating slab inside its shells of air and sea, set in the Void | The Ainulindalë → the Change of the World | The world itself: its creation, its lights, its changing shape |
| **World** | The lands of one age, zoomed out | Years of an age | Journeys between places, coastlines changing, event markers |
| **Event** | One diorama where a single event plays out | Seconds of animation | Characters walking, talking, fighting |

You move between levels by zooming: click into the world from the cosmos, click an event marker to fly into its diorama, and pull back out the same way.

### Cosmos (the front door)

Visitors land here: Arda floating in darkness. Scrubbing time from the very beginning is the first experience.

The cosmology follows Tolkien's *Ambarkanta* (in *The Shaping of Middle-earth*). From the inside out:

- **Ambar**: the earth, the faceted slab with cut sides, the same diorama language as every event.
- **Vista**: the inner air.
- **Ilmen**: the upper air, where the stars are set.
- **Vaiya**: the encircling seas.
- **Ilurambar**: the Walls of the World.
- **Kúma**: the Void outside.

Shells are translucent layered spheres you can fly through.

Story beats at this level:

1. **Ainulindalë**: abstract, not geographic. Streams of light are the Ainur's themes, Melkor's discord is jagged red interference, the Vision is a ghostly preview of the world, and *Eä* condenses Arda out of the Void.
2. **The Spring of Arda**: the two Lamps light a symmetric world, then fall.
3. **The Two Trees** in Valinor, then the first rising of the Moon and the Sun.
4. **Beleriand drowned** at the end of the First Age.
5. **The fall of Númenor**: the slab bends into a sphere and Valinor is taken out of the world.

### World

- Shows one age's geography (coastlines of *that* era) with markers for events nearby in time.
- Journeys between events are drawn as animated paths.

### Event

- A diorama with characters animated along tracks.
- Play/pause, a draggable scrubber with **beat markers** (e.g. "Bilbo caught", "dawn").
- Click a character → highlight ring + side panel: name, description, and their **current thought**, which changes as the scene plays. "Follow" keeps the camera on them.
- Event summary panel; prev/next (chronological, or along the followed character's lane).
- Battles use the same view on larger dioramas, factions colour-coded, beats marking the turning points.

## 3. Ways in, and the cross-views

1. **By time** (default): the timeline of ages; drag it and the view updates.
2. **By place**: everything that happened in a place, across ages.
3. **By character**: a character's life as a lane of events.
4. **Search**: any event, place or character.

Events are not isolated stories. Two **cross-views** show how they connect:

### 3.1 Time cursor (built first)

Pick any moment on the global timeline and see **everything happening then**: the events in progress and where every character is. Beside the map, a **"Meanwhile…"** list jumps to any of them.

From inside an event the same list shows what is happening elsewhere at that moment, and how it relates. At the Pelennor Fields: *Pelargir* (made this possible), *Battle of Dale* (the same days, in the North), *Frodo and Sam in Mordor* (journey).

"At the same time" is matched at the precision the sources allow (§4.4): day by day in the War of the Ring, by season or year in the First Age.

### 3.2 Character lanes

A character's life as a lane of events and journey legs. Add more characters and their lanes run side by side; where they share an event the lanes **cross**. Tuor's lane meets Túrin's at the pools of Ivrin, where the cousins pass without knowing each other, a few years before Túrin's end. Kin relations (`kin`) suggest which lanes to add.

### 3.3 The interface: a collapsible sidebar

The ways in live in a **sidebar on the left**, not in dropdowns. The 3D stage fills the rest of the screen, and every other control floats over it. Mockups: the *Ardatir UI* design canvas (event view with the sidebar open, cosmos with it collapsed, phone drawer).

**Rail and panel.** The sidebar is two parts:

- A narrow **icon rail**, always visible: the Ardatir star (home: the cosmos), then one item per view, **Ages, Stories, Lives, Books, Places**, each an icon with a short label. At the bottom, the language switch (EN / ES) and the collapse toggle.
- A **panel** beside it showing the chosen view, with the wordmark, tagline and search at the top and the disclaimer at the bottom. Clicking a rail item opens its view; clicking the active one again folds the panel away, leaving only the rail. Collapsed, rail items show their name on hover.

**The views:**

| View | Shows |
|---|---|
| **Ages** | The ages as a vertical thread of nodes. The current age is lit and opens into its arcs, then their events, with the event on screen highlighted. |
| **Stories** | The arcs as cards: age, name, one line of summary. |
| **Lives** | Characters in the current event first, then everyone; each opens into summary, kin and their events in order. Picking several as chips to show their lanes side by side comes with character lanes (§3.2). |
| **Books** | Each book opens into chapters (from events' `source`), linking to the events they cover. |
| **Places** | Places with their events, alphabetical for now; grouped by region, with a way into the world map, once the world map exists. |

Events that can be watched (staged) are links marked with a filled diamond; outlines are listed dimmed so the whole story is visible. Search matches event, character and place names in the current language, ignoring accents.

**Over the stage:**

- Top left, a **breadcrumb** of where you are (*Third Age › The Quest of Erebor › Roast Mutton*); top right, a **zoom switch**, *Cosmos · World · Event*.
- The event card sits under the breadcrumb, the selected character's card on the right (§2, Event).
- The narration caption above the timeline bar.
- The **timeline bar**: previous / play / next event, the scrubber with beat markers, time, **Meanwhile…** and mute. Until the time cursor (§3.1) exists, Meanwhile lists the event's links and the events whose honest range overlaps it. Later, in the cosmos and world levels, the bar spans the ages instead.

**Phones.** The rail and panel become one **drawer** opened from a menu button: the views as a tab strip under the search, the language switch in the footer.

**Look: fantasy, kept light.** Night-blue ground, parchment ink, one gold accent; Cormorant Garamond for names and titles, Inter for everything else. The fantasy comes from a few small touches only: the four-point star, diamond markers on section rules and beats, the glowing node on the ages thread, a faint starfield. No parchment textures, ornate frames or decorative fonts in body text: the dioramas are the show.

**The URL still holds the state** (§7); which view is open and whether the panel is collapsed are remembered per visitor, not put in the route.

## 4. Content model

### 4.1 Storage

All content lives in `content/`, **one YAML file per thing**, linked by id. Lists such as "a character's events" or "what happened in a place" are **derived** at build time, never maintained by hand.

```
content/
  ages/         before-time.yaml, first-age.yaml, ...
  characters/   bilbo.yaml, turin.yaml, ...
  places/       bag-end.yaml, ivrin.yaml, ...
  arcs/         the-war-of-the-ring.yaml, ...      named periods that group events
  journeys/     the-ring-to-mordor.yaml, ...        dated paths connecting events
  factions/     (later) sides in battles
  events/<age>/<sort-key>-<id>/
    event.yaml        facts: when, where, who, links, beats
    narration.yaml    the script, passage by passage (status: scripted)
    staging.yaml      animation: stage, timings, character tracks (status: staged)
    audio/<lang>.mp3  narration recording (optional)
    audio/<lang>.yaml its timing: duration, and the second each passage starts
```

- **YAML** for authoring: comments, long text and clean diffs. The build turns it into JSON.
- **Translations inline**: `en:` and `es:` side by side, so gaps are obvious and validated.
- **Small events.** One event is one scene: "Battle of the Pelennor Fields", not "The War of the Ring". Larger stories are **arcs** grouping many events, so the timeline can zoom between the two. Small events are what make the cross-views useful.
- **The folder's sort key is the story order.** Events are ordered by age, then by the key, never by their dates: vague dates can't say whether something "in autumn" comes before something "in November". Keys are numeric (`YYYY-MM-DD-n`), with seasons written as a month (summer → `07`, autumn → `09`) and `-1`, `-2`… for events in the same stretch: `2941-07-1-captured-in-goblin-town`, `2941-07-2-riddles-in-the-dark`. The build warns when a key contradicts the dates. The id inside `event.yaml` is what everything links to.

### 4.2 Separation of content and staging

`event.yaml` and `narration.yaml` say **what happened**; they hold no animation timings. `staging.yaml` says **how it is shown**: which stage, how long, where each narration passage and beat falls in the animation (`t`, 0 → 1), and the character tracks. Writing and animating are separate jobs, matching the phases.

### 4.3 Status pipeline

| Status | Has | Meaning |
|---|---|---|
| `outline` | `event.yaml` | Facts are in: when, where, who, summary, links. Appears in cross-views. |
| `scripted` | + `narration.yaml` | The story is written. |
| `staged` | + `staging.yaml` | Playable with placeholder visuals. |
| `animated` | final assets | Finished terrain, animation and sound. |

The build checks each event has what its status claims.

### 4.4 Time

Every event has a `when`: a start, an optional end, and a **precision**.

```yaml
when:
  start: { age: third-age, year: 3019, month: 3, day: 15 }
  precision: day          # day | month | season | year | decade | approximate
```

- Dates are written as the sources give them: age + year (+ month and day, or a season, when known). Months follow the sources' reckoning, treated as 12 months of 30 days. The days outside the months in the Shire Reckoning (2 Yule, 1 Lithe, Mid-year's Day, Overlithe, 2 Lithe, 1 Yule; Appendix D) are written `day: 1-lithe` etc. with no month. Every year is laid out as 366 equal day slots: 2 Yule, months 1–6, 1 Lithe, Mid-year's Day, Overlithe (an empty slot in non-leap years, so positions never depend on the leap rule), 2 Lithe, months 7–12, 1 Yule (`src/data/calendar.ts`).
- The build places every date on **one shared axis** in years of the Sun, using offsets defined in each age's file (First Age year 1 = axis 1; Second Age 1 = 591; Third Age 1 = 4032; Fourth Age 1 = 7053).
- The Years of the Trees are placed before the First Age with a configurable year length (one Valian Year ≈ 9.582 years of the Sun, one of Tolkien's later figures); dates there are approximate by nature.
- Ages before time (the Ainulindalë) are **timeless**: their events have no position on the axis and sit before everything else.
- **Precision widens the span**: a `year` date covers the whole year, a `season` three months (winter runs into the next year), `approximate` ± 5 years. The span is the **honest range**: when the sources allow it to have happened.
- **Best guess (`at`).** Honest ranges alone make a poor time cursor: six "summer 2941" events would all look simultaneous. So the build also gives each event a best-guess moment inside its range:
  1. Events dated to within about a month are **anchors**, placed at their middle.
  2. Every other event's window is its range narrowed by the nearest anchors before and after it in its characters' lanes; events sharing a window are spaced evenly across it in story order.
  3. A forward pass makes sure nothing comes before an earlier event in a shared character's lane, or before an event it is `caused-by` / `enabled-by`.
- The time cursor shows events whose best guess is near the cursor as **likely happening now**, and those whose honest range merely covers it as **possibly now**. The best guess is never shown as a date; it is a placement, and the range is what the site states.

### 4.5 Links

Typed relations between events, for connections time alone can't show. Written once; the build adds the reverse.

| Type | Reverse | Example |
|---|---|---|
| `enabled-by` | `enables` | Pelennor Fields *enabled-by* Pelargir: the Corsairs' ships bring Aragorn's host |
| `caused-by` | `causes` | Tuor sees Túrin *caused-by* the fall of Nargothrond |
| `concurrent` | `concurrent` | Pelennor Fields and the Battle of Dale |
| `crossing` | `crossing` | two characters' threads meet without the story joining them |

### 4.6 Journeys and whereabouts

A journey is a dated path for one or more characters: `waypoints` of place + date. A stay known only within bounds gets an optional `end`, like an event's `when.end` (Gandalf at Dol Guldur: summer–autumn 2941), so the range is honest without inventing a date. Between events, it says where a character is, which is what the time cursor needs to show "what everyone is doing". The Quest of Erebor, Tuor's road to Gondolin and the Ring's road to Mordor are journeys.

Waypoints get best guesses too: one that matches an event on the journey (same place, overlapping dates) takes that event's moment; the rest are spaced between their neighbours. A character's whereabouts at a moment is the last waypoint reached, on the way to the next. Coarse waypoints may overlap their neighbours; only one that clearly comes before the previous is an error.

Journeys follow who actually travels together: in *The Hobbit*, Bilbo's journey, the dwarves' road to Erebor, and Gandalf's year (he leaves the company at Mirkwood for Dol Guldur and rejoins at the Mountain) are separate, so the time cursor can show them apart.

### 4.7 Characters

Name, kind, summary and, for staging, a placeholder colour and relative height (`scale`). `kin` lists family relations (`{ id: turin, as: cousin }`), used to suggest lanes to compare.

## 5. Narration

Every event is told by a **narration script**: passages written in our own words (no reading of Tolkien's text aloud). The same script is what the audio reads, and it is shown on screen in step with the voice and the animation.

```yaml
# narration.yaml: the words
- id: fire
  en: Cold, wet and lost in the hills, the company spotted a light among the trees...
  es: Con frío, empapados y perdidos entre las colinas...

# staging.yaml: where each passage belongs in the animation
narration: { fire: 0.0, trolls: 0.25, caught: 0.45 }

# audio/es.yaml: when each passage starts in the Spanish recording
duration: 31.5
starts: { fire: 0.4, trolls: 7.2, caught: 13.9 }
```

- **One clock.** The playhead runs in seconds of narration; the animation time `t` is derived from it. Between passage starts the animation is stretched to match, so a slower Spanish reading slows the animation and every passage still begins exactly on its moment. Without `starts`, the event is stretched linearly to the recording's `duration`; without a recording, it lasts the staging's `duration`.
- **On screen** the current passage appears when its voice starts and is revealed word by word as it is read; the unread part waits, dimmed. Without audio the reveal follows the same pacing, so every event works muted.
- Producing the recordings and their timing files is outside this project (the author uses a Voice Studio in a homelab). Keep the spoken words identical to the passage text.
- **Scripts out, recordings in.** `npm run narration:export` writes each event's script per language to `out/narration/<event>/<lang>.{txt,json}` for the Voice Studio, with a `textHash` of the text. The hash goes back into `audio/<lang>.yaml` with the recording, and the content build warns when `narration.yaml` no longer matches it (a stale recording). `--changed` exports only what needs (re)recording. Format in `content/README.md`.
- No cloned voices of real actors.

## 6. Languages

- English is the default; Spanish is the second language. Adding one = add its code to `LANGS` in `src/data/types.ts`, then its interface strings.
- Every content text is `{ en, es }`. English is required; missing languages fall back to English, and the build reports what's missing.
- Names follow the published translations (Bilbo Bolsón, Bolsón Cerrado, Thorin Escudo de Roble).
- Interface strings live in `src/i18n.ts`.
- The language comes from `?lang=` in the URL, then the visitor's last choice, then English.

## 7. Shareable moments

The URL always reflects where you are:

```
/#/event/ainulindale?t=0.42
/#/event/roast-mutton?t=0.45&follow=bilbo&lang=es
```

## 8. Technical shape

- **Static site**: Vite + TypeScript + three.js, no framework. Output is a plain `dist/` folder (GitHub Pages).
- **Code is split by zoom level**: each stage (`scene/cosmos.ts`, `scene/dioramaStage.ts`) is loaded with a dynamic `import()` the first time it is needed, so the front page never downloads diorama code. three.js core gets its own chunk (`manualChunks` in `vite.config.ts`), cached across deploys; keep every chunk under Vite's 500 kB warning.
- **Content build** (`scripts/content/`): reads `content/`, validates it, and writes `public/data/` (generated, not committed):
  - `index.json`: ages, characters, places, arcs, journeys, and every event's summary placed on the axis with links in both directions, plus lookups by character, place, arc and journey. Small enough to load up front; the time cursor and lanes run on it.
  - `events/<id>.json`: one per staged event, with narration, staging and audio timing, loaded when the event opens.
  - `audio/<id>/<lang>.mp3`: recordings copied from the event folders.
- **Validation fails the build**: unknown ids, missing English, a status without its files, narration or beat ids that don't match their staging or audio timing, impossible dates. Missing Spanish is a warning.
- Runs automatically with `npm run dev` (rebuilds on change) and `npm run build`; `npm run content` checks content on its own.
- Overlap queries ("what's happening at this moment?") run in the browser over the sorted index; with hundreds of events that's instant, so no precomputed overlap table is stored.

## 9. Art direction

Everything on screen today is a **placeholder** (stand-in figures, generic terrain, sliding movement). The real look is built in phase 3, judged against an art-direction document and a reference board (`docs/ART.md`, to be written).

- **Characters are modelled in Blender** and exported as **glTF**: low-poly, but with **enough detail to look good**: spend polygons where they carry character (hair in chunky faceted curls, beards, hats, coat tails, hands, feet) and keep the rest simple. Faceted flat-shaded surfaces; slightly more detail on characters and trees than on terrain.
- **Proportions are film-like**: realistic heights and builds, no enlarged heads; hobbits look like small adults, not toys.
- **Faces are simplified**: clear shapes for nose, brow and beard, small modest eyes, no detailed likeness. Expression comes from posture and animation more than from faces.
- **Shared rigs and animation sets** per body type (hobbit, dwarf, man/elf, wizard, troll), so one set of clips (idle, walk, run, talk, gesture, fight, hide…) serves many characters. Animation playback stays a pure function of the event time `t`.
- **Kits for places**: the Shire (hobbit-holes with round doors, hills, gardens, hedges), Rivendell, Mirkwood, Lake-town, the Mountain, built from reusable pieces.
- **Designs come from Tolkien's descriptions**, not from the films or series: proportions and mood may echo film-like realism, but no recognisable film designs or likenesses.
- **Light and mood carry the story**: time of day (the dawn that turns the trolls to stone), weather, warm interiors, colour grading per place.
- **Budgets**: models stay small enough for a static site on ordinary laptops and phones (compressed glTF, shared textures or flat colours, no Git LFS, since GitHub Pages doesn't serve it).
- **Asset plan**: every model *The Hobbit* needs, with rig, priority and status, is listed in [`ASSETS.md`](ASSETS.md).

## 10. IP guidelines (fan project)

- Non-commercial; no ads, merchandise or paywall.
- Summaries, thoughts and narration in our own words; quotations short and rare. `source` fields cite book and chapter for accuracy, never text.
- Maps, models and art are original. Published maps are references to look at, never traced or used as layers.
- No imagery or likenesses from the films or series.
- Clear disclaimer: not affiliated with the Tolkien Estate, Middle-earth Enterprises, or any studio.

## 11. Decision log

| Date | Decision |
|---|---|
| 2026-11-08 | Name: **Ardatir**, one word. |
| 2026-11-08 | Static site; Vite + TypeScript + three.js, no framework. |
| 2026-11-08 | Three zoom levels; the cosmos is the front door and the Ainulindalë the first event. |
| 2026-11-08 | Low-poly faceted dioramas; characters with film-like proportions. |
| 2026-11-08 | English default, Spanish second; inline translations. |
| 2026-11-08 | Narration is our own script, shown in sync with the animation; recordings optional and produced outside the project; one clock driven by the recording. |
| 2026-11-08 | Three phases: content → platform → event production; status pipeline per event. |
| 2026-11-08 | Content in `content/` as YAML, one file per thing, linked by id; derived indexes at build time. |
| 2026-11-08 | Small single-scene events grouped into arcs. |
| 2026-11-08 | Events carry `when` with precision on one shared axis; typed links; journeys give whereabouts. |
| 2026-11-08 | Cross-views: the **time cursor** is the first platform feature, then character lanes. |
| 2026-11-08 | Story order is authored by the folder sort key, not inferred from dates. |
| 2026-11-08 | Every event and waypoint has an honest range and a best-guess moment; the cursor shows "likely" and "possibly" separately. |
| 2026-11-08 | *The Hobbit* is the first book outlined end to end, with its backstory (Smaug's coming, Azanulbizar, Thráin, the Ring's finding). |
| 2026-11-09 | Goal stated: people should be amazed and feel good learning these stories. |
| 2026-11-09 | Characters are modelled in Blender and exported as glTF; current visuals are placeholders. |
| 2026-11-09 | Character style: low-poly with enough detail to look good; film-like proportions (no enlarged heads); simplified faces. |
| 2026-11-09 | The Shire's days outside the months are named with `day:` (`2-yule`, `1-lithe`, `midyear`, `overlithe`, `2-lithe`, `1-yule`); each year is 366 fixed day slots. |
| 2026-11-09 | Navigation moves from top-right dropdowns to a collapsible left sidebar (icon rail + panel): Ages, Stories, Lives, Books, Places; a light fantasy look (§3.3). |

## 12. Open questions

- **Journeys**: do long travels (Frodo's road to Mordor) play only on the world map as a moving path, or do some legs (Moria, the Dead Marshes) get their own dioramas?
- **Factions** for battles: format to be defined when the first battle is staged.
- **World view**: the original world map per age is not built yet; places have no map coordinates until it is.
