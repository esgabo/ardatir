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
  loadFailed: {
    en: 'This scene could not be loaded. Check your connection and reload the page.',
    es: 'No se pudo cargar esta escena. Revisa tu conexión y recarga la página.',
  },
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
  // Sidebar (docs/DESIGN.md §3.3)
  navigation: { en: 'Navigation', es: 'Navegación' },
  home: { en: 'Ardatir home: the cosmos', es: 'Inicio de Ardatir: el cosmos' },
  view_ages: { en: 'Ages', es: 'Edades' },
  view_stories: { en: 'Stories', es: 'Historias' },
  view_lives: { en: 'Lives', es: 'Vidas' },
  view_books: { en: 'Books', es: 'Libros' },
  view_places: { en: 'Places', es: 'Lugares' },
  title_ages: { en: 'The Ages', es: 'Las Edades' },
  title_stories: { en: 'Stories', es: 'Historias' },
  title_lives: { en: 'Lives', es: 'Vidas' },
  title_books: { en: 'Books', es: 'Libros' },
  title_places: { en: 'Places', es: 'Lugares' },
  hint_ages: { en: 'Browse the Ages', es: 'Recorre las Edades' },
  hint_stories: { en: 'Stories that span many events', es: 'Historias que abarcan muchos eventos' },
  hint_lives: { en: "Follow a character's life", es: 'Sigue la vida de un personaje' },
  hint_books: { en: 'Browse by book and chapter', es: 'Explora por libro y capítulo' },
  hint_places: { en: 'Everything that happened in a place', es: 'Todo lo que ocurrió en un lugar' },
  search: { en: 'Search events, people, places', es: 'Busca eventos, personajes, lugares' },
  noResults: { en: 'Nothing found.', es: 'No se encontró nada.' },
  resultsEvents: { en: 'Events', es: 'Eventos' },
  resultsLives: { en: 'Characters', es: 'Personajes' },
  resultsPlaces: { en: 'Places', es: 'Lugares' },
  collapse: { en: 'Collapse sidebar', es: 'Plegar barra lateral' },
  expand: { en: 'Expand sidebar', es: 'Desplegar barra lateral' },
  openMenu: { en: 'Open menu', es: 'Abrir menú' },
  closeMenu: { en: 'Close menu', es: 'Cerrar menú' },
  otherEvents: { en: 'Other events', es: 'Otros eventos' },
  noEvents: { en: 'No events yet.', es: 'Aún no hay eventos.' },
  chapter: { en: 'Chapter', es: 'Capítulo' },
  kinOf: { en: 'Kin', es: 'Parientes' },
  about: { en: 'About', es: 'Acerca de' },
  playable: { en: 'Can be watched', es: 'Se puede ver' },
  // Over the stage
  breadcrumb: { en: 'You are here', es: 'Estás aquí' },
  zoom: { en: 'Zoom level', es: 'Nivel de zoom' },
  zoom_cosmos: { en: 'Cosmos', es: 'Cosmos' },
  zoom_world: { en: 'World', es: 'Mundo' },
  zoom_event: { en: 'Event', es: 'Evento' },
  worldSoon: { en: 'The world map is not built yet', es: 'El mapa del mundo aún no está hecho' },
  prevEvent: { en: 'Previous event', es: 'Evento anterior' },
  nextEvent: { en: 'Next event', es: 'Evento siguiente' },
  meanwhile: { en: 'Meanwhile…', es: 'Mientras tanto…' },
  connected: { en: 'Connected', es: 'Relacionado' },
  sameTime: { en: 'Around the same time', es: 'Por las mismas fechas' },
  nothingMeanwhile: { en: 'Nothing else is recorded at this time yet.', es: 'Aún no hay nada más registrado en estas fechas.' },
  link_causes: { en: 'leads to', es: 'provoca' },
  'link_caused-by': { en: 'caused by', es: 'causado por' },
  link_enables: { en: 'makes possible', es: 'hace posible' },
  'link_enabled-by': { en: 'made possible by', es: 'posible gracias a' },
  link_concurrent: { en: 'at the same time', es: 'al mismo tiempo' },
  link_crossing: { en: 'paths cross', es: 'caminos que se cruzan' },
  // Books (published Spanish titles)
  'book_the-hobbit': { en: 'The Hobbit', es: 'El Hobbit' },
  'book_the-fellowship-of-the-ring': { en: 'The Fellowship of the Ring', es: 'La Comunidad del Anillo' },
  'book_the-two-towers': { en: 'The Two Towers', es: 'Las Dos Torres' },
  'book_the-return-of-the-king': { en: 'The Return of the King', es: 'El Retorno del Rey' },
  'book_the-lord-of-the-rings': { en: 'The Lord of the Rings', es: 'El Señor de los Anillos' },
  'book_the-silmarillion': { en: 'The Silmarillion', es: 'El Silmarillion' },
  'book_unfinished-tales': { en: 'Unfinished Tales', es: 'Cuentos inconclusos' },
  spring: { en: 'spring', es: 'primavera' },
  summer: { en: 'summer', es: 'verano' },
  autumn: { en: 'autumn', es: 'otoño' },
  winter: { en: 'winter', es: 'invierno' },
  // Days outside the months (Shire Reckoning, Appendix D); keys are `day_<ExtraDay>`
  'day_2-yule': { en: '2 Yule', es: '2 Yule' },
  'day_1-lithe': { en: '1 Lithe', es: '1 Lithe' },
  day_midyear: { en: "Mid-year's Day", es: 'Día de Mitad del Año' },
  day_overlithe: { en: 'Overlithe', es: 'Sobrelithe' },
  'day_2-lithe': { en: '2 Lithe', es: '2 Lithe' },
  'day_1-yule': { en: '1 Yule', es: '1 Yule' },
} satisfies Record<string, LocalizedText>;

export type UiKey = keyof typeof UI;

export function t(key: UiKey, lang: Lang): string {
  return tr(UI[key], lang);
}
