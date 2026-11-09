// An event's page: for every event that can't be watched yet (outline or scripted), its
// story in words — honest date, place, who was there, summary, the narration when it is
// written, its links in both directions, its stories and journeys, and what else happened
// around then (docs/DESIGN.md §3.4). Staged events open their stage instead.

import { index, loadScript } from './chronicle';
import { overlaps } from './data/calendar';
import type { EventSummary, Lang } from './data/types';
import { h } from './dom';
import { honestDate, placeInSentence, shortDate } from './format';
import { ICONS } from './icons';
import { t as ui, tr, type UiKey } from './i18n';
import { linkedEvents, sameTime } from './related';
import { likelyParts, placementParts, renderParts, whyToggle } from './placement';
import { hasLane, MAX_LANES } from './lanes';
import { eventHref, livesHref, timeHref } from './routes';
import { momentOfEvent, momentPath } from './moment';
import { factionById, factionChip, listNodes, sidesLine } from './sides';

export interface ReaderHost {
  lang(): Lang;
}

const BOOK = (book: string, L: Lang) => ui(`book_${book}` as UiKey, L) || book;

/** A section heading in the sidebar's style: label, rule, diamond. */
function heading(text: string): HTMLElement {
  return h('h2', { class: 'r-h' }, h('span', {}, text), h('span', { class: 'rule', 'aria-hidden': 'true' }), h('span', { class: 'diamond', 'aria-hidden': 'true' }));
}

/** A link to another event: filled diamond when it can be watched, hollow when it is read. */
function eventLink(e: EventSummary, L: Lang, cls = 'r-ev'): HTMLAnchorElement {
  return h('a', { class: `${cls}${e.stage ? ' staged' : ''}`, href: eventHref(e.id, L), title: ui(e.stage ? 'playable' : 'readable', L) },
    h('span', { class: 'ev-dot', 'aria-hidden': 'true' }), h('span', { class: 'r-ev-name' }, tr(e.title, L)));
}

function placeName(id: string | undefined, L: Lang): string {
  return tr(index.places.find((p) => p.id === id)?.name, L);
}

export function renderReader(root: HTMLElement, ev: EventSummary, host: ReaderHost): void {
  const L = host.lang();
  const S = (k: UiKey) => ui(k, L);
  root.innerHTML = '';
  const age = index.ages.find((a) => a.id === ev.age);
  const arcs = index.arcs.filter((a) => ev.arcs.includes(a.id));
  const art = h('article', { class: 'reader', lang: L });

  // ---- Title block ----
  art.append(
    h('p', { class: 'r-over' }, [tr(age?.name, L), ...arcs.map((a) => tr(a.title, L))].filter(Boolean).join('  ·  ')),
    h('h1', { class: 'r-title' }, tr(ev.title, L)),
  );
  const meta = h('ul', { class: 'r-meta' });
  meta.append(h('li', {}, h('span', { html: ICONS.clock }), h('span', {}, honestDate(ev, L))));
  if (ev.place) meta.append(h('li', {}, h('span', { html: ICONS.places }), h('span', {}, placeName(ev.place, L))));
  const sides = sidesLine(ev, L);
  if (sides) meta.append(h('li', { class: 'r-sides' }, h('span', { html: ICONS.sides }), sides));
  if (ev.source) {
    const ch = ev.source.chapter;
    const chapter = typeof ch === 'number' ? `${S('chapter')} ${ch}` : ch ? `“${ch}”` : '';
    meta.append(h('li', {}, h('span', { html: ICONS.books }), h('span', {}, [BOOK(ev.source.book, L), chapter].filter(Boolean).join(', '))));
  }
  art.append(meta);
  // How the event sits on the timeline when its date isn't exact: words, never the guess as a date.
  if (ev.atReason && ev.atReason.kind !== 'exact') {
    const parts = placementParts(ev, L);
    if (parts.length) art.append(h('p', { class: 'r-placed' }, h('span', { class: 'r-placed-label' }, `${S('placedLabel')}: `), ...renderParts(parts, L)));
  }
  // Everything else at this moment, everywhere: the time cursor, with the way back here.
  art.append(h('a', { class: 'r-more r-timeline', href: timeHref(momentPath(momentOfEvent(ev, index.ages)), L, { from: ev.id }) },
    h('span', { html: ICONS.time }), `${S('seeOnTimeline')} →`));
  art.append(h('p', { class: 'r-status' }, h('span', { class: 'r-status-mark', 'aria-hidden': 'true' }), S(ev.status === 'outline' ? 'status_outline' : 'status_scripted')));
  art.append(h('p', { class: 'r-summary' }, tr(ev.summary, L)));

  // ---- The telling: the narration, read as text ----
  if (ev.status !== 'outline') {
    const box = h('section', { class: 'r-section r-telling' }, heading(S('telling')));
    const body = h('div', { class: 'r-passages', 'aria-busy': 'true' }, h('p', { class: 'r-quiet' }, S('tellingLoading')));
    box.append(body);
    art.append(box);
    loadScript(ev.id).then((s) => {
      body.innerHTML = '';
      body.removeAttribute('aria-busy');
      for (const p of s.passages) body.append(h('p', {}, tr(p.text, L)));
    }).catch(() => { body.innerHTML = ''; body.append(h('p', { class: 'r-quiet' }, S('tellingFailed'))); });
  }

  // ---- Who was there ----
  const people = ev.characters.map((id) => index.characters.find((c) => c.id === id)).filter((c) => !!c);
  if (people.length) {
    const ul = h('ul', { class: 'r-who' });
    // A name opens that life's lane; with several, all their lanes side by side.
    for (const c of people) {
      const kind = ui(`kind_${c.kind}` as UiKey, L) || c.kind;
      ul.append(h('li', {}, h('a', { class: 'r-person', href: livesHref([c.id], L), title: S('followLife') },
        h('span', { class: 'r-person-name' }, tr(c.name, L)), h('span', { class: 'r-person-kind' }, kind),
        h('span', { class: 'r-person-sum' }, tr(c.summary, L)))));
    }
    const lanes = people.filter((c) => hasLane(c.id)).slice(0, MAX_LANES).map((c) => c.id);
    art.append(h('section', { class: 'r-section' }, heading(S('whoWasThere')), ul,
      lanes.length > 1 && h('a', { class: 'r-more', href: livesHref(lanes, L) }, `${S('seeSideBySide')} →`)));
  }

  // ---- The sides: each faction, who leads it; the sides divided by "against" ----
  if (ev.sides?.length) {
    const box = h('section', { class: 'r-section' }, heading(S('sidesTitle')));
    ev.sides.forEach((side, i) => {
      if (i) box.append(h('p', { class: 'r-against' }, S('against')));
      const ul = h('ul', { class: 'r-who r-factions' });
      for (const f of side.map(factionById)) {
        if (!f) continue;
        const leaders = f.leaders.map((id) => index.characters.find((c) => c.id === id)).filter((c) => !!c);
        const led = h('span', { class: 'r-person-sum' });
        if (leaders.length) {
          const [before, after] = S('ledBy').split('{a}');
          led.append(before);
          const names = leaders.map((c) => placeInSentence(tr(c.name, L), L));
          led.append(...listNodes(leaders.map((c, k) => h('a', { href: livesHref([c.id], L), title: S('followLife') }, names[k])), names, L));
          led.append(after);
        }
        ul.append(h('li', { class: 'r-person r-faction', style: `--fx:${f.color}` },
          h('span', { class: 'r-person-name' }, factionChip(f, L)),
          h('span', { class: 'r-person-sum' }, tr(f.summary, L)),
          leaders.length ? led : null));
      }
      box.append(ul);
    });
    art.append(box);
  }

  // ---- Connections: links in both directions, with their notes ----
  const linked = linkedEvents(ev);
  if (linked.length) {
    const ul = h('ul', { class: 'r-links' });
    for (const { event: e, link } of linked) {
      ul.append(h('li', {},
        h('span', { class: 'r-link-type' }, S(`link_${link.type}` as UiKey)),
        eventLink(e, L),
        link.note && h('p', { class: 'r-note' }, tr(link.note, L)),
        h('span', { class: 'r-when' }, [shortDate(e, L) || tr(index.ages.find((a) => a.id === e.age)?.name, L), placeName(e.place, L)].filter(Boolean).join('  ·  '))));
    }
    art.append(h('section', { class: 'r-section' }, heading(S('connections')), ul));
  }

  // ---- Stories (arcs) and journeys ----
  if (arcs.length || ev.journeys.length) {
    const box = h('section', { class: 'r-section' }, heading(S('partOf')));
    for (const arc of arcs) {
      const i = arc.events.indexOf(ev.id);
      const byId = (id?: string) => (id ? index.events.find((e) => e.id === id) : undefined);
      const prev = byId(arc.events[i - 1]), next = byId(arc.events[i + 1]);
      box.append(h('div', { class: 'r-arc' },
        h('h3', {}, tr(arc.title, L)),
        h('p', {}, tr(arc.summary, L)),
        (prev || next) && h('div', { class: 'r-arc-nav' },
          prev && h('div', {}, h('span', { class: 'r-label' }, S('beforeInStory')), eventLink(prev, L)),
          next && h('div', {}, h('span', { class: 'r-label' }, S('afterInStory')), eventLink(next, L)))));
    }
    for (const j of index.journeys.filter((x) => ev.journeys.includes(x.id))) {
      const route = h('ol', { class: 'r-route' });
      j.waypoints.forEach((w, k) => {
        const here = w.place === ev.place && (!ev.span || overlaps(w.span, ev.span));
        if (k && j.waypoints[k - 1].place === w.place) return;
        route.append(h('li', { class: here ? 'here' : undefined, 'aria-current': here ? 'location' : undefined }, placeName(w.place, L)));
      });
      const who = j.characters.map((id) => tr(index.characters.find((c) => c.id === id)?.name, L)).filter(Boolean);
      box.append(h('div', { class: 'r-arc r-journey' },
        h('span', { class: 'r-label' }, S('onTheRoad')),
        h('h3', {}, tr(j.title, L)),
        h('p', { class: 'r-quiet' }, who.join(', ')),
        route));
    }
    art.append(box);
  }

  // ---- Around the same time: likely (our best guess, explained) and possibly (ranges overlap) ----
  const same = sameTime(ev, 6);
  if (same.likely.length || same.possibly.length) {
    const box = h('section', { class: 'r-section' }, heading(S('sameTime')));
    const when = (e: EventSummary) => h('span', { class: 'r-when' }, [shortDate(e, L), placeName(e.place, L)].filter(Boolean).join('  ·  '));
    if (same.likely.length) {
      const ul = h('ul', { class: 'r-same' });
      for (const e of same.likely) {
        const [btn, note] = whyToggle(`${S('whyLikely')}: ${tr(e.title, L)}`, likelyParts(ev, e, L), L);
        ul.append(h('li', {}, h('span', { class: 'r-same-row' }, eventLink(e, L), btn), when(e), note));
      }
      box.append(h('h3', { class: 'r-sub' }, S('likelySameTime'), h('span', { class: 'guess' }, ` — ${S('ourBestGuess')}`)), ul);
    }
    if (same.possibly.length) {
      const ul = h('ul', { class: 'r-same' });
      for (const { event: e } of same.possibly) ul.append(h('li', {}, eventLink(e, L), when(e)));
      box.append(h('h3', { class: 'r-sub' }, S('possiblySameTime')), h('p', { class: 'r-sub-note' }, S('possiblyWhy')), ul);
    }
    art.append(box);
  }

  // ---- Before and after, in story order ----
  const i = index.events.findIndex((e) => e.id === ev.id);
  const prev = index.events[i - 1], next = index.events[i + 1];
  const nav = h('nav', { class: 'r-nav' });
  const navCard = (e: EventSummary | undefined, label: string, cls: string) => e
    ? h('a', { class: `r-nav-card ${cls}`, href: eventHref(e.id, L) },
      h('span', { class: 'r-label' }, label),
      h('span', { class: 'r-nav-title' }, tr(e.title, L)),
      h('span', { class: 'r-when' }, honestDate(e, L)))
    : h('span', { class: `r-nav-card ${cls} empty` });
  nav.append(navCard(prev, `← ${S('before')}`, 'prev'), navCard(next, `${S('after')} →`, 'next'));
  art.append(nav);

  art.append(h('footer', { class: 'r-foot' }, S('disclaimer')));
  root.append(art);
}
