// Which recording plays: the audio language apart from the reading language (src/audioChoice.ts),
// and how the choice rides in the URL (src/routes.ts).

import { describe, expect, it } from 'vitest';
import { pickAudio } from '../src/audioChoice.ts';
import { eventHref, parseRoute } from '../src/routes.ts';

describe('pickAudio', () => {
  it('plays English for a Spanish reader when only English is recorded', () => {
    expect(pickAudio(['en'], 'es')).toBe('en');
  });
  it('plays the reading language when it is recorded', () => {
    expect(pickAudio(['en', 'es'], 'es')).toBe('es');
  });
  it('plays what the visitor asked for', () => {
    expect(pickAudio(['en', 'es'], 'es', 'en')).toBe('en');
  });
  it('falls back when the asked-for language is not recorded', () => {
    expect(pickAudio(['en'], 'es', 'es')).toBe('en');
  });
  it('is silent with no recordings', () => {
    expect(pickAudio([], 'en')).toBeNull();
    expect(pickAudio(['es'], 'en')).toBeNull(); // only the reading language or English, never a third choice unasked
  });
  it('is silent when asked for off', () => {
    expect(pickAudio(['en'], 'en', 'off')).toBeNull();
  });
});

describe('the audio route', () => {
  it('reads ?audio=', () => {
    expect(parseRoute('#/event/ainulindale?lang=es&audio=en')).toMatchObject({ kind: 'event', eventId: 'ainulindale', lang: 'es', audio: 'en' });
  });
  it('writes audio only when given', () => {
    expect(eventHref('x', 'es', { audio: 'en' })).toBe('#/event/x?audio=en&lang=es');
    expect(eventHref('x', 'es')).toBe('#/event/x?lang=es');
  });
});
