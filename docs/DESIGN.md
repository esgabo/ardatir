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

They form the arc *The Shape of Arda* with the Ainulindalë. Each is a small event of its own, staged with `stage: cosmos`, so the time cursor and the Meanwhile panel treat them like any other.

Past the end of history the cosmos has one more story, **what is foretold** (§4.8): the arc *The End of Days*, the Last Battle and the world remade as Mandos prophesied them, then the Second Music. Its world-sized scenes belong to the cosmos too, and five are staged there: the Sun and Moon put out over the round world and Eärendil driving Morgoth from the airs (`the-sun-and-moon-are-destroyed`), the Earth broken and made again with the Silmarils rising out of sea, earth and air (`the-silmarils-are-recovered`), the Trees rekindled on Ezellohar (`the-two-trees-are-rekindled`) and the Pelóri levelled with the light flowing over the world (`the-mountains-of-valinor-are-levelled`), and the Second Music (`the-second-music-of-the-ainur`), an echo of the first Music in which the Ainur and the Children of Ilúvatar sing before a great light, the themes settle into one harmony with no discord left in it, and all ends in light; the rest are scripted. Wherever they appear they are marked as prophecy, never shown as history.

**Prophecy is seen as a dream.** The foretold cosmos scenes share a register of their own (`scene/cosmosForetold.ts`): a violet-tinted Void, a slow pale mist, colours drawn a little towards a pale lavender ivory, and soft, hazy edges round the stage (`body.foretold-stage` in `style.css`, set for any foretold event); the stage card says *Foretold by Mandos, not told as history* in place of a date. The look stays the same low-poly, warm and luminous one, only softer, so it never reads as history.

### World

- Shows one age's geography (coastlines of *that* era) with markers for events nearby in time.
- Journeys between events are drawn as animated paths.
- **It has content of its own**: an arc's narration, told over the map, with the arc's scenes pinned on it as diamonds to drop into (§4.10). The world level is a scale of storytelling, not only a floor to cross.

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

Events are not isolated stories. Three **cross-views** show how they connect: the time cursor (§3.1) for *what else was happening then*, character lanes (§3.2) for *where two lives crossed*, and family trees (§3.6) for *how these two are related*.

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

A character's life as a lane of events and journey legs. Add more characters and their lanes run side by side; where they share an event the lanes **cross**. Tuor's lane meets Túrin's at the pools of Ivrin, where the cousins pass without knowing each other, a few years before Túrin's end. Family relations suggest which lanes to add — derived from `parents` and the narrowed `kin` (§4.11).

**Lanes own time; the family tree owns descent** (§3.6). A lane never draws parentage and a tree never lists events, so the two cannot become halves of one feature. They link to each other instead: a lane's kin suggestions carry *See the family →*, and every card on a tree carries *Follow their life →*.

**Route:** `#/lives?with=tuor,turin` (the order of the lanes; up to eight). It opens as a page in place of the stage, like an event page (§3.4).

- **Lanes are columns, time runs down the page.** Each chosen character is a thin vertical thread in their own colour (a light palette that reads on the night ground; gold stays the accent), with their initial at the top of the column, sticky while scrolling (two letters when lanes would share one: Gollum *Go*, Gimli *Gi*). On a phone at most four lanes are drawn, the first four chosen, and the page says so (*Showing 4 of 8 lives*); the chips still list all. Beside the threads, one row per step, in **one story order** for all lanes (the index order: age, then sort key).
- **What a lane holds** comes from the build (`index.lanes`): the character's events in story order, and between them the **journey legs** no event of theirs covers, a waypoint whose matched event they are not in, or one with no event at all (Frodo's road through Cirith Ungol before his events exist). Legs are placed by best guess: between their own lane's events before and after them, and there after every event of any chosen lane guessed no later than the leg (so a leg never shows before another lane's earlier event); they are drawn as small hollow nodes with the place in italics, the journey and the waypoint's honest range beneath (*Jun – 1 Lithe 2941*). Legs shared by several lanes (same place and range) are one row.
- **Crossings:** a row where two or more lanes share an event gets filled nodes ringed in gold, joined by a gold bar across the lanes, and a soft gold band behind the title with *Paths cross · Tuor, Túrin*, each full name in its lane's colour. A row with one lane has a plain node in that lane's colour.
- **Time between rows** is said honestly: an age heading when the age changes, and *at least N years later* (dotted threads) when the honest ranges are a year or more apart (`yearsBetween` in `calendar.ts`), counted in the age's own years: in the Years of the Trees, *at least 75 Valian years later*. Each row states only its honest date; the best guess is never shown.
- **Clicking an event opens it**: its stage if staged, else its page; Back returns to the lanes.
- **Choosing lanes:** chips at the top (each with its colour and a remove button), a search box to add a life (a combobox: whole-name, then name-start, then word-start matches first; arrow keys, Enter, Escape), and **kin suggestions** from the family graph (derived from `parents`, plus the authored `kin`; §4.11), written from the chosen character's side (*Túrin Turambar, cousin of Tuor*; *Thráin, father of Thorin Oakenshield*). Characters have no gender field, so Spanish takes the gender from the relation word (*Nienor, hermana de Túrin*) and says gender-neutral ones without guessing (*Túrin y Tuor, primos*; *Aragorn y Arwen, prometidos*). With no lanes chosen, the page offers a few **lives that cross**: for each age, the pair sharing the most events. Kin suggestions and pairs are links to the lanes with them added, so they can be opened or shared and Back undoes them; the add box and the remove buttons change the lanes in place and keep focus in the add box.
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
| **Lives** | The lives chosen for lanes as chips, with *Side by side →* (§3.2); then characters in the current event first, then everyone; each opens into summary, family, *See their family →* (§3.6) and their events in order, and has a + / ✓ toggle that adds or removes their lane. |
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
- **Who was there**: the characters as small cards (name, kind, one line); a name opens their life, and *See their family →* opens their tree (§3.6).
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

### 3.6 Family trees: how two people are related (#89)

The books say *son of*, *of the house of*, *kinsman of* on nearly every page, and the site could
not answer any of it. The time cursor says what was happening at a moment (§3.1); the lanes say
where two lives crossed (§3.2); **how are these two related** is the third question the texts keep
asking, and it needs a view of its own, because its answer is neither a moment nor a sequence — it
is a shape. The format the shape is drawn from is §4.11.

**It is not a lane, and must not become one.** Lanes own time: they run down the page in story
order and say *at least seventy-five years later*. A tree owns descent, and descent is not time.
Galadriel is Finwë's granddaughter and the contemporary of her own great-great-nephews; three
mortal generations pass while one elvish generation does not end. So **the tree has no time
axis**: its rows are generations counted from the person at the centre, and dates are writing on a
card, never a position. A tree that set Elrond and Elros on one line and then let their
descendants drift three thousand years apart would be two views fighting inside one picture. They
hand off instead: every card carries *Follow their life →* into that character's lane, and the
lanes' kin suggestions gain *See the family →* back. Descent here, time there, one link each way.

**One person at the centre, two generations each way.** A whole house at once is a hairball on a
phone and not much better on a desk: the house of Finwë is sixty-odd people and Durin's line is
twenty generations of one column. So the tree opens on one character with their parents and
grandparents above, their children and grandchildren below, and beside them their siblings, their
spouse or spouses, and their siblings' children — which is what a reader means by *their family*.
Everything further is one tap away and every tap goes into the URL, so a grown tree is shareable,
the same restraint lanes keep with their cap of eight.

- **Rows are generations.** One band per generation, the centre's band lit, parents above,
  children below. A couple stands side by side with a short tie between them and their children
  hang from the middle of that tie. A person whose other parent the sources never name hangs from
  a single stem, and **no empty box is ever drawn for a parent we are not told about**: silence is
  shown as silence, exactly as an undated event shows only its honest range (§4.4).
- **Twins are said, not drawn** (`twin`, §4.11). A generation band already stands siblings side by
  side, so the geometry has nothing left to add: the two stems leave the parents' tie at one point
  before splitting, which reads as *born together*, and the card carries the word — *Elladan, twin
  of Elrohir* / *Elladan y Elrohir, gemelos*. For Elrond's sons it is close to the only thing the
  texts say about them, and a tree that could not say it would be missing their whole story.
- **Half-siblings are drawn as half-siblings**, because in this story almost nothing matters more:
  Fëanor and Fingolfin share a father and not a mother, and most of the First Age comes out of
  that fact. They hang from the shared parent alone, not from a couple's tie, and the card says
  *half-brother* in words.
- **The four race shapes come out of the data, not out of four layouts.** One layout; the shape
  follows the edges, because the edges *are* the difference between the houses:

| House | What its edges are | What the one layout draws |
|---|---|---|
| Durin's line | one child a generation, twenty deep | a column one card wide — a chain is what a generation-row layout does with a chain |
| the house of Finwë | broad, deep, with marriage inside it (Fingolfin's children and Finarfin's marry across) | a wide tree whose ties cross; a marriage inside the house is one tie drawn between two cards in the same band |
| the kings of Númenor, the Line of Elros, the Stewards | succession with a few branch points | a near-column with short side branches, which is what succession is |
| the Bagginses, Tooks and Brandybucks | shallow, very broad, heavily intermarried | wide bands with many ties in them: the sprawl *is* the joke, and the layout tells it by being crowded |

- **A row too wide to read collapses.** Past about ten cards a band draws the people joined to the
  centre plus a chip, *and nine more Tooks*, which opens in place. The Shire's sprawl survives
  being told in two breaths.
- **Following a line is one control, not twenty taps.** Where every generation has a single child
  the tree offers *Durin's line: twenty generations →*, which sets the depth to the whole chain.
  Same layout, only narrow.
- **A card** is the name with its pronunciation hint (§3.5), the character's kind, their honest
  dates where we have them (*born F.A. 464*, *F.A. 472 – 501*), their one line of summary, and,
  where the sources say something other than a death, their `fate` in a sentence (§4.11). A card
  of a kind other than the centre's is marked as such, which is how a half-elven tree reads at a
  glance.
- **The relation is said in warm words, and computed.** *Galadriel is Fingon's aunt.* For anything
  further off, a sentence instead of a term: *They share an ancestor: Finwë, four generations above
  Galadriel and six above Gil-galad.* We do **not** print cousin degrees. English and Spanish do
  not cut them the same way, *second cousin once removed* is jargon a newcomer cannot use, and the
  sentence is both truer and friendlier. A `kin` tie the parentage graph cannot derive (§4.11) is
  said in its own words and drawn as a dotted tie, never a stem. That is how **six of the thirteen
  dwarves of Thorin's Company** stand in a view of Durin's line at all: the sources give Dori,
  Nori, Ori, Bifur, Bofur and Bombur no parentage, only *of Durin's race, kinsmen of Thorin*, and
  six dotted ties saying exactly that is better than six characters quietly absent (§4.11).

**The half-elven crossing is the reason to build this at all.** Elrond and Elros are brothers of
two different `kind`s, Elros chose the fate of Men and Elrond the Elves, and sixty-odd generations
later Aragorn and Arwen rejoin two houses sundered three thousand years. The design serves it in
four plain ways: an edge never cares what race it crosses, so the brothers simply stand together
in one band with their kinds marked; `fate` carries the Choice in one sentence on each of the four
who made it (Lúthien, Elros, Elrond, Arwen); `also=` grafts a second line into the same picture,
so `#/kin/aragorn?also=arwen` draws both; and the common-ancestor sentence says the thing a
diagram cannot — *Aragorn and Arwen share an ancestor: Elros and Elrond were brothers, sixty-six
generations and three thousand years ago*. It is also exactly why the rows are generations and not
years: the two lines take different numbers of generations to cross the same span, and that
difference is the story.

**Route.**

```
#/kin/elrond                              one life at the centre, two generations each way
#/kin/thorin?up=all                       Durin's line followed all the way back up
#/kin/aragorn?also=arwen&up=4             a second line grafted in, and more ancestors
```

`up` and `down` are whole numbers or `all` (the default is 2 and 2, left out of the URL);
`also` is a comma-separated list of extra people grafted in, like lanes' `with=`. Expanding,
collapsing and recentring behave as scrubbing does (§7): growing the tree replaces the current
history entry, opening another view adds one, and a fresh deep link lands on the grown tree.
It opens as a page in place of the stage, like the lanes and the time cursor.

**Ways in — and no new rail item.** A view that needs a person chosen before it can show anything
would open on nothing, so there is no seventh icon, by the same reasoning that gave factions none
(§4.9). Instead: the sidebar's **Lives** view gains *See their family →* on each character beside
the lane toggle; an event page's *Who was there* cards and the selected character's card on a
stage gain the same link; the lanes' kin suggestions link to the tree as well as adding a lane;
and every card on the tree recentres the tree on that person.

**Phones.** The bands scroll sideways with the centre card marked and the generation labels
sticky; the collapse chips keep each band short enough that sideways scrolling is a nudge and not
a journey. Nothing is drawn that a tap cannot reach.

**Where the code goes.** The arithmetic — generation depth, siblings and half-siblings, the
nearest common ancestor and the sentence about it, which bands collapse — is pure and tested in
`src/kinGraph.ts`, the precedent being `laneRows.ts`, `timeAxis.ts` and `whereabouts.ts`. The DOM
is `src/kin.ts`, loaded with a dynamic `import()` as its own chunk.

**The look is ours, and this matters here more than anywhere.** Appendix C of *The Lord of the
Rings* and the tables in *The Silmarillion* are Tolkien's own **diagrams**, and the same rule
applies as to the published maps (§10, `docs/MAP.md`): who begat whom is fact, not anyone's
expression, and may be read off them as reference — their layout, typography and design may not be
reproduced. So we draw in the site's own language: night ground, parchment ink, one gold accent,
the diamond on a rule (§3.3). No ruled boxes, no columns of small capitals, and no `=` between
spouses, which is those tables' own signature. The resemblance between any two family trees is the
family, not the drawing.

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

The build checks each event has what its status claims. An arc that tells its own story runs through the same four words, with its own files (§4.10), and its status is independent of its events'.

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

Name, kind, summary, optionally how to say the name (`pronounce`, §3.5) and, for staging, a placeholder colour and relative height (`scale`). `parents`, `spouse` and the narrowed `kin` say who they are related to, and the family tree is drawn from them (§3.6, §4.11); optional `born`, `died` and `fate` say what the sources say about the ends of their life, and nothing more. Siblings, cousins, descendants and generation depth are derived by the build, never authored. `home` (a place id) is for characters who never travel, like Tom Bombadil in the Old Forest: when no journey places them, the time cursor shows them at home, but only between the start of their first event and the end of their last (honest ranges), since outside that the sources say nothing of them. A journey that comes to visit them (one of their events is on it) extends that span through its stops at their home: Gandalf's stay with Tom in November 3019 keeps Tom at home after his last event.

### 4.8 What is foretold

Some of the story has not happened: the **Dagor Dagorath** (the Last Battle) and the remaking of the world are **prophecy**, and the Second Music of the Ainur is said to come *after the end of days*. They live in an age of their own, `content/ages/foretold.yaml` (*What Is Foretold*, *Lo Profetizado*), with `timeless: true` and **`foretold: true`**.

- **The flag is on the age, not on each event**: every event in a foretold age is prophecy, so nothing in it can be mistaken for history by forgetting a field. The build requires a foretold age to be timeless (no dates, never on the axis) and to come after every dated age by `order`; story order puts its events after all others.
- **Each event must cite its `source`**, so its page can say where the prophecy comes from, and may name who foretells it with `foretoldBy` (a character id: `mandos`); `foretoldBy` is refused outside a foretold age. Links into and out of it are ordinary links: *Túrin slays Morgoth* is `caused-by` the curse on Húrin's house, so the curse's page shows *leads to* the prophecy, marked as such.
- **Marked everywhere it appears**: a small dashed *Foretold* badge (*Profecía*) beside the event wherever it is listed with history (sidebar lists, connections, lanes, the breadcrumb on wide screens), left out only where the list is already under the foretold age's own heading; its page says *Foretold by Mandos, not told as history. Source: …* under the title (§3.4); the time cursor shows it in a dashed box after the axis (§3.1); in lanes its events come after every journey leg, under the age heading with *Foretold, not told as history*; *lives that cross* pairs are taken from history only. It never appears in *likely* or *possibly* at the same time: it has no honest range.
- **Which version we tell, and why.** The published *Silmarillion* only hints at the end: Morgoth thrust through the Door of Night with a guard on the Walls of the World, the Second Music, Men joining in it. The fuller prophecy (Morgoth's return, the Sun and Moon destroyed, Túrin's black sword, the Silmarils recovered, the Trees rekindled, the Pelóri levelled) is the **Second Prophecy of Mandos** that ends Tolkien's drafts: the *Sketch of the Mythology* and the *Quenta* (*The Shaping of Middle-earth*), then the 1937 *Quenta Silmarillion* (*The Lost Road*). We follow the 1937 text, the latest full telling, and say so on every page; the later *Valaquenta* (*Morgoth's Ring*) says the healing of the Marring was not revealed, and Christopher Tolkien left the prophecy out of the published book. The Second Music is told from the published *Silmarillion* (*Ainulindalë*, *Of the Beginning of Days*). Each event's YAML notes where the versions differ (Fionwë in the drafts is our Eönwë).
- **The world's shape after the end is left as Tolkien left it** (#59). The prophecy says the Earth is broken and made again, but not what shape it takes, and Tolkien never reconciled the remade world with the round one after Númenor. So each scene takes the shape its own words call for: *The Silmarils are recovered* remakes the round world (`ROUND_WORLD`, `cosmosJewels.ts`), *The Two Trees are rekindled* and *The Mountains of Valinor are levelled* return to the flat map of the Elder Days (`ELDER`), because they bring back the Trees and the Pelóri, and the Second Music is a dream of the world, not a map. We don't invent a shared "remade" land state; instead each of the three events carries a `note` (an optional `{ en, es }` text on any event, for where the sources disagree or are silent) that says so plainly, shown first in *About this scene* and under the summary on the event's page, and its `event.yaml` has a comment pointing here.
- **One scene per event**, so the strongest moments can each be animated: Morgoth returns through the Door of Night; the Sun and the Moon are destroyed; the Last Battle is gathered; Túrin slays Morgoth; the Silmarils are recovered; the Two Trees are rekindled; the Mountains of Valinor are levelled; the Second Music of the Ainur (arc *The End of Days*).

### 4.9 Factions: sides in battles

A **faction** is a host that fights as one body under its own banner: `content/factions/<id>.yaml` with a name (plural, as a host is named: *Elves of Mirkwood*), a banner `color`, a `kind` (a character kind: elf, man, dwarf, goblin, orc, wolf, eagle…, which also shapes its army's figures), a short summary and its `leaders` (character ids). Factions are reused across battles: the Dwarves of the Iron Hills fight at Azanulbizar under Náin and at the Five Armies under Dáin.

- **A battle lists its sides** in `event.yaml`: `sides`, a list of at least two groups of allied faction ids, each against the others. It says who fought together in the end (at the Five Armies, the dwarves who nearly fought the elves and men are on their side). The build validates the ids (each faction on one side only), and derives `index.byFaction`, each faction's battles in story order.
- **Who is a faction, who a character:** one being who comes alone is a character with his own track (Beorn at the Five Armies). A host is a faction even with a named leader (the Eagles of the Misty Mountains, led by their Lord). A small band whose members all have tracks may still be a faction, so the sides are said in full (Thorin's Company), but needs no army.
- **Armies** (`armies` in `staging.yaml`): `{ faction, size: small | medium | large, keyframes: [{ t, x, z, action? }] }`, the faction on one of the event's sides. Keyframes place the army's centre; unlike a character's, an army keyframe's `action` says what it does **on the way to** that keyframe (walk or run there; idle or fight where it stands). It faces the way it last marched, wheeling round when it turns (§2, battles).
- **On the site:** event pages give the sides in the meta lines (*Men of Dale and Dwarves of Erebor against Easterlings*) and a **The sides** section with each faction's summary and leaders (names open their lives); the time cursor's event rows add the sides line; the sidebar's search lists matching factions with their battles (`src/sides.ts`). No new rail item: factions are a way into battles, not a view of their own.

### 4.10 Arcs that tell: narration at the scale of a map (#88)

The three zoom levels were defined together (§2), but only two of them ever had anything to say.
The cosmos tells the shaping of the world and a diorama tells one scene; the world between them
was a floor to cross on the way down — a map with markers, and no voice. Meanwhile narration
lived only inside events, and an arc was three fields: an id, a title and a line of summary, with
its list of events derived by the build. Arcs grouped scenes and said nothing of their own.

**The world view's content is narration at arc scale.** How a war moved across a country, where a
host marched, which road the survivors took, how long a city stood before it fell: told over the
map of its age, with the arc's own scenes pinned on it as diamonds a visitor drops into. The three
levels become three scales of storytelling rather than three distances from the ground.

| Level | Tells |
|---|---|
| cosmos | the Music, the shaping and unmaking of the world |
| **world** | **how a war moved across a country** |
| diorama | what happened in one place on one day |

**This cannot be an event.** One event is one scene (§4.1), and a map-scale overview is by
definition not one scene — it is the thing the scenes are cut out of. Forcing it into an event
would either break that rule or invent a fourth content kind. It belongs to the **arc**, which
already is exactly "several scenes that belong together", and which gains a `narration.yaml` and
a `staging.yaml` of its own.

Almost nothing new is needed underneath. `EventClock` maps seconds ⇄ `t` without caring what it
is timing; the recordings, the `textHash` staleness and the two languages work as they do for an
event; `framingAt` already sweeps an authored view across ground; `Stage` plus `buildStage`'s
dynamic `import()` is how a level is added as its own chunk. Genuinely new are **one set** (the
map) and **one scale** for the hosts.

#### The shape of an arc

An arc that is only a grouping stays what it is: one flat file, `arcs/<id>.yaml`. An arc that
gains a telling has several files, and so becomes a folder, exactly as an event does:

```
arcs/the-war-of-the-ring.yaml          a grouping: nothing more to read
arcs/the-fall-of-gondolin/
  arc.yaml           the same fields as the flat file, plus status, sources, beats
  narration.yaml     the script, passage by passage
  staging.yaml       the map, the framing, the hosts, the roads, the scenes
  audio/<lang>.mp3   a recording and its timing, exactly as an event's
  audio/<lang>.yaml
```

The build reads both forms and refuses an arc that exists as both. Twenty-five arcs with one
folder each, twenty-four of them holding a single file, would be churn bought with nothing; a flat
file **promotes** to a folder the day somebody writes its telling. The id stays the id, so
nothing that links to the arc changes.

The **status pipeline is the same four words** (§4.3), and means the same thing — the build checks
an arc has the files its status claims:

| Status | Has | Meaning |
|---|---|---|
| `outline` | `arc.yaml` (or the flat file) | A named group of scenes, with a summary. All of today's arcs. |
| `scripted` | + `narration.yaml` | The overview is written; it can be read as text. |
| `staged` | + `staging.yaml` | It plays over the map, with placeholder geography. |
| `animated` | the age's finished map | Final map geometry and a recording. |

An arc's status is **independent of its events'**. That is the point rather than a concession: an
arc can be staged while every scene in it is still an outline, so a visitor can watch how Gondolin
fell long before any of its scenes has a diorama — and conversely a finished diorama needs no
arc telling to be watched. The derived `events` list is unchanged, and stays the build's.

**Who reads it.** A voice belongs to an age (§5), so an arc is read by the narrator of the age of
its **first event in story order**: that is where the telling opens, and a telling has one voice
from its first word. Where an arc's events span ages — *The Age of Men*, *After the War* — somebody
has to choose, and the choice should be visible, so `narratedBy: <age id>` on the arc says which
age's voice tells it. The build warns when an arc whose events cross an age boundary leaves it
out. An arc never gets a voice of its own: that would be a narrator per story, which §5 decided
against.

An arc's narration ids live in their own namespace (`arc/<id>` in `out/narration/`), and the build
refuses an arc id that collides with an event id, so the pipeline can never record one over the
other.

#### `staging.yaml` at map scale

```yaml
map: beleriand                 # which map: beleriand | middle-earth | aman | numenor
duration: 110                  # seconds, when there is no recording
narration: { hidden: 0, treason: 0.26 }      # every passage id, rising — as an event's
beats: { assault: 0.4 }                      # every beat id from arc.yaml
camera:
  - { t: 0, x: 6, z: 24, width: 54 }         # the whole of Beleriand
  - { t: 0.4, x: 8, z: 24, width: 16 }       # in on the Encircling Mountains
scenes: { fall-of-gondolin: 0.42 }           # which events the telling reaches, and when
hosts: [ ... ]                               # bodies of people moving over the country
roads: [ ... ]                               # journeys drawn as painted road
```

**The framing is `camera`, unchanged** — the same `{ t, x, z, width }` keys, eased the same way,
with `width` in map units instead of tile units (§9.3). A sweep from Hithlum to Angband is the
same authored move as a push in through Bag End's door, at a different scale, and inventing a
second vocabulary for it would only mean two things to keep in step. The same rule holds with it:
the view is the author's, the stage never moves its own camera, and a visitor's pan and zoom
survive as an offset.

**There is no `light`, no `reveal` and no `sound`.** A map is not a place and a country has no
hour: the bargain §9.5 strikes — ambience is a pure function of place and hour, so every staged
event in a listed place is heard for free — has nothing to bite on here, and a map has no lid to
lift. So an arc's telling carries the voice and nothing else, the way the cosmos is silent
(§9.5): what a war sounds like from four hundred miles up is a decision somebody should make on
purpose. The map's own look belongs to the map, one per age, not to each telling.

#### `hosts`: a body of people at map scale

A tile `army` (§4.9) is a block of small figures with a `size` that means a count of them and
actions — `idle`, `walk`, `run`, `fight` — that describe what a figure's legs are doing. None of
that survives the change of scale: across a country a host is not figures, it is a **mark on a
map**, and a thousand orcs and ten thousand differ in how much of the country they fill, not in
how many bodies can be counted. So the map gets its own key and its own closed vocabulary, and
`armies` stays honest at tile scale. Reusing it would make `size` mean two things and leave the
renderer guessing which scale it was in.

```yaml
hosts:
  - faction: host-of-angband     # a faction (§4.9): its banner colour and name
    mark: column
    weight: 4
    keyframes:
      - { t: 0.26, at: angband, action: hold }
      - { t: 0.40, x: 7, z: 17, action: march }      # over the northern heights
      - { t: 0.44, at: gondolin, action: fight }
  - label: { en: The survivors of Gondolin, es: Los supervivientes de Gondolin }
    color: "#8fb6c8"
    mark: trickle
    weight: 1
    keyframes:
      - { t: 0.64, at: gondolin, action: hold }
```

- **`faction` or `label`, never both.** A fighting side is a faction and takes its name and banner
  colour from its file, so the map, the battle pages and the time cursor say the same words. But
  much of what moves across a map is not a side in a battle — refugees out of a burning city, a
  migration, a fleet of exiles — and a faction file for them would claim they fought something. A
  host may instead carry its own `label` and `color`.
- **`mark` is how it is drawn**, from a closed list the build checks, exactly as the sound cues are
  checked (§9.5): a mark the renderer cannot draw would silently be nothing on the map.

  | `mark` | Drawn as | For |
  |---|---|---|
  | `column` | a thickening line with a head | an army on a road or through a pass |
  | `mass` | a block sitting on the ground | a host encamped, a siege, a city's defence |
  | `swarm` | scattered, no front | orcs loose over a countryside |
  | `trickle` | a thin thread | refugees, a small company, a migration |
  | `fleet` | a mark on water | ships |
  | `flight` | a mark above the ground | eagles, dragons |

- **`weight`, 1 to 5**, is how much of the country the mark fills. Not a number of soldiers: the
  sources rarely give one, and a figure invented for a renderer would be a precision the content
  is not allowed to claim (§4.4 applies to numbers as much as to dates).
- **A keyframe may carry its own `mark` or `weight`**, and changes the host's from there on. A
  column that arrives and becomes a mass besieging a city is the commonest thing on a map, and
  the alternative — two hosts, one appearing exactly where the other stops — would make a single
  body of people read as two.
- **A keyframe names a place, not a number, wherever a place exists**: `at: angband`, and the map
  already knows where that is. Authoring a march as a list of place ids is both easier to check
  and easier to read than coordinates, and it survives the map's geometry being redrawn.
  `x`, `z` are for a point that is no place — a river crossing, a pass with no file of its own,
  open sea — in the map's own units. Exactly one of `at` or `x`/`z` per keyframe.
- **`action` says what the host does on the way to that keyframe**, as an army's does (§4.9):
  `march`, `ride`, `sail`, `fly`, `flee`, `hold`, `fight`, `fade`. `hold` and `fight` happen where
  it stands; `fade` is a host that is destroyed or disperses, the mark thinning to nothing where
  it is. A host before its first keyframe is not on the map at all, which is how one arrives.

Everything here is a pure function of `t`, like a tile army's formation: where a mark is, how thick
it is and whether it is on the map at all are read from the keyframes alone, and `ambient` may only
add the crawl of a column, never move it.

#### `scenes`: the arc's own events on the map

The diamonds are **not authored**. Every event of the arc is already derived, carries a `place`,
and the place carries coordinates, so a pin per scene costs nothing to write and cannot drift out
of step with the content. What the staging says is only **when the telling reaches each one**:

```yaml
scenes: { maeglin-betrays-gondolin: 0.26, fall-of-gondolin: 0.42 }
```

An event listed here lights at its `t` and stays lit — a filled diamond, the same mark the sidebar
uses for a scene that can be watched (§3.3). An event of the arc that the telling does not stop at
is drawn hollow from the first frame, as an unstaged event is listed hollow: *there is a scene
here, but these words are not about it*. The build checks every id in `scenes` is an event of that
arc, and that the `t`s rise in the arc's own story order, so a telling cannot claim the city fell
before it was founded.

**Clicking a diamond is ordinary navigation**, which is what makes it safe mid-telling. The arc
pauses, the link is `#/event/<id>?from=<arc>`, and because the arc's own route carries its `t`
(below) the entry left behind in the history is the exact moment the visitor left. Back — and the
*← Back to The Fall of Gondolin* link the event shows when it was opened from an arc — returns to
the arc at that moment, paused, ready to play on. Nothing is remembered anywhere but the URL,
which is the rule the rest of the site already keeps (§7).

#### `roads`: journeys drawn inside the telling

A journey is already an ordered list of dated stops (§4.6), and an arc's telling is usually about
a road: the flight out of Gondolin, the march of the Last Alliance, the Ring going east. So a
journey is drawn **inside the arc's staging**, not in a view of its own:

```yaml
roads:
  - { journey: the-flight-from-gondolin, from: 0.64, to: 0.9 }
```

Between `from` and `to` the road paints itself along the journey's waypoints in order; before
`from` there is nothing, after `to` the whole road stays. The events the build has already matched
to waypoints sit on it as the diamonds they are, and **a leg with no event is plain road** — which
is the real reason to draw it this way. The map then says, in a picture and without a word of
complaint, which parts of a journey we have told and which we have not: a stretch of road with
nothing on it reads as a road not yet walked, not as a gap in the project. `gandalfs-road-3018`
is seven waypoints with events on a few of them, and it should look like that.

A standalone **journey view** — *There and Back Again* end to end, outside any arc — is a separate
feature and not designed here; when it comes it should draw the road exactly as `roads` does
rather than grow a second vocabulary for the same line.

#### The map, and what this section depends on

An arc plays on **one of the maps** (`MAP_IDS`: `beleriand`, `middle-earth`, `aman`, `numenor`),
named by `map:`, and framed by its `camera` keys. Everything above needs exactly two things of
the map: that it has a name, and that **a place has coordinates on it** — `map: { on, x, z }` in
`content/places/`, in the same ground plane a tile uses (`x` east, `z` south), one unit ten miles
(`docs/MAP.md`). Nothing else here depends on the geography, so an arc's `camera`, `hosts` and
`roads` survive the map being redrawn at the same coordinates. The build should check that every
place used by an arc's events, hosts and roads has an entry for the map the arc names: a telling
that cannot place half its scenes is an error, not a map with holes in it. A place that is
`nowhere` on every map cannot carry a diamond, and an arc whose scenes are all nowhere has no
business being staged at this level.

The geography is drawn as original low-poly geometry at those coordinates, in the same visual
language as the tiles (§9), and can be replaced later **at the same coordinates**, because the
coordinates were never the drawing (§10).

#### Route, and what this is deliberately not

```
#/arc/the-fall-of-gondolin?t=0.42&lang=es&audio=en
```

The arc's telling is the world level's route, and `t` behaves exactly as an event's: scrubbing and
seeking replace the current history entry, opening a scene or another view adds one, and a fresh
deep link lands on the composed view at that moment (§7). An arc with no `narration.yaml` has no
route of its own — it stays a card in the sidebar's **Stories** view (§3.3), which gains *Watch
this story over the map →* on the arcs that have a telling. There is no `follow=` at this scale:
following a mark on a map is not following a life.

**The worked example** is `content/arcs/the-fall-of-gondolin/` — a `narration.yaml` of ten
passages and a `staging.yaml` with the framing, three hosts (Morgoth's by faction, the refugees
and the eagles by label), the two roads and the seven scenes the telling stops at, out of the
arc's thirteen. The build does not read `arcs/<id>/` yet, so the folder is ignored and the arc is
still its flat file; the folder's own `README.md` says what the build has to learn to accept it.

**The time cursor and the lanes gain nothing from this, on purpose.** An arc's `t` is narration
time, not history: one passage may cover four hundred years of a hidden city and the next a single
night, and the clock stretches to the reading, not to the calendar. Putting a telling on the time
axis would mean giving its passages dates we would then have to defend, and the axis already has
the arc's events on it, each at its own honest range. So an arc is not on the axis, no passage
carries a date, the cursor does not list arcs among what is happening at a moment, and `index.lanes`
is untouched. The one join worth having costs nothing and already exists in both directions: an
arc's telling links to the time cursor at its first event's moment, and an event opened from an arc
keeps its own *See this moment on the timeline →*.

### 4.11 Parentage: the one edge a family tree is drawn from (#89)

`kin` was written for one job and does it: it suggests whose lane to open beside another's
(§3.2). It cannot draw a tree, for four reasons that are worth stating because each one decides
something below. It records the **derived** relation instead of the primitive one (`brother`,
`cousin`, `nephew`, where a tree needs only *child of*); its `as:` vocabulary is **open and
unchecked**, so `father`, `sire` and `padre` would all pass; the build derives **no reverse**, so
which way round a pair was written is arbitrary; and `cousin` and `kin`, a sixth of the entries,
carry **no generation at all**, so nothing can place them in a band.

**One primitive edge: `parents`.** A tree is built from *child of* and nothing else.

```yaml
parents: [ thingol, melian ]     # 0, 1 or 2 known parents; order carries no meaning
```

Why a list, and not `father:` / `mother:`:

- **Characters have no gender field, on purpose.** §3.2 leans on that: Spanish takes its gender
  from the relation word, and says the gender-neutral ones without guessing. `father:` and
  `mother:` would bring gender in through the back door and then demand it be known for every
  parent in the content.
- **One named parent is a common and honest case** — Melian and Lúthien's line, the many
  characters whose mother the texts never name — and with a list it needs no special writing: you
  list the parent you were told about. With two keys, *the sources do not name her* and *we have
  not written her file yet* would be the same missing key.
- **Order is not meaning**, so nobody has to remember a convention. Couples are drawn from
  `spouse` (below), not from the order of this list: two parents who are also spouses are drawn as
  a couple with their children under the tie, and two who are not are drawn as two stems meeting.
- There is no placeholder for an unnamed parent, and none is wanted. A box with nothing in it is a
  claim about a person we know nothing about; the tree draws a single stem instead (§3.6).
- **Fíli and Kíli settle it from the other side.** They reach Thorin only through Dís, their
  mother and his sister, and the sources never name her husband. With a list, `parents: [ dis ]`
  is the whole truth and the tree draws one stem up to Dís and on to Thráin. With `father:` and
  `mother:`, the two nephews whose uncle leads the company would need an empty `father:` to say
  nothing at all.

**Everything else is derived by the build, never authored.** Children, siblings, half-siblings
(one shared parent, flagged), ancestors, descendants, cousins, uncles, nephews, generation depth
and the houses themselves are all consequences of `parents`, and are derived at build time into
`index.json`, exactly as a character's events and a place's events are (§4.1). Authoring any of
them would be writing the same fact twice and inviting the two copies to disagree. **This is the
rule, not a guideline:** if a relation can be computed from parentage, it is not a field.

**Spouses are their own key, because a tree draws couples and marriage is not descent.**

```yaml
spouse: [ miriel, indis ]        # in the order they were married
betrothed: [ ]                   # a betrothal that never became a marriage
```

A list rather than one id, and Finwë settles that on his own: Míriel, then Indis. The list order is
the order they were married, which is the order the tree draws them in. `betrothed` stays in the
format because the books do have betrothals that end otherwise, but it is rare: Beren and Lúthien,
Tuor and Idril, Aragorn and Arwen, Faramir and Éowyn all married, so all four are `spouse`.
Both keys are **symmetric**, and the build derives the other side and marks it `reverse: true` —
the precedent is event links (§4.5), written once and reversed by the build.

**`kin` survives, narrowed to exactly what parentage cannot say.** The vocabulary becomes a
**closed list the build checks**, like the sound cues and a kit's cover names (§9.5, §9.4), because
a word the view cannot draw is silently nothing on the screen:

| `as` | What it means | Why it cannot be derived |
|---|---|---|
| `ancestor` / `descendant` | the books assert the descent, and the generations between are not in our content | real and unfakeable: *a descendant of Durin* with eight unwritten links in between must not be invented as eight placeholder people |
| `cousin` | the books call them kinsmen of one generation, and we cannot reach a common ancestor in our data | it is said on the site and drawn as a dotted tie; once both lines reach a shared ancestor, the derived relation replaces it |
| `sibling` | the books say plainly that two people are brother or sister, and name no parent of either | Bofur and Bombur are brothers in the published *Hobbit*, and no source names a parent of either. Without this word a sourced fact would have to be downgraded to `kin` or an unnamed parent invented to hang them from, and inventing people is exactly what this format refuses |
| `kin` | related, and the sources say no more | the honest vague word, and worth keeping for that |
| `foster-parent` / `fosterling` | raised them, or was raised by them | **not descent at all**, and the texts care about it enormously: Túrin in Thingol's halls, Aragorn in Elrond's, Frodo as Bilbo's heir |

A `kin` tie is drawn as a dotted tie, never a stem, and never counts as a generation. So fostering
can sit in a tree without pretending to be blood.

**The decisive case is already in our content, and it is `as: kin`.** `dori`, `nori` and `ori`
carry that word today, and it is the most accurate entry in the whole set: Appendix A says only
that they are of Durin's race and remote kinsmen of Thorin, and gives no parentage at all for them
or for Bifur, Bofur and Bombur. **Six of the thirteen dwarves of Thorin's Company therefore have
no computable place in any tree** — and they are not obscure names in a table, they are six
characters the project has already written and will certainly stage. A parentage-only model would
drop them out of a view of Durin's line in silence, which is the worst way for content to go
missing: nothing on the screen says anybody is absent. With `kin` they hang off the line as six
dotted ties saying exactly what the book says, *of Durin's race, kinsmen of Thorin, and no more
than that*. That is the argument for keeping the field: not a vague-relation escape hatch, but the
only honest way to draw a company half of whose members the sources leave unplaced.

**Twins are their own key, because parentage cannot reach them.** Twins have exactly the same
parents as any other siblings, so twinhood is **unrecoverable from the edges** — and for Elladan
and Elrohir it is very nearly the only thing the texts ever say about them. So:

```yaml
twin: elrohir                    # on Elladan; symmetric, and the build adds the reverse
```

- **One key, a single id**, symmetric like `spouse`, with the reverse derived and marked
  `reverse: true`. The texts have no triplets, so a list would be a shape kept ready for nobody;
  it can become one later without changing a drawn thing.
- **Not a `kin` word.** The closed list above is for relations that are *not* descent and are
  drawn as a dotted tie outside the generations. A twin **is** a sibling, derived as one from
  `parents` and standing in that band; twinhood only refines it. Putting it in `kin` would draw
  Elladan and Elrohir as cousins-by-another-name and leave their real sibling edge beside it,
  saying the same thing twice in two different shapes.
- **Not `twins: [[a, b]]` on the parent.** It would put a fact about two people in a third
  person's file, and a pair whose parent the sources never name — which is exactly the Dís case
  above — would have nowhere to live.
- **The build checks** that a twin shares at least one parent with their twin (otherwise it is an
  error, not a drawing), that the pair is mutual, and that nobody is their own twin.
- **In the view** (§3.6) the geometry barely moves, and should not: a generation row already puts
  siblings side by side, so the fact belongs in the words. The one cheap bit of drawing worth
  having is that the two stems leave the parents' tie at a single point before splitting, which
  reads as *born together*; the card says the rest. Our three pairs are Elladan and Elrohir,
  Amrod and Amras, and Eluréd and Elurín, and none of the five has a file yet, so nothing needs
  migrating.
- **In both languages**, by the convention `kinPhrase` already keeps for relations whose gender we
  do not store (§3.2): English *{a}, twin of {b}*, Spanish the gender-neutral plural *{a} y {b},
  gemelos*, exactly as `kin_sibling` and `kin_cousin` are written. Spanish also has *mellizos* for
  twins who are not identical; the sources never say which these are, so we use the ordinary word
  and claim nothing more.

#### Migration: what happens to the thirteen words in use

Thirty-six files carry `kin` today. Each word has one answer:

| In use | Count | Becomes |
|---|--:|---|
| `father`, `son`, `grandfather`, `grandson` | 20 | a `parents:` entry on the child (and, for the grandparents, on the parent in between) — then deleted |
| `brother`, `sister` | 15 | nothing of its own: `parents:` on both, and the build derives the sibling edge, half-siblings included — or `as: sibling` where no source names either parent |
| `uncle`, `nephew` | 5 | nothing of its own: derived from `parents:` once the sibling in between has them |
| `wife`, `husband` | 4 | `spouse:` on either side (the build reverses it) |
| `betrothed` | 1 | `spouse:` — Aragorn and Arwen marry; the field is for betrothals that did not |
| `cousin` | 10 | `parents:` on both where the common ancestor is in our content (Húrin and Huor are brothers, so Túrin and Tuor are derived exactly); **kept as `kin`** where it is not |
| `kin` | 6 | kept as it is |

**The build's voice during the migration, and after.** The plan here was for the closed
vocabulary to ship as a **warning** naming the exact replacement for the word it found (*`as:
brother` is derived from `parents:` now — put Húrin's parentage on both and delete this*), and to
become an error only once the last file was migrated, so that the content change need not ride in
the same commit as the format. **That plan could not survive this repo, and it was right not to.**
`tests/build.test.ts` asserts that the real content is valid *with no warnings*, so a warning is
every bit as blocking here as an error, and the staged state was never a state the repository
could be in. The vocabulary is therefore an **error** from the day it shipped, the thirty-six
files were migrated in the same change, and the replacement-naming message does its work in the
author's terminal rather than in a tolerated warning. The lesson is worth keeping written down:
the zero-warning test had already decided this question, and the design did not think to ask it.
An error it must be in any case, because two statements of the same fact that can disagree are
worse than either. The build also warns when a `kin` entry is *derivable
from the parentage already authored* — that warning is how the migration finds its own end, and it
stays useful afterwards, since it catches a `cousin` that became computable when somebody wrote the
missing grandparent's file.

The lanes change as little as possible. `kinPhrase` keeps its templates and is now fed the
**derived** relation as well as the authored one, so *Thráin, father of Thorin Oakenshield* reads
the same while coming from `parents:` instead of `kin:`; the gender-from-the-word rule (§3.2) is
untouched. The suggestions get better by themselves, because the derived graph knows siblings and
nephews for everyone with parentage, not only for the pairs somebody remembered to write down.

#### Dates: `born`, `died`, and the event that says so

Characters have no dates at all today, and births and deaths exist only as events. Both halves of
that are kept, with one checked against the other.

- **An event says whose life begins or ends in it.** `event.yaml` gains optional `born:` and
  `died:`, lists of character ids that must be among the event's own `characters`. The build then
  derives that character's date from the **event's honest range** (§4.4), at the event's own
  precision. *The birth of Túrin* is dated to F.A. 464 to the year, so Túrin is born in F.A. 464,
  no better and no worse.
- **A character may state a date the content has no scene for.** `born:` and `died:` on a
  character take the same shape as a journey's waypoint — a date in the §4.4 vocabulary and its
  own precision:

  ```yaml
  # content/characters/thrain.yaml — Appendix A dates him; no scene of ours is his birth or death
  born: { date: { age: third-age, year: 2644 }, precision: year }
  died: { date: { age: third-age, year: 2850 }, precision: year }
  ```

  Appendix A dates most of Durin's line and every king of Númenor, and almost none of them will
  ever be a scene. Refusing those dates to keep one mechanism would make the tree poorer for
  nothing. This is not derived data authored by hand: no other file holds these facts.
- **When both exist they must agree.** A stated date that falls outside the honest range of the
  event that claims the birth or death is an **error**, not a quiet preference for one of them.
  That check is the reason two sources of truth are safe here.
- **No heuristic, ever.** Recognising a birth or a death from the title was the obvious shortcut
  and is a trap: it would have to work in two languages, and the real folder names show how it
  would go — `nienor-is-born` says nothing about *born* in Spanish, `the-passing-of-king-elessar`
  is a death that never says so, and `celeborn-leaves-middle-earth` is not a death at all. The
  event declares it or the character does.
- **Silence is silence.** No `died` means the sources do not say they died, and the tree draws no
  end: **an elf who is never said to die is never drawn as dead.** A stem simply runs on.
- **`fate: { en, es }`** is one sentence for a life that ends in something other than a death — a
  choice of mortality, a passing over Sea, a return out of Mandos. It is where the Choice of the
  Half-elven is written down, and it is why §3.6 can say what the diagrams cannot.
- **No date is ever inferred from a generation.** A father is not given a date because his son has
  one, and a tree never estimates. §4.4's discipline covers this: the best guesses are for placing
  events on an axis, and a tree has no axis to place anybody on.

#### What the build checks

Unknown ids, as everywhere. A character listed as their own parent, spouse or `kin`. More than two
`parents`. A **cycle** — nobody is their own ancestor. A `spouse` who is also a parent or child of
the same character. A `kin` word outside the closed list, and a `kin` entry already derivable from
parentage (both warnings until the migration ends, then the first becomes an error). `born` after
`died`. A `born`/`died` on an event naming a character the event does not list. A stated date
outside the honest range of the event that claims it. A parent whose honest range of birth begins
after the child's ends — a warning, not an error, because honest ranges are wide on purpose and
two vague years often overlap.

#### A house is not a content kind

"The House of Finwë", "Durin's Folk", "the Line of Elros" could be files like `content/factions/`
(§4.9). They should not be. A faction file exists because a host has things a battle needs and
nothing derives: a banner colour, a `kind` that shapes its figures, leaders, and a side to be on.
A house file would hold a name, a summary and a list of members — and the list must be derived
from `parents` or it will go stale, the summary is already the founder's own `summary`, and the
name is a template: *The House of Finwë* / *La Casa de Finwë* in `src/i18n.ts`, which is right for
most of them. So the house stays the parentage graph, and the one thing a template cannot give is
the one authored field:

```yaml
house: { en: Durin's Folk, es: El Pueblo de Durin }   # on the founder, where the books name it otherwise
```

The books call it *Durin's Folk*, not *the House of Durin*, and the site should use their words. If
we later want an editorial paragraph per house, it can be added without touching a single edge —
which is the test that this is the right way round.

#### The worked example

The house of Finwë, carried down to the half-elven crossing. These are fenced here and **not
written into `content/characters/`**: the build does not know these keys yet, and content files
nothing reads would be a trap for the next author.

```yaml
# content/characters/finwe.yaml
id: finwe
name: { en: Finwë, es: Finwë }
kind: elf
summary:
  en: First King of the Noldor, who led them from Cuiviénen into the light of the Trees.
  es: Primer rey de los Noldor, que los guio desde Cuiviénen hasta la luz de los Árboles.
spouse: [ miriel, indis ]          # Míriel first; after her death, Indis
house: { en: The House of Finwë, es: La Casa de Finwë }

# content/characters/feanor.yaml
id: feanor
parents: [ finwe, miriel ]
# no `born:` here: `birth-of-feanor` already says it, and the build takes Y.T. 1169 from that event

# content/characters/fingolfin.yaml
id: fingolfin
parents: [ finwe, indis ]          # a half-brother to Fëanor: the build derives it, and says so
spouse: [ anaire ]

# content/characters/galadriel.yaml
id: galadriel
parents: [ finarfin, earwen ]      # Finarfin is Indis's son too, so she is Fëanor's half-niece
spouse: [ celeborn ]
fate:
  en: She did not die; at the end of the Third Age she took ship over Sea.
  es: No murió; al final de la Tercera Edad se embarcó hacia el Oeste.

# content/characters/idril.yaml
id: idril
parents: [ turgon, elenwe ]
spouse: [ tuor ]                   # a marriage of Elves and Men, the second of the three

# content/characters/earendil.yaml
id: earendil
parents: [ tuor, idril ]
spouse: [ elwing ]

# content/characters/elros.yaml
id: elros
parents: [ earendil, elwing ]
kind: man                           # the same parents as Elrond, and another kind: that is the point
fate:
  en: Given the choice of the Half-elven, he took the fate of Men, and was the first King of Númenor.
  es: Puesto ante la elección de los Medio-elfos, tomó el destino de los Hombres, y fue el primer rey de Númenor.
# no `died:` here either: `death-of-elros` carries it, to the year

# content/characters/elrond.yaml
id: elrond
parents: [ earendil, elwing ]
kind: elf
spouse: [ celebrian ]
fate:
  en: He chose the Elves, and stayed while his brother's house rose and fell in Númenor.
  es: Eligió a los Elfos, y permaneció mientras la casa de su hermano se alzaba y caía en Númenor.

# content/characters/arwen.yaml
id: arwen
parents: [ elrond, celebrian ]
spouse: [ aragorn ]                 # today's `kin: [{ id: aragorn, as: betrothed }]`: they marry
fate:
  en: Like Lúthien before her, she took a mortal life, and her own choice closed the long sundering.
  es: Como Lúthien antes que ella, tomó una vida mortal, y su elección cerró la larga separación.
```

```yaml
# content/events/first-age/0503-1-birth-of-earendil/event.yaml  (the one added line)
characters: [ tuor, idril, earendil ]
born: [ earendil ]
```

Everything a tree needs is in those edges. From them the build derives that Fëanor and Fingolfin
are half-brothers; that Galadriel stands one band below Fëanor and is the contemporary of his
grandchildren; that Elros and Elrond are brothers of two kinds; and that Aragorn and Arwen's
nearest common ancestor is Eärendil — the sentence §3.6 puts under the two of them, and the reason
the view exists.

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
- **One narrator per age.** Each age names its narrator (`narrator:` in `content/ages/<age>.yaml`), and every event of that age is read by it: the history of the world told as fact, plainly and with weight, never as a children's story. The book doesn't change the voice (*The Hobbit* and *The Lord of the Rings* share the Third Age's), and characters have no voices of their own. A narrator (`content/narrators/<id>.yaml`) has a voice per audio language, designed once at audition from attributes, then cloned in every recording from our own reference sample, committed next to it. A narrator is never a real actor's voice. Spanish voices speak **Latin American** Spanish (seseo), so Spanish narration avoids forms only Spain uses (*vosotros*); none of today's scripts use them.
- **Recordings are made by the pipeline** on the homelab Voice Studio (`docs/LOCAL.md`). `npm run narration:render` renders each passage on its own, with names respelled from `content/pronunciation.yaml`. Every take is checked automatically: words heard against the script, names, pace against the narrator's median, length, clipping and silences. A flagged take is retried with a new seed, and all takes are cached, so an edited passage re-renders alone and a failed run resumes. The author listens to every flagged take plus a random sample, on a report page. `npm run narration:publish` then joins the passages with a fixed gap and writes `audio/<lang>.mp3` and `.yaml` with exact `starts`, the `narrator` and version, and a hash per passage. The build names exactly which passages went stale. Keep the spoken words identical to the passage text. Design: `docs/superpowers/specs/2026-11-10-narration-voices-design.md`.
- **Scripts out, recordings in.** `npm run narration:export` writes each event's script per language to `out/narration/<event>/<lang>.{txt,json}` for the Voice Studio, with a `textHash` of the text. The hash goes back into `audio/<lang>.yaml` with the recording, and the content build warns when `narration.yaml` no longer matches it (a stale recording). `--changed` exports only what needs (re)recording. Format in `content/README.md`.
- **Who reads which age, today.** `the-lady` reads the Third Age; `the-elder` reads Before Time and,
  provisionally, the Years of the Lamps, the Years of the Trees, the First Age, the Second Age and what
  is foretold. He is the one who was there before anything began, so he can honestly tell every age
  before the Third, and the world opens and closes in one voice. Designing a distinct voice for the
  Elder Days needs an audition, which is a listening choice; until someone makes it, these five ages
  are one line each in `content/ages/`. The Fourth Age has no staged event yet and so needs no voice.
- No cloned voices of real actors.

## 6. Languages

- English is the default; Spanish is the second language. Adding one = add its code to `LANGS` in `src/data/types.ts`, then its interface strings.
- Every content text is `{ en, es }`. English is required; missing languages fall back to English, and the build reports what's missing.
- Names follow the published translations (Bilbo Bolsón, Bolsón Cerrado, Thorin Escudo de Roble).
- Interface strings live in `src/i18n.ts`.
- The language comes from `?lang=` in the URL, then the visitor's last choice, then English. Following a link with `?lang=` switches the open tab to that language; a link without one keeps the current language.
- **What you hear is apart from what you read.** `?lang=` is the reading language (text and interface); `?audio=` is the recording that plays, or `off`. Without `?audio=`, the reading language's recording plays if there is one, else the English one, else none (`pickAudio` in `src/audioChoice.ts`). So Spanish text can ship before Spanish voices, and a visitor can read Spanish while hearing English. The clock follows the recording that plays; text in another language appears as its passage starts in that recording. A small button beside the sound control shows and switches the voice's language when there is a choice. Muting is `audio=off`: the event keeps the staging's own pace, and the place's own sound (§9.5) goes quiet with the voice.

## 7. Shareable moments

The URL always reflects where you are:

```
/#/event/ainulindale?t=0.42
/#/event/roast-mutton?t=0.45&follow=bilbo&lang=es
/#/event/tuor-sees-turin-at-ivrin?lang=es          an event that isn't staged: its page (§3.4)
/#/lives?with=tuor,turin                            character lanes, in this order (§3.2)
/#/kin/elrond?up=3&also=aragorn                     a family tree, grown and grafted (§3.6)
/#/time/third-age/3019-03-15                        the time cursor at a day (§3.1); …/3019-03, …/3019, …/3019-midyear
/#/time/first-age/495?zoom=age&from=fall-of-nargothrond   a whole year, at the age scale, opened from an event
/#/arc/the-fall-of-gondolin?t=0.42                   an arc's telling over the map of its age (§4.10)
/#/start                                            the opening over the cosmos (§3.5)
```

Moving to another event or view adds a history entry, so the back button returns; scrubbing and selecting only update the current one. A link to the event already on screen seeks to its `t` and follows its `follow`, when it gives them. Links inside the site are plain `href`s built in `src/routes.ts`.

After every navigation, focus moves to the new view's heading (its `h1`), so keyboard and screen-reader users start at the top of what they opened; redrawing the sidebar keeps focus on the control that had it.

## 8. Technical shape

- **Static site**: Vite + TypeScript + three.js, no framework. Output is a plain `dist/` folder (GitHub Pages).
- **Code is split by zoom level**: each stage (`scene/cosmos.ts`, `scene/dioramaStage.ts`) is loaded with a dynamic `import()` the first time it is needed, so the front page never downloads diorama code. Within the cosmos, each event's animation after the Ainulindalë is its own module (`scene/cosmosLamps.ts`, `cosmosTrees.ts`, `cosmosSunMoon.ts`, `cosmosBeleriand.ts`, `cosmosRound.ts`), picked by event id in `scene/cosmos.ts` and loaded the same way; all of them share the Void, the shells, the camera and small helpers (glows, names, fitting the camera to narrow screens) in `scene/cosmosWorld.ts`. The four after the Lamps also share `scene/cosmosLands.ts` (a chunk of its own): an original, simplified map of the lands on the slab after the Lamps (Aman behind the Pelóri, the Great Sea, Middle-earth with Beleriand, the Grinding Ice, the Encircling Sea; Beleriand drowned and Númenor raised in the Second Age), the faceted `Slab` they are drawn on (which can bend into a globe), forests and the Two Trees. The glTF loader (`scene/models.ts`: `GLTFLoader`, the meshopt decoder) is its own chunk too, fetched only when an event has a model. three.js core gets its own chunk (`manualChunks` in `vite.config.ts`), cached across deploys. Chunk budgets are checked by the build (`chunkBudgets` in `vite.config.ts`): every chunk of ours stays under 500 kB minified, and three.js under 600 kB, since it is one module and the loader needs its animation system and loaders (about 55 kB).
- **Content build** (`scripts/content/`): reads `content/`, validates it, and writes `public/data/` (generated, not committed):
  - `index.json`: ages, characters, places, arcs, journeys, factions, and every event's summary placed on the axis with links in both directions, plus lookups by character, place, arc, journey and faction (`byFaction`), each character's family (parents, children, spouses, siblings and half-siblings, with the reverses derived; §4.11), and each character's lane (events and uncovered journey legs, in story order; each waypoint also names the event it matched). Small enough to load up front; the time cursor and lanes run on it.
  - `events/<id>.json`: one per staged event, with narration, staging and audio timing, loaded when the event opens.
  - `scripts/<id>.json`: the narration passages of every event that has a `narration.yaml`, so a scripted event's page can show them as text.
  - `audio/<id>/<lang>.mp3`: recordings copied from the event folders.
  - `models/<path>.glb`: the models content points to, copied from `assets/` (§9, [`MODELS.md`](MODELS.md)).
- **Validation fails the build**: unknown ids, missing English, a status without its files, narration or beat ids that don't match their staging or audio timing, impossible dates, a missing or oversized model. Missing Spanish is a warning.
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
- **Light and mood carry the story**: time of day (the dawn that turns the trolls to stone), weather, warm interiors, colour grading per place. See §9.1.
- **Budgets**: models stay small enough for a static site on ordinary laptops and phones (compressed glTF, shared textures or flat colours, no Git LFS, since GitHub Pages doesn't serve it): a character ≤ 300 kB, a kit file ≤ 800 kB, a prop ≤ 100 kB after meshopt compression, checked by the build (`MODEL_BUDGETS` in `scripts/content/models.ts`).
- **Pipeline** ([`MODELS.md`](MODELS.md), #20): sources and exports live in `assets/` (`characters/<id>/<id>.glb`, optional `<id>.blend` beside it, never deployed; `kits/<kit>/`, `props/<id>/`). Export from Blender as glTF binary, Y-up, transforms applied, one scene per asset, no Draco; `npm run model:pack` compresses with meshopt (gltfpack) into `assets/`. A character's `model:` (and a track's per-event `model:` in `staging.yaml`) links it; the build checks it exists, is a loadable `.glb` and fits its budget, and copies it into the site.
- **In the diorama**: the placeholder figure stands while a model loads and whenever there is none or it fails; models are scaled to the placeholder's height times `Character.scale`, so relative heights stay in content. Clips named `idle`, `walk`, `run`, `talk`, `hide`, `fight` play for the pose sampled at `t`, with an `AnimationMixer` whose time is **set** from `t` each frame (never advanced by the wall clock), so scrubbing and deep links stay exact (#22); without clips the placeholder's motion stays.
- **Asset plan**: every model *The Hobbit* needs, with rig, priority and status, is listed in [`ASSETS.md`](ASSETS.md).

### 9.1 The render look (#76)

What makes a diorama feel like a made object rather than lit geometry. All of it is a pure
function of the event time `t` and the event's place, so scrubbing and deep links land on exactly
the same frame.

- **The light of the hour** (`src/scene/lighting.ts`): staging's `light:` keys name a preset from
  `dawn` to `night`, blended between keys. A preset now carries its air and its fill as well as
  its sun and sky.
- **A soft second light** (`fill`), from the viewer's side and above, that comes up as the sun
  goes down: nothing at midday, strongest at night. A night scene lit only by a weak moon and a
  hearth is atmospheric and unreadable — faces, gestures and half the set disappear. This is the
  lamp a model-maker puts beside the case. It casts no shadow, and it changes how well the scene
  can be seen, never what is happening in it. Decided 2026-11-15.
- **Haze with depth** (`fog`, `fogDepth`): air between the front of the tile and the back, tinted
  **toward the background, never toward a bright sky**. A diorama is a lit object on a dark field;
  air the colour of daylight makes its far edge glow and dissolve instead of recede. At its
  thinnest the far corner is about a fifth hazed, at its thickest about half.
- **A grade per place** (`src/scene/grade.ts`): the Shire warm and green, the wild damp and cold,
  Rivendell clear and silver, Mirkwood oppressive, Lake-town grey, Mordor without comfort. We
  grade **the light, not the pixels**: a post-processing pass would be a second render of the
  frame, a chunk of its own and the first thing to fail on a phone, while pulling the sun, sky and
  haze toward a place's colour costs nothing and cannot drift out of step with the shadows. A
  place whose grade takes light away gets more of the soft second light back, not less, so a cave
  is moody rather than unreadable. The background takes only a third of the tint, so the void
  around the tile stays dark. A place nobody has graded is `plain`: the light exactly as it was.
- **Shadows**: one sun, a shadow camera wrapped close around the tile, map size by quality.
  Under each figure a **contact shadow** — a soft disc on the ground, four triangles — because at
  this scale what tells the eye how big everything is is where a figure *touches*, not the long
  shadow behind it. Not ambient occlusion, and not pretending to be: a screen-space pass is the
  first thing that would fail on a phone.
- **A quality setting** (`src/scene/quality.ts`), `low` / `medium` / `high`, guessed from what the
  browser will say for free and overridable with `?quality=`, which is then remembered. It turns
  the shadow map, the pixel ratio and the counts of small moving things down together. Contact
  shadows and the haze stay on all the way down: the discs are nearly free and are the only thing
  holding figures to the ground once the shadow map goes, and the haze is a term in shaders
  three.js already compiles, so switching it off would buy nothing and cost the scene its depth.
  Measuring what a device can actually do, rather than guessing, is #30.

### 9.2 Where a figure stands (#81)

A figure is placed on the kit's `terrain` mesh, which is the walkable ground. That is one
height per (x, z), and it is the right thing to raycast: it is low-poly, it is one mesh, and it
cannot put a character on a table top by accident. What it cannot say is that a character is
standing **on** something the kit built above it.

- **`y` on a keyframe** (`src/data/types.ts`) is the author saying how high that surface is: the
  stump by the trolls' fire, the bench outside the Green Dragon, a doorstep, a bridge deck. It
  is interpolated like `x` and `z`, so a figure steps up and down. Staging already names an
  exact spot in a tile the kit built; this is the third number of that spot.
- **Nothing pushes figures apart at render time**, and nothing should: a figure's position has
  to stay a pure function of `t` alone for scrubbing and deep links to land on the same frame,
  and who stands in front of whom is a composition the author made, not a simulation to run. So
  crowding is a **build warning** (`crowding` in `src/timeline.ts`): two figures within a
  figure-width of each other at the same `t`, standing still or walking through each other,
  with figures offstage and figures on different levels left alone.
- **There is no sitting pose yet.** Until one exists, a seat is a place to stand beside rather
  than on, which is how the trolls and the Green Dragon's dwarves are staged. When one arrives
  it belongs with `y`: the pose puts the hips at a known height above the feet, and `y` is the
  seat's height less that, so the figure's weight lands on the seat.

### 9.3 How a scene is framed (#28)

For a long time every diorama was seen from one fixed wide shot holding the whole fourteen-unit
tile. That is right for a scene played across a hillside and wrong for one played in a room: at
that distance a hobbit is a few dozen pixels and an interior is a tenth of the picture. The
cost was not that interiors looked small — it was that scenes *moved outdoors to be seen*. The
Unexpected Party was staged with the company queueing up the garden path while Bag End's
modelled, dressed, lit rooms stood empty behind them.

- **`camera` in `staging.yaml`** is a list of `{ t, x, z, width }`: where the view looks on the
  ground, and the side of the square of ground to hold in frame. It is eased between keys like
  the light, and `width` eases through its ratio rather than its difference, so halving the
  frame feels the same move whether it starts at the whole tile or at one room.
- **The framing is the author's**, not a consequence of where the figures happen to be. An
  automatic fit would make the shot a function of the blocking; this way the blocking can serve
  the shot, which is the direction a scene is actually composed in.
- **It never fights the visitor's hand.** The stage reports the shot (`framingAt`); the app
  applies it as a *change* from the one applied last frame, so a pan or a zoom survives as an
  offset from the staged view. A fresh stage has nothing to offset from, so the first frame
  lands on the shot exactly — which is what makes a deep link open on the composed view.
- **An event without `camera` is untouched**: the whole tile, as before.

What framing alone does not fix is that a covered place is still covered: pointing the view at
a room under three metres of meadow only gets you a closer look at the meadow. That is §9.4.

### 9.4 Seeing inside a covered place (#28)

Measuring the sight lines into Bag End settled where the problem actually was. A ray out of the
parlour rises one unit for every unit it travels east, and the rooms are only about two and a
half deep, so it clears the vault and the partition walls and leaves through the cut face —
and then runs into the Hill, three metres of turf standing over the whole hole. The earth on
top was hiding the scene, not the architecture under it. (An earlier note here blamed the vault;
that was wrong, and the vault only becomes the blocker once the turf is gone.)

Rather than build indoor places open — a hobbit-hole without its hill is not a hobbit-hole, and
the green dome with its round door is the picture everyone comes for — the diorama **lifts the
cover away**, like the lid off a doll's house.

- **A kit names its covers.** Any object called `cover-<name>` can be lifted. Bag End has two:
  `cover-hill`, the turf over the rooms, and `cover-vaults`, the ceilings under it. What stays
  is the front bank with its door and windows and the cut east face with its earth strata — the
  two things that say *hobbit-hole*, kept whether the lid is on or off.
- **`reveal` in `staging.yaml`** is a list of `{ t, cover, amount }`, 0 closed to 1 lifted
  clear, eased between that cover's own keys. Each cover is its own little track, so a scene
  may take the roof off one building and leave the next alone, or shut one again.
- **It rises as it fades**, by rather more than half its own height. Fading alone reads as
  glass; rising alone leaves a solid slab floating over the scene. Together they read as the
  diorama opening itself, which is the feeling worth having.
- **The author says when**, not the camera. An automatic reveal — fade whatever the view is
  behind — would put the composition back in the camera's hands, the thing §9.3 took out of
  them, and it would flicker as the shot eases past geometry.
- **The build checks the name** against the `cover-*` objects the kit's `.glb` really has. A
  typo would otherwise fail silently, leaving the scene shut with nothing to say why.

The cost is that a visitor who pans away from the composed shot can still find a cover the
author had no reason to lift at that moment. That is the price of the author owning the
composition, and it is the right way round: a wrong reveal is visible to everyone, a missed one
only to someone who went looking.

### 9.5 Sound (#27)

A diorama with no sound is a model under glass. The sound is what tells a visitor that the Shire
is a place where things live, that a hall has walls, that a cave does not.

**Nothing is recorded. Everything is synthesized**, in the browser, out of noise, a filter and an
envelope (`src/sound/engine.ts`, loaded with a dynamic `import()` the first time somebody presses
play — about 3 kB over the wire). The reasons line up with every other decision here:

- **It is ours.** The art rules say maps, models and terrain are original; a bought or borrowed
  ambience bed would be the one place where somebody else's wood stands in for ours.
- **There is nothing to credit and nothing to track.** No licence per file, no source list that
  has to stay true, no audio anybody has to clear before publishing.
- **It weighs nothing.** This repository cannot use Git LFS (GitHub Pages will not serve it), and
  a sampled bed for every place would be tens of megabytes of what is otherwise a site of text
  and small models.
- **It is honestly a made thing**, like the faceted terrain: a few simple shapes, obviously built
  rather than photographed. A fire here is noise through a low filter and a scatter of pops, and
  it sounds like what it is.

**The bed comes from the place and the hour, with nothing authored** (`src/sound/scape.ts`). This
is exactly the bargain §9.1 makes with the grade: a place is decided once, and every event in it
agrees. A `Scape` is eight layers — wind, leaves, birds, crickets, water, fire, room, drips — each
0 → 1, and `PLACE_SCAPES` says which named scape a place takes (`hall`, `wood`, `camp`, `mirkwood`,
`elvish`, `lake`, `mountain`, `cave`, `mordor`, `shire`, `open`). The hour folds in through the
same `Light.lamps` that lights the windows: birds by day, crickets after dark, the wind dropping
at night, a hearth that burns a little by day and comes up once it is the light in the room. So
every staged event in a listed place is heard without anyone writing a line of staging, and a new
event in Bag End sounds like Bag End on the day it is staged.

A place nobody has listened for gets **silence**, the way an ungraded place gets `plain` light.
That is a real answer and not a gap: the cosmos events have no place and make no sound, because
deciding what the Music of the Ainur sounds like is a decision somebody should make on purpose,
not a side effect of a lookup table.

**The one-shots come from two places, and both are already written down** (`src/sound/cues.ts`):

- **Footsteps come free from the gait.** A figure's feet are on the same clock as its legs
  (`strideSeconds`), so a step lands when the walk cycle puts a foot down, at the pace the staging
  has the figure covering ground, and a heavier figure lands harder. Figures standing, hiding or
  offstage make none, and across a seek none are fired at all, so a scrub cannot empty the whole
  event's footsteps into one frame.
- **Everything else is the author's**, as `sound` in `staging.yaml`: a list of `{ t, cue, gain? }`,
  from a closed vocabulary (`CUES` in `src/data/types.ts`: `knock`, `door`, `thud`, `clang`,
  `splash`, `crack`, `whoosh`, `wings`, `rumble`, `chime`, `pour`, `clatter`). The build checks
  every name against it, because a cue the engine cannot make is simply silence. They sit at a `t`
  for the same reason the camera and the covers do (§9.3, §9.4): a knock derived from a figure
  standing near a door would be a sound caused by the blocking rather than by the story.

**What is pure and what is not.** The cues are a pure function of the pair of moments they fall
between, so the same scrub sounds the same twice and a deep link never misses a beat. The bed is
not: it runs on the audio clock, as shimmer and drift run on `ambient` seconds, because nothing in
the story depends on where in a gust you are. `Stage.sound(from, to, eventSeconds)` reports both
and the stage makes no noise itself, exactly as it moves no camera.

**The mix.** Everything goes out dry and again through a room's tail — an impulse built the same
way, noise with an exponential decay — and the scape's `room` layer sets how much of the second is
heard, which is what tells the ear whether a footstep is in a field, a hall or a cave. While a
recording is playing the whole bed steps back to `DUCK` from its first passage on, because the
narrators read an event nearly end to end and a recording does not say where it pauses for breath;
an event with no recording has no voice to duck under and is heard in full. The master never goes
above half, because the sound is a layer over the scene and never the scene.

**Muting is one control.** `?audio=off` already meant "no voice, and the event keeps its own
pace"; it now means nothing to hear at all, which is what a speaker icon promises. Nothing is
fetched and no audio clock is started until somebody presses play unmuted, and the control is
offered only where there is something to hear: a recording, or a diorama.

**Not done yet, deliberately:** music. An original score is a composer's decision and a
listening choice, like the narrators' audition (§5), and a synthesized bed is ambience, not music.
Until somebody makes that decision there is none — which also means the cosmos, where the first
music of all is sung, is still silent.

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
| 2026-11-11 | Spanish narration is Latin American (#34). The Voice Studio's design tags have no Spanish accents, so the accent was chosen by ear at audition and lives in the reference sample (`the-elder.es.flac`). |
| 2026-11-10 | The audio language is apart from the reading language: `?audio=`, falling back to the reading language, then English, then none (§6). |
| 2026-11-09 | Character lanes: lanes as coloured columns with time running down, one story order, crossings in gold, honest gaps ("at least N years later"), kin suggestions; lanes derived by the build; route `#/lives?with=` (§3.2). |
| 2026-11-09 | The time cursor (#1): a page at `#/time/<age>/<date>` (readable, at the precision picked: year, month, day, days outside the months; also an axis position); the ages as log-width segments with the timeless ones apart before the axis, and a finer scale (age, century, year, month) down to a single day, keyboard and touch operable; likely / possibly by `nearnessDuring` (the moment is its span); whereabouts from journeys by company, honest ("somewhere between"), with a labelled best guess for a day or month; characters who never travel shown at `home` within their events' span; moments to visit; a **Time** rail item; ways to and from events (§3.1). |
| 2026-11-09 | **What is foretold** (#57): the Dagor Dagorath and the Second Music in a timeless age flagged `foretold`, after the Fourth Age and never on the axis; every event cites its source and may name who foretold it (`foretoldBy`); marked as prophecy everywhere (badge, page line, dashed segment after the axis, lanes); the fuller version from *The History of Middle-earth* (the 1937 *Quenta Silmarillion*), split into one scene per event (§4.8). |
| 2026-11-09 | Model pipeline (#20): `assets/<type>/<id>/<id>.glb` (`.blend` sources beside, never deployed; no Git LFS); Blender exports glTF binary, Y-up, applied transforms, one scene, compressed with meshopt via `npm run model:pack` (gltfpack; meshopt over Draco for its smaller decoder); `model:` on characters and per-event on tracks, checked by the build (exists, loadable, within budget: characters 300 kB, kits 800 kB, props 100 kB); the loader is its own chunk; placeholder while loading or without a model; clips driven from `t` (§9, `MODELS.md`). |
| 2026-11-09 | Wonder and learning (#29): a first visit to the front door opens with a short guided opening over the Ainulindalë (one line per beat, Next, skippable at once, then three ways in: a story, a moment, a life), remembered per visitor, at `#/start` and reopened from the sidebar's *Start here*; `pronounce: { en, es }` respellings in the *AR-da* style on characters, places, ages and events, validated, shown as a small hint; *About this scene* on the stage; gentle pointers to the books from `source`, with chapter titles in both languages (§3.5). |
| 2026-11-25 | **Sound** (#27): synthesized in the browser, never sampled — original by construction, nothing to licence or credit, and weightless in a repository that cannot use Git LFS. The ambience of an event is a pure function of its **place and the hour** (`PLACE_SCAPES`, folded through the same `Light.lamps` that lights the windows), so every staged event in a listed place is heard without authoring; a place nobody has listened for is silent, as an ungraded place is `plain`. Footsteps come free from the gait (`strideSeconds`), and everything else the story does is authored at a `t` in `sound`, from a closed vocabulary the build checks. The bed ducks under a recording and the mute button silences all of it. No music yet: that is a composer's decision (§9.5). |
| 2026-11-17 | Seeing inside a covered place (#28): a kit names its covers (`cover-<name>`) and the staging lifts them away in `t` (`reveal`), like the lid off a doll's house — rising and fading together. The author says when, never the camera, for the same reason the framing is authored (§9.4). |
| 2026-11-15 | Where a figure stands (#81): a keyframe's `y` says how high above the walkable ground a character is, so one placed on a log, a bench or a doorstep is not buried in it; crowding is a **build warning**, not a push-apart at render time, because a figure's place must stay a pure function of `t` and who stands in front of whom is the author's composition (§9.2). |
| 2026-11-15 | The render look (#76): a soft second light that comes up as the sun goes down, so a night scene can be seen; haze tinted toward the background, never toward a bright sky, so the far edge of a tile recedes instead of dissolving; a grade per place applied to **the light, not the pixels** (no post-processing pass: a second render of the frame is the first thing to fail on a phone), where a place that takes light away gets the soft light back, and the background takes only a third of the tint so the void stays dark; contact shadows under figures, because at this scale where a figure touches says more than the shadow behind it; one quality setting turning the shadow map, pixel ratio and effect counts down together, guessed from the device and overridable with `?quality=` (§9.1). |
| 2026-11-09 | Factions (#18): one file per side in `content/factions/` (name, banner colour, kind, summary, leaders), reused across battles; battles list `sides` as groups of allied factions; staging places `armies` (faction, size, keyframes) as instanced blocks of small figures in the faction's colour, named characters keeping their own tracks; one being who comes alone (Beorn) is a character, a host (the Eagles) a faction. First example: the Battle of Five Armies (§2, §4.9). |
| 2026-11-26 | **Family trees** (#89): a third cross-view, drawn from **one authored edge, `parents: [a, b]`** — a list and not `father:`/`mother:`, because characters have no gender field by decision and one named parent must stay writable without an empty box for the other. Siblings, half-siblings, cousins, uncles, descendants and generation depth are **derived by the build**, never authored; `spouse` (a list, in the order married) and `betrothed` are separate, since a tree draws couples but marriage is not descent; `kin` survives narrowed to a closed, build-checked list of what parentage cannot say (`ancestor`, `descendant`, `cousin`, `sibling`, `kin`, `foster-parent`, `fosterling`), drawn as a dotted tie. Dates come from the event that declares them (`born:`/`died:` on `event.yaml`, at the event's honest range) or, for the hundreds Appendix A gives that will never be a scene, from the character — and an explicit date outside its event's range is an error. Silence is silence: no `died` draws no end, so an elf is never drawn as dead, and `fate` says in a sentence what happened instead. The view is **generation rows, never a time axis** (immortals break the axis and the lanes already own time), one character centred with two generations each way and growth in the URL (`#/kin/<id>?up=&down=&also=`); one layout for all four race shapes, because the shapes are in the edges; no new rail item. **Twins get their own symmetric key** (`twin`), since twinhood has the same parents as any other siblinghood and so is unrecoverable from the edges — said in words, not drawn, and the one fact the texts give about Elrond's sons. A house is derived from the graph, not a content kind (§3.6, §4.11). |
| 2026-11-26 | **Narration at arc scale** (#88): the world view's content is an arc's own telling over the map of its age — how a war moved across a country — because a map-scale overview is by definition not one scene and so cannot be an event. An arc with a telling becomes a folder (`arc.yaml` + `narration.yaml` + `staging.yaml` + `audio/`) and runs through the same four-word status pipeline, independent of its events'; it is read by the narrator of its first event's age (`narratedBy` when its events cross ages). The clock, the recordings and the authored `camera` are the event machinery unchanged; new are **`hosts`** (a body of people as a mark on a map: `mark` from a closed list, `weight` 1–5 rather than a count of soldiers, keyframes naming places, `faction` or a plain `label` for refugees) and **`roads`** (a journey painted along its waypoints, so an untold leg reads as a stretch of road with nothing on it). The arc's events are pinned from their places and need no authoring; `scenes` says only when the telling reaches each. No `light`, `sound` or `reveal` at map scale, and arcs stay off the time axis: an arc's `t` is narration time, not history (§4.10). |

## 12. Open questions

- **Journeys**: answered in part (§4.10). A long travel is both at once: inside an arc's telling it is a painted road (`roads`) with the legs we have told marked on it as diamonds, and each of those legs is a diorama of its own. What is still open is only **which** legs earn one — Moria and the Dead Marshes probably, a week of walking probably not — which is an authoring choice per journey, not a design question.
- **A standalone journey view**: *There and Back Again* end to end, outside any arc (§4.10). Worth having, not designed yet; it should draw the road exactly as an arc's `roads` does.
- **Family trees** (#89, §3.6, §4.11): the format and the view are designed; the content is the larger half. The four worth authoring first are the house of Finwë, Durin's line, the Line of Elros through to Aragorn, and the Baggins/Took/Brandybuck knot. Open within the design: whether the generation bands ever want a **second arrangement for a single line** (Durin's twenty generations read as a column already, but twenty cards is a long scroll on a phone), and how far **`up=all` on a crowded house** can go before the collapse chips are doing all the work. Both are answerable only by drawing it.
- **World view**: the original world map per age is not built yet. The coordinate scheme that unblocks it is settled in `docs/MAP.md`; §4.10 depends on nothing more than a named map per age and coordinates per place.
