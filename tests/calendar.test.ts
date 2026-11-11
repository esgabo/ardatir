import { describe, expect, it } from 'vitest';
import {
  ageYearCount, APPROXIMATE_YEARS, axisToDate, dateSpan, daySlot, dayWindowSlots, hasOverlithe, LIKELY_DAY, LIKELY_MONTH, LIKELY_SEASON,
  likelyWindow, nearness, nearnessAt, nearnessDuring, ONE_DAY, overlaps, slotDay, stepDate, vaguer, whenSpan, within, yearsBetween, type Timed,
} from '../src/data/calendar.ts';
import { EXTRA_DAYS, type Age, type Precision, type StoryDate } from '../src/data/types.ts';

const ta: Age = { id: 'third-age', order: 5, name: { en: 'Third Age' }, summary: { en: '' }, axis: { start: 4032, yearLength: 1 } };
const trees: Age = { id: 'years-of-the-trees', order: 3, name: { en: 'Trees' }, summary: { en: '' }, axis: { start: -100, yearLength: 10 } };
const timeless: Age = { id: 'before-time', order: 1, name: { en: 'Before' }, summary: { en: '' } };
const ages = new Map([ta, trees, timeless].map((a) => [a.id, a]));
const d = (x: Partial<StoryDate>): StoryDate => ({ age: 'third-age', year: 2941, ...x });
const yearStart = 4032 + 2940;
const SLOT = 1 / 366;

describe('dateSpan by precision', () => {
  it('a day is ONE_DAY wide in a Sun-year age, for named days too', () => {
    for (const day of [{ month: 4, day: 26 }, { day: '1-lithe' as const }]) {
      const s = dateSpan(d(day), 'day', ta)!;
      expect(s.to - s.from).toBeCloseTo(ONE_DAY, 12);
    }
  });

  it('a year covers the whole year', () => {
    expect(dateSpan(d({}), 'year', ta)).toEqual({ from: yearStart, to: yearStart + 1 });
  });

  it('a decade covers ten years from its start', () => {
    expect(dateSpan(d({}), 'decade', ta)).toEqual({ from: yearStart, to: yearStart + 10 });
  });

  it(`approximate covers ±${APPROXIMATE_YEARS} years around the year`, () => {
    const s = dateSpan(d({}), 'approximate', ta)!;
    expect(s.from).toBeCloseTo(yearStart - APPROXIMATE_YEARS);
    expect(s.to).toBeCloseTo(yearStart + APPROXIMATE_YEARS + 1);
  });

  it('a month covers 30 days and a day one day', () => {
    const m = dateSpan(d({ month: 3 }), 'month', ta)!;
    expect(m.to - m.from).toBeCloseTo(30 * SLOT);
    const day = dateSpan(d({ month: 3, day: 15 }), 'day', ta)!;
    expect(day.to - day.from).toBeCloseTo(SLOT);
    expect(day.from).toBeGreaterThanOrEqual(m.from);
    expect(day.to).toBeLessThanOrEqual(m.to + 1e-12);
  });

  it('a day sits inside its month, its season and its year', () => {
    const day = dateSpan(d({ month: 7, day: 10 }), 'day', ta)!;
    const summer = dateSpan(d({ season: 'summer' }), 'season', ta)!;
    expect(day.from).toBeGreaterThanOrEqual(summer.from);
    expect(day.to).toBeLessThanOrEqual(summer.to);
  });

  it('seasons are three months; winter crosses into the next year', () => {
    const spring = dateSpan(d({ season: 'spring' }), 'season', ta)!;
    expect(spring.from).toBeCloseTo(dateSpan(d({ month: 3 }), 'month', ta)!.from);
    expect(spring.to).toBeCloseTo(dateSpan(d({ month: 6 }), 'month', ta)!.from);
    const winter = dateSpan(d({ season: 'winter' }), 'season', ta)!;
    expect(winter.from).toBeCloseTo(dateSpan(d({ month: 12 }), 'month', ta)!.from);
    expect(winter.to).toBeGreaterThan(yearStart + 1);
    expect(winter.to).toBeCloseTo(dateSpan(d({ year: 2942, month: 3 }), 'month', ta)!.from);
  });

  it('scales with the age year length', () => {
    const s = dateSpan({ age: trees.id, year: 3 }, 'year', trees)!;
    expect(s).toEqual({ from: -80, to: -70 });
    const m = dateSpan({ age: trees.id, year: 3, month: 1 }, 'month', trees)!;
    expect(m.to - m.from).toBeCloseTo(300 / 366);
  });

  it('timeless ages have no span', () => {
    expect(dateSpan({ age: timeless.id, year: 1 }, 'year', timeless)).toBeUndefined();
  });
});

describe('the Shire extra days', () => {
  const dayFrom = (x: Partial<StoryDate>) => dateSpan(d(x), 'day', ta)!.from;

  it('fall in calendar order around the months', () => {
    const order = [
      dayFrom({ day: '2-yule' }), dayFrom({ month: 1, day: 1 }), dayFrom({ month: 6, day: 30 }),
      dayFrom({ day: '1-lithe' }), dayFrom({ day: 'midyear' }), dayFrom({ day: 'overlithe' }), dayFrom({ day: '2-lithe' }),
      dayFrom({ month: 7, day: 1 }), dayFrom({ month: 12, day: 30 }), dayFrom({ day: '1-yule' }),
      dayFrom({ year: 2942, day: '2-yule' }),
    ];
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThan(order[i - 1]);
  });

  it('2 Yule opens the year and 1 Yule closes it, one day each', () => {
    expect(dayFrom({ day: '2-yule' })).toBeCloseTo(yearStart);
    const y1 = dateSpan(d({ day: '1-yule' }), 'day', ta)!;
    expect(y1.to).toBeCloseTo(yearStart + 1);
  });

  it('every day of a year has its own slot, and the year has 366', () => {
    const slots = new Set<number>();
    for (const x of EXTRA_DAYS) slots.add(daySlot(undefined, x));
    for (let m = 1; m <= 12; m++) for (let day = 1; day <= 30; day++) slots.add(daySlot(m, day));
    expect(slots.size).toBe(366);
    expect(Math.min(...slots)).toBe(0);
    expect(Math.max(...slots)).toBe(365);
  });

  it('months are untouched by the extra days: each is 30 days', () => {
    expect(daySlot(6, 30) - daySlot(6, 1)).toBe(29);
    expect(daySlot(7, 1) - daySlot(6, 30)).toBe(5); // 1 Lithe, Mid-year's Day, Overlithe, 2 Lithe between
  });

  it('summer holds the Lithe days; winter holds Yule', () => {
    const summer = dateSpan(d({ season: 'summer' }), 'season', ta)!;
    for (const x of ['1-lithe', 'midyear', 'overlithe', '2-lithe'] as const) {
      expect(overlaps(dateSpan(d({ day: x }), 'day', ta)!, summer)).toBe(true);
    }
    const winter = dateSpan(d({ season: 'winter' }), 'season', ta)!;
    expect(overlaps(dateSpan(d({ day: '1-yule' }), 'day', ta)!, winter)).toBe(true);
    expect(overlaps(dateSpan(d({ year: 2942, day: '2-yule' }), 'day', ta)!, winter)).toBe(true);
    expect(overlaps(dateSpan(d({ day: '2-yule' }), 'day', ta)!, winter)).toBe(false); // that one opens the previous winter's year
  });

  it('Overlithe: every fourth year, except the last of a century', () => {
    expect(hasOverlithe(2940)).toBe(true);
    expect(hasOverlithe(2941)).toBe(false);
    expect(hasOverlithe(2900)).toBe(false);
    expect(hasOverlithe(3020)).toBe(true);
  });
});

describe('axisToDate', () => {
  const list = [ta, trees, timeless];

  it('round-trips numbered and named days', () => {
    const cases: Partial<StoryDate>[] = [
      { month: 1, day: 1 }, { month: 3, day: 15 }, { month: 6, day: 30 }, { month: 7, day: 1 }, { month: 12, day: 30 },
      ...EXTRA_DAYS.map((x) => ({ day: x })),
    ];
    for (const c of cases) {
      const s = dateSpan(d(c), 'day', ta)!;
      const back = axisToDate((s.from + s.to) / 2, list)!;
      expect(back.age.id).toBe('third-age');
      expect(back.year).toBe(2941);
      expect(back.day).toBe(c.day);
      expect(back.month).toBe(c.month);
      const start = axisToDate(s.from, list)!;
      expect(start.day).toBe(c.day);
    }
  });

  it('is undefined before the first dated age', () => {
    expect(axisToDate(-1000, list)).toBeUndefined();
  });
});

describe('whenSpan and overlaps', () => {
  it('runs from the start of the start date to the end of the end date', () => {
    const s = whenSpan({ start: d({ season: 'summer' }), end: d({ season: 'autumn' }), precision: 'season' }, ages)!;
    expect(s.from).toBeCloseTo(dateSpan(d({ season: 'summer' }), 'season', ta)!.from);
    expect(s.to).toBeCloseTo(dateSpan(d({ season: 'autumn' }), 'season', ta)!.to);
  });

  it('gives the end its own precision when asked: June until 1 Lithe', () => {
    const s = whenSpan({ start: d({ month: 6 }), end: d({ day: '1-lithe' }), precision: 'month', endPrecision: 'day' }, ages)!;
    expect(s.from).toBeCloseTo(dateSpan(d({ month: 6 }), 'month', ta)!.from);
    expect(s.to).toBeCloseTo(dateSpan(d({ day: '1-lithe' }), 'day', ta)!.to);
    expect(s.to - s.from).toBeCloseTo(31 / 366); // 30 days of June and Midsummer's Eve
  });

  it('is the start span without an end, undefined for unknown or timeless ages', () => {
    expect(whenSpan({ start: d({}), precision: 'year' }, ages)).toEqual({ from: yearStart, to: yearStart + 1 });
    expect(whenSpan({ start: { age: 'nowhere', year: 1 }, precision: 'year' }, ages)).toBeUndefined();
    expect(whenSpan({ start: { age: 'before-time', year: 1 }, precision: 'year' }, ages)).toBeUndefined();
  });

  it('touching spans do not overlap', () => {
    expect(overlaps({ from: 0, to: 1 }, { from: 1, to: 2 })).toBe(false);
    expect(overlaps({ from: 0, to: 1.01 }, { from: 1, to: 2 })).toBe(true);
  });

  it('adjacent days do not overlap, despite float rounding (26 and 27 September 3018)', () => {
    const day = (year: number, month: number, dd: number) => dateSpan(d({ year, month, day: dd }), 'day', ta)!;
    const a = day(3018, 9, 26), b = day(3018, 9, 27);
    expect(overlaps(a, b)).toBe(false);
    expect(overlaps(b, a)).toBe(false);
    expect(overlaps(a, a)).toBe(true);
    // Every pair of neighbouring days in the busiest years.
    for (const year of [2941, 3018, 3019]) for (let s = 0; s < 365; s++) {
      const x = dateSpan({ age: 'third-age', year, ...slotDay(s) }, 'day', ta)!, y = dateSpan({ age: 'third-age', year, ...slotDay(s + 1) }, 'day', ta)!;
      expect(overlaps(x, y), `${year} slot ${s}`).toBe(false);
    }
  });

  it('adjacent Valian years do not overlap', () => {
    const vy = (year: number) => dateSpan({ age: 'years-of-the-trees', year }, 'year', { id: 'years-of-the-trees', axis: { start: -14372, yearLength: 9.582 } })!;
    for (let year = 1; year < 1500; year += 37) expect(overlaps(vy(year), vy(year + 1)), `Y.T. ${year}`).toBe(false);
  });

  it('within: the end of a span is outside it, its start inside, after float rounding', () => {
    const a = dateSpan(d({ year: 3018, month: 9, day: 26 }), 'day', ta)!, b = dateSpan(d({ year: 3018, month: 9, day: 27 }), 'day', ta)!;
    expect(within(b.from, a)).toBe(false);
    expect(within(a.to, b)).toBe(true);
    expect(within(a.from, a)).toBe(true);
  });
});

describe('yearsBetween', () => {
  const y = (year: number, p: 'year' | 'season' | 'approximate' = 'year', x: Partial<StoryDate> = {}) => dateSpan(d({ year, ...x }), p, ta)!;
  it('counts the whole years that certainly passed between two honest ranges', () => {
    expect(yearsBetween(y(2463), y(2770))).toBe(306);          // end of 2463 to the start of 2770
    expect(yearsBetween(y(2941), y(2942))).toBe(0);            // back to back
    expect(yearsBetween(y(2941, 'season', { season: 'spring' }), y(2942, 'season', { season: 'autumn' }))).toBe(1);
  });
  it('is 0 when the ranges overlap, and widens with imprecision', () => {
    expect(yearsBetween(y(2941), y(2941, 'season', { season: 'summer' }))).toBe(0);
    expect(yearsBetween(y(2460, 'approximate'), y(2470))).toBe(4); // c. 2460 may run to the end of 2465: 2466–2469
  });
  it("counts in the age's own years when given the age: Valian years in the Years of the Trees", () => {
    const yt = (year: number) => dateSpan({ age: trees.id, year }, 'year', trees)!;
    // Years 1 and 76: 74 whole Valian years between them (2–75), which are 740 years of the Sun.
    expect(yearsBetween(yt(1), yt(76), trees)).toBe(74);
    expect(yearsBetween(yt(1), yt(76))).toBe(740);
    expect(yearsBetween(y(2463), y(2770), ta)).toBe(306); // a Sun-year age is unchanged
  });
});

describe('likely or possibly at the same time (nearness, docs/DESIGN.md §4.4)', () => {
  const at = 4032 + 2940 + 0.5;
  const wide = { from: at - 1, to: at + 1 };
  /** An event with a wide honest span (so spans always overlap), a guess `offsetDays` from `at`, and a precision. */
  const e = (id: string, precision: Precision | undefined, offsetDays: number, extra: Partial<Timed> = {}): Timed => ({
    id, span: wide, at: at + offsetDays * ONE_DAY, ...precision ? { when: { precision } } : {}, characters: [], links: [], ...extra,
  });

  it('names the windows: ±3 days, ±15 days, ±45 days; none for a year or vaguer', () => {
    expect(LIKELY_DAY).toBeCloseTo(3 * ONE_DAY, 12);
    expect(LIKELY_MONTH).toBeCloseTo(15 * ONE_DAY, 12);
    expect(LIKELY_SEASON).toBeCloseTo(45 * ONE_DAY, 12);
    expect(likelyWindow('day')).toBe(LIKELY_DAY);
    expect(likelyWindow('month')).toBe(LIKELY_MONTH);
    expect(likelyWindow('season')).toBe(LIKELY_SEASON);
    for (const p of ['year', 'decade', 'approximate', undefined] as const) expect(likelyWindow(p)).toBeUndefined();
  });

  it('takes the vaguer of two precisions; timeless beats everything', () => {
    expect(vaguer('day', 'season')).toBe('season');
    expect(vaguer('month', 'day')).toBe('month');
    expect(vaguer('year', 'approximate')).toBe('approximate');
    expect(vaguer('day', undefined)).toBeUndefined();
  });

  it('day: likely within 3 days, possibly beyond', () => {
    expect(nearness(e('a', 'day', 0), e('b', 'day', 3))).toEqual({ kind: 'likely', why: 'window' });
    expect(nearness(e('a', 'day', 0), e('b', 'day', 4))).toEqual({ kind: 'possibly', why: 'too-far' });
  });

  it('month: the vaguer precision sets the window (15 days)', () => {
    expect(nearness(e('a', 'day', 0), e('b', 'month', 15))?.kind).toBe('likely');
    expect(nearness(e('a', 'month', 0), e('b', 'day', 16))?.kind).toBe('possibly');
  });

  it('season: 45 days', () => {
    expect(nearness(e('a', 'day', 0), e('b', 'season', 45))?.kind).toBe('likely');
    expect(nearness(e('a', 'season', 0), e('b', 'season', 46))?.kind).toBe('possibly');
  });

  it('year, decade, approximate or timeless: never likely, only possibly', () => {
    for (const p of ['year', 'decade', 'approximate'] as const) expect(nearness(e('a', 'day', 0), e('b', p, 0))).toEqual({ kind: 'possibly', why: 'vague' });
    expect(nearness(e('a', 'day', 0), e('b', undefined, 0))).toEqual({ kind: 'possibly', why: 'vague' });
  });

  it('a shared character in another scene is never likely: story order says one follows the other', () => {
    expect(nearness(e('a', 'day', 0, { characters: ['bilbo'] }), e('b', 'day', 0, { characters: ['bilbo', 'thorin'] })))
      .toEqual({ kind: 'possibly', why: 'same-character' });
  });

  it('unless the two are linked concurrent or crossing (either side); the window still applies', () => {
    for (const type of ['concurrent', 'crossing']) {
      const a = e('a', 'day', 0, { characters: ['bilbo'], links: [{ to: 'b', type }] });
      expect(nearness(a, e('b', 'day', 1, { characters: ['bilbo'] }))?.kind).toBe('likely');
      expect(nearness(e('b', 'day', 1, { characters: ['bilbo'] }), a)?.kind).toBe('likely');
      expect(nearness(a, e('b', 'day', 9, { characters: ['bilbo'] }))?.kind).toBe('possibly');
    }
    // Other links don't lift the rule.
    const caused = e('a', 'day', 0, { characters: ['bilbo'], links: [{ to: 'b', type: 'causes' }] });
    expect(nearness(caused, e('b', 'day', 1, { characters: ['bilbo'] }))?.why).toBe('same-character');
  });

  it('nothing at all when the honest ranges miss each other, for the same event, or for a timeless one', () => {
    const early = { ...e('a', 'day', 0), span: { from: at - 1, to: at } };
    const late = { ...e('b', 'day', 0), span: { from: at, to: at + 1 } };
    expect(nearness(early, late)).toBeUndefined();
    expect(nearness(e('a', 'day', 0), e('a', 'day', 0))).toBeUndefined();
    expect(nearness(e('a', 'day', 0), { id: 'music' })).toBeUndefined();
  });

  it('the bare time cursor uses the event\'s own precision', () => {
    expect(nearnessAt(at, e('b', 'day', 2))?.kind).toBe('likely');
    expect(nearnessAt(at, e('b', 'day', 5))?.kind).toBe('possibly');
    expect(nearnessAt(at, e('b', 'season', 40))?.kind).toBe('likely');
    expect(nearnessAt(at, e('b', 'year', 0))).toEqual({ kind: 'possibly', why: 'vague' });
    expect(nearnessAt(at + 2, e('b', 'day', 0))).toBeUndefined(); // outside its honest range
  });
});

// ---------- Moments on the time cursor (docs/DESIGN.md §3.1) ----------

describe('moments: ages, windows and steps', () => {
  const fa: Age = { id: 'first-age', order: 4, name: { en: 'First Age' }, summary: { en: '' }, axis: { start: 1, yearLength: 1 } };
  const sa: Age = { id: 'second-age', order: 5, name: { en: 'Second Age' }, summary: { en: '' }, axis: { start: 591, yearLength: 1 } };
  const yt: Age = { id: 'years-of-the-trees', order: 3, name: { en: 'Trees' }, summary: { en: '' }, axis: { start: -14372, yearLength: 9.582 } };
  const list = [yt, fa, sa];
  const at = (year: number, x: Partial<StoryDate>): StoryDate => ({ age: 'first-age', year, ...x });

  it("counts an age's own years up to the next age; the last one is open", () => {
    expect(ageYearCount(fa, list)).toBe(590);
    expect(ageYearCount(yt, list)).toBe(1500);
    expect(ageYearCount(sa, list)).toBeUndefined();
  });

  it('slotDay is the inverse of daySlot', () => {
    for (let s = 0; s < 366; s++) { const x = slotDay(s); expect(daySlot(x.month, x.day)).toBe(s); }
  });

  it('day windows: a month with the days outside the months beside it', () => {
    expect(dayWindowSlots(4, 26)).toEqual({ month: 4, from: daySlot(4, 1), to: daySlot(4, 30) + 1 });
    expect(dayWindowSlots(6, 1)).toEqual({ month: 6, from: daySlot(6, 1), to: daySlot(7, 1) }); // with the Lithe days
    expect(dayWindowSlots(7, 3).from).toBe(daySlot(undefined, '1-lithe'));
    expect(dayWindowSlots(undefined, 'midyear').month).toBe(6);
    expect(dayWindowSlots(1, 1).from).toBe(0); // 2 Yule opens Afteryule
    expect(dayWindowSlots(undefined, '1-yule')).toEqual({ month: 12, from: daySlot(12, 1), to: 366 });
  });

  it('steps days through the Lithe days, skipping an Overlithe that does not exist', () => {
    expect(stepDate(at(495, { month: 6, day: 30 }), 'day', 1, list)).toEqual(at(495, { day: '1-lithe' }));
    expect(stepDate(at(495, { day: 'midyear' }), 'day', 1, list)).toEqual(at(495, { day: '2-lithe' })); // 495: no Overlithe
    expect(stepDate(at(496, { day: 'midyear' }), 'day', 1, list)).toEqual(at(496, { day: 'overlithe' }));
    expect(stepDate(at(495, { day: '1-yule' }), 'day', 1, list)).toEqual(at(496, { day: '2-yule' }));
    expect(stepDate(at(495, { day: '2-yule' }), 'day', -1, list)).toEqual(at(494, { day: '1-yule' }));
  });

  it('steps months, leaving a day outside the months for the month beside it', () => {
    expect(stepDate(at(495, { month: 12 }), 'month', 1, list)).toEqual(at(496, { month: 1 }));
    expect(stepDate(at(495, { month: 1 }), 'month', -1, list)).toEqual(at(494, { month: 12 }));
    expect(stepDate(at(495, { day: '1-lithe' }), 'month', 1, list)).toEqual(at(495, { month: 7, day: 1 }));
    expect(stepDate(at(495, { day: '1-lithe' }), 'month', -1, list)).toEqual(at(495, { month: 6, day: 1 }));
    expect(stepDate(at(495, { month: 3, day: 15 }), 'month', 1, list)).toEqual(at(495, { month: 4, day: 15 }));
  });

  it('runs on into the next age and back, and stops at the first year on the axis', () => {
    expect(stepDate({ age: 'first-age', year: 590 }, 'year', 1, list)).toEqual({ age: 'second-age', year: 1 });
    expect(stepDate({ age: 'second-age', year: 1 }, 'year', -1, list)).toEqual({ age: 'first-age', year: 590 });
    expect(stepDate({ age: 'first-age', year: 1 }, 'year', -1, list)).toEqual({ age: 'years-of-the-trees', year: 1500 });
    expect(stepDate({ age: 'years-of-the-trees', year: 3 }, 'year', -10, list)).toEqual({ age: 'years-of-the-trees', year: 1 });
    expect(stepDate(at(590, { day: '1-yule' }), 'day', 1, list)).toEqual({ age: 'second-age', year: 1, day: '2-yule' });
  });
});

describe('nearnessDuring: the time cursor over a whole moment', () => {
  const year = dateSpan(d({}), 'year', ta)!;
  const day = dateSpan(d({ month: 4, day: 26 }), 'day', ta)!;
  const ev = (precision: Precision, span: { from: number; to: number }, at: number): Timed => ({ id: 'x', span, at, when: { precision } });

  it('an empty moment is the bare cursor', () => {
    const e = ev('day', day, (day.from + day.to) / 2);
    expect(nearnessDuring({ from: day.from, to: day.from }, e)).toEqual(nearnessAt(day.from, e));
  });

  it('a whole year: exact events inside it are likely; year-dated ones only possibly', () => {
    expect(nearnessDuring(year, ev('day', day, (day.from + day.to) / 2))?.kind).toBe('likely');
    expect(nearnessDuring(year, ev('year', year, (year.from + year.to) / 2))).toEqual({ kind: 'possibly', why: 'vague' });
  });

  it("a day: a guess within the event's own window of it is likely, further only possibly, outside its range nothing", () => {
    const summer = dateSpan(d({ season: 'summer' }), 'season', ta)!;
    const s = dateSpan(d({ month: 7, day: 10 }), 'day', ta)!;
    expect(nearnessDuring(s, ev('season', summer, s.from + 40 * ONE_DAY))?.kind).toBe('likely');
    expect(nearnessDuring(s, ev('season', summer, s.from + 50 * ONE_DAY))).toEqual({ kind: 'possibly', why: 'too-far' });
    expect(nearnessDuring(day, ev('season', summer, summer.from))).toBeUndefined();
  });
});
