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

/** A date as the sources give it. Only fill what the sources support. */
export interface StoryDate {
  age: string;
  year: number;
  month?: number;
  day?: number;
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
  /** Timeless ages (before the world) have no axis. */
  axis?: { start: number; yearLength: number };
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
}

export interface Place {
  id: string;
  name: LocalizedText;
  summary: LocalizedText;
  /** Position on Ardatir's own world map, once it exists. */
  world?: { x: number; z: number };
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
  precision: Precision;
  span: Span;
  /** Best-guess moment inside `span`: the matching event's `at` when there is one. */
  at: number;
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
  place?: string;
  characters: string[];
  arcs: string[];
  journeys: string[];
  tags: string[];
  status: Status;
  source?: { book: string; chapter?: string | number };
  title: LocalizedText;
  summary: LocalizedText;
  links: EventLink[];
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
  audioFiles: Partial<Record<Lang, NarrationAudio>>;
}

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
  byPlace: Record<string, string[]>;
}
