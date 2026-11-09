import { describe, expect, it } from 'vitest';
import { APPROXIMATE_YEARS, axisToDate, dateSpan, daySlot, hasOverlithe, ONE_DAY, overlaps, whenSpan, yearsBetween } from '../src/data/calendar.ts';
import { EXTRA_DAYS, type Age, type StoryDate } from '../src/data/types.ts';

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
