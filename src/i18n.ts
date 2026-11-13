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
  audioLanguage: { en: 'Narration heard in', es: 'Narración en' },
  audio_en: { en: 'English', es: 'inglés' },
  audio_es: { en: 'Spanish', es: 'español' },
  events: { en: 'Events', es: 'Eventos' },
  language: { en: 'Language', es: 'Idioma' },
  progress: { en: 'Event progress', es: 'Progreso del evento' },
  pressPlay: { en: 'Press play to begin', es: 'Pulsa reproducir para comenzar' },
  loadFailed: {
    en: 'This scene could not be loaded. Check your connection and reload the page.',
    es: 'No se pudo cargar esta escena. Revisa tu conexión y recarga la página.',
  },
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
  kind_raven: { en: 'Raven', es: 'Cuervo' },
  'kind_skin-changer': { en: 'Skin-changer', es: 'Cambiapieles' },
  'kind_the-one': { en: 'The One', es: 'El Único' },
  kind_maia: { en: 'Maia', es: 'Maia' },
  kind_balrog: { en: 'Balrog', es: 'Balrog' },
  kind_ent: { en: 'Ent', es: 'Ent' },
  kind_huorn: { en: 'Huorn', es: 'Ucorno' },
  kind_spider: { en: 'Spider', es: 'Araña' },
  kind_beast: { en: 'Beast', es: 'Bestia' },
  kind_wolf: { en: 'Wolf', es: 'Lobo' },
  kind_warg: { en: 'Warg', es: 'Huargo' },
  kind_horse: { en: 'Horse', es: 'Caballo' },
  kind_other: { en: 'Other being', es: 'Otro ser' },
  // Cosmos labels (Ambarkanta): the Quenya names stay, the gloss is translated.
  ambar: { en: 'Ambar · the Earth', es: 'Ambar · la Tierra' },
  vista: { en: 'Vista · the inner air', es: 'Vista · el aire interior' },
  ilmen: { en: 'Ilmen · where the stars are set', es: 'Ilmen · donde se fijan las estrellas' },
  vaiya: { en: 'Vaiya · the encircling seas', es: 'Vaiya · los mares circundantes' },
  walls: { en: 'Ilurambar · the Walls of the World', es: 'Ilurambar · los Muros del Mundo' },
  kuma: { en: 'Kúma · the Void', es: 'Kúma · el Vacío' },
  moon: { en: 'Isil · the Moon', es: 'Isil · la Luna' },
  sun: { en: 'Anar · the Sun', es: 'Anar · el Sol' },
  straightRoad: { en: 'the Straight Road', es: 'el Camino Recto' },
  elves: { en: 'Elves', es: 'Elfos' },
  men: { en: 'Men', es: 'Hombres' },
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
  collapseCard: { en: 'Collapse event card', es: 'Plegar la ficha del evento' },
  expandCard: { en: 'Expand event card', es: 'Desplegar la ficha del evento' },
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
  // "Likely" and "possibly" at the same time, and how a best guess is placed (#2, docs/DESIGN.md §4.4)
  likelySameTime: { en: 'Likely at the same time', es: 'Probablemente a la vez' },
  ourBestGuess: { en: 'our best guess', es: 'nuestra mejor estimación' },
  possiblySameTime: { en: 'Possibly at the same time', es: 'Posiblemente a la vez' },
  possiblyWhy: { en: 'Their honest date ranges overlap.', es: 'Los intervalos de fechas que permiten las fuentes se solapan.' },
  whyLikely: { en: 'Why we think so', es: 'Por qué lo creemos' },
  likelyWithin: { en: 'By our best guess, the two fall within {w} of each other.', es: 'Según nuestra mejor estimación, ocurren con menos de {w} de diferencia.' },
  within_day: { en: 'three days', es: 'tres días' },
  within_month: { en: 'half a month', es: 'medio mes' },
  within_season: { en: 'a month and a half', es: 'mes y medio' },
  placedLabel: { en: 'On the timeline', es: 'En la línea del tiempo' },
  place_exact: { en: 'The sources give {date}.', es: 'Las fuentes dan la fecha: {date}.' },
  place_range: { en: 'The sources say only {date}.', es: 'Las fuentes solo dicen {date}.' },
  place_between: { en: 'We place it after {a} and before {b}, because that is the order of {story}.', es: 'Lo situamos después de {a} y antes de {b}, porque ese es el orden de {story}.' },
  place_after: { en: 'We place it after {a}, because that is the order of {story}.', es: 'Lo situamos después de {a}, porque ese es el orden de {story}.' },
  place_before: { en: 'We place it before {b}, because that is the order of {story}.', es: 'Lo situamos antes de {b}, porque ese es el orden de {story}.' },
  place_shared: { en: 'It shares that stretch with {n} other events, spaced out in story order.', es: 'Comparte ese tramo con otros {n} eventos, repartidos en el orden de la historia.' },
  place_middle: { en: 'Nothing near it in the story has an exact date, so we place it in the middle of that range.', es: 'Nada cercano en la historia tiene fecha exacta, así que lo situamos en mitad de ese intervalo.' },
  place_spaced: { en: 'Nothing near it in the story has an exact date, so we spread it and {n} others evenly through that range, in story order.', es: 'Nada cercano en la historia tiene fecha exacta, así que lo repartimos con otros {n} a lo largo de ese intervalo, en el orden de la historia.' },
  place_follows_lane: { en: 'We place it just after {a}, which comes before it in {story}.', es: 'Lo situamos justo después de {a}, que va antes en {story}.' },
  place_follows_caused: { en: 'We place it just after {a}, which led to it.', es: 'Lo situamos justo después de {a}, que lo provocó.' },
  place_follows_enabled: { en: 'We place it just after {a}, which made it possible.', es: 'Lo situamos justo después de {a}, que lo hizo posible.' },
  storyOf1: { en: "{a}'s story", es: 'la historia de {a}' },
  storyOf2: { en: "{a}'s and {b}'s stories", es: 'las historias de {a} y {b}' },
  link_causes: { en: 'leads to', es: 'provoca' },
  'link_caused-by': { en: 'caused by', es: 'causado por' },
  link_enables: { en: 'makes possible', es: 'hace posible' },
  'link_enabled-by': { en: 'made possible by', es: 'posible gracias a' },
  link_concurrent: { en: 'at the same time', es: 'al mismo tiempo' },
  link_crossing: { en: 'paths cross', es: 'caminos que se cruzan' },
  // The time cursor (#1, docs/DESIGN.md §3.1)
  view_time: { en: 'Time', es: 'Tiempo' },
  title_time: { en: 'Time', es: 'Tiempo' },
  hint_time: { en: "Pick a moment, see what's happening everywhere", es: 'Elige un momento y mira qué ocurre en todas partes' },
  timeline: { en: 'Timeline', es: 'Línea del tiempo' },
  theAges: { en: 'The ages', es: 'Las edades' },
  'ageShort_before-time': { en: 'Before', es: 'Antes' },
  'ageShort_years-of-the-lamps': { en: 'Lamps', es: 'Lámparas' },
  ageShort_foretold: { en: 'Foretold', es: 'Profecía' },
  ageYears: { en: '{n} years', es: '{n} años' },
  ageValianYears: { en: '{n} Valian years', es: '{n} años valianos' },
  moment: { en: 'Moment', es: 'Momento' },
  scale: { en: 'Scale', es: 'Escala' },
  scale_age: { en: 'Age', es: 'Edad' },
  scale_century: { en: 'Century', es: 'Siglo' },
  scale_year: { en: 'Year', es: 'Año' },
  scale_month: { en: 'Month', es: 'Mes' },
  earlier: { en: 'Earlier', es: 'Antes' },
  later: { en: 'Later', es: 'Después' },
  timeKeys: {
    en: 'Drag or tap the scale. Arrow keys step by its unit, Page Up and Page Down by more, Home and End go to its ends; + and − zoom.',
    es: 'Arrastra o toca la escala. Las flechas avanzan una unidad de la escala; Re Pág y Av Pág, a saltos mayores; Inicio y Fin van a sus extremos; + y − cambian la escala.',
  },
  momentNote_year: { en: 'The whole year: everything the sources allow within it.', es: 'El año entero: todo lo que las fuentes permiten dentro de él.' },
  momentNote_season: { en: 'The whole season.', es: 'La estación entera.' },
  momentNote_month: { en: 'The whole month.', es: 'El mes entero.' },
  momentNote_day: { en: 'A single day.', es: 'Un solo día.' },
  momentNote_timeless: {
    en: 'Outside time: this happens before the world has days or years, so it has no place on the timeline.',
    es: 'Fuera del tiempo: ocurre antes de que el mundo tenga días o años, así que no tiene lugar en la línea del tiempo.',
  },
  momentNote_foretold: {
    en: 'Foretold, not history: what the prophecies say will come after all the ages. It has no date, so it stands past the end of the timeline.',
    es: 'Profetizado, no historia: lo que las profecías dicen que vendrá después de todas las edades. No tiene fecha, así que queda más allá del final de la línea del tiempo.',
  },
  // What is foretold (#57, docs/DESIGN.md §4.8)
  foretold: { en: 'Foretold', es: 'Profecía' },
  foretoldHint: { en: 'Foretold, not told as history', es: 'Profecía; no se narra como historia' },
  foretoldBy: { en: 'Foretold by {a}, not told as history.', es: 'Lo predijo {a}; no se narra como historia.' },
  foretoldNoOne: { en: 'Foretold, not told as history.', es: 'Es una profecía; no se narra como historia.' },
  foretoldSource: { en: 'Source: {s}.', es: 'Fuente: {s}.' },
  foretoldTitle: { en: 'Foretold, not history', es: 'Profetizado, no historia' },
  valianNote: {
    en: 'In the Years of the Trees a year is a Valian year, about ten years of the Sun: only whole years can be chosen.',
    es: 'En los Años de los Árboles un año es un año valiano, unos diez años del Sol: solo se pueden elegir años enteros.',
  },
  momentsToVisit: { en: 'Moments to visit', es: 'Momentos para visitar' },
  'mo_first-age-495': { en: 'Nargothrond falls; Tuor at Ivrin', es: 'Cae Nargothrond; Tuor en Ivrin' },
  'mo_third-age-2941-08': { en: 'Mirkwood, and Gandalf gone south', es: 'El Bosque Negro, y Gandalf lejos, al sur' },
  'mo_third-age-3019-03-15': { en: 'Pelennor, and the Tower of Cirith Ungol', es: 'El Pelennor y la Torre de Cirith Ungol' },
  likelyThen: { en: 'Likely happening then', es: 'Lo que probablemente ocurre entonces' },
  possiblyThen: { en: 'Possibly happening then', es: 'Lo que posiblemente ocurre entonces' },
  possiblyThenWhy: { en: "The sources' date ranges include this moment, but say no more.", es: 'Los intervalos de fechas de las fuentes incluyen este momento, pero no dicen más.' },
  likelyDuring: { en: 'By our best guess, it falls within this moment ({m}).', es: 'Según nuestra mejor estimación, cae dentro de este momento ({m}).' },
  likelyNear: { en: 'By our best guess, it falls within {w} of this moment ({m}).', es: 'Según nuestra mejor estimación, cae a menos de {w} de este momento ({m}).' },
  nothingThen: { en: 'Nothing is recorded at this moment yet. Try one nearby, or one of the moments above.', es: 'Aún no hay nada registrado en este momento. Prueba con uno cercano o con alguno de los de arriba.' },
  showAll: { en: 'Show all {n}', es: 'Mostrar los {n}' },
  outsideTime: { en: 'Outside time', es: 'Fuera del tiempo' },
  whereTitle: { en: 'Where everyone is', es: 'Dónde está cada cual' },
  whereNote: { en: 'From their journeys: where the sources allow them to be at this moment.', es: 'Según sus viajes: dónde permiten las fuentes que estén en este momento.' },
  whereAt: { en: 'At {a}', es: 'En {a}' },
  whereBetween: { en: 'Somewhere between {a} and {b}', es: 'En algún punto entre {a} y {b}' },
  guessAt: { en: 'at {a}', es: 'en {a}' },
  guessPast: { en: 'past {a}, on the way to {b}', es: 'tras {a}, de camino a {b}' },
  whereGuessWhy: {
    en: "The sources date these stops only as closely as shown. We space a journey's stops out in order between the dated ones around them: this is where those guesses put them, not a date the sources give.",
    es: 'Las fuentes fechan estas paradas solo hasta donde se indica. Repartimos las paradas de un viaje en orden entre las fechadas que las rodean: aquí es donde las sitúan esas estimaciones, no una fecha de las fuentes.',
  },
  thereEvent: { en: 'There', es: 'Allí' },
  atHome: { en: 'At home', es: 'En casa' },
  atHomeIn: { en: 'In their own country, {a}', es: 'En su propia tierra, {a}' },
  atHomeWhy: { en: 'They never travel: between their first and last recorded events, they are at home.', es: 'Nunca viajan: entre su primer y su último evento registrados, están en casa.' },
  seeOnTimeline: { en: 'See this moment on the timeline', es: 'Ver este momento en la línea del tiempo' },
  backTo: { en: 'Back to {e}', es: 'Volver a {e}' },
  openTimeline: { en: 'Open the timeline', es: 'Abrir la línea del tiempo' },
  thisEventsMoment: { en: "This event's moment", es: 'El momento de este evento' },
  timeIntro: {
    en: 'Pick any moment, from the Music before time to the Fourth Age, and see what is happening then, and where everyone is. Past the end lies what is foretold.',
    es: 'Elige cualquier momento, de la Música antes del tiempo a la Cuarta Edad, y mira qué ocurre entonces y dónde está cada cual. Más allá del final queda lo profetizado.',
  },
  // Event pages: events that can't be watched yet, read as text (#4)
  readable: { en: 'Read its story', es: 'Lee su historia' },
  status_outline: { en: 'Not staged yet: for now, its story is told here in words.', es: 'Aún sin escenificar: por ahora, su historia se cuenta aquí con palabras.' },
  status_scripted: { en: 'Written, not yet staged: below is the narration the animation will tell.', es: 'Escrita, aún sin escenificar: abajo está la narración que contará la animación.' },
  telling: { en: 'The telling', es: 'El relato' },
  tellingLoading: { en: 'Fetching the telling…', es: 'Cargando el relato…' },
  tellingFailed: { en: 'The telling could not be loaded. Check your connection and reload the page.', es: 'No se pudo cargar el relato. Revisa tu conexión y recarga la página.' },
  whoWasThere: { en: 'Who was there', es: 'Quiénes estaban' },
  connections: { en: 'Connections', es: 'Conexiones' },
  partOf: { en: 'Part of', es: 'Forma parte de' },
  onTheRoad: { en: 'On the road', es: 'En camino' },
  toldIn: { en: 'Told in', es: 'Se cuenta en' },
  before: { en: 'Before', es: 'Antes' },
  after: { en: 'After', es: 'Después' },
  beforeInStory: { en: 'Before, in this story', es: 'Antes, en esta historia' },
  afterInStory: { en: 'After, in this story', es: 'Después, en esta historia' },
  watch: { en: 'Watch', es: 'Ver' },
  around: { en: 'around', es: 'hacia' },
  circa: { en: 'c.', es: 'h.' },
  // Character lanes (#3, docs/DESIGN.md §3.2)
  livesTitle: { en: 'Lives side by side', es: 'Vidas en paralelo' },
  livesIntro: {
    en: 'Choose characters to follow their lives in story order. Where they share an event, their paths cross.',
    es: 'Elige personajes para seguir sus vidas en el orden de la historia. Donde comparten un evento, sus caminos se cruzan.',
  },
  addLife: { en: 'Add a life…', es: 'Añade una vida…' },
  removeLife: { en: 'Remove', es: 'Quitar' },
  lanesMax: { en: 'Up to eight lives at once.', es: 'Hasta ocho vidas a la vez.' },
  livesThatCross: { en: 'Lives that cross', es: 'Vidas que se cruzan' },
  sharedEvent: { en: 'one shared event', es: 'un evento en común' },
  sharedEvents: { en: 'shared events', es: 'eventos en común' },
  pathsCross: { en: 'Paths cross', es: 'Sus caminos se cruzan' },
  yearLater: { en: 'at least a year later', es: 'al menos un año después' },
  yearsLater: { en: 'at least {n} years later', es: 'al menos {n} años después' },
  // In the Years of the Trees the years are Valian years (each about ten of the Sun)
  valianYearLater: { en: 'at least a Valian year later', es: 'al menos un año valiano después' },
  valianYearsLater: { en: 'at least {n} Valian years later', es: 'al menos {n} años valianos después' },
  lanesShowing: { en: 'Showing {n} of {m} lives: a wider screen shows them all.', es: 'Se muestran {n} de {m} vidas: en una pantalla más ancha se ven todas.' },
  suggestions: { en: 'Characters', es: 'Personajes' },
  storyOrder: { en: 'In story order', es: 'En el orden de la historia' },
  sideBySide: { en: 'Side by side', es: 'En paralelo' },
  seeSideBySide: { en: 'See their lives side by side', es: 'Ver sus vidas en paralelo' },
  followLife: { en: 'Follow their life', es: 'Sigue su vida' },
  laneAdd: { en: 'Show beside the others', es: 'Mostrar junto a los demás' },
  laneRemove: { en: 'Take out of the lanes', es: 'Quitar de la vista en paralelo' },
  // Kin relations (`kin[].as` in characters/), as phrases: {a} is the relative, {b} the one
  // whose kin they are ("Túrin, cousin of Tuor"). Characters have no gender field, so Spanish
  // takes the gender from the English word (sister → hermana); for words with none (cousin,
  // sibling, betrothed, kin) it says it without guessing: "Túrin y Tuor, primos".
  kin_brother: { en: '{a}, brother of {b}', es: '{a}, hermano de {b}' },
  kin_sister: { en: '{a}, sister of {b}', es: '{a}, hermana de {b}' },
  kin_sibling: { en: '{a}, sibling of {b}', es: '{a} y {b}, hermanos' },
  kin_cousin: { en: '{a}, cousin of {b}', es: '{a} y {b}, primos' },
  kin_father: { en: '{a}, father of {b}', es: '{a}, padre de {b}' },
  kin_mother: { en: '{a}, mother of {b}', es: '{a}, madre de {b}' },
  kin_parent: { en: '{a}, parent of {b}', es: '{a}, de los padres de {b}' },
  kin_son: { en: '{a}, son of {b}', es: '{a}, hijo de {b}' },
  kin_daughter: { en: '{a}, daughter of {b}', es: '{a}, hija de {b}' },
  kin_child: { en: '{a}, child of {b}', es: '{a}, descendiente de {b}' },
  kin_grandfather: { en: '{a}, grandfather of {b}', es: '{a}, abuelo de {b}' },
  kin_grandmother: { en: '{a}, grandmother of {b}', es: '{a}, abuela de {b}' },
  kin_grandson: { en: '{a}, grandson of {b}', es: '{a}, nieto de {b}' },
  kin_granddaughter: { en: '{a}, granddaughter of {b}', es: '{a}, nieta de {b}' },
  kin_uncle: { en: '{a}, uncle of {b}', es: '{a}, tío de {b}' },
  kin_aunt: { en: '{a}, aunt of {b}', es: '{a}, tía de {b}' },
  kin_nephew: { en: '{a}, nephew of {b}', es: '{a}, sobrino de {b}' },
  kin_niece: { en: '{a}, niece of {b}', es: '{a}, sobrina de {b}' },
  kin_wife: { en: '{a}, wife of {b}', es: '{a}, esposa de {b}' },
  kin_husband: { en: '{a}, husband of {b}', es: '{a}, esposo de {b}' },
  kin_spouse: { en: '{a}, spouse of {b}', es: '{a} y {b}, casados' },
  kin_betrothed: { en: '{a}, betrothed of {b}', es: '{a} y {b}, prometidos' },
  kin_ancestor: { en: '{a}, ancestor of {b}', es: '{a}, de los antepasados de {b}' },
  kin_descendant: { en: '{a}, descendant of {b}', es: '{a}, descendiente de {b}' },
  kin_kin: { en: '{a}, kin of {b}', es: '{a}, pariente de {b}' },
  // Battles: their sides (factions)
  against: { en: 'against', es: 'contra' },
  sidesTitle: { en: 'The sides', es: 'Los bandos' },
  ledBy: { en: 'Led by {a}', es: 'Con {a} al frente' },
  resultsFactions: { en: 'Sides in battles', es: 'Bandos en las batallas' },
  // Books (published Spanish titles)
  'book_the-hobbit': { en: 'The Hobbit', es: 'El Hobbit' },
  'book_the-fellowship-of-the-ring': { en: 'The Fellowship of the Ring', es: 'La Comunidad del Anillo' },
  'book_the-two-towers': { en: 'The Two Towers', es: 'Las Dos Torres' },
  'book_the-return-of-the-king': { en: 'The Return of the King', es: 'El Retorno del Rey' },
  'book_the-lord-of-the-rings': { en: 'The Lord of the Rings', es: 'El Señor de los Anillos' },
  'book_the-silmarillion': { en: 'The Silmarillion', es: 'El Silmarillion' },
  'book_unfinished-tales': { en: 'Unfinished Tales', es: 'Cuentos inconclusos' },
  'book_the-adventures-of-tom-bombadil': { en: 'The Adventures of Tom Bombadil', es: 'Las aventuras de Tom Bombadil' },
  // The History of Middle-earth, vol. V; the Spanish title is unconfirmed (#51)
  'book_the-lost-road': { en: 'The Lost Road and Other Writings', es: 'El camino perdido y otros escritos' },
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
  // Wonder and learning (#29, docs/DESIGN.md §3.5): the first visit's opening
  openingWelcome: { en: 'Welcome to Ardatir', es: 'Te damos la bienvenida a Ardatir' },
  opening_void: { en: 'Before the world, there was only the Void, and Ilúvatar, the One.', es: 'Antes del mundo solo existía el Vacío, e Ilúvatar, el Único.' },
  opening_music: { en: 'He gave the Ainur a theme, and they sang. Their Music filled the emptiness.', es: 'Dio un tema a los Ainur, y cantaron. Su Música llenó el vacío.' },
  opening_discord: { en: 'One of them, Melkor, sang against it, and discord rang out. Yet even that became part of the song.', es: 'Uno de ellos, Melkor, cantó en contra, y resonó la discordia. Pero hasta ella acabó formando parte del canto.' },
  opening_vision: { en: 'Then Ilúvatar showed them what they had sung: a world. And he said, Let it be.', es: 'Entonces Ilúvatar les mostró lo que habían cantado: un mundo. Y dijo: Que sea.' },
  opening_arda: { en: 'So Arda was made: the world where all these stories happen.', es: 'Así nació Arda: el mundo donde suceden todas estas historias.' },
  openingNext: { en: 'Next', es: 'Siguiente' },
  openingSkip: { en: 'Skip the opening', es: 'Saltar la introducción' },
  openingClose: { en: 'Close', es: 'Cerrar' },
  openingArda: { en: 'Arda awaits', es: 'Arda te espera' },
  openingInvite: { en: 'Where would you like to begin?', es: '¿Por dónde quieres empezar?' },
  openingInviteSub: { en: 'Every story here is told in short scenes. Pick a way in; you can always come back.', es: 'Aquí cada historia se cuenta en escenas breves. Elige un camino; siempre puedes volver.' },
  wayStory: { en: 'Follow a story', es: 'Sigue una historia' },
  wayStoryBody: { en: 'The Hobbit, from the evening thirteen dwarves turn up at Bilbo’s door.', es: 'El Hobbit, desde la tarde en que trece enanos se presentan en casa de Bilbo.' },
  wayTime: { en: 'Pick a moment', es: 'Elige un momento' },
  wayTimeBody: { en: 'Choose any day in the long history, and see what is happening everywhere.', es: 'Elige cualquier día de la larga historia y mira qué ocurre en todas partes.' },
  wayLife: { en: 'Follow a life', es: 'Sigue una vida' },
  wayLifeBody: { en: 'Walk beside {a}, there and back again, and see whose paths cross his.', es: 'Acompaña a {a} en su viaje de ida y vuelta, y mira con quién se cruza su camino.' },
  openingStay: { en: 'Or stay a while among the stars', es: 'O quédate un rato entre las estrellas' },
  openingMenuHint: { en: 'Every way in is also in the menu.', es: 'Todos los caminos están también en el menú.' },
  startHere: { en: 'Start here', es: 'Empieza aquí' },
  startHereHint: { en: 'A short welcome: the Music, Arda, and three ways in', es: 'Una breve bienvenida: la Música, Arda y tres caminos para entrar' },
  // Learning on demand: how to say a name, the books, "About this scene"
  sayIt: { en: 'How to say it', es: 'Cómo se pronuncia' },
  inTheBooks: { en: 'In the books', es: 'En los libros' },
  readIn: { en: 'Read this in {book}, {where}.', es: 'Léelo en {book}, {where}.' },
  readInBook: { en: 'Read this in {book}.', es: 'Léelo en {book}.' },
  readInSub: { en: 'Here it is told in a few words of our own; Tolkien tells it in full, and far better.', es: 'Aquí se cuenta en pocas palabras nuestras; Tolkien lo cuenta entero, y mucho mejor.' },
  chapterN: { en: 'chapter {n}', es: 'capítulo {n}' },
  aboutScene: { en: 'About this scene', es: 'Sobre esta escena' },
  sceneNote: { en: 'A note on this scene', es: 'Una nota sobre esta escena' },
  whereIsThis: { en: 'Where is this?', es: '¿Dónde ocurre?' },
  whenIsThis: { en: 'When is this?', es: '¿Cuándo ocurre?' },
  whoIsThis: { en: 'Who is here?', es: '¿Quién aparece?' },
  beforeAndAfter: { en: 'Before and after', es: 'Antes y después' },
  happenedBefore: { en: 'What happened before', es: 'Lo que pasó antes' },
  comesNext: { en: 'What comes next', es: 'Lo que viene después' },
  showOnStage: { en: 'Show them in the scene', es: 'Mostrarlo en la escena' },
  aboutPlace: { en: 'About this place', es: 'Sobre este lugar' },
} satisfies Record<string, LocalizedText>;

export type UiKey = keyof typeof UI;

export function t(key: UiKey, lang: Lang): string {
  return tr(UI[key], lang);
}

/** Is there an interface string for this key? (For keys built from content ids: `kind_<kind>`, `kin_<as>`.) */
export const hasKey = (key: string): key is UiKey => Object.hasOwn(UI, key);

/** Is this key written in this language (not just falling back to English)? */
export const hasText = (key: string, lang: Lang): boolean => hasKey(key) && !!(UI[key] as LocalizedText)[lang];

/**
 * "Arwen, betrothed of Aragorn" / "Arwen y Aragorn, prometidos": `a` is `as` of `b`. A relation
 * with no phrase yet says only that they are kin, never shows the raw id in Spanish.
 */
export function kinPhrase(as: string, a: string, b: string, lang: Lang): string {
  const key = `kin_${as}`;
  const tpl = hasKey(key) ? t(key, lang) : lang === 'en' ? `{a}, ${as.replace(/-/g, ' ')} of {b}` : t('kin_kin', lang);
  return tpl.replace('{a}', a).replace('{b}', b);
}
