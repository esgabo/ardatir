// The collapsible sidebar: an icon rail of views plus a panel showing the chosen
// view (docs/DESIGN.md §3.3). Built from the content index; no framework.

import { index } from './chronicle';
import type { Character, EventSummary, Lang } from './data/types';
import { ICONS, type IconName } from './icons';
import { t as ui, tr, type UiKey } from './i18n';
import { fold, h } from './dom';
import { shortDate } from './format';
import { hasLane, laneColor, MAX_LANES } from './lanes';
import { eventHref, livesHref, timeHref } from './routes';
import { momentLabel } from './format';
import { momentOfEvent, parseMoment } from './moment';
import { MOMENTS } from './moments';
import { factionChip } from './sides';
import { shortcutLabel, type TimeState } from './timeCursor';

export const VIEWS = ['ages', 'time', 'stories', 'lives', 'books', 'places'] as const;
export type View = (typeof VIEWS)[number];

const VIEW_ICON: Record<View, IconName> = { ages: 'ages', time: 'time', stories: 'stories', lives: 'lives', books: 'books', places: 'places' };
const BOOK_ORDER = ['the-hobbit', 'the-fellowship-of-the-ring', 'the-two-towers', 'the-return-of-the-king', 'the-lord-of-the-rings', 'the-silmarillion', 'unfinished-tales', 'the-adventures-of-tom-bombadil'];
const STORAGE_KEY = 'ardatir.sidebar';

export interface SidebarHost {
  lang(): Lang;
  currentId(): string;
  openEvent(id: string): void;
  openHome(): void;
  toggleLang(): void;
  /** Called whenever the sidebar's width changes. */
  layoutChanged(): void;
  /** The lives shown side by side (character lanes), and whether that page is open. */
  lanes(): string[];
  lanesOpen(): boolean;
  setLanes(ids: string[]): void;
  /** The time cursor's state when its page is open. */
  timeOpen(): TimeState | undefined;
  /** The time cursor at an event's moment. */
  timeHrefFor(e: EventSummary): string;
}

export class Sidebar {
  view: View = 'ages';
  open = true;
  /** Phone drawer state (below the mobile breakpoint the sidebar is a drawer). */
  drawer = false;
  query = '';
  private expanded = new Set<string>();
  private revealedFor = '';
  private panelBody!: HTMLElement;

  constructor(private root: HTMLElement, private host: SidebarHost) {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
      if (saved && (VIEWS as readonly string[]).includes(saved.view)) this.view = saved.view;
      if (saved && typeof saved.open === 'boolean') this.open = saved.open;
    } catch { /* storage unavailable: defaults */ }
  }

  private L(key: UiKey): string { return ui(key, this.host.lang()); }

  private save(): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ view: this.view, open: this.open })); } catch { /* ignore */ }
  }

  private applyLayout(): void {
    document.body.classList.toggle('sb-open', this.open);
    document.body.classList.toggle('drawer-open', this.drawer);
    this.host.layoutChanged();
  }

  /** Open a view (and the panel), optionally expanding one of its groups. */
  show(view: View, expandKey?: string): void {
    this.view = view;
    this.open = true;
    this.drawer = true;
    this.query = '';
    if (expandKey) this.expanded.add(expandKey);
    this.save();
    this.render();
  }

  toggle(): void { this.open = !this.open; this.save(); this.render(); }
  setDrawer(on: boolean): void { this.drawer = on; this.render(); }

  /** Expand the groups that lead to the current event, once per event. */
  private revealCurrent(): void {
    const id = this.host.currentId();
    if (this.revealedFor === id) return;
    this.revealedFor = id;
    const e = index.events.find((x) => x.id === id);
    if (!e) return;
    this.expanded.add(`age:${e.age}`);
    for (const a of e.arcs) { this.expanded.add(`age:${e.age}/arc:${a}`); this.expanded.add(`arc:${a}`); }
    if (e.place) this.expanded.add(`place:${e.place}`);
    if (e.source) { this.expanded.add(`book:${e.source.book}`); this.expanded.add(`book:${e.source.book}/ch:${e.source.chapter ?? ''}`); }
  }

  /**
   * Make this the view shown in the rail and panel, without opening the panel or the phone
   * drawer (the page on screen belongs to it). Takes effect on the next render().
   */
  setView(view: View): void {
    if (this.view === view) return;
    this.view = view;
    this.query = '';
  }

  render(): void {
    const L = this.host.lang();
    this.revealCurrent();
    // Redrawing replaces every control: keep focus on the one that had it (marked data-fk).
    const had = document.activeElement instanceof HTMLElement && this.root.contains(document.activeElement)
      ? document.activeElement.dataset.fk : undefined;
    this.build(L);
    if (had) this.root.querySelector<HTMLElement>(`[data-fk="${CSS.escape(had)}"]`)?.focus({ preventScroll: true });
  }

  private build(L: Lang): void {
    this.root.innerHTML = '';
    this.root.setAttribute('aria-label', this.L('navigation'));

    // ---- Rail ----
    const rail = h('nav', { class: 'rail', 'aria-label': this.L('navigation') });
    const home = h('button', { type: 'button', class: 'rail-home', 'data-fk': 'home', 'aria-label': this.L('home'), title: this.L('home'), html: ICONS.star });
    home.addEventListener('click', () => { this.host.openHome(); this.setDrawer(false); });
    rail.append(home);
    for (const v of VIEWS) {
      const on = v === this.view && (this.open || this.drawer);
      const b = h('button', { type: 'button', class: 'rail-item', 'data-fk': `rail:${v}`, 'aria-pressed': on ? 'true' : 'false', 'data-hint': this.L(`hint_${v}` as UiKey) },
        h('span', { html: ICONS[VIEW_ICON[v]] }), h('span', { class: 'rail-label' }, this.L(`view_${v}` as UiKey)));
      b.addEventListener('click', () => {
        if (v === this.view && this.open && !this.drawer) { this.toggle(); return; }
        this.view = v; this.open = true; this.query = ''; this.save(); this.render();
      });
      rail.append(b);
    }
    rail.append(h('span', { class: 'rail-spacer' }));
    const lang = h('button', { type: 'button', class: 'rail-lang', 'data-fk': 'lang', 'aria-label': this.L('language'), title: this.L('language') }, L.toUpperCase());
    lang.addEventListener('click', () => this.host.toggleLang());
    const tog = h('button', { type: 'button', class: 'rail-toggle', 'data-fk': 'toggle', 'aria-expanded': this.open ? 'true' : 'false', 'aria-label': this.L(this.open ? 'collapse' : 'expand'), title: this.L(this.open ? 'collapse' : 'expand'), html: ICONS.sidebar });
    tog.addEventListener('click', () => this.toggle());
    rail.append(lang, tog);

    // ---- Panel ----
    const panel = h('div', { class: 'sb-panel' });
    const close = h('button', { type: 'button', class: 'sb-close', 'data-fk': 'close', 'aria-label': this.L('closeMenu'), html: ICONS.close });
    close.addEventListener('click', () => this.setDrawer(false));
    const input = h('input', { type: 'search', 'data-fk': 'search', placeholder: this.L('search'), 'aria-label': this.L('search'), value: this.query }) as HTMLInputElement;
    input.value = this.query;
    input.addEventListener('input', () => { this.query = input.value; this.renderBody(); });
    panel.append(
      h('header', { class: 'sb-head' },
        h('div', { class: 'sb-brand' }, h('div', { class: 'wordmark' }, 'Ardatir'), h('div', { class: 'tagline' }, this.L('tagline'))),
        close),
      h('label', { class: 'sb-search', html: ICONS.search }, input),
      h('div', { class: 'sb-title' }, h('span', {}, this.L(`title_${this.view}` as UiKey)), h('span', { class: 'rule' }), h('span', { class: 'diamond' })),
    );
    this.panelBody = h('div', { class: 'sb-body' });
    // Language switch for the phone drawer (the rail's EN/ES button covers larger screens).
    const langs = h('div', { class: 'foot-lang', role: 'group', 'aria-label': this.L('language') });
    for (const code of ['en', 'es'] as const) {
      const b = h('button', { type: 'button', 'data-fk': `lang:${code}`, 'aria-pressed': code === L ? 'true' : 'false' }, code === 'en' ? 'English' : 'Español');
      b.addEventListener('click', () => { if (code !== this.host.lang()) this.host.toggleLang(); });
      langs.append(b);
    }
    panel.append(this.panelBody, h('footer', { class: 'sb-foot' }, langs, h('span', {}, this.L('disclaimer'))));

    this.root.append(rail, panel);
    this.renderBody();
    this.applyLayout();
    const cur = this.panelBody.querySelector('[aria-current="page"]');
    cur?.scrollIntoView({ block: 'nearest' });
  }

  private renderBody(): void {
    const body = this.panelBody;
    body.innerHTML = '';
    body.parentElement?.querySelector('.sb-title')?.toggleAttribute('hidden', !!this.query.trim());
    if (this.query.trim()) { body.append(this.searchResults(this.query.trim())); return; }
    const build = { ages: () => this.agesView(), time: () => this.timeView(), stories: () => this.storiesView(), lives: () => this.livesView(), books: () => this.booksView(), places: () => this.placesView() }[this.view];
    body.append(build());
  }

  // ---------- Building blocks ----------

  /**
   * Every event is a link: staged ones open their stage (filled diamond), the others their
   * page (hollow diamond, a little dimmer), so the whole story can be followed.
   */
  private eventRow(e: EventSummary): HTMLElement {
    const L = this.host.lang();
    const current = e.id === this.host.currentId();
    const a = h('a', {
      class: e.stage ? 'ev' : 'ev dim', href: eventHref(e.id, L), 'data-fk': `ev:${e.id}`, 'aria-current': current ? 'page' : undefined,
      title: this.L(e.stage ? 'playable' : 'readable'),
    }, h('span', { class: 'ev-dot', 'aria-hidden': 'true' }), h('span', { class: 'ev-name' }, tr(e.title, L)), h('span', { class: 'ev-when' }, shortDate(e, L)));
    a.addEventListener('click', (ev) => { ev.preventDefault(); this.drawer = false; this.host.openEvent(e.id); });
    return h('li', {}, a);
  }

  private eventList(ids: string[] | EventSummary[]): HTMLElement {
    const evs = (ids as (string | EventSummary)[])
      .map((x) => (typeof x === 'string' ? index.events.find((e) => e.id === x) : x))
      .filter((e): e is EventSummary => !!e);
    if (!evs.length) return h('p', { class: 'sb-empty' }, this.L('noEvents'));
    return h('ul', { class: 'ev-list' }, ...evs.map((e) => this.eventRow(e)));
  }

  /** An expandable group: a header button and children built only when open. */
  private group(key: string, head: Node[], children: () => Node, cls = 'grp', extra?: () => Node | null): HTMLElement {
    const open = this.expanded.has(key);
    const li = h('li', { class: `${cls}${open ? ' open' : ''}` });
    const btn = h('button', { type: 'button', class: `${cls}-head`, 'data-fk': `grp:${key}`, 'aria-expanded': open ? 'true' : 'false' }, h('span', { class: 'chev', html: ICONS.chevron }), ...head);
    btn.addEventListener('click', () => {
      if (this.expanded.has(key)) this.expanded.delete(key); else this.expanded.add(key);
      const fresh = this.group(key, head, children, cls, extra);
      if (li.dataset.key) fresh.dataset.key = li.dataset.key;
      li.replaceWith(fresh);
      fresh.querySelector<HTMLElement>(`[data-fk="${CSS.escape(`grp:${key}`)}"]`)?.focus({ preventScroll: true });
    });
    const side = extra?.();
    li.append(side ? h('div', { class: 'grp-row' }, btn, side) : btn);
    if (open) li.append(children());
    return li;
  }

  // ---------- Views ----------

  private agesView(): HTMLElement {
    const L = this.host.lang();
    const current = index.events.find((e) => e.id === this.host.currentId());
    const ol = h('ol', { class: 'thread' });
    for (const age of [...index.ages].sort((a, b) => a.order - b.order)) {
      const evs = index.events.filter((e) => e.age === age.id);
      const lit = current?.age === age.id;
      const key = `age:${age.id}`;
      const head = [
        h('span', { class: `node${lit ? ' lit' : ''}`, 'aria-hidden': 'true' }),
        h('span', { class: 'age-text' }, h('span', { class: 'age-name' }, tr(age.name, L)), h('span', { class: 'age-sub' }, tr(age.summary, L))),
      ];
      ol.append(this.group(key, head, () => {
        if (!evs.length) return h('p', { class: 'sb-empty' }, this.L('noEvents'));
        const arcs = index.arcs.filter((a) => evs.some((e) => e.arcs.includes(a.id)));
        const list = h('ul', { class: 'sub' });
        for (const arc of arcs) {
          const inAge = arc.events.filter((id) => evs.some((e) => e.id === id));
          list.append(this.group(`${key}/arc:${arc.id}`, [h('span', { class: 'grp-name' }, tr(arc.title, L))], () => this.eventList(inAge)));
        }
        const loose = evs.filter((e) => !e.arcs.length);
        if (loose.length && arcs.length) list.append(this.group(`${key}/other`, [h('span', { class: 'grp-name' }, this.L('otherEvents'))], () => this.eventList(loose)));
        else if (loose.length) list.append(h('li', {}, this.eventList(loose)));
        return list;
      }, 'age'));
    }
    return ol;
  }

  /** The time cursor: where it stands, this event's moment, and moments to visit (docs/DESIGN.md §3.1). */
  private timeView(): HTMLElement {
    const L = this.host.lang();
    const box = h('div', { class: 'sb-time' });
    const open = this.host.timeOpen();
    const card = h('div', { class: 'sb-lanes' }, h('p', {}, this.L('timeIntro')));
    if (open) card.append(h('p', { class: 'sb-time-now' }, momentLabel(open.moment, L)));
    else {
      const go = h('a', { class: 'sb-lanes-go', href: timeHref(undefined, L) }, `${this.L('openTimeline')} →`);
      go.addEventListener('click', () => this.setDrawer(false));
      card.append(go);
    }
    box.append(card);
    const current = index.events.find((e) => e.id === this.host.currentId());
    const link = (href: string, name: string, when: string, here = false) => {
      const a = h('a', { class: 'ev', href, 'aria-current': here ? 'page' : undefined },
        h('span', { class: 'ev-dot', 'aria-hidden': 'true' }), h('span', { class: 'ev-name' }, name), h('span', { class: 'ev-when' }, when));
      a.addEventListener('click', () => this.setDrawer(false));
      return h('li', {}, a);
    };
    if (current && !open) {
      box.append(h('div', { class: 'sb-section' }, this.L('thisEventsMoment')),
        h('ul', { class: 'ev-list' }, link(this.host.timeHrefFor(current), tr(current.title, L), momentLabel(momentOfEvent(current, index.ages), L))));
    }
    box.append(h('div', { class: 'sb-section' }, this.L('momentsToVisit')));
    const ul = h('ul', { class: 'ev-list' });
    for (const mo of MOMENTS) {
      const m = parseMoment(mo.path, index.ages);
      const here = !!open && !!m && momentLabel(m, L) === momentLabel(open.moment, L) && m.age === open.moment.age;
      ul.append(link(timeHref(mo.path, L), shortcutLabel(mo.path, mo.event, L), m ? momentLabel(m, L) : '', here));
    }
    box.append(ul);
    return box;
  }

  private storiesView(): HTMLElement {
    const L = this.host.lang();
    const current = this.host.currentId();
    const ul = h('ul', { class: 'cards' });
    for (const arc of index.arcs) {
      const first = index.events.find((e) => e.id === arc.events[0]);
      const age = index.ages.find((a) => a.id === first?.age);
      const here = arc.events.includes(current);
      ul.append(this.group(`arc:${arc.id}`, [
        h('span', { class: `card-text${here ? ' here' : ''}` },
          h('span', { class: 'card-age' }, tr(age?.name, L)),
          h('span', { class: 'card-name' }, tr(arc.title, L)),
          h('span', { class: 'card-sub' }, tr(arc.summary, L))),
      ], () => this.eventList(arc.events), 'card'));
    }
    return ul;
  }

  private characterGroup(c: Character): HTMLElement {
    const L = this.host.lang();
    const kindKey = `kind_${c.kind}` as UiKey;
    const kind = ui(kindKey, L) || c.kind;
    return this.group(`char:${c.id}`, [
      h('span', { class: 'who' }, h('span', { class: 'who-name' }, tr(c.name, L)), h('span', { class: 'who-kind' }, kind)),
    ], () => {
      const box = h('div', { class: 'who-body' }, h('p', {}, tr(c.summary, L)));
      if (c.kin?.length) {
        const kin = h('p', { class: 'kin' }, `${this.L('kinOf')}: `);
        c.kin.forEach((k, i) => {
          const other = index.characters.find((x) => x.id === k.id);
          if (!other) return;
          const b = h('button', { type: 'button', class: 'linkish' }, tr(other.name, L));
          b.addEventListener('click', () => {
            this.expanded.add(`char:${other.id}`);
            this.renderBody();
            this.panelBody.querySelector(`[data-key="char:${other.id}"]`)?.scrollIntoView({ block: 'nearest' });
          });
          if (i) kin.append(', ');
          kin.append(b);
        });
        box.append(kin);
      }
      box.append(this.eventList(index.byCharacter[c.id] ?? []));
      return box;
    }, 'grp', () => this.laneToggle(c));
  }

  /** Add a character to the lives shown side by side, or take them out. */
  private laneToggle(c: Character): Node | null {
    if (!hasLane(c.id)) return null;
    const lanes = this.host.lanes();
    const i = lanes.indexOf(c.id);
    const on = i >= 0;
    const full = !on && lanes.length >= MAX_LANES;
    const b = h('button', {
      type: 'button', class: 'lane-toggle', 'data-fk': `lane:${c.id}`, 'aria-pressed': on ? 'true' : 'false', disabled: full,
      'aria-label': `${this.L(on ? 'laneRemove' : 'laneAdd')}: ${tr(c.name, this.host.lang())}`, title: this.L(full ? 'lanesMax' : on ? 'laneRemove' : 'laneAdd'),
      style: on ? `--c: ${laneColor(i)}` : undefined, html: on ? ICONS.check : ICONS.plus,
    });
    b.addEventListener('click', () => { this.drawer = false; this.host.setLanes(on ? lanes.filter((x) => x !== c.id) : [...lanes, c.id]); });
    return b;
  }

  /** The top of the Lives view: the lives side by side, as chips, and the way to their lanes. */
  private lanesCard(): HTMLElement {
    const L = this.host.lang();
    const lanes = this.host.lanes();
    const box = h('div', { class: 'sb-lanes' });
    const chips = h('ul', { class: 'sb-chips' });
    lanes.forEach((id, i) => {
      const c = index.characters.find((x) => x.id === id);
      if (c) chips.append(h('li', { style: `--c: ${laneColor(i)}` }, h('span', { class: 'lp-dot', 'aria-hidden': 'true' }), tr(c.name, L)));
    });
    if (lanes.length) box.append(chips);
    else box.append(h('p', {}, this.L('livesIntro')));
    if (!this.host.lanesOpen()) {
      const go = h('a', { class: 'sb-lanes-go', href: livesHref(lanes, L) }, `${this.L('sideBySide')} →`);
      go.addEventListener('click', (e) => { e.preventDefault(); this.drawer = false; this.host.setLanes(lanes); });
      box.append(go);
    }
    return box;
  }

  private livesView(): HTMLElement {
    const L = this.host.lang();
    const current = index.events.find((e) => e.id === this.host.currentId());
    const byName = (a: Character, b: Character) => tr(a.name, L).localeCompare(tr(b.name, L), L);
    const here = index.characters.filter((c) => current?.characters.includes(c.id)).sort(byName);
    const rest = index.characters.filter((c) => !here.includes(c) && hasLane(c.id)).sort(byName);
    const box = h('div', {}, this.lanesCard());
    const section = (title: string, list: Character[]) => {
      if (!list.length) return;
      box.append(h('div', { class: 'sb-section' }, title));
      const ul = h('ul', { class: 'groups' });
      for (const c of list) { const g = this.characterGroup(c); g.dataset.key = `char:${c.id}`; ul.append(g); }
      box.append(ul);
    };
    section(current ? tr(current.title, L) : '', here);
    section(this.L('resultsLives'), rest);
    return box;
  }

  private booksView(): HTMLElement {
    const L = this.host.lang();
    const books = [...new Set(index.events.map((e) => e.source?.book).filter((b): b is string => !!b))]
      .sort((a, b) => (BOOK_ORDER.indexOf(a) + 1 || 99) - (BOOK_ORDER.indexOf(b) + 1 || 99));
    const ul = h('ul', { class: 'groups' });
    for (const book of books) {
      const evs = index.events.filter((e) => e.source?.book === book);
      const title = ui(`book_${book}` as UiKey, L) || book;
      ul.append(this.group(`book:${book}`, [h('span', { class: 'book-name' }, title)], () => {
        const chapters = [...new Set(evs.map((e) => e.source?.chapter ?? ''))]
          .sort((a, b) => (typeof a === 'number' && typeof b === 'number' ? a - b : 0));
        const sub = h('ul', { class: 'sub' });
        for (const ch of chapters) {
          const label = typeof ch === 'number' ? `${this.L('chapter')} ${ch}` : String(ch || '—');
          sub.append(this.group(`book:${book}/ch:${ch}`, [h('span', { class: 'grp-name' }, label)],
            () => this.eventList(evs.filter((e) => (e.source?.chapter ?? '') === ch))));
        }
        return sub;
      }));
    }
    return ul;
  }

  private placesView(): HTMLElement {
    const L = this.host.lang();
    const places = index.places.filter((p) => (index.byPlace[p.id]?.length ?? 0) > 0)
      .sort((a, b) => tr(a.name, L).localeCompare(tr(b.name, L), L));
    const ul = h('ul', { class: 'groups' });
    for (const p of places) {
      ul.append(this.group(`place:${p.id}`, [
        h('span', { class: 'who' }, h('span', { class: 'who-name' }, tr(p.name, L)), h('span', { class: 'who-kind' }, String(index.byPlace[p.id].length))),
      ], () => h('div', { class: 'who-body' }, h('p', {}, tr(p.summary, L)), this.eventList(index.byPlace[p.id]))));
    }
    return ul;
  }

  private searchResults(q: string): HTMLElement {
    const L = this.host.lang();
    const f = fold(q);
    const hit = (s: string) => fold(s).includes(f);
    const events = index.events.filter((e) => hit(tr(e.title, L))).slice(0, 20);
    const chars = index.characters.filter((c) => hit(tr(c.name, L))).slice(0, 12);
    const places = index.places.filter((p) => hit(tr(p.name, L))).slice(0, 12);
    const factions = (index.factions ?? []).filter((x) => hit(tr(x.name, L))).slice(0, 8);
    const box = h('div', { class: 'results' });
    if (!events.length && !chars.length && !places.length && !factions.length) { box.append(h('p', { class: 'sb-empty' }, this.L('noResults'))); return box; }
    if (events.length) box.append(h('div', { class: 'sb-section' }, this.L('resultsEvents')), this.eventList(events));
    const jump = (title: string, items: { id: string; name: string }[], view: View, prefix: string) => {
      if (!items.length) return;
      box.append(h('div', { class: 'sb-section' }, title));
      const ul = h('ul', { class: 'ev-list' });
      for (const it of items) {
        const b = h('button', { type: 'button', class: 'ev' }, h('span', { class: 'ev-name' }, it.name));
        b.addEventListener('click', () => { this.view = view; this.query = ''; this.expanded.add(`${prefix}:${it.id}`); this.save(); this.render(); });
        ul.append(h('li', {}, b));
      }
      box.append(ul);
    };
    jump(this.L('resultsLives'), chars.map((c) => ({ id: c.id, name: tr(c.name, L) })), 'lives', 'char');
    jump(this.L('resultsPlaces'), places.map((p) => ({ id: p.id, name: tr(p.name, L) })), 'places', 'place');
    // Sides in battles: each faction with the battles it fought in.
    if (factions.length) box.append(h('div', { class: 'sb-section' }, this.L('resultsFactions')));
    for (const x of factions) box.append(h('div', { class: 'sb-faction' }, factionChip(x, L)), this.eventList(index.byFaction?.[x.id] ?? []));
    return box;
  }
}
