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
2. **The Spring of Arda** (`the-spring-of-arda`): the two Lamps light a symmetric world, the land greens, Almaren glows where their lights meet; then Utumno rises in the north, the Lamps fall, and fire and new seas break the balanced shape.
3. **The Two Trees** in Valinor (`the-two-trees`), then the first rising of the Moon and the Sun (`the-first-moon-and-sun`): two events, since they are two scenes ages apart.
4. **Beleriand drowned** at the end of the First Age (`beleriand-is-drowned`).
5. **The fall of Númenor**: the slab bends into a sphere and Valinor is taken out of the world (`the-world-is-made-round`, the cosmic side of the island's `downfall-of-numenor`).

They form the arc *The Shape of Arda* with the Ainulindalë. Each is a small event of its own, staged with `stage: cosmos` (so far the Ainulindalë and the Spring of Arda; the others are scripted), so the time cursor and the Meanwhile panel treat them like any other.

Past the end of history the cosmos has one more story, **what is foretold** (§4.8): the arc *The End of Days*, the Last Battle and the world remade as Mandos prophesied them, then the Second Music. Its world-sized scenes (the Sun and Moon put out, the Silmarils rising out of sea, earth and air, the Second Music) belong to the cosmos too, and its scenes in Valinor to event dioramas; they are scripted, not staged yet. Wherever they appear they are marked as prophecy, never shown as history.

### World

- Shows one age's geography (coastlines of *that* era) with markers for events nearby in time.
- Journeys between events are drawn as animated paths.

### Event

- A diorama with characters animated along tracks.
- Play/pause, a draggable scrubber with **beat markers** (e.g. "Bilbo caught", "dawn").
- Click a character → highlight ring + side panel: name, description, and their **current thought**, which changes as the scene plays. "Follow" keeps the camera on them.
- Event summary panel; prev/next (chronological, or along the followed character's lane).
- **Battles** use the same view, factions colour-coded, beats marking the turning points. Each side is a **faction** (§4.9) with a banner colour; the event lists its sides, and staging places each faction's **army** as a block of small figures in that colour, with a banner at its front (`src/scene/armies.ts`). The named characters keep their own tracks and lead them, standing a head taller than the ranks, so the story stays readable in the crowd. Armies are drawn with instancing (at most 240 figures in a battle) so a phone keeps up: per army two instanced draw calls (bodies, heads), a third for spears, and one more for a foot army's banner (pole, cloth and finial merged into one vertex-coloured mesh), each drawn again for the shadow map: the six armies of the Five Armies take 19 draw calls, 38 with shadows. Where every figure stands is a pure function of `t` (a formation's jitter is seeded by the army; before its first keyframe an army stands there, idle), and `ambient` only adds the bob of marching, the jostle of a fight and the beat of wings. Off the tile is offstage, as for figures: a host marches on and off, and whether a figure is on the tile is decided by its place in the formation, before any idle motion, so it never depends on `ambient`. Wolves run in loose packs and eagles wheel over the field, by the faction's `kind` (`ARMY_KINDS`; any other kind is drawn as men, and the build warns). The event card names the sides as a key: *Thorin's Company, Dwarves of the Iron Hills, Elves of Mirkwood, Men of Lake-town and Eagles of the Misty Mountains against Goblins of the Misty Mountains and the Wargs*, each with its colour, one side per line (hidden on phones, where the card is a single line under the top bar). On a desktop the diorama frames its tile in the space the card leaves free (`Stage.resize`'s `insetLeft`).

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

**Route:** `#/time/<age>/<date>`, readable: `#/time/third-age/3019-03-15` (a day), `…/3019-03` (a month), `…/3019` (a whole year), `…/3019-midyear` or `…/3019-1-lithe` (a day outside the months), `…/2941-summer` (a season, from an event dated by season), `#/time/before-time` (a timeless age). A bare axis position (`#/time/7050.2`, years of the Sun) opens the day it falls on; an age alone opens the year of its first event. `?zoom=age|century|year|month` only when it isn't the moment's default scale; `?from=<event>` when opened from an event. Without a moment it opens on the Unexpected Party, 26 April 2941. It opens as a page in place of the stage, like the lanes (§3.2). Stepping, dragging and zooming update the URL in place (no history entry), like scrubbing; a moment link adds one.

- **The moment is said honestly**, exactly as precise as it was picked: *T.A. 3019* (with *The whole year: everything the sources allow within it*), *March, T.A. 3019*, *15 March, T.A. 3019*. Its span is its honest range (`dateSpan`), like any event's.
- **The control** has two scales. The **ages** as segments of one bar: the timeless ages (*Before Time*, *the Years of the Lamps*) in a dashed box of their own before the axis, not on it; then the dated ages, each as wide as the logarithm of its own years (1500 Valian years, 590, 3441, 3021, and the open Fourth Age shown to Fo.A. 120, the end of Appendix B), so each is readable and pickable though their lengths differ a hundredfold; and past the end, in a dashed box of its own after the axis, **what is foretold** (§4.8, `#/time/foretold`), with the note *Foretold, not history: what the prophecies say will come after all the ages. It has no date, so it stands past the end of the timeline.* Its page lists the prophecy's scenes under *Foretold, not history*. On a timeless moment the scale and its zooms are hidden but the ‹ › steps stay, and the arrow keys on a timeless segment do the same: they move along the bar in order (*Before Time* → *the Years of the Lamps* → the first year of the Trees; from what is foretold, ‹ goes to the last year the axis shows), and a step that has nowhere to go is disabled. Faint dots show where events are (placed by best guess, no dates said); a gold diamond marks the moment. Under it, the **finer scale** inside the chosen age, at four zooms: *Age* (the whole age, pick a year), *Century* (pick a year), *Year* (pick a month), *Month* (pick a day: the month with the days outside the months beside it, June and July with the Lithe days, Afteryule with 2 Yule, Foreyule with 1 Yule; an Overlithe slot in a year without one is drawn empty). In the Years of the Trees only *Age* and *Century*: a Valian year is about ten of the Sun, so only whole years mean anything. The scale names what it shows (*April, T.A. 2941*) and is a slider: drag or tap (the window holds still while dragging), arrows step by its unit (into a coarser moment first: from *T.A. 3019*, → is January), Page Up/Down by more (a century or ten years / ten years / a year / a month), Home/End to its ends, + and − zoom; ‹ › buttons step for touch. Steps run on across ages (F.A. 590 → S.A. 1) and off the ends of the axis: → or End from the last day the axis shows (Fo.A. 120, at any scale) goes to what is foretold, ← or Home from Y.T. 1 to the Years of the Lamps; a bigger step stops at the end first. A URL naming a year past an age's end opens on its last year (for the Fourth Age, the last one shown), and an Overlithe in a year without one on Mid-year's Day. Pure logic in `src/moment.ts` (paths, precision), `src/timeAxis.ts` (segments, scales, ticks, picking, steps) and `stepDate` / `dayWindowSlots` / `nearnessDuring` in `calendar.ts`, all tested.
- **Moments to visit**: a few moments where much happens at once (the Music, the darkening of Valinor, F.A. 495, the Downfall of Númenor, the Unexpected Party, Mirkwood in August 2941, the Council of Elrond, 15 March 3019, the Ring's end), listed in `src/moments.ts`, labelled by an event's title or their own string; also in the sidebar's **Time** view.
- **Likely happening then — our best guess**: events whose guess falls inside the moment or within their own window of it (`nearnessDuring`, §4.4.1), each with the (i) explanation as on event pages (*By our best guess, it falls within three days of this moment (15 March, T.A. 3019)*, then how it is placed). **Possibly happening then**: the honest range includes the moment, and no more can be said (the first twelve, then *Show all*). Each with its full honest date and place.
- **Where everyone is**, from the journeys (`src/whereabouts.ts`): a stop whose honest range covers the moment is a place they may be at (*At Cirith Ungol*); several such stops, or none between two, are *Somewhere between Goblin-town and the Elvenking's Halls*, with the stops in order and the first and last stop's honest ranges. For a day or a month (never a whole year) the best guesses add which stop was likely last reached, labelled: *Our best guess: past Shelob's Lair, on the way to Mordor* (i). Journeys with the same answer are one company (Bilbo, Gandalf and the dwarves at Bag End), largest first; each character is listed once, and on a handoff day (Gandalf leaving the hobbits on 30 Oct 3019) the journey that is starting wins; names open their lanes, *See their lives side by side* opens the company's; the event at that stop, if any, is linked (*There:*). Characters who stay in one place (`home`, §4.7) are listed quietly *At home*: *In their own country, the Old Forest*, only between their first and last events.
- **Ways in and out:** the sidebar's **Time** rail item (§3.3); *See this moment on the timeline →* on every event page (under its placement) and at the foot of the Meanwhile panel on a stage, opening the event's moment (its start, at its own precision; vaguer than a season gives the year) with *← Back to <event>*. Meanwhile itself stays as it is.

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

- A narrow **icon rail**, always visible: the Ardatir star (home: the cosmos), then one item per view, **Ages, Time, Stories, Lives, Books, Places**, each an icon with a short label. At the bottom, the language switch (EN / ES) and the collapse toggle.
- A **panel** beside it showing the chosen view, with the wordmark, tagline, *Start here* (the opening, §3.5) and search at the top and the disclaimer at the bottom. Clicking a rail item opens its view; clicking the active one again folds the panel away, leaving only the rail. Collapsed, rail items show their name on hover.

**The views:**

| View | Shows |
|---|---|
| **Ages** | The ages as a vertical thread of nodes. The current age is lit and opens into its arcs, then their events, with the event on screen highlighted. |
| **Time** | The time cursor (§3.1): what it is, the moment on screen (or *Open the timeline →*), the current event's moment, and the moments to visit. Its page is the timeline itself. |
| **Stories** | The arcs as cards: age, name, one line of summary. |
| **Lives** | The lives chosen for lanes as chips, with *Side by side →* (§3.2); then characters in the current event first, then everyone; each opens into summary, kin and their events in order, and has a + / ✓ toggle that adds or removes their lane. |
| **Books** | Each book opens into chapters (from events' `source`), linking to the events they cover. |
| **Places** | Places with their events, alphabetical for now; grouped by region, with a way into the world map, once the world map exists. |

Every event in a list is a link. Events that can be watched (staged) are marked with a filled diamond and open their stage; the others (outline, scripted) have a hollow diamond, are listed a little dimmer, and open their page (§3.4), so the whole story can be followed. Search matches event, character and place names in the current language, ignoring accents.

**Over the stage:**

- Top left, a **breadcrumb** of where you are (*Third Age › The Quest of Erebor › Roast Mutton*); top right, a **zoom switch**, *Cosmos · World · Event*.
- The event card sits under the breadcrumb, the selected character's card on the right (§2, Event).
- The narration caption above the timeline bar.
- The **timeline bar**: previous / play / next event, the scrubber with beat markers, time, **About this scene** (§3.5), **Meanwhile…** and mute. Meanwhile lists the event's links and the events whose honest range overlaps it, as *likely* (our best guess, explained) and *possibly* (§4.4.1), each a link like those in the sidebar, and ends with *See this moment on the timeline →*, the time cursor (§3.1) at the event's moment. Later, in the cosmos and world levels, the bar spans the ages instead.

**Phones.** The rail and panel become one **drawer** opened from a menu button: the views as a tab strip under the search, the language switch in the footer.

**Look: fantasy, kept light.** Night-blue ground, parchment ink, one gold accent; Cormorant Garamond for names and titles, Inter for everything else. The fantasy comes from a few small touches only: the four-point star, diamond markers on section rules and beats, the glowing node on the ages thread, a faint starfield. No parchment textures, ornate frames or decorative fonts in body text: the dioramas are the show.

**The URL still holds the state** (§7); which view is open and whether the panel is collapsed are remembered per visitor, not put in the route.

### 3.4 Event pages: events that can't be watched yet

Most events will be outlines for a long time, and they are exactly what the cross-views are made of. So every event has a way in: a staged event opens its stage, and **any other event opens its page**, a calm text view in place of the stage, at the same route (`#/event/<id>`). It is what most visitors will see for a long time, so it is treated as a finished thing, not a placeholder.

- **One centred column**, set like a page of a book: the age and stories as a small overline, the title large in the serif, then the **honest date** (start and end at their precision, e.g. *Winter, F.A. 495*; never the best guess), the place and the source (book and chapter, cited, not quoted). A quiet note says it isn't staged yet.
- The **summary** in the serif, larger than body text. When the event is `scripted`, **the telling**: its narration passages read as plain text, in order, without animation (`data/scripts/<id>.json`, loaded with the page).
- **What is foretold** (§4.8) says so first, under the title, in a dashed box: the *Foretold* badge and one line, *Foretold by Mandos, not told as history. Source: The Lost Road and Other Writings, “Quenta Silmarillion”.* (who foretells it only when the source names one).
- **Who was there**: the characters as small cards (name, kind, one line); a name opens their life.
- **Connections**: every link, both directions (the reverses come from the build), with its type (*caused by*, *makes possible*…) and its note.
- **Part of**: each arc with its summary and the events before and after this one in it; each journey with its places in order, this one lit.
- **Around the same time**: events whose honest range overlaps this one (as Meanwhile does), split into *likely* (our best guess, each with a short explanation behind an info button) and *possibly* (§4.4.1). Under the honest date at the top, a quiet line says how an event that isn't exactly dated is placed on the timeline (§4.4).
- **Before / After**: the previous and next event in story order, so the whole chronicle can be read page by page.

The look is the sidebar's: night ground with a faint starfield and a soft gold glow at the top, section rules with a diamond, filled and hollow diamonds on event links. While a page is open the stage under it neither renders nor plays; the breadcrumb and zoom switch stay on top.

### 3.5 Wonder and learning: the opening, names, the books

The scenes are the show, but a newcomer also needs a door, a hand on the shoulder and a way onward (#29). Everything here is gentle and on demand: nothing appears unasked except the opening, once.

- **The opening** (`src/opening.ts`, route `#/start`). A first visit to the front door does not land on a bare control panel: the cosmos fills the screen (sidebar, bar and cards set aside) and the Ainulindalë plays from its first moment, with one short line of our own at a time, tied to the animation's beats: *Before the world, there was only the Void, and Ilúvatar, the One* (t 0), the Music (0.08), Melkor's discord (0.35), the Vision and *Let it be* (0.62), *So Arda was made: the world where all these stories happen* (0.88). The lines follow the animation (`stepAt(t)`); **Next** jumps to the next line's moment, so a visitor goes at their own pace, and the narration caption is hidden meanwhile so there is only one text on screen. Then (from t 0.97) a calm **invitation**, *Where would you like to begin?*, with three ways in as cards: **Follow a story** (*The Hobbit* from *An Unexpected Party*), **Pick a moment** (the time cursor, §3.1), **Follow a life** (Bilbo's lane, §3.2); and *Or stay a while among the stars*. **Skippable at once**: *Skip the opening* (and Escape) from the first frame; beside it a language switch names the other language in its own words (*Español*), since the sidebar is set aside. It is a modal dialog: focus inside, Tab cycles, each new line said by a live region, no motion beyond a fade (none with reduced motion).
- **Only once, and only at the front door.** It opens by itself when a visitor's first page is the front door (no event in the URL) and they have not seen it (`ardatir.opening` in localStorage; unreadable storage counts as seen, so it never shows on every visit). A deep link is never interrupted. While it is up the URL is `#/start`; closing it returns to the cosmos' own route, and any other route takes it down. **Reopened** from the sidebar's *Start here* under the wordmark (also in the phone drawer).
- **How to say a name.** Characters, places, ages and events may carry `pronounce: { en, es }`, a respelling for readers of that language in the *AR-da* style: syllables joined by hyphens, the stressed one in capitals, one per word (`ee-LOO-va-tar`, `i-LÚ-va-tar`; `KIR-ith OON-gol`). An event's respells its title when the title is a name (the Ainulindalë). The build checks the form (`src/data/pronounce.ts`). It is shown as a small pill after the name, the stressed syllable in gold: on event pages (title, place, who was there), the stage's event card, the selected character's card, *About this scene*, and the sidebar's Lives and Places. Screen readers hear *How to say it: ee-loo-va-tar*. Filled for about forty hard names (Ilúvatar, Fëanor, Lúthien, Túrin, Glaurung, Eärendil, Celebrimbor, Galadriel, the Nazgûl, Barad-dûr, Númenor, Lothlórien…); Spanish respellings use Spanish spelling (*th* as *z*, *h* as *j*, a hard *g* before *e*/*i* as *gu*).
- **About this scene** (`src/learn.ts`): a button in the stage's bar beside Meanwhile (one panel open at a time) that opens, on demand, **where is this** (the place and its summary; for the Music, which has no place, *when*: its age), **who is here** (each character with kind, how to say the name and their one line; the name shows them on the stage when they have a track, *Follow their life →* opens their lane), **before and after** (the previous and next event in its first story, else in the chronicle) and **in the books**. On event pages the same questions are already answered by the page (§3.4); the place gets an (i) that opens its summary under the meta lines.
- **Pointers to the books.** From `source`, gently: *Read this in* The Hobbit*, chapter 5, “Riddles in the Dark”.* / *Léelo en* El Hobbit*, capítulo 5, «Acertijos en las tinieblas».*, then *Here it is told in a few words of our own; Tolkien tells it in full, and far better.* On every event page (*In the books*, before Before / After) and in *About this scene*. The Hobbit's chapters are cited by number and named here; the others by their English title, given in Spanish from the published editions (`src/books.ts`; the unconfirmed ones go on the #51 checklist). The meta line's source uses the same titles, and a test keeps every cited chapter translated.
- **Tone.** Short sentences, no jargon before it is needed, warm without being sugary, and accurate for readers who know the books (the opening's lines are paraphrase, checked against the *Ainulindalë*).

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
  factions/     elves-of-mirkwood.yaml, ...         sides in battles (§4.9)
  events/<age>/<sort-key>-<id>/
    event.yaml        facts: when, where, who, links, beats (and a battle's sides)
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

`event.yaml` and `narration.yaml` say **what happened**; they hold no animation timings. `staging.yaml` says **how it is shown**: which stage, how long, where each narration passage and beat falls in the animation (`t`, 0 → 1), the character tracks, and a battle's armies. Writing and animating are separate jobs, matching the phases.

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
- Ages before time (the Ainulindalë) are **timeless**: their events have no position on the axis and sit before everything else. **What is foretold** (§4.8) is timeless too, and sits after everything else.
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
3. For the **bare time cursor** (a moment, not an event), the window is the event's own precision. The cursor's moments are whole days, months, seasons or years, so the moment is its span (`nearnessDuring`): *possibly* when the event's honest range overlaps it, *likely* when the event's guess falls inside it or within the event's window of it. An empty span is exactly `nearnessAt`. A whole year thus calls an event dated 26 April "likely" in 2941, and a year-dated one only "possibly".

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

Name, kind, summary, optionally how to say the name (`pronounce`, §3.5) and, for staging, a placeholder colour and relative height (`scale`). `kin` lists family relations (`{ id: turin, as: cousin }`), used to suggest lanes to compare. `home` (a place id) is for characters who never travel, like Tom Bombadil in the Old Forest: when no journey places them, the time cursor shows them at home, but only between the start of their first event and the end of their last (honest ranges), since outside that the sources say nothing of them. A journey that comes to visit them (one of their events is on it) extends that span through its stops at their home: Gandalf's stay with Tom in November 3019 keeps Tom at home after his last event.

### 4.8 What is foretold

Some of the story has not happened: the **Dagor Dagorath** (the Last Battle) and the remaking of the world are **prophecy**, and the Second Music of the Ainur is said to come *after the end of days*. They live in an age of their own, `content/ages/foretold.yaml` (*What Is Foretold*, *Lo Profetizado*), with `timeless: true` and **`foretold: true`**.

- **The flag is on the age, not on each event**: every event in a foretold age is prophecy, so nothing in it can be mistaken for history by forgetting a field. The build requires a foretold age to be timeless (no dates, never on the axis) and to come after every dated age by `order`; story order puts its events after all others.
- **Each event must cite its `source`**, so its page can say where the prophecy comes from, and may name who foretells it with `foretoldBy` (a character id: `mandos`); `foretoldBy` is refused outside a foretold age. Links into and out of it are ordinary links: *Túrin slays Morgoth* is `caused-by` the curse on Húrin's house, so the curse's page shows *leads to* the prophecy, marked as such.
- **Marked everywhere it appears**: a small dashed *Foretold* badge (*Profecía*) beside the event wherever it is listed with history (sidebar lists, connections, lanes, the breadcrumb on wide screens), left out only where the list is already under the foretold age's own heading; its page says *Foretold by Mandos, not told as history. Source: …* under the title (§3.4); the time cursor shows it in a dashed box after the axis (§3.1); in lanes its events come after every journey leg, under the age heading with *Foretold, not told as history*; *lives that cross* pairs are taken from history only. It never appears in *likely* or *possibly* at the same time: it has no honest range.
- **Which version we tell, and why.** The published *Silmarillion* only hints at the end: Morgoth thrust through the Door of Night with a guard on the Walls of the World, the Second Music, Men joining in it. The fuller prophecy (Morgoth's return, the Sun and Moon destroyed, Túrin's black sword, the Silmarils recovered, the Trees rekindled, the Pelóri levelled) is the **Second Prophecy of Mandos** that ends Tolkien's drafts: the *Sketch of the Mythology* and the *Quenta* (*The Shaping of Middle-earth*), then the 1937 *Quenta Silmarillion* (*The Lost Road*). We follow the 1937 text, the latest full telling, and say so on every page; the later *Valaquenta* (*Morgoth's Ring*) says the healing of the Marring was not revealed, and Christopher Tolkien left the prophecy out of the published book. The Second Music is told from the published *Silmarillion* (*Ainulindalë*, *Of the Beginning of Days*). Each event's YAML notes where the versions differ (Fionwë in the drafts is our Eönwë).
- **One scene per event**, so the strongest moments can each be animated: Morgoth returns through the Door of Night; the Sun and the Moon are destroyed; the Last Battle is gathered; Túrin slays Morgoth; the Silmarils are recovered; the Two Trees are rekindled; the Mountains of Valinor are levelled; the Second Music of the Ainur (arc *The End of Days*).

### 4.9 Factions: sides in battles

A **faction** is a host that fights as one body under its own banner: `content/factions/<id>.yaml` with a name (plural, as a host is named: *Elves of Mirkwood*), a banner `color`, a `kind` (a character kind: elf, man, dwarf, goblin, orc, wolf, eagle…, which also shapes its army's figures), a short summary and its `leaders` (character ids). Factions are reused across battles: the Dwarves of the Iron Hills fight at Azanulbizar under Náin and at the Five Armies under Dáin.

- **A battle lists its sides** in `event.yaml`: `sides`, a list of at least two groups of allied faction ids, each against the others. It says who fought together in the end (at the Five Armies, the dwarves who nearly fought the elves and men are on their side). The build validates the ids (each faction on one side only), and derives `index.byFaction`, each faction's battles in story order.
- **Who is a faction, who a character:** one being who comes alone is a character with his own track (Beorn at the Five Armies). A host is a faction even with a named leader (the Eagles of the Misty Mountains, led by their Lord). A small band whose members all have tracks may still be a faction, so the sides are said in full (Thorin's Company), but needs no army.
- **Armies** (`armies` in `staging.yaml`): `{ faction, size: small | medium | large, keyframes: [{ t, x, z, action? }] }`, the faction on one of the event's sides. Keyframes place the army's centre; unlike a character's, an army keyframe's `action` says what it does **on the way to** that keyframe (walk or run there; idle or fight where it stands). It faces the way it last marched, wheeling round when it turns (§2, battles).
- **On the site:** event pages give the sides in the meta lines (*Men of Dale and Dwarves of Erebor against Easterlings*) and a **The sides** section with each faction's summary and leaders (names open their lives); the time cursor's event rows add the sides line; the sidebar's search lists matching factions with their battles (`src/sides.ts`). No new rail item: factions are a way into battles, not a view of their own.

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
- The language comes from `?lang=` in the URL, then the visitor's last choice, then English. Following a link with `?lang=` switches the open tab to that language; a link without one keeps the current language.

## 7. Shareable moments

The URL always reflects where you are:

```
/#/event/ainulindale?t=0.42
/#/event/roast-mutton?t=0.45&follow=bilbo&lang=es
/#/event/tuor-sees-turin-at-ivrin?lang=es          an event that isn't staged: its page (§3.4)
/#/lives?with=tuor,turin                            character lanes, in this order (§3.2)
/#/time/third-age/3019-03-15                        the time cursor at a day (§3.1); …/3019-03, …/3019, …/3019-midyear
/#/time/first-age/495?zoom=age&from=fall-of-nargothrond   a whole year, at the age scale, opened from an event
/#/start                                            the opening over the cosmos (§3.5)
```

Moving to another event or view adds a history entry, so the back button returns; scrubbing and selecting only update the current one. A link to the event already on screen seeks to its `t` and follows its `follow`, when it gives them. Links inside the site are plain `href`s built in `src/routes.ts`.

After every navigation, focus moves to the new view's heading (its `h1`), so keyboard and screen-reader users start at the top of what they opened; redrawing the sidebar keeps focus on the control that had it.

## 8. Technical shape

- **Static site**: Vite + TypeScript + three.js, no framework. Output is a plain `dist/` folder (GitHub Pages).
- **Code is split by zoom level**: each stage (`scene/cosmos.ts`, `scene/dioramaStage.ts`) is loaded with a dynamic `import()` the first time it is needed, so the front page never downloads diorama code. Within the cosmos, each event's animation after the Ainulindalë is its own module (`scene/cosmosLamps.ts`), picked by event id in `scene/cosmos.ts` and loaded the same way; all of them share the Void, the shells and the camera (`scene/cosmosWorld.ts`). three.js core gets its own chunk (`manualChunks` in `vite.config.ts`), cached across deploys; keep every chunk under Vite's 500 kB warning.
- **Content build** (`scripts/content/`): reads `content/`, validates it, and writes `public/data/` (generated, not committed):
  - `index.json`: ages, characters, places, arcs, journeys, factions, and every event's summary placed on the axis with links in both directions, plus lookups by character, place, arc, journey and faction (`byFaction`), and each character's lane (events and uncovered journey legs, in story order; each waypoint also names the event it matched). Small enough to load up front; the time cursor and lanes run on it.
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
| 2026-11-09 | Character lanes: lanes as coloured columns with time running down, one story order, crossings in gold, honest gaps ("at least N years later"), kin suggestions; lanes derived by the build; route `#/lives?with=` (§3.2). |
| 2026-11-09 | The time cursor (#1): a page at `#/time/<age>/<date>` (readable, at the precision picked: year, month, day, days outside the months; also an axis position); the ages as log-width segments with the timeless ones apart before the axis, and a finer scale (age, century, year, month) down to a single day, keyboard and touch operable; likely / possibly by `nearnessDuring` (the moment is its span); whereabouts from journeys by company, honest ("somewhere between"), with a labelled best guess for a day or month; characters who never travel shown at `home` within their events' span; moments to visit; a **Time** rail item; ways to and from events (§3.1). |
| 2026-11-09 | **What is foretold** (#57): the Dagor Dagorath and the Second Music in a timeless age flagged `foretold`, after the Fourth Age and never on the axis; every event cites its source and may name who foretold it (`foretoldBy`); marked as prophecy everywhere (badge, page line, dashed segment after the axis, lanes); the fuller version from *The History of Middle-earth* (the 1937 *Quenta Silmarillion*), split into one scene per event (§4.8). |
| 2026-11-09 | Wonder and learning (#29): a first visit to the front door opens with a short guided opening over the Ainulindalë (one line per beat, Next, skippable at once, then three ways in: a story, a moment, a life), remembered per visitor, at `#/start` and reopened from the sidebar's *Start here*; `pronounce: { en, es }` respellings in the *AR-da* style on characters, places, ages and events, validated, shown as a small hint; *About this scene* on the stage; gentle pointers to the books from `source`, with chapter titles in both languages (§3.5). |
| 2026-11-09 | Factions (#18): one file per side in `content/factions/` (name, banner colour, kind, summary, leaders), reused across battles; battles list `sides` as groups of allied factions; staging places `armies` (faction, size, keyframes) as instanced blocks of small figures in the faction's colour, named characters keeping their own tracks; one being who comes alone (Beorn) is a character, a host (the Eagles) a faction. First example: the Battle of Five Armies (§2, §4.9). |

## 12. Open questions

- **Journeys**: do long travels (Frodo's road to Mordor) play only on the world map as a moving path, or do some legs (Moria, the Dead Marshes) get their own dioramas?
- **World view**: the original world map per age is not built yet; places have no map coordinates until it is.
