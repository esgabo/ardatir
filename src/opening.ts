// The first visit (docs/DESIGN.md §3.5): a short guided opening over the cosmos while the
// Ainulindalë plays (the Void, the Music, Arda forming), one short line at a time, then a calm
// invitation with three ways in: follow a story, pick a moment, follow a life. Skippable at once;
// shown by itself only on a visitor's first visit to the front door (remembered in localStorage),
// and reopened any time at #/start (the sidebar's "Start here").

import type { Lang } from './data/types';
import { h } from './dom';
import { ICONS } from './icons';
import { LANG_NAMES, t as ui, type UiKey } from './i18n';

/** The opening's lines, each shown from its moment `from` in the Ainulindalë (its beats, staging.yaml). */
export const OPENING_STEPS = [
  { id: 'void', from: 0 },
  { id: 'music', from: 0.08 },
  { id: 'discord', from: 0.35 },
  { id: 'vision', from: 0.62 },
  { id: 'arda', from: 0.88 },
] as const;
/** After the last line, from this moment on (or on "Next"), the invitation. */
export const INVITE_AT = 0.97;

/** Which step shows at animation time t: an index into OPENING_STEPS, or OPENING_STEPS.length for the invitation. */
export function stepAt(t: number): number {
  if (t >= INVITE_AT) return OPENING_STEPS.length;
  let i = 0;
  for (let k = 0; k < OPENING_STEPS.length; k++) if (t >= OPENING_STEPS[k].from) i = k;
  return i;
}

/** Where "Next" goes from a step: the next step's moment (the invitation's for the last line). */
export const nextFrom = (step: number): number => (step + 1 < OPENING_STEPS.length ? OPENING_STEPS[step + 1].from : INVITE_AT);

const SEEN_KEY = 'ardatir.opening';

/** Has this visitor seen the opening? Unreadable storage counts as seen, so it never nags on every visit. */
export function openingSeen(): boolean {
  try { return localStorage.getItem(SEEN_KEY) !== null; } catch { return true; }
}
export function rememberOpening(): void {
  try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* storage unavailable: fine */ }
}

export interface OpeningHost {
  lang(): Lang;
  /** The animation time of the Ainulindalë on screen, and whether it is playing. */
  seek(t: number): void;
  /** Switch to the other language (the opening has its own switch: the sidebar is hidden under it). */
  toggleLang(): void;
  /** The three ways in, as hrefs, and the name of the life offered. */
  storyHref(): string;
  timeHref(): string;
  lifeHref(): string;
  lifeName(): string;
  /** The opening was closed (skipped, or a way in chosen): the stage takes over again. */
  closed(): void;
}

export class Opening {
  private step = -1;
  /** Says each new line to screen readers; it outlives the redraws. */
  private live = h('p', { class: 'sr-only', 'aria-live': 'polite' });
  open = false;

  constructor(private root: HTMLElement, private host: OpeningHost) {
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); this.close(); return; }
      if (e.key === 'Tab') this.trapFocus(e);
    });
  }

  private L(k: UiKey): string { return ui(k, this.host.lang()); }

  show(): void {
    this.open = true;
    this.step = -1;
    rememberOpening();
    document.body.classList.add('opening');
    this.root.hidden = false;
    this.render(0);
    this.root.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
  }

  /** Close it: the stage, its bar and the sidebar come back. */
  close(): void {
    if (!this.open) return;
    this.hide();
    this.host.closed();
  }

  /** Take it down without telling the host (the route moved elsewhere). */
  hide(): void {
    this.open = false;
    this.root.hidden = true;
    this.root.innerHTML = '';
    document.body.classList.remove('opening');
  }

  /** Follow the animation: called with its time while the opening is up. */
  sync(t: number): void {
    if (!this.open) return;
    const s = stepAt(t);
    if (s !== this.step) this.render(s);
  }

  /** Redraw in the current language (a language change while it is open). */
  refresh(): void { if (this.open) { const s = this.step; this.step = -1; this.render(s); } }

  private render(step: number): void {
    const L = this.host.lang();
    const hadFocus = this.root.contains(document.activeElement);
    this.step = step;
    this.root.innerHTML = '';
    this.root.setAttribute('lang', L);
    const invite = step >= OPENING_STEPS.length;
    const skip = h('button', { type: 'button', class: 'op-skip' }, this.L(invite ? 'openingClose' : 'openingSkip'));
    skip.addEventListener('click', () => this.close());
    // Offer the other language by its own name, so a newcomer can read the welcome at once.
    const other = L === 'en' ? 'es' : 'en';
    const lang = h('button', { type: 'button', class: 'op-lang', lang: other, 'aria-label': `${this.L('language')}: ${LANG_NAMES[other]}` }, LANG_NAMES[other]);
    lang.addEventListener('click', () => this.host.toggleLang());

    const box = h('div', { class: `op-box${invite ? ' op-invite' : ''}` });
    if (!invite) {
      const id = OPENING_STEPS[step].id;
      const next = h('button', { type: 'button', class: 'op-next' }, `${this.L('openingNext')} →`);
      next.addEventListener('click', () => this.host.seek(nextFrom(this.step)));
      const dots = h('ol', { class: 'op-dots', 'aria-hidden': 'true' },
        ...OPENING_STEPS.map((_, k) => h('li', { class: k === step ? 'on' : k < step ? 'past' : undefined })));
      box.append(
        h('p', { class: 'op-over' }, this.L('openingWelcome')),
        h('h2', { class: 'op-line', id: 'op-line', tabindex: '-1' }, this.L(`opening_${id}` as UiKey)),
        h('div', { class: 'op-controls' }, dots, next),
      );
    } else {
      const way = (href: string, icon: string, title: string, body: string) => {
        const a = h('a', { class: 'op-way', href }, h('span', { class: 'op-way-icon', html: icon }),
          h('span', { class: 'op-way-text' }, h('span', { class: 'op-way-title' }, title), h('span', { class: 'op-way-body' }, body)));
        a.addEventListener('click', () => this.hide()); // the link navigates; the new view takes over
        return h('li', {}, a);
      };
      const stay = h('button', { type: 'button', class: 'op-stay' }, this.L('openingStay'));
      stay.addEventListener('click', () => this.close());
      box.append(
        h('p', { class: 'op-over' }, this.L('openingArda')),
        h('h2', { class: 'op-line', id: 'op-line', tabindex: '-1' }, this.L('openingInvite')),
        h('p', { class: 'op-sub' }, this.L('openingInviteSub')),
        h('ul', { class: 'op-ways' },
          way(this.host.storyHref(), ICONS.stories, this.L('wayStory'), this.L('wayStoryBody')),
          way(this.host.timeHref(), ICONS.time, this.L('wayTime'), this.L('wayTimeBody')),
          way(this.host.lifeHref(), ICONS.lives, this.L('wayLife'), this.L('wayLifeBody').replace('{a}', this.host.lifeName()))),
        h('p', { class: 'op-foot' }, stay, h('span', { class: 'op-hint' }, this.L('openingMenuHint'))),
      );
    }
    this.root.setAttribute('aria-labelledby', 'op-line');
    this.root.append(h('div', { class: 'op-top' }, lang, skip), box, this.live);
    this.live.textContent = box.querySelector('h2')?.textContent ?? '';
    // Keep focus inside: on the new line (or the first way in) when it had focus before.
    if (hadFocus) (invite ? this.root.querySelector<HTMLElement>('.op-way') : this.root.querySelector<HTMLElement>('.op-next'))?.focus({ preventScroll: true });
  }

  /** A modal dialog: Tab cycles within it. */
  private trapFocus(e: KeyboardEvent): void {
    const items = [...this.root.querySelectorAll<HTMLElement>('a[href], button')];
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}
