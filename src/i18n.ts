import { DEFAULT_LANG, LANGS, type Lang, type LocalizedText } from './data/types';

/** Pick the text for a language, falling back to English. */
export function tr(text: LocalizedText | undefined, lang: Lang): string {
  if (!text) return '';
  return text[lang] ?? text.en;
}

export function isLang(v: unknown): v is Lang {
  return typeof v === 'string' && (LANGS as readonly string[]).includes(v);
}

const STORAGE_KEY = 'ardatir.lang';

/** Language from the URL, else the visitor's last choice, else English. */
export function initialLang(fromUrl: string | null): Lang {
  if (isLang(fromUrl)) return fromUrl;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLang(stored)) return stored;
  } catch { /* storage unavailable: fine */ }
  return DEFAULT_LANG;
}

export function rememberLang(lang: Lang): void {
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
}

export const LANG_NAMES: Record<Lang, string> = { en: 'English', es: 'Español' };

/** Interface strings. Every key must exist in English; other languages fall back. */
const UI = {
  tagline: { en: 'a watch over Arda', es: 'una vigilia sobre Arda' },
  play: { en: 'Play', es: 'Reproducir' },
  pause: { en: 'Pause', es: 'Pausa' },
  mute: { en: 'Mute narration', es: 'Silenciar narración' },
  unmute: { en: 'Unmute narration', es: 'Activar narración' },
  events: { en: 'Events', es: 'Eventos' },
  language: { en: 'Language', es: 'Idioma' },
  progress: { en: 'Event progress', es: 'Progreso del evento' },
  pressPlay: { en: 'Press play to begin', es: 'Pulsa reproducir para comenzar' },
  notStaged: { en: 'not yet staged', es: 'aún sin escenificar' },
  disclaimer: {
    en: 'A non-commercial fan project. Not affiliated with the Tolkien Estate or Middle-earth Enterprises.',
    es: 'Un proyecto de fans sin fines comerciales. Sin relación con el Tolkien Estate ni con Middle-earth Enterprises.',
  },
  kind_hobbit: { en: 'Hobbit', es: 'Hobbit' },
  kind_wizard: { en: 'Wizard', es: 'Mago' },
  kind_dwarf: { en: 'Dwarf', es: 'Enano' },
  kind_troll: { en: 'Troll', es: 'Troll' },
  kind_man: { en: 'Man', es: 'Hombre' },
  kind_elf: { en: 'Elf', es: 'Elfo' },
  kind_dragon: { en: 'Dragon', es: 'Dragón' },
  kind_wraith: { en: 'Ringwraith', es: 'Espectro del Anillo' },
  kind_creature: { en: 'Creature', es: 'Criatura' },
  kind_ainu: { en: 'Ainu', es: 'Ainu' },
  kind_orc: { en: 'Orc', es: 'Orco' },
  kind_goblin: { en: 'Goblin', es: 'Trasgo' },
  kind_eagle: { en: 'Eagle', es: 'Águila' },
  'kind_skin-changer': { en: 'Skin-changer', es: 'Cambiapieles' },
  'kind_the-one': { en: 'The One', es: 'El Único' },
  // Cosmos labels (Ambarkanta): the Quenya names stay, the gloss is translated.
  ambar: { en: 'Ambar · the Earth', es: 'Ambar · la Tierra' },
  vista: { en: 'Vista · the inner air', es: 'Vista · el aire interior' },
  ilmen: { en: 'Ilmen · where the stars are set', es: 'Ilmen · donde se fijan las estrellas' },
  vaiya: { en: 'Vaiya · the encircling seas', es: 'Vaiya · los mares circundantes' },
  walls: { en: 'Ilurambar · the Walls of the World', es: 'Ilurambar · los Muros del Mundo' },
  kuma: { en: 'Kúma · the Void', es: 'Kúma · el Vacío' },
  spring: { en: 'spring', es: 'primavera' },
  summer: { en: 'summer', es: 'verano' },
  autumn: { en: 'autumn', es: 'otoño' },
  winter: { en: 'winter', es: 'invierno' },
} satisfies Record<string, LocalizedText>;

export type UiKey = keyof typeof UI;

export function t(key: UiKey, lang: Lang): string {
  return tr(UI[key], lang);
}
