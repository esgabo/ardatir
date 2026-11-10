// Pointers to the books themselves (docs/DESIGN.md §3.5): "Read this in The Hobbit, chapter 5,
// “Riddles in the Dark”." from an event's `source`. Chapters are cited in content by number
// (The Hobbit) or by their English title; this gives them in each language. Spanish titles
// follow the published Minotauro editions as best we know them; the unconfirmed ones are on the
// checklist in issue #51. Pure: no DOM.

import type { EventSummary, Lang } from './data/types';
import { t as ui, type UiKey } from './i18n';

/** The Hobbit cites chapters by number; their titles. */
const HOBBIT: Record<number, { en: string; es: string }> = {
  1: { en: 'An Unexpected Party', es: 'Una tertulia inesperada' },
  2: { en: 'Roast Mutton', es: 'Cordero asado' },
  3: { en: 'A Short Rest', es: 'Un breve descanso' },
  4: { en: 'Over Hill and Under Hill', es: 'Sobre la colina y bajo la colina' },
  5: { en: 'Riddles in the Dark', es: 'Acertijos en las tinieblas' },
  6: { en: 'Out of the Frying-Pan into the Fire', es: 'De la sartén al fuego' },
  7: { en: 'Queer Lodgings', es: 'Extraños aposentos' },
  8: { en: 'Flies and Spiders', es: 'Moscas y arañas' },
  9: { en: 'Barrels Out of Bond', es: 'Barriles en libertad' },
  10: { en: 'A Warm Welcome', es: 'Una cálida bienvenida' },
  11: { en: 'On the Doorstep', es: 'En el umbral' },
  12: { en: 'Inside Information', es: 'Información secreta' },
  13: { en: 'Not at Home', es: 'Fuera de casa' },
  14: { en: 'Fire and Water', es: 'Fuego y agua' },
  15: { en: 'The Gathering of the Clouds', es: 'Se juntan las nubes' },
  16: { en: 'A Thief in the Night', es: 'Un ladrón en la noche' },
  17: { en: 'The Clouds Burst', es: 'Las nubes estallan' },
  18: { en: 'The Return Journey', es: 'El viaje de vuelta' },
  19: { en: 'The Last Stage', es: 'La última etapa' },
};

/** Spanish titles of the chapters cited by English title (all of them in content/ today). */
export const CHAPTERS_ES: Record<string, string> = {
  // The Silmarillion
  'Ainulindalë': 'Ainulindalë',
  'Akallabêth': 'Akallabêth',
  'Of the Beginning of Days': 'Del principio de los días',
  'Of the Coming of the Elves and the Captivity of Melkor': 'De la llegada de los Elfos y el cautiverio de Melkor',
  'Of Thingol and Melian': 'De Thingol y Melian',
  'Of Eldamar and the Princes of the Eldalië': 'De Eldamar y los príncipes de los Eldalië',
  'Of Fëanor and the Unchaining of Melkor': 'De Fëanor y la liberación de Melkor',
  'Of the Silmarils and the Unrest of the Noldor': 'De los Silmarils y la inquietud de los Noldor',
  'Of the Darkening of Valinor': 'Del oscurecimiento de Valinor',
  'Of the Flight of the Noldor': 'De la huida de los Noldor',
  'Of the Sun and Moon and the Hiding of Valinor': 'Del Sol y la Luna y el ocultamiento de Valinor',
  'Of Men': 'De los Hombres',
  'Of the Return of the Noldor': 'Del regreso de los Noldor',
  'Of Beleriand and its Realms': 'De Beleriand y sus reinos',
  'Of the Ruin of Beleriand and the Fall of Fingolfin': 'De la ruina de Beleriand y la caída de Fingolfin',
  'Of Beren and Lúthien': 'De Beren y Lúthien',
  'Of the Fifth Battle: Nirnaeth Arnoediad': 'De la Quinta Batalla: Nirnaeth Arnoediad',
  'Of Túrin Turambar': 'De Túrin Turambar',
  'Of the Ruin of Doriath': 'De la ruina de Doriath',
  'Of Tuor and the Fall of Gondolin': 'De Tuor y la caída de Gondolin',
  'Of Maeglin': 'De Maeglin',
  'Of the Voyage of Eärendil and the War of Wrath': 'Del viaje de Eärendil y la Guerra de la Cólera',
  'Of the Rings of Power and the Third Age': 'De los Anillos de Poder y la Tercera Edad',
  // The Fellowship of the Ring
  'A Long-expected Party': 'Una reunión muy esperada',
  'The Shadow of the Past': 'La sombra del pasado',
  'Three is Company': 'Tres es compañía',
  'A Short Cut to Mushrooms': 'Atajo a los hongos',
  'A Conspiracy Unmasked': 'Una conspiración desenmascarada',
  'The Old Forest': 'El Bosque Viejo',
  'In the House of Tom Bombadil': 'En casa de Tom Bombadil',
  'Fog on the Barrow-downs': 'Niebla en las Quebradas de los Túmulos',
  'At the Sign of the Prancing Pony': 'En la posada del Poney Pisador',
  'A Knife in the Dark': 'Un cuchillo en la oscuridad',
  'Flight to the Ford': 'Huida hacia el vado',
  'Many Meetings': 'Muchos encuentros',
  'The Council of Elrond': 'El Concilio de Elrond',
  'The Ring Goes South': 'El Anillo va hacia el sur',
  'A Journey in the Dark': 'Un viaje en la oscuridad',
  'Lothlórien': 'Lothlórien',
  'The Mirror of Galadriel': 'El espejo de Galadriel',
  'Farewell to Lórien': 'Adiós a Lórien',
  'The Great River': 'El Río Grande',
  'The Breaking of the Fellowship': 'La disolución de la Compañía',
  // The Two Towers
  'The Departure of Boromir': 'La partida de Boromir',
  'The Riders of Rohan': 'Los Jinetes de Rohan',
  'The Uruk-hai': 'Los Uruk-hai',
  'Treebeard': 'Bárbol',
  'The White Rider': 'El Caballero Blanco',
  'The King of the Golden Hall': 'El Rey del Castillo de Oro',
  "Helm's Deep": 'El Abismo de Helm',
  'The Flotsam and Jetsam': 'Restos y despojos',
  'The Voice of Saruman': 'La voz de Saruman',
  'The Palantír': 'El palantir',
  'The Taming of Sméagol': 'Sméagol domado',
  'The Passage of the Marshes': 'El paso de la ciénaga',
  'The Black Gate is Closed': 'La Puerta Negra está cerrada',
  'The Window on the West': 'La ventana al Oeste',
  'The Stairs of Cirith Ungol': 'Las escaleras de Cirith Ungol',
  "Shelob's Lair": 'El antro de Ella-Laraña',
  // The Return of the King
  'Minas Tirith': 'Minas Tirith',
  'The Passing of the Grey Company': 'El paso de la Compañía Gris',
  'The Muster of Rohan': 'La revista de Rohan',
  'The Siege of Gondor': 'El sitio de Gondor',
  'The Ride of the Rohirrim': 'La cabalgata de los Rohirrim',
  'The Battle of the Pelennor Fields': 'La batalla de los Campos del Pelennor',
  'The Houses of Healing': 'Las Casas de Curación',
  'The Last Debate': 'La última deliberación',
  'The Black Gate Opens': 'La Puerta Negra se abre',
  'The Tower of Cirith Ungol': 'La Torre de Cirith Ungol',
  'The Land of Shadow': 'El País de la Sombra',
  'Mount Doom': 'El Monte del Destino',
  'The Field of Cormallen': 'El Campo de Cormallen',
  'The Steward and the King': 'El senescal y el rey',
  'Many Partings': 'Muchas despedidas',
  'Homeward Bound': 'De regreso al hogar',
  'The Scouring of the Shire': 'El saneamiento de la Comarca',
  'The Grey Havens': 'Los Puertos Grises',
  // Appendices (The Lord of the Rings)
  'Appendix A': 'Apéndice A',
  'Appendix A (Aragorn and Arwen)': 'Apéndice A (Aragorn y Arwen)',
  "Appendix A (Durin's Folk)": 'Apéndice A (El pueblo de Durin)',
  'Appendix B': 'Apéndice B',
  // Unfinished Tales
  'Aldarion and Erendis': 'Aldarion y Erendis',
  'Of Tuor and his Coming to Gondolin': 'De Tuor y su llegada a Gondolin',
  'The Quest of Erebor': 'La búsqueda de Erebor',
  // The Lost Road and Other Writings
  'Quenta Silmarillion': 'Quenta Silmarillion',
  // The Adventures of Tom Bombadil
  'The Adventures of Tom Bombadil': 'Las aventuras de Tom Bombadil',
  'Bombadil Goes Boating': 'Bombadil va en barca',
};

type Source = NonNullable<EventSummary['source']>;

/** The book's title in a language (published titles, i18n.ts), or its id. */
export const bookTitle = (book: string, L: Lang): string => ui(`book_${book}` as UiKey, L) || book;

/** A chapter's title in a language: The Hobbit's by number, the others from their English title. */
export function chapterTitle(ch: Source['chapter'], L: Lang): string | undefined {
  if (ch === undefined || ch === '') return undefined;
  if (typeof ch === 'number') return HOBBIT[ch]?.[L] ?? HOBBIT[ch]?.en;
  return L === 'en' ? ch : CHAPTERS_ES[ch] ?? ch;
}

const isAppendix = (ch: string) => /^Appendix\b/.test(ch);
const quote = (s: string, L: Lang) => (L === 'es' ? `«${s}»` : `“${s}”`);

/**
 * Where in the book, as a phrase: "chapter 5, “Riddles in the Dark”" (numbered), "“Of Beren and
 * Lúthien”" (named), "Appendix B" (appendices, unquoted). Empty when the source names no chapter.
 */
export function chapterPhrase(source: Source, L: Lang): string {
  const ch = source.chapter;
  const title = chapterTitle(ch, L);
  if (typeof ch === 'number') return title ? `${ui('chapterN', L).replace('{n}', String(ch))}, ${quote(title, L)}` : ui('chapterN', L).replace('{n}', String(ch));
  if (!ch || !title) return '';
  return isAppendix(ch) ? title : quote(title, L);
}

/** "Read this in The Hobbit, chapter 5, “Riddles in the Dark”." as parts, so the book title can be set in italics. */
export function readItIn(source: Source, L: Lang): { before: string; book: string; after: string } {
  const where = chapterPhrase(source, L);
  const tpl = ui(where ? 'readIn' : 'readInBook', L);
  const [before, rest = ''] = tpl.split('{book}');
  return { before, book: bookTitle(source.book, L), after: rest.replace('{where}', where) };
}

/** The same as plain text (for tests, labels and screen readers). */
export function readItInText(source: Source, L: Lang): string {
  const p = readItIn(source, L);
  return `${p.before}${p.book}${p.after}`;
}
