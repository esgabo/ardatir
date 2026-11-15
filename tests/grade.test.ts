import { describe, expect, it } from 'vitest';
import { GRADES, PLACE_GRADES, gradeFor, graded } from '../src/scene/grade';
import { LIGHTS } from '../src/scene/lighting';

/** How bright a #rrggbb is, 0 to 255. */
const luma = (c: string) => {
  const n = parseInt(c.slice(1), 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
};
/** How far the furthest channel is from the mean: a rough stand-in for saturation. */
const spread = (c: string) => {
  const n = parseInt(c.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const mean = (ch[0] + ch[1] + ch[2]) / 3;
  return Math.max(...ch.map((v) => Math.abs(v - mean)));
};

describe('gradeFor', () => {
  it('is plain for a place nobody has graded', () => {
    expect(gradeFor('utumno-no-such-place')).toBe(GRADES.plain);
    expect(gradeFor(undefined)).toBe(GRADES.plain);
  });

  it('gives the places of the staged Hobbit events the grade they were written for', () => {
    expect(gradeFor('bag-end')).toBe(GRADES.shire);
    expect(gradeFor('green-dragon')).toBe(GRADES.shire);
    expect(gradeFor('trollshaws')).toBe(GRADES.wild);
    expect(gradeFor('rivendell')).toBe(GRADES.elvish);
  });

  it('names only grades that exist', () => {
    for (const [place, name] of Object.entries(PLACE_GRADES)) {
      expect(GRADES[name], `${place} asks for a grade "${name}" that is not defined`).toBeDefined();
    }
  });
});

describe('graded', () => {
  it('leaves the light exactly as it was under plain', () => {
    expect(graded(LIGHTS.day, GRADES.plain)).toBe(LIGHTS.day);
  });

  it('never touches story state: lamps and fireflies are the same at every grade', () => {
    for (const g of Object.values(GRADES)) {
      const out = graded(LIGHTS.dusk, g);
      expect(out.lamps).toBe(LIGHTS.dusk.lamps);
      expect(out.fireflies).toBe(LIGHTS.dusk.fireflies);
      expect(out.sunFrom).toEqual(LIGHTS.dusk.sunFrom);
    }
  });

  it('warms the Shire and cools Lake-town', () => {
    const [r] = [graded(LIGHTS.day, GRADES.shire).sun].map((c) => parseInt(c.slice(1), 16));
    const day = parseInt(LIGHTS.day.sun.slice(1), 16);
    expect((r >> 16) & 255).toBeGreaterThanOrEqual((day >> 16) & 255); // no less red than it was
    // Lake-town drains the colour out of the light rather than adding any.
    expect(spread(graded(LIGHTS.day.sun ? { ...LIGHTS.day, sun: '#88cc44' } : LIGHTS.day, GRADES.laketown).sun))
      .toBeLessThan(spread('#88cc44'));
  });

  it('takes the light out of Mirkwood and the underground, and leaves Rivendell bright', () => {
    expect(graded(LIGHTS.day, GRADES.mirkwood).sunIntensity).toBeLessThan(LIGHTS.day.sunIntensity);
    expect(graded(LIGHTS.day, GRADES.underground).sunIntensity).toBeLessThan(graded(LIGHTS.day, GRADES.mirkwood).sunIntensity);
    expect(luma(graded(LIGHTS.day, GRADES.mirkwood).sun)).toBeLessThan(luma(LIGHTS.day.sun));
    expect(graded(LIGHTS.day, GRADES.elvish).hemiIntensity).toBeGreaterThan(LIGHTS.day.hemiIntensity);
  });

  it('thickens the air where a place is meant to be thick, and keeps it inside its range', () => {
    expect(graded(LIGHTS.day, GRADES.mirkwood).fogDepth).toBeGreaterThan(LIGHTS.day.fogDepth);
    expect(graded(LIGHTS.day, GRADES.shire).fogDepth).toBeLessThan(LIGHTS.day.fogDepth);
    for (const g of Object.values(GRADES)) {
      for (const light of Object.values(LIGHTS)) {
        const d = graded(light, g).fogDepth;
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('the soft second light under a grade', () => {
  it('is never graded down: the darkest places get more of it, not less', () => {
    for (const name of ['mirkwood', 'underground', 'mordor'] as const) {
      const g = GRADES[name];
      expect(g.ambient, name).toBeLessThan(1);          // the place takes light away
      expect(g.fill ?? 1, name).toBeGreaterThan(1);     // and gives the readable light back
      expect(graded(LIGHTS.night, g).fillIntensity).toBeGreaterThan(LIGHTS.night.fillIntensity);
    }
  });

  it('leaves it alone where a place has no view about it', () => {
    expect(graded(LIGHTS.night, GRADES.shire).fillIntensity).toBe(LIGHTS.night.fillIntensity);
  });
});
