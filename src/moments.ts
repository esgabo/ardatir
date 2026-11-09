// "Moments to visit" on the time cursor (docs/DESIGN.md §3.1): a few moments where much
// happens at once. Each is a readable moment path; its label is an event's title (already
// translated in content/) or, for moments that gather several, an interface string
// (`mo_<path with / as ->`, in i18n.ts). tests/timeCursor.test.ts checks each one resolves
// and has something happening.

export interface MomentShortcut {
  path: string;
  /** Labelled with this event's title. */
  event?: string;
}

export const MOMENTS: MomentShortcut[] = [
  { path: 'before-time', event: 'ainulindale' },
  { path: 'years-of-the-trees/1495', event: 'the-trees-are-darkened' },
  { path: 'first-age/495' },
  { path: 'second-age/3319', event: 'downfall-of-numenor' },
  { path: 'third-age/2941-04-26', event: 'unexpected-party' },
  { path: 'third-age/2941-08' },
  { path: 'third-age/3018-10-25', event: 'the-council-of-elrond' },
  { path: 'third-age/3019-03-15' },
  { path: 'third-age/3019-03-25', event: 'the-ring-is-destroyed' },
];

/** The interface key of a shortcut without an event: `mo_first-age-495`. */
export const momentKey = (path: string) => `mo_${path.replace(/\//g, '-')}`;
