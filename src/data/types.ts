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
}

export interface Kin {
  id: string;
  /** Relation keyword, e.g. "cousin", "sister". */
  as: string;
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

export interface Place {
  id: string;
  name: LocalizedText;
  summary: LocalizedText;
  /** Position on Ardatir's own world map, once it exists. */
  world?: { x: number; z: number };
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
  action?: 'idle' | 'walk' | 'run' | 'fight' | 'talk' | 'hide';
  thought?: LocalizedText;
}

export interface Track {
  characterId: string;
  keyframes: Keyframe[];
  /** This event's model for the character, overriding `Character.model` (same URL form). */
  model?: string;
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
}
