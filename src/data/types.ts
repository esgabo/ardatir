// Ardatir's compiled data model: what the content build (scripts/content) writes
// to public/data/ and what the site loads. Authors write YAML in content/; see
// docs/DESIGN.md §4 for the authoring format.
//
// All text is written in our own words: summaries, not quotations from the books.

/** Supported languages. English is the default and is always required. */
export const LANGS = ['en', 'es'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'en';

/** Text in every language we have; `en` is required, the others fall back to it. */
export type LocalizedText = { en: string } & Partial<Record<Lang, string>>;

// ---------- Time ----------

export const PRECISIONS = ['day', 'month', 'season', 'year', 'decade', 'approximate'] as const;
export type Precision = (typeof PRECISIONS)[number];
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

/**
 * The days outside the twelve months in the Shire Reckoning (The Return of the King,
 * Appendix D), in calendar order: `2-yule` opens the year, `1-lithe`, `midyear` (Mid-year's
 * Day), `overlithe` (leap years only) and `2-lithe` fall between months 6 and 7, and `1-yule`
 * closes the year. Written as `day: <name>` with no month; see calendar.ts for their place.
 */
export const EXTRA_DAYS = ['2-yule', '1-lithe', 'midyear', 'overlithe', '2-lithe', '1-yule'] as const;
export type ExtraDay = (typeof EXTRA_DAYS)[number];

/** A date as the sources give it. Only fill what the sources support. */
export interface StoryDate {
  age: string;
  year: number;
  month?: number;
  /** 1–30 within `month`, or the name of a day outside the months (then no month). */
  day?: number | ExtraDay;
  season?: Season;
}

export interface When {
  start: StoryDate;
  end?: StoryDate;
  precision: Precision;
}

/** A position range on the shared axis, in years of the Sun (fractional), already widened by precision. */
export interface Span {
  from: number;
  to: number;
}

// ---------- Entities ----------

export interface Age {
  id: string;
  order: number;
  name: LocalizedText;
  abbr?: LocalizedText;
  summary: LocalizedText;
  /** Timeless ages (before the world, and what is foretold after it) have no axis. */
  axis?: { start: number; yearLength: number };
  /**
   * What is foretold, not told as history (the Last Battle, the Second Music): a timeless age
   * placed after the dated ones. Every event in it is prophecy, and the site says so wherever
   * it shows one (docs/DESIGN.md §4.8).
   */
  foretold?: boolean;
  /** How to say a hard name (`ee-LOO-va-tar`), per language: data/pronounce.ts, docs/DESIGN.md §3.5. */
  pronounce?: LocalizedText;
  /** The narrator who tells this age's events (content/narrators/<id>.yaml). */
  narrator?: string;
}

/** How one narrator sounds in one language, on the Voice Studio (content/narrators/README.md). */
export interface NarratorVoice {
  engine: string;
  engineVersion: string;
  /** Voice-design attributes the voice was made from at audition. */
  instruct: string;
  /** Seed of the chosen audition take; in production the seed only picks a take. */
  seed: number;
  speed: number;
  params?: Record<string, number | string | boolean>;
  /** Our own designed sample every recording is cloned from, next to the yaml. */
  reference: string;
  /** `sha256:` + 64 hex digits of the reference file. */
  referenceHash: string;
  /** The exact words the reference says. */
  refText: string;
  /** Seconds between passages in a recording (default 0.8). */
  gap?: number;
  /** Bumped when the voice changes; older recordings are then stale. */
  version: number;
}

export interface Narrator {
  id: string;
  brief: LocalizedText;
  voices: Partial<Record<Lang, NarratorVoice>>;
}

/**
 * The closed list of `kin` words: exactly what parentage cannot say (docs/DESIGN.md §4.11).
 * Everything a tree can derive from `parents` is not a field, so `brother`, `father` and the
 * rest are gone, and a word outside this list is an error naming its replacement. `sibling` is
 * here for the one case §4.11's table misses: Bofur and Bombur are brothers in the published
 * *Hobbit* and no source gives either of them a parent, so the fact is unrecoverable from the
 * edges, exactly as `dori`/`nori`/`ori`'s `kin` is.
 */
export const KIN_WORDS = ['ancestor', 'descendant', 'cousin', 'sibling', 'kin', 'foster-parent', 'fosterling'] as const;
export type KinWord = (typeof KIN_WORDS)[number];

export interface Kin {
  id: string;
  /**
   * Relation keyword: one of KIN_WORDS. Typed as a string while the 36 files written against the
   * open vocabulary are migrated (§4.11), since an un-migrated word is a warning, not an error.
   */
  as: string;
}

/**
 * A birth or a death: the date as written (by the character, or by the event that declares it),
 * its honest range, and the event that declares it where one does. Silence is silence — a
 * character with no `died` has none, and nothing may infer one (§4.11).
 */
export interface LifeDate {
  date?: StoryDate;
  precision?: Precision;
  /** The honest range on the shared axis (src/data/calendar.ts). */
  span?: Span;
  /** The event whose `born:`/`died:` names this character, when one does. */
  event?: string;
}

/** One side of a family tie. `reverse` marks the side the build derived, as event links do (§4.5). */
export interface FamilyTie {
  id: string;
  reverse?: boolean;
}

/** A sibling, derived from `parents`: `half` when one parent is shared and each has another (§4.11). */
export interface FamilySibling extends FamilyTie {
  half: boolean;
  /** The parents the two share. */
  shared: string[];
  /** Born together: the one sibling fact parentage cannot reach, so it is authored (`twin`). */
  twin?: boolean;
}

/**
 * A character's family, derived by the build from `parents`, `spouse`, `betrothed` and `twin`
 * (docs/DESIGN.md §4.11). Nothing here is authored but the parents, the spouses, the betrothals
 * and the twin: children, siblings, half-siblings, generation depth and the house are
 * consequences, exactly as a character's events are.
 */
export interface Family {
  /** Authored: 0–2 parents, order meaningless. */
  parents: string[];
  /** Derived from everyone else's `parents`, in content order. */
  children: string[];
  /** Authored where written, in the order married; the other side is derived and marked. */
  spouses: FamilyTie[];
  betrothed: FamilyTie[];
  /** Authored on one side, derived on the other. */
  twin?: FamilyTie;
  siblings: FamilySibling[];
  /** Authored, and only for what parentage cannot say. */
  kin: Kin[];
  /** 0 for a character whose parents the content does not give, one more than the deepest parent. */
  generation: number;
  /** The house they stand in: the id of the part of the parentage graph (its eldest member). */
  house?: string;
}

/** A house: a connected part of the parentage graph, named by the books where they name it (§4.11). */
export interface House {
  /** The eldest known member of this part of the graph, or the one carrying `house:`. */
  id: string;
  /** From `house:` on the founder, where the books name it their own way (*Durin's Folk*). */
  name?: LocalizedText;
  /** Every member, in content order. */
  members: string[];
}

export interface Character {
  id: string;
  /** Names are localized too: Bilbo Baggins / Bilbo Bolsón. */
  name: LocalizedText;
  /** e.g. "hobbit", "dwarf", "wizard", "troll". */
  kind: string;
  summary: LocalizedText;
  /** Placeholder colour until real low-poly models exist. */
  color?: string;
  /** Relative height (1 = hobbit-sized), keeps film-like proportions between races. */
  scale?: number;
  kin?: Kin[];
  /** 0, 1 or 2 known parents, order meaningless: the one edge a family tree is drawn from (§4.11). */
  parents?: string[];
  /** Spouses in the order they were married; symmetric, the other side derived (§4.11). */
  spouse?: string[];
  /** A betrothal that never became a marriage: rare, and symmetric too. */
  betrothed?: string[];
  /** Born together with this character: symmetric, and unrecoverable from `parents` (§4.11). */
  twin?: string;
  /** From the character's own `born:`, or from the event that declares the birth. */
  born?: LifeDate;
  /** Likewise — and left out entirely when the sources do not say they died. */
  died?: LifeDate;
  /** One sentence for a life that ended in something other than a death (the Choice of the Half-elven). */
  fate?: LocalizedText;
  /** On a founder, where the books name their house their own way (*Durin's Folk*). */
  house?: LocalizedText;
  /**
   * Where a character who doesn't travel lives (Tom Bombadil: the Old Forest). The time cursor
   * shows them there when no journey of theirs covers the moment, within the span of their events.
   */
  home?: string;
  /**
   * The character's glTF model, as a URL under the site root (`data/models/characters/bilbo/bilbo.glb`),
   * from `model:` (a path under assets/). Without one, the diorama draws the placeholder figure.
   */
  model?: string;
  /** How to say a hard name (`ee-LOO-va-tar`), per language: data/pronounce.ts, docs/DESIGN.md §3.5. */
  pronounce?: LocalizedText;
}

/**
 * The maps the world view draws. Beleriand sinks at the end of the First Age, so its places
 * share no coordinate frame with later Middle-earth; Aman and Númenor are their own lands.
 * See docs/MAP.md.
 */
export const MAP_IDS = ['middle-earth', 'beleriand', 'aman', 'numenor'] as const;
export type MapId = typeof MAP_IDS[number];

/**
 * A place's position on one map: the ground plane is x/z (y is up, as everywhere in three.js),
 * +x east and +z south, one unit ten miles. `radius` is how far across a region reaches from
 * that centre, in the same units; a place with a point and no extent has none. docs/MAP.md.
 */
export interface PlacePoint {
  on: MapId;
  x: number;
  z: number;
  radius?: number;
}

export interface Place {
  id: string;
  name: LocalizedText;
  summary: LocalizedText;
  /**
   * Where the place sits on Ardatir's own maps (`map:` in content/places/, docs/MAP.md). One
   * entry per map it appears on — the Blue Mountains are on both Beleriand and Middle-earth —
   * so a world stage picks the entry whose `on` is the map it draws. Missing for a place that
   * belongs to no frame we draw (`map: nowhere`).
   */
  map?: PlacePoint[];
  /** How to say a hard name (`ee-LOO-va-tar`), per language: data/pronounce.ts, docs/DESIGN.md §3.5. */
  pronounce?: LocalizedText;
}

/**
 * A side in battles (content/factions/<id>.yaml): who fights together under one banner,
 * reused across battles (the Dwarves of the Iron Hills at Azanulbizar and the Five Armies).
 */
export interface Faction {
  id: string;
  name: LocalizedText;
  /** Banner colour, #rrggbb: chips on pages, the army's figures and banner on a diorama. */
  color: string;
  /** What they are, as a character kind (elf, man, dwarf, orc, wolf, eagle…): it shapes the army's figures. */
  kind: string;
  summary: LocalizedText;
  /** Characters who lead it (character ids), in any battle. */
  leaders: string[];
}

export interface Arc {
  id: string;
  title: LocalizedText;
  summary: LocalizedText;
  /** Derived: the arc's events in chronological order. */
  events: string[];
  span?: Span;
}

export interface Waypoint {
  place: string;
  date: StoryDate;
  /** For a stay known only within bounds: the latest the sources allow, like an event's `when.end`. */
  end?: StoryDate;
  precision: Precision;
  /** Precision of `end` when it differs from `precision` (a stay from "June" until "1 Lithe"). Only with `end`. */
  endPrecision?: Precision;
  /** Honest range: from the start of `date` to the end of `end` (or of `date`), widened by precision. */
  span: Span;
  /** Best-guess moment inside `span`: the matching event's `at` when there is one. */
  at: number;
  /** Derived: the event on this journey that happens at this waypoint, when there is one. */
  event?: string;
}

export interface Journey {
  id: string;
  title: LocalizedText;
  characters: string[];
  waypoints: Waypoint[];
  span?: Span;
  /** Derived: events that are part of this journey, chronological. */
  events: string[];
}

// ---------- Events ----------

export const LINK_TYPES = ['caused-by', 'causes', 'enabled-by', 'enables', 'concurrent', 'crossing'] as const;
export type LinkType = (typeof LINK_TYPES)[number];

export interface EventLink {
  to: string;
  type: LinkType;
  note?: LocalizedText;
  /** True when the build added this as the reverse of a link written on the other event. */
  reverse?: boolean;
}

export const STATUSES = ['outline', 'scripted', 'staged', 'animated'] as const;
export type Status = (typeof STATUSES)[number];

export type StageKind = 'cosmos' | 'world' | 'diorama';

/**
 * How a best guess was placed (`estimatePositions` in scripts/content/build.ts):
 * - `exact`: dated to within about a month (an anchor), placed at its middle.
 * - `between-anchors`, `after-anchor`, `before-anchor`: its honest range narrowed by the nearest
 *   exact-dated events before (`after`) and after (`before`) it in a shared character's lane.
 * - `range-midpoint`: no anchor narrows it and nothing shares its stretch: the middle of its range.
 * - `spaced-in-range`: no anchor narrows it; spread evenly with the others sharing that range, in story order.
 * - `after-predecessor`: the window put it too early, so it is moved just after `follows`, an
 *   earlier event in a shared lane (`via: 'lane'`) or one it is caused or enabled by.
 */
export const AT_REASON_KINDS = ['exact', 'between-anchors', 'after-anchor', 'before-anchor', 'range-midpoint', 'spaced-in-range', 'after-predecessor'] as const;
export type AtReasonKind = (typeof AT_REASON_KINDS)[number];

export interface AtReason {
  kind: AtReasonKind;
  /** The exact-dated event just before it in a shared lane, which the guess comes after. */
  after?: string;
  /** The exact-dated event just after it in a shared lane, which the guess comes before. */
  before?: string;
  /** Characters whose lanes gave those anchors (or the predecessor), at most two. */
  lane?: string[];
  /** For `after-predecessor`: the event it is placed just after, and why it must follow it. */
  follows?: string;
  via?: 'lane' | 'caused-by' | 'enabled-by';
  /** How many events share the window (the guess is spaced among them in story order); omitted when alone. */
  shared?: number;
  /** The window the guess was placed in: the honest span, narrowed by the anchors (axis years, rounded). */
  window?: [number, number];
}

/** What the index knows about every event: enough for the timeline, time cursor and lanes. */
export interface EventSummary {
  id: string;
  age: string;
  when?: When;
  /** Honest bounds: when the sources allow it to have happened. Absent for timeless events. */
  span?: Span;
  /**
   * Best-guess moment, inside `span`. Events with exact dates are anchors; vaguely dated
   * events between them in a character's lane are spaced out in story order. The time
   * cursor uses it for "likely happening now", and `span` for "possibly now".
   */
  at?: number;
  /** Why `at` landed where it did (docs/DESIGN.md §4.4), so the site can explain the guess. */
  atReason?: AtReason;
  place?: string;
  characters: string[];
  arcs: string[];
  journeys: string[];
  tags: string[];
  status: Status;
  source?: { book: string; chapter?: string | number };
  /** In a foretold age: who foretells it (a character id, e.g. Mandos), when the source names one. */
  foretoldBy?: string;
  title: LocalizedText;
  /** How to say the title, when it is a hard name (the Ainulindalë). */
  pronounce?: LocalizedText;
  summary: LocalizedText;
  /**
   * A short note for readers, in our own words: where the sources disagree or are silent, and
   * what the scene chose (the remade world's shape at the end of days). Shown in "About this
   * scene" and on the event's page.
   */
  note?: LocalizedText;
  links: EventLink[];
  /**
   * A battle's sides: groups of allied faction ids, each group against the others
   * (`[[elves, men, dwarves], [goblins, wargs]]`). Absent for events that aren't battles.
   */
  sides?: string[][];
  /** Present when the event can be played. */
  stage?: StageKind;
  /** Languages with a narration recording. */
  audio: Lang[];
}

/** What a character is doing at a moment of an event. */
export interface Keyframe {
  /** Normalised event time, 0 → 1. */
  t: number;
  /** Position inside the event's diorama (local units, origin at the tile centre). */
  x: number;
  z: number;
  /**
   * How high the character stands above the ground here, in tile units (default 0).
   *
   * A figure is placed on the kit's `terrain` mesh, which is the walkable ground. A kit also
   * builds things a character can be *on* — a log by the fire, a bench outside the inn, a
   * doorstep, a bridge — and the terrain runs underneath those, so a troll sitting on a log
   * placed at ground level is buried in it to the waist. `y` is the author saying how far up
   * that surface is. Staging already names an exact spot in a tile the kit built; this is the
   * third number of that spot.
   *
   * It is interpolated like `x` and `z`, so a figure can step up onto something and down again.
   */
  y?: number;
  action?: 'idle' | 'walk' | 'run' | 'fight' | 'talk' | 'hide';
  thought?: LocalizedText;
}

export interface Track {
  characterId: string;
  keyframes: Keyframe[];
  /** This event's model for the character, overriding `Character.model` (same URL form). */
  model?: string;
  /**
   * A second model the character turns into partway through the event, from `t` onwards: the
   * trolls caught by the dawn. Pure in `t`, so scrubbing back shows them alive again.
   */
  becomes?: { t: number; model: string };
}

export const ARMY_SIZES = ['small', 'medium', 'large'] as const;
export type ArmySize = (typeof ARMY_SIZES)[number];
export const ARMY_ACTIONS = ['idle', 'walk', 'run', 'fight'] as const;
export type ArmyAction = (typeof ARMY_ACTIONS)[number];
/** Faction kinds a diorama has a look for (src/scene/armies.ts); any other kind is drawn as men, and the build warns. */
export const ARMY_KINDS = ['elf', 'man', 'dwarf', 'goblin', 'orc', 'hobbit', 'wolf', 'warg', 'eagle'] as const;
export type ArmyKind = (typeof ARMY_KINDS)[number];

/** Where an army's centre is at a moment of an event, and what it is doing. Off the tile = offstage. */
export interface ArmyKeyframe {
  t: number;
  x: number;
  z: number;
  action?: ArmyAction;
}

/** A faction's host on a diorama, drawn as a block of small figures in its colour; named characters keep their own tracks. */
export interface Army {
  faction: string;
  size: ArmySize;
  keyframes: ArmyKeyframe[];
}

/** The light of a diorama at a moment (src/scene/lighting.ts has the look of each). */
export const LIGHT_PRESETS = ['dawn', 'morning', 'day', 'evening', 'dusk', 'night'] as const;
export type LightPreset = (typeof LIGHT_PRESETS)[number];
/** From `t` on, the light moves towards `preset` (staging.yaml `light`); between keys it blends. */
export interface LightKey {
  t: number;
  preset: LightPreset;
}

/**
 * Where the view looks at a moment, and how much ground it holds (staging.yaml `camera`).
 *
 * Without this an event is seen from one fixed wide shot holding the whole tile, which is right
 * for a scene played across a hillside and wrong for one played in a room: at that distance a
 * hobbit is a few dozen pixels and an interior is a tenth of the picture, so the action gets
 * pushed out onto the open ground where it can be seen. The framing is the author's, like the
 * light and the blocking, and it is interpolated between keys so the view glides.
 */
export interface CameraKey {
  t: number;
  /** The point on the ground the view centres on (tile units, origin at the tile centre). */
  x: number;
  z: number;
  /**
   * How much ground to hold in frame: the side of a square centred on (x, z) that is kept
   * visible, in tile units. The whole tile is 14 across; Bag End's parlour is about 3.
   */
  width: number;
}

/**
 * A cover the diorama lifts away so the scene under it can be seen (staging.yaml `reveal`).
 *
 * A scene played indoors is hidden by whatever keeps the weather off it: the earth over a
 * hobbit-hole, a hall's shingled roof, an inn's thatch. Rather than build those places open —
 * which would cost them their silhouette, and a hobbit-hole is its hill — a kit names each
 * cover (an object called `cover-<name>`), and the staging says when it rises out of the way,
 * like a lid off a doll's house. `amount` is 0 for closed and 1 for fully lifted, eased between
 * keys, and it is the author's call at every moment, never a consequence of where the camera is.
 */
export interface CoverKey {
  t: number;
  /** Which cover: the `<name>` of a `cover-<name>` object in the kit (`hill` for Bag End). */
  cover: string;
  /** 0 = closed, 1 = lifted clear and faded out. */
  amount: number;
}

/**
 * The whole vocabulary of one-shot sounds (src/sound/engine.ts). It is small on purpose: each is
 * a shape the engine can build out of noise and a filter, and a cue nobody can synthesize is a
 * cue that would simply be silent. It lives here because the content build checks `sound` against
 * it and the site plays from it.
 */
export const CUES = [
  'step',     // a foot down (never authored: it comes from the gait)
  'knock',    // knuckles on a door
  'door',     // a leaf swinging, and its latch
  'thud',     // something heavy set down, or a fall
  'clang',    // metal on metal
  'splash',   // into water
  'crack',    // wood breaking, a whip, a stone split
  'whoosh',   // something large moving past
  'wings',    // one slow wingbeat
  'rumble',   // stone moving, thunder, a mountain at work
  'chime',    // a bell, or elvish glass
  'pour',     // drink into a vessel
  'clatter',  // crockery and cutlery
] as const;

export type CueKind = (typeof CUES)[number];

/**
 * What an author may write in `sound`: everything but a footstep, which comes from the gait and
 * placed by hand would land where the legs are not.
 */
export const AUTHORED_CUES: readonly CueKind[] = CUES.filter((c) => c !== 'step');

/**
 * A sound that belongs to a moment rather than to a place (staging.yaml `sound`).
 *
 * The ambience of an event comes from its place and the hour, with nothing authored (DESIGN §9.5);
 * what the story *does* — a knock at a door, crockery on a table, a sword, a wingbeat — belongs to
 * a beat, so the author places it at a `t`, for the same reason the camera and the covers are
 * authored: a knock that happened because somebody was standing near a door would be a sound
 * caused by the blocking rather than by the story. Footsteps are the exception, and come free from
 * the gait. `cue` is one of `CUE_KINDS` in src/sound/cues.ts.
 */
export interface SoundKey {
  t: number;
  cue: CueKind;
  /** Louder or softer than that cue's own level (1 by default). */
  gain?: number;
}

export interface Beat {
  id: string;
  t: number;
  label: LocalizedText;
}

/** One passage of narration: what the audio reads and the screen shows, starting at `t`. */
export interface NarrationSegment {
  id: string;
  /** Moment of the animation this passage belongs to (0 → 1). */
  t: number;
  text: LocalizedText;
}

/** A narration recording in one language. */
export interface NarrationAudio {
  /** Path relative to the site root. */
  src: string;
  /** Length in seconds; the event lasts this long in this language. */
  duration: number;
  /** Second at which each passage begins, same order as `narration`. */
  starts?: number[];
}

/** A playable event: loaded from data/events/<id>.json when opened. */
export interface EventDetail extends EventSummary {
  stage: StageKind;
  /** Length when no recording exists for the current language, in seconds. */
  durationSeconds: number;
  narration: NarrationSegment[];
  beats: Beat[];
  tracks: Track[];
  /** A battle's armies (staging.yaml `armies`), when it has any. */
  armies?: Army[];
  /** The place built for this event (staging.yaml `set`: a kit model's URL), instead of the generic tile. */
  set?: string;
  /** How the light changes through the event (staging.yaml `light`); without it, a fixed day. */
  light?: LightKey[];
  /** How the view is framed through the event (staging.yaml `camera`); without it, the whole tile. */
  camera?: CameraKey[];
  /** Covers the set lifts away (staging.yaml `reveal`); without it, the place stays shut. */
  reveal?: CoverKey[];
  /** One-shot sounds at their moments (staging.yaml `sound`); the ambience needs no authoring. */
  sound?: SoundKey[];
  audioFiles: Partial<Record<Lang, NarrationAudio>>;
}

/** data/scripts/<id>.json: an event's narration as text, for every event that has a narration.yaml. */
export interface EventScript {
  id: string;
  passages: { id: string; text: LocalizedText }[];
}

/** One step of a character's lane: an event they are in, or a waypoint of one of their journeys. */
export type LaneEntry = { event: string } | { journey: string; waypoint: number };

/** data/index.json */
export interface ContentIndex {
  ages: Age[];
  characters: Character[];
  places: Place[];
  arcs: Arc[];
  journeys: Journey[];
  /** Every event: timeless ones first (by age order), then by axis position. */
  events: EventSummary[];
  byCharacter: Record<string, string[]>;
  /**
   * Each character's lane (docs/DESIGN.md §3.2): their events in story order, with the legs
   * of their journeys that no event of theirs covers placed between them.
   */
  lanes: Record<string, LaneEntry[]>;
  byPlace: Record<string, string[]>;
  /** The sides in battles. */
  factions: Faction[];
  /** Derived: each faction's battles (events whose `sides` name it), in story order. */
  byFaction: Record<string, string[]>;
  /**
   * Each character's family (docs/DESIGN.md §3.6, §4.11), derived from the authored `parents`,
   * `spouse`, `betrothed` and `twin` with the reverses marked — exactly as byCharacter and lanes
   * are derived. Every character has an entry, even one with no kin at all.
   */
  family: Record<string, Family>;
  /** Derived: the connected parts of the parentage graph. */
  houses: House[];
}
