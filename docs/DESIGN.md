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

**Route:** `#/lives?with=tuor,turin` (the order of the lanes; up to eight). It opens as a page in place of the stage, like an event page (§3.4).

- **Lanes are columns, time runs down the page.** Each chosen character is a thin vertical thread in their own colour (a light palette that reads on the night ground; gold stays the accent), with their initial at the top of the column, sticky while scrolling (two letters when lanes would share one: Gollum *Go*, Gimli *Gi*). On a phone at most four lanes are drawn, the first four chosen, and the page says so (*Showing 4 of 8 lives*); the chips still list all. Beside the threads, one row per step, in **one story order** for all lanes (the index order: age, then sort key).
- **What a lane holds** comes from the build (`index.lanes`): the character's events in story order, and between them the **journey legs** no event of theirs covers, a waypoint whose matched event they are not in, or one with no event at all (Frodo's road through Cirith Ungol before his events exist). Legs are placed by best guess: between their own lane's events before and after them, and there after every event of any chosen lane guessed no later than the leg (so a leg never shows before another lane's earlier event); they are drawn as small hollow nodes with the place in italics, the journey and the waypoint's honest range beneath (*Jun – 1 Lithe 2941*). Legs shared by several lanes (same place and range) are one row.
- **Crossings:** a row where two or more lanes share an event gets filled nodes ringed in gold, joined by a gold bar across the lanes, and a soft gold band behind the title with *Paths cross · Tuor, Túrin*, each full name in its lane's colour. A row with one lane has a plain node in that lane's colour.
- **Time between rows** is said honestly: an age heading when the age changes, and *at least N years later* (dotted threads) when the honest ranges are a year or more apart (`yearsBetween` in `calendar.ts`), counted in the age's own years: in the Years of the Trees, *at least 75 Valian years later*. Each row states only its honest date; the best guess is never shown.
- **Clicking an event opens it**: its stage if staged, else its page; Back returns to the lanes.
- **Choosing lanes:** chips at the top (each with its colour and a remove button), a search box to add a life (a combobox: whole-name, then name-start, then word-start matches first; arrow keys, Enter, Escape), and **kin suggestions** from `kin`, written from the chosen character's side (*Túrin Turambar, cousin of Tuor*; *Thráin, father of Thorin Oakenshield*). Characters have no gender field, so Spanish takes the gender from the relation word (*Nienor, hermana de Túrin*) and says gender-neutral ones without guessing (*Túrin y Tuor, primos*; *Aragorn y Arwen, prometidos*). With no lanes chosen, the page offers a few **lives that cross**: for each age, the pair sharing the most events. Kin suggestions and pairs are links to the lanes with them added, so they can be opened or shared and Back undoes them; the add box and the remove buttons change the lanes in place and keep focus in the add box.
- **Ways in:** the sidebar's **Lives** view shows the chosen lives as chips with *Side by side →*, and every character row has a **+ / ✓ toggle** that adds or removes their lane; a character's name on an event page opens their lane, and *See their lives side by side* opens everyone in the event; the selected character's card on a stage has *Follow their life →*.

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
| **Lives** | The lives chosen for lanes as chips, with *Side by side →* (§3.2); then characters in the current event first, then everyone; each opens into summary, kin and their events in order, and has a + / ✓ toggle that adds or removes their lane. |
| **Books** | Each book opens into chapters (from events' `source`), linking to the events they cover. |
| **Places** | Places with their events, alphabetical for now; grouped by region, with a way into the world map, once the world map exists. |

Every event in a list is a link. Events that can be watched (staged) are marked with a filled diamond and open their stage; the others (outline, scripted) have a hollow diamond, are listed a little dimmer, and open their page (§3.4), so the whole story can be followed. Search matches event, character and place names in the current language, ignoring accents.

**Over the stage:**

- Top left, a **breadcrumb** of where you are (*Third Age › The Quest of Erebor › Roast Mutton*); top right, a **zoom switch**, *Cosmos · World · Event*.
- The event card sits under the breadcrumb, the selected character's card on the right (§2, Event).
- The narration caption above the timeline bar.
- The **timeline bar**: previous / play / next event, the scrubber with beat markers, time, **Meanwhile…** and mute. Until the time cursor (§3.1) exists, Meanwhile lists the event's links and the events whose honest range overlaps it, as *likely* (our best guess, explained) and *possibly* (§4.4.1), each a link like those in the sidebar. Later, in the cosmos and world levels, the bar spans the ages instead.

**Phones.** The rail and panel become one **drawer** opened from a menu button: the views as a tab strip under the search, the language switch in the footer.

**Look: fantasy, kept light.** Night-blue ground, parchment ink, one gold accent; Cormorant Garamond for names and titles, Inter for everything else. The fantasy comes from a few small touches only: the four-point star, diamond markers on section rules and beats, the glowing node on the ages thread, a faint starfield. No parchment textures, ornate frames or decorative fonts in body text: the dioramas are the show.

**The URL still holds the state** (§7); which view is open and whether the panel is collapsed are remembered per visitor, not put in the route.

### 3.4 Event pages: events that can't be watched yet

Most events will be outlines for a long time, and they are exactly what the cross-views are made of. So every event has a way in: a staged event opens its stage, and **any other event opens its page**, a calm text view in place of the stage, at the same route (`#/event/<id>`). It is what most visitors will see for a long time, so it is treated as a finished thing, not a placeholder.

- **One centred column**, set like a page of a book: the age and stories as a small overline, the title large in the serif, then the **honest date** (start and end at their precision, e.g. *Winter, F.A. 495*; never the best guess), the place and the source (book and chapter, cited, not quoted). A quiet note says it isn't staged yet.
- The **summary** in the serif, larger than body text. When the event is `scripted`, **the telling**: its narration passages read as plain text, in order, without animation (`data/scripts/<id>.json`, loaded with the page).
- **Who was there**: the characters as small cards (name, kind, one line); a name opens their life.
- **Connections**: every link, both directions (the reverses come from the build), with its type (*caused by*, *makes possible*…) and its note.
- **Part of**: each arc with its summary and the events before and after this one in it; each journey with its places in order, this one lit.
- **Around the same time**: events whose honest range overlaps this one (as Meanwhile does), split into *likely* (our best guess, each with a short explanation behind an info button) and *possibly* (§4.4.1). Under the honest date at the top, a quiet line says how an event that isn't exactly dated is placed on the timeline (§4.4).
- **Before / After**: the previous and next event in story order, so the whole chronicle can be read page by page.

The look is the sidebar's: night ground with a faint starfield and a soft gold glow at the top, section rules with a diamond, filled and hollow diamonds on event links. While a page is open the stage under it neither renders nor plays; the breadcrumb and zoom switch stay on top.

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
- **Why each guess landed where it did (`atReason`).** The build records it on every dated event in `index.json`, so the site can explain a guess in words instead of showing it:

  ```json
  "atReason": { "kind": "after-anchor", "after": "welcome-at-lake-town", "lane": ["bilbo"], "shared": 6, "window": [6972.7281, 6972.9153] }
  ```

  | `kind` | Meaning | Fields |
  |---|---|---|
  | `exact` | an anchor (dated to within about a month), at its middle | — |
  | `between-anchors` | its range narrowed by an exact-dated event before and one after it in a shared lane | `after`, `before`, `lane` |
  | `after-anchor` / `before-anchor` | narrowed on one side only; the other side is its own range | `after` or `before`, `lane` |
  | `range-midpoint` | nothing near it in its lanes is exact, and it shares its range with no one: the middle | — |
  | `spaced-in-range` | nothing near it is exact; spread evenly with the others sharing that range, in story order | `shared` |
  | `after-predecessor` | step 3 moved it just after `follows`, the previous event in a shared lane (`via: lane`) or what it is `caused-by` / `enabled-by` | `follows`, `via`, `lane` (for a lane) |

  `lane` names the characters whose lanes gave the anchors (at most two); `shared` is how many events share the window (omitted when one); `window` is the honest span as narrowed by the anchors, the bounds the guess was placed within (axis years, rounded to 4 decimals). Timeless events have neither `at` nor `atReason`.
- **On the site**, an event page whose date isn't exact says how it is placed, under its honest date, from `atReason` (`src/placement.ts`): *The sources say only autumn, T.A. 2941. We place it after* A Welcome at Lake-town *(22 September, T.A. 2941), because that is the order of Bilbo Baggins's story. It shares that stretch with 5 other events, spaced out in story order.* It describes the placement relative to the anchors; the guess itself is never shown as a date.

#### 4.4.1 "Likely" and "possibly" at the same time

Two events (or a moment and an event) are **possibly** at the same time when their honest ranges overlap. That is a fact the sources allow and stays as it is. **Likely** leans on the best guesses, so it is only said where they mean something (`nearness` / `nearnessAt` in `src/data/calendar.ts`):

1. **Same character, different scene: never "likely"**, unless the two are linked `concurrent` or `crossing`. Story order already says one follows the other; guesses a few days apart would only blur that. (This fixes issue #2: during *A Welcome at Lake-town*, 22 September 2941, *The Secret Door* was "likely" because its guess fell in early October, though Bilbo is in both and the door comes later.)
2. **Otherwise the window scales with the vaguer of the two precisions**, between best guesses: **day ±3 days** (exact dates still differ by a day or two between sources and reckonings), **month ±15 days** (half a month: a mid-month guess reaches either end of its month, no further), **season ±45 days** (half a season: the same part of the season, not anywhere in it). **Year, decade, approximate** and timeless dates never make "likely", only "possibly": a guess placed somewhere in a year says too little to call two events simultaneous. The numbers are `LIKELY_DAY`, `LIKELY_MONTH`, `LIKELY_SEASON` in `calendar.ts`.
3. For the **bare time cursor** (a moment, not an event), the window is the event's own precision.

**Why this rule** (decided 2026-11-09), over the options in issue #2:

- *A window from precision alone* still leaves the example wrong: the door and Lake-town are both within a season's window, so it would stay "likely". The lane rule is what tells them apart.
- *A window from the gap to the neighbouring anchors* follows the data more closely, but is hard to explain to a visitor ("likely, because the anchors around it are 40 days apart") and is still wide when the anchors are far apart.
- *"Likely" only when both are exact-dated* is honest but makes "likely" almost never appear: most events are dated by season or year.

**On the site**, "likely" is always labelled as our guess and explained: *Likely at the same time — our best guess*, each item with a small info button (a real button, not hover-only) that opens one or two sentences: how close our guesses put the two, then how that event is placed (its honest range and the anchors, from `atReason`). "Possibly" carries one line: *Their honest date ranges overlap.* Both the Meanwhile panel and event pages (*Around the same time*) show the two groups.

### 4.5 Links

Typed relations between events, for connections time alone can't show. Written once; the build adds the reverse.

| Type | Reverse | Example |
|---|---|---|
| `enabled-by` | `enables` | Pelennor Fields *enabled-by* Pelargir: the Corsairs' ships bring Aragorn's host |
| `caused-by` | `causes` | Tuor sees Túrin *caused-by* the fall of Nargothrond |
| `concurrent` | `concurrent` | Pelennor Fields and the Battle of Dale |
| `crossing` | `crossing` | two characters' threads meet without the story joining them |

### 4.6 Journeys and whereabouts

A journey is a dated path for one or more characters: `waypoints` of place + date. A stay known only within bounds gets an optional `end`, like an event's `when.end` (Gandalf at Dol Guldur: summer–autumn 2941), so the range is honest without inventing a date. The end may have its own precision (`endPrecision`): the company is in Rivendell from some time in June until 1 Lithe. Between events, it says where a character is, which is what the time cursor needs to show "what everyone is doing". The Quest of Erebor, Tuor's road to Gondolin and the Ring's road to Mordor are journeys.

Waypoints get best guesses too: one that matches an event on the journey (same place, overlapping dates) takes that event's moment, even when the waypoint is short enough to be an anchor; the rest are spaced between their neighbours. The build warns when an event at one of a journey's places overlaps none of its waypoints there. A character's whereabouts at a moment is the last waypoint reached, on the way to the next. Coarse waypoints may overlap their neighbours; only one that clearly comes before the previous is an error.

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
- **One narrator per age.** Each age names its narrator (`narrator:` in `content/ages/<age>.yaml`), and every event of that age is read by it: the history of the world told as fact, plainly and with weight, never as a children's story. The book doesn't change the voice (*The Hobbit* and *The Lord of the Rings* share the Third Age's), and characters have no voices of their own. A narrator (`content/narrators/<id>.yaml`) has a voice per audio language, designed once at audition from attributes, then cloned in every recording from our own reference sample, committed next to it. A narrator is never a real actor's voice.
- **Recordings are made by the pipeline** on the homelab Voice Studio (`docs/LOCAL.md`). `npm run narration:render` renders each passage on its own, with names respelled from `content/pronunciation.yaml`. Every take is checked automatically: words heard against the script, names, pace against the narrator's median, length, clipping and silences. A flagged take is retried with a new seed, and all takes are cached, so an edited passage re-renders alone and a failed run resumes. The author listens to every flagged take plus a random sample, on a report page. `npm run narration:publish` then joins the passages with a fixed gap and writes `audio/<lang>.mp3` and `.yaml` with exact `starts`, the `narrator` and version, and a hash per passage. The build names exactly which passages went stale. Keep the spoken words identical to the passage text. Design: `docs/superpowers/specs/2026-11-10-narration-voices-design.md`.
- **Scripts out, recordings in.** `npm run narration:export` writes each event's script per language to `out/narration/<event>/<lang>.{txt,json}` for the Voice Studio, with a `textHash` of the text. The hash goes back into `audio/<lang>.yaml` with the recording, and the content build warns when `narration.yaml` no longer matches it (a stale recording). `--changed` exports only what needs (re)recording. Format in `content/README.md`.
- No cloned voices of real actors.

## 6. Languages

- English is the default; Spanish is the second language. Adding one = add its code to `LANGS` in `src/data/types.ts`, then its interface strings.
- Every content text is `{ en, es }`. English is required; missing languages fall back to English, and the build reports what's missing.
- Names follow the published translations (Bilbo Bolsón, Bolsón Cerrado, Thorin Escudo de Roble).
- Interface strings live in `src/i18n.ts`.
- The language comes from `?lang=` in the URL, then the visitor's last choice, then English. Following a link with `?lang=` switches the open tab to that language; a link without one keeps the current language.
- **What you hear is apart from what you read.** `?lang=` is the reading language (text and interface); `?audio=` is the recording that plays, or `off`. Without `?audio=`, the reading language's recording plays if there is one, else the English one, else none (`pickAudio` in `src/audioChoice.ts`). So Spanish text can ship before Spanish voices, and a visitor can read Spanish while hearing English. The clock follows the recording that plays; text in another language appears as its passage starts in that recording. A small button beside the sound control shows and switches the voice's language when there is a choice. Muting is `audio=off`: the event keeps the staging's own pace.

## 7. Shareable moments

The URL always reflects where you are:

```
/#/event/ainulindale?t=0.42
/#/event/roast-mutton?t=0.45&follow=bilbo&lang=es
/#/event/tuor-sees-turin-at-ivrin?lang=es          an event that isn't staged: its page (§3.4)
/#/lives?with=tuor,turin                            character lanes, in this order (§3.2)
```

Moving to another event or view adds a history entry, so the back button returns; scrubbing and selecting only update the current one. A link to the event already on screen seeks to its `t` and follows its `follow`, when it gives them. Links inside the site are plain `href`s built in `src/routes.ts`.

After every navigation, focus moves to the new view's heading (its `h1`), so keyboard and screen-reader users start at the top of what they opened; redrawing the sidebar keeps focus on the control that had it.

## 8. Technical shape

- **Static site**: Vite + TypeScript + three.js, no framework. Output is a plain `dist/` folder (GitHub Pages).
- **Code is split by zoom level**: each stage (`scene/cosmos.ts`, `scene/dioramaStage.ts`) is loaded with a dynamic `import()` the first time it is needed, so the front page never downloads diorama code. three.js core gets its own chunk (`manualChunks` in `vite.config.ts`), cached across deploys; keep every chunk under Vite's 500 kB warning.
- **Content build** (`scripts/content/`): reads `content/`, validates it, and writes `public/data/` (generated, not committed):
  - `index.json`: ages, characters, places, arcs, journeys, and every event's summary placed on the axis with links in both directions, plus lookups by character, place, arc and journey, and each character's lane (events and uncovered journey legs, in story order; each waypoint also names the event it matched). Small enough to load up front; the time cursor and lanes run on it.
  - `events/<id>.json`: one per staged event, with narration, staging and audio timing, loaded when the event opens.
  - `scripts/<id>.json`: the narration passages of every event that has a `narration.yaml`, so a scripted event's page can show them as text.
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
| 2026-11-09 | Every event is reachable: events that can't be watched yet open a text page at the same route, with the narration as text once scripted (§3.4). |
| 2026-11-09 | "Likely at the same time": never for two scenes sharing a character (unless linked `concurrent`/`crossing`); otherwise best guesses within ±3 days / ±15 days / ±45 days by the vaguer precision (day / month / season), never for a year or vaguer. Every best guess records why it landed there (`atReason`), and the site labels "likely" as our best guess and explains it (§4.4, §4.4.1; #2). |
| 2026-11-10 | Narration voices: one narrator per age and audio language, not per book or character; events read as history. Voices designed at audition, then cloned from our own reference sample, committed to the repo, because published recordings are public anyway. Recordings rendered passage by passage on the homelab Voice Studio, checked automatically, spot-listened by the author, published with exact starts (§5). The Before Time narrator is `the-elder`. |
| 2026-11-10 | The audio language is apart from the reading language: `?audio=`, falling back to the reading language, then English, then none (§6). |
| 2026-11-09 | Character lanes: lanes as coloured columns with time running down, one story order, crossings in gold, honest gaps ("at least N years later"), kin suggestions; lanes derived by the build; route `#/lives?with=` (§3.2). |

## 12. Open questions

- **Journeys**: do long travels (Frodo's road to Mordor) play only on the world map as a moving path, or do some legs (Moria, the Dead Marshes) get their own dioramas?
- **Factions** for battles: format to be defined when the first battle is staged.
- **World view**: the original world map per age is not built yet; places have no map coordinates until it is.
