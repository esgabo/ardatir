import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { collidingShown, currentBeat, layoutBeatLabels, type BeatLabelLayout } from './beatLabels';
import { characterMap, eventById, index, loadEvent, loadIndex, playable } from './chronicle';
import { LANGS, type EventDetail, type EventSummary, type Lang } from './data/types';
import { h } from './dom';
import { honestDate } from './format';
import { foretoldBadge } from './foretold';
import { ICONS } from './icons';
import { initialLang, isLang, rememberLang, t as ui, tr, type UiKey } from './i18n';
import { renderReader } from './reader';
import { sidesLine } from './sides';
import { linkedEvents, sameTime } from './related';
import { likelyParts, whyToggle } from './placement';
import { MAX_LANES, PHONE_QUERY, renderLanes } from './lanes';
import { eventHref, livesHref, parseRoute, startHref, timeHref, type Route } from './routes';
import { DEFAULT_MOMENT, momentOfEvent, momentPath, parseMoment } from './moment';
import { fitZoom, ZOOMS, type Zoom } from './timeAxis';
import { momentHref, renderTime, resolveMoment, type TimeState } from './timeCursor';
import { Sidebar } from './sidebar';
import { EventClock } from './eventClock';
import { Narration } from './narration';
import type { Stage } from './scene/stage';
import { Opening, openingSeen } from './opening';
import { renderLearn, sayHint } from './learn';
import './style.css';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------- URL state (routes.ts): #/event/<id>?t=0.42&follow=bilbo&lang=es ----------

/**
 * A page shown instead of the stage: an event that can't be watched yet, read as text, or
 * lives side by side (character lanes). While a page is open the stage stays loaded
 * underneath but neither renders nor plays.
 */
type Page = { kind: 'event'; id: string } | { kind: 'lives'; ids: string[] } | ({ kind: 'time' } & TimeState);
let page: Page | null = null;
/** The lives last shown side by side, so the sidebar can offer them again. */
let laneIds: string[] = [];

const pageHref = (p: Page) => (p.kind === 'event' ? eventHref(p.id, state.lang)
  : p.kind === 'lives' ? livesHref(p.ids, state.lang) : momentHref(p, state.lang));

/** The time cursor at an event's moment, with the way back to it. */
const timeHrefFor = (e: EventSummary) => timeHref(momentPath(momentOfEvent(e, index.ages)), state.lang, { from: e.id });

/** Update the URL in place (no history entry) to what is on screen. */
function writeRoute(): void {
  if (opening.open) { history.replaceState(null, '', startHref(state.lang)); return; } // the opening is #/start
  if (page) { history.replaceState(null, '', pageHref(page)); return; }
  if (!state.event) return;
  history.replaceState(null, '', eventHref(state.event.id, state.lang, {
    t: state.t > 0 ? state.t.toFixed(3) : undefined, follow: state.selected ?? undefined,
  }));
}

/** Go somewhere: a new history entry, so the back button returns. */
function navigate(hash: string): void {
  if (location.hash === hash) { focusHeading = true; applyRoute(parseRoute(hash)); }
  else location.hash = hash; // → hashchange → applyRoute
}

/**
 * Set by a navigation: once the new view is on screen, focus moves to its heading, so
 * keyboard and screen-reader users start at the top of what they opened (not lost in a
 * redrawn sidebar or on the body).
 */
let focusHeading = false;
function focusView(): void {
  if (!focusHeading) return;
  focusHeading = false;
  const h1 = page ? pageEl.querySelector<HTMLElement>('h1') : $('event-title');
  if (!h1) return;
  h1.tabIndex = -1;
  h1.focus({ preventScroll: true });
}

// ---------- State ----------
const route: Route = parseRoute();
const state = {
  event: undefined as unknown as EventDetail, // set when the first stage loads
  t: 0, // set from the route when its stage loads
  playing: false,
  lang: initialLang(route.lang ?? null) as Lang,
  selected: null as string | null,
};

// ---------- Renderer ----------
const viewport = $('viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewport.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.inset = '0';
labelRenderer.domElement.style.pointerEvents = 'none';
viewport.appendChild(labelRenderer.domElement);

let stage: Stage;
let controls: OrbitControls;
let narration: Narration;
let clock: EventClock;
/** Playhead in seconds of narration; the animation time state.t is derived from it. */
let playhead = 0;

/**
 * Each zoom level is its own chunk, loaded the first time it is needed, so the front
 * page (the cosmos) never downloads the diorama code and vice versa.
 */
async function buildStage(event: EventDetail): Promise<Stage> {
  if (event.stage === 'cosmos') {
    const { createCosmosStage } = await import('./scene/cosmos');
    const L = (k: Parameters<typeof ui>[0]) => ui(k, state.lang);
    return createCosmosStage(event.id, {
      ambar: L('ambar'), vista: L('vista'), ilmen: L('ilmen'),
      vaiya: L('vaiya'), walls: L('walls'), kuma: L('kuma'),
      moon: L('moon'), sun: L('sun'), straightRoad: L('straightRoad'),
    });
  }
  const { createDioramaStage } = await import('./scene/dioramaStage');
  return createDioramaStage(event, characterMap, state.lang, new Map((index.factions ?? []).map((f) => [f.id, f])));
}

/** Bumped on every loadStage (and when a page opens), so a slower load can't replace a newer view. */
let stageGeneration = 0;
interface StageLoad { id: string; view: () => { t: number; selected: string | null }; onSwitch?: () => void }
/** The newest loadStage's request while it is in flight, so a language change can redo it. */
let pending: StageLoad | undefined;
let looping = false;

/**
 * Show an event: fetch it (when `load` is given), build its stage, and only then switch
 * `state` to it with `view()`, so the old stage never renders with the new event's state
 * while the chunk loads. Without `load` it rebuilds the current event (a language change).
 */
async function loadStage(load?: StageLoad): Promise<void> {
  const gen = ++stageGeneration;
  pending = load;
  let event: EventDetail, next: Stage;
  try {
    event = load ? await loadEvent(load.id) : state.event;
    if (gen !== stageGeneration) return;
    next = await buildStage(event);
  } catch (e) {
    if (gen === stageGeneration) { pending = undefined; showLoadError(e); }
    return;
  }
  if (gen !== stageGeneration) { next.dispose(); return; }
  pending = undefined;

  if (load) {
    if (page) hidePage(); // a page stays up until the stage that replaces it is ready
    const v = load.view();
    state.event = event;
    state.t = v.t;
    state.selected = v.selected;
    load.onSwitch?.();
  }
  loadError = false;
  stageStale = false;

  // The previous stage keeps rendering until the new one is ready, then is swapped out.
  stage?.dispose();
  controls?.dispose();
  narration?.dispose();

  stage = next;
  controls = new OrbitControls(stage.camera, renderer.domElement);
  controls.target.copy(stage.target);
  controls.enableDamping = true;
  if (event.stage === 'cosmos') {
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.25;
    controls.minDistance = 6;
    controls.maxDistance = 40;
  } else {
    controls.enableRotate = false; // keep the isometric angle; pan + zoom only
    controls.screenSpacePanning = true;
    controls.minZoom = 0.5;
    controls.maxZoom = 4;
  }
  clock = new EventClock(event, state.lang);
  narration = new Narration(event, state.lang, clock);
  playhead = clock.secondsAt(state.t);
  stage.select?.(state.selected);
  resize();
  renderStatic();
  writeRoute();
  focusView();
  if (!looping) { looping = true; frame(); }
}

/** Set when the last stage failed to load; the caption shows the error until one loads. */
let loadError = false;

function showLoadError(e: unknown): void {
  console.error(e);
  loadError = true;
  spoken.textContent = ui('loadFailed', state.lang);
  unspoken.textContent = '';
  // No stage was ever shown: still give the visitor the sidebar, so another event can be opened.
  if (!stage) try { $('disclaimer').textContent = ui('disclaimer', state.lang); sidebar.render(); } catch { /* the index itself failed */ }
}

// A stale chunk after a deploy (the old index.html asks for files that are gone): reload once
// to fetch the new build. The guard stops a reload loop when the chunk is really unreachable.
const RELOAD_KEY = 'ardatir.reloadedForChunk';
addEventListener('vite:preloadError', () => {
  let last = 0;
  try { last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0; } catch { return; /* no storage: don't risk a loop */ }
  if (Date.now() - last < 60_000) return; // already tried; loadStage shows the error
  try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())); } catch { return; }
  location.reload();
});

// ---------- UI ----------
const playBtn = $<HTMLButtonElement>('play');
const muteBtn = $<HTMLButtonElement>('mute');
const scrubber = $<HTMLInputElement>('scrubber');
const caption = $('caption');
const spoken = document.createElement('span');
const unspoken = document.createElement('span');
unspoken.className = 'unspoken';
caption.append(spoken, unspoken);
const prevBtn = $<HTMLButtonElement>('prev');
const nextBtn = $<HTMLButtonElement>('next');
const meanwhileBtn = $<HTMLButtonElement>('meanwhile');
const meanwhilePanel = $('meanwhile-panel');
const menuBtn = $<HTMLButtonElement>('menu');
const pageEl = $('page');

/** The last diorama visited, so the zoom switch can return to it from the cosmos. */
let lastDiorama: string | undefined;

/** The front door: the cosmos. */
const homeId = () => (playable().find((e) => e.stage === 'cosmos') ?? playable()[0])?.id;

const openEvent = (id: string) => navigate(eventHref(id, state.lang));

/** Set when the language changed while a page hid the stage: rebuilt on the way back. */
let stageStale = false;

/**
 * Show what a route names. A staged event opens its stage; any other event opens its page;
 * no event (or an unknown one) is the front door, the cosmos.
 */
function applyRoute(r: Route): void {
  // The language is part of the URL: a link with ?lang=es opens in Spanish, whatever this tab
  // showed before. (No lang means "as you were": in-site links always carry a non-English one.)
  const langChanged = isLang(r.lang) && r.lang !== state.lang;
  if (langChanged) {
    state.lang = r.lang as Lang;
    rememberLang(state.lang);
    if (state.event) stageStale = true; // labels and names are baked into the stage
  }
  // The opening over the cosmos (a first visit, or "Start here"); any other route takes it down.
  if (r.kind === 'start') { startOpening(); return; }
  if (opening.open) opening.hide();
  if (r.kind === 'lives') {
    laneIds = r.with.filter((id) => index.characters.some((c) => c.id === id)).slice(0, MAX_LANES);
    showPage({ kind: 'lives', ids: laneIds });
    return;
  }
  if (r.kind === 'time') {
    // An unreadable moment opens the default one (the URL is then rewritten to it).
    const moment = resolveMoment(r.where) ?? parseMoment(DEFAULT_MOMENT, index.ages)!;
    const zoom = fitZoom((ZOOMS as readonly string[]).includes(r.zoom ?? '') ? r.zoom as Zoom : undefined, moment, index.ages);
    const from = r.from && eventById(r.from) ? r.from : undefined;
    showPage({ kind: 'time', moment, zoom, from });
    return;
  }
  const target = r.eventId ? eventById(r.eventId) : undefined;
  if (target && !target.stage) { showPage({ kind: 'event', id: target.id }); return; }
  const id = target?.id ?? homeId();
  if (!id) return;
  if (state.event && !pending && id === state.event.id) {
    // Already on screen (or under a page): come back to it, at the moment and with the
    // character the URL names, when it names them.
    if (page) hidePage();
    if (target && r.t !== undefined) { state.playing = false; state.t = r.t; }
    if (target && r.follow !== undefined) state.selected = r.follow;
    if (stageStale) { void loadStage(); return; } // the language changed: rebuild (it seeks to state.t)
    playhead = clock.secondsAt(state.t);
    stage.select?.(state.selected);
    renderStatic();
    resize();
    writeRoute();
    focusView();
    return;
  }
  if (pending?.id === id) {
    if (langChanged) void loadStage(pending); // on its way in the old language: redo it in the new one
    return;
  }
  // loadStage takes its generation before fetching, so only the newest route can switch.
  void loadStage({
    id,
    view: () => ({ t: target ? r.t ?? 0 : 0, selected: target ? r.follow ?? null : null }),
    onSwitch: () => { state.playing = false; closeMeanwhile(); closeLearn(); },
  });
}

function showPage(p: Page): void {
  stageGeneration++; // a stage still loading must not replace the page
  pending = undefined;
  const same = !!page && page.kind === p.kind && (p.kind !== 'event' || (page.kind === 'event' && page.id === p.id));
  page = p;
  state.playing = false;
  closeMeanwhile();
  closeLearn();
  document.body.classList.add('page-open');
  renderPage();
  if (!same) pageEl.scrollTop = 0;
  writeRoute();
  if (same && p.kind === 'lives' && focusHeading) focusLanesAdd(); // a life added by a link: keep adding
  else focusView();
}

function hidePage(): void {
  page = null;
  document.body.classList.remove('page-open');
  pageEl.innerHTML = '';
}

function renderPage(): void {
  if (!page) return;
  const L = state.lang;
  document.documentElement.lang = L;
  if (page.kind === 'lives') {
    renderLanes(pageEl, page.ids, {
      lang: () => state.lang,
      // Changed from the lanes page itself (add box, remove): the page redraws, so keep focus in the add box.
      setLanes: (ids) => { setLanes(ids); focusLanesAdd(); },
    });
    renderCrumbs(undefined, [], ui('title_lives', L));
    renderZoom(null);
    sidebar.setView('lives'); // the rail shows where we are, without opening the drawer
  } else if (page.kind === 'time') {
    const tp = page;
    renderTime(pageEl, tp, {
      lang: () => state.lang,
      // Stepping, dragging, zooming: the URL follows in place (no history entry), like scrubbing.
      changed: (s) => { Object.assign(tp, s); writeRoute(); renderCrumbs(s.moment.age, [], ui('title_time', state.lang)); sidebar.render(); },
    });
    renderCrumbs(tp.moment.age, [], ui('title_time', L));
    renderZoom(null);
    sidebar.setView('time');
  } else {
    const ev = eventById(page.id)!;
    renderReader(pageEl, ev, { lang: () => state.lang });
    renderCrumbs(ev.age, ev.arcs, tr(ev.title, L));
    renderZoom('event');
  }
  renderChrome();
  sidebar.render();
}

/** Change the lives shown side by side: in place on the lanes page, else opening it. */
function setLanes(ids: string[]): void {
  laneIds = ids.slice(0, MAX_LANES);
  if (page?.kind === 'lives' && page.ids.length) { page = { kind: 'lives', ids: laneIds }; renderPage(); writeRoute(); }
  else navigate(livesHref(laneIds, state.lang)); // from elsewhere, or the first pick on an empty page: a history entry
}

/** After the lanes page redraws: focus the add box, or the heading when eight lives fill it. */
function focusLanesAdd(): void {
  if (page?.kind !== 'lives') return;
  focusHeading = false;
  const el = pageEl.querySelector<HTMLElement>('.lp-add input') ?? pageEl.querySelector<HTMLElement>('h1');
  el?.focus({ preventScroll: true });
}

// Lanes on a phone show fewer at once (lanes.ts): redraw when the layout crosses the breakpoint.
matchMedia(PHONE_QUERY).addEventListener('change', () => { if (page?.kind === 'lives') renderPage(); });

const sidebar = new Sidebar($('sidebar'), {
  lang: () => state.lang,
  currentId: () => (page ? (page.kind === 'event' ? page.id : '') : state.event?.id ?? ''),
  timeOpen: () => (page?.kind === 'time' ? page : undefined),
  timeHrefFor,
  lanes: () => laneIds,
  lanesOpen: () => page?.kind === 'lives',
  setLanes,
  openEvent,
  openHome: () => { const c = homeId(); if (c) openEvent(c); },
  toggleLang: () => setLang(LANGS[(LANGS.indexOf(state.lang) + 1) % LANGS.length]),
  layoutChanged: () => { if (stage) resize(); },
});

function setLang(lang: Lang): void {
  state.lang = lang;
  rememberLang(lang);
  opening.refresh();
  if (page) {
    // The page redraws now; the stage underneath (labels and names baked in) when it is next shown.
    renderPage();
    writeRoute();
    if (state.event) stageStale = true;
    return;
  }
  if (!pending) writeRoute();
  void loadStage(pending); // labels and names are baked into the stage; redo a load in flight in the new language
}

/** Breadcrumb: age › arc › here. */
function renderCrumbs(ageId: string | undefined, arcIds: string[], here: string): void {
  const L = state.lang;
  const crumbs = $('crumbs');
  crumbs.setAttribute('aria-label', ui('breadcrumb', L));
  crumbs.innerHTML = '';
  const age = index.ages.find((a) => a.id === ageId);
  const arc = index.arcs.find((a) => arcIds.includes(a.id));
  const crumb = (text: string, onClick: () => void) => {
    const b = h('button', { type: 'button', class: 'crumb' }, text);
    b.addEventListener('click', onClick);
    crumbs.append(b, h('span', { class: 'sep', 'aria-hidden': 'true' }, '›'));
  };
  if (age) crumb(tr(age.name, L), () => sidebar.show('ages', `age:${age.id}`));
  if (arc) crumb(tr(arc.title, L), () => sidebar.show('stories', `arc:${arc.id}`));
  crumbs.append(h('span', { class: 'here' }, here));
  // What is foretold is marked even here: the crumbs name an age that is prophecy, not history.
  if (age?.foretold) crumbs.append(h('span', { class: 'foretold-badge', title: ui('foretoldHint', L) }, ui('foretold', L)));
}

/** Zoom switch: the cosmos, the world (not built yet) and events. */
function renderZoom(level: 'cosmos' | 'event' | null): void {
  const zoom = $('zoom');
  zoom.setAttribute('aria-label', ui('zoom', state.lang));
  for (const b of zoom.querySelectorAll<HTMLButtonElement>('button')) {
    const z = b.dataset.zoom as 'cosmos' | 'world' | 'event';
    b.textContent = ui(`zoom_${z}`, state.lang);
    b.setAttribute('aria-pressed', String(z === level));
    if (z === 'world') b.title = ui('worldSoon', state.lang);
  }
}

/** What every view shares: the language, the menu button and the disclaimer. */
function renderChrome(): void {
  const L = state.lang;
  document.documentElement.lang = L;
  $('disclaimer').textContent = ui('disclaimer', L);
  menuBtn.innerHTML = ICONS.menu; menuBtn.setAttribute('aria-label', ui('openMenu', L));
}

function renderStatic(): void {
  if (page) return; // the stage is hidden under a page; it is redrawn when shown again
  const L = state.lang;
  renderChrome();
  scrubber.setAttribute('aria-label', ui('progress', L));
  const L_ = (k: UiKey) => ui(k, L);
  prevBtn.innerHTML = ICONS.prev; prevBtn.setAttribute('aria-label', L_('prevEvent')); prevBtn.title = L_('prevEvent');
  nextBtn.innerHTML = ICONS.next; nextBtn.setAttribute('aria-label', L_('nextEvent')); nextBtn.title = L_('nextEvent');
  const list = playable();
  const i = list.findIndex((e) => e.id === state.event.id);
  prevBtn.disabled = i <= 0;
  nextBtn.disabled = i < 0 || i >= list.length - 1;
  meanwhileBtn.innerHTML = `${ICONS.clock}<span>${L_('meanwhile')}</span>`;
  learnBtn.innerHTML = `${ICONS.info}<span>${L_('aboutScene')}</span>`; learnBtn.setAttribute('aria-label', L_('aboutScene'));
  if (!learnPanel.hidden) openLearn(); // redrawn in the new language, or for the new event
  renderCrumbs(state.event.age, state.event.arcs, tr(state.event.title, L));
  renderZoom(state.event.stage === 'cosmos' ? 'cosmos' : 'event');
  if (state.event.stage !== 'cosmos') lastDiorama = state.event.id;
  sidebar.render();

  paintFold();
  $('event-title').textContent = tr(state.event.title, L);
  const say = sayHint(state.event.pronounce, L);
  $('event-say').replaceChildren(...say ? [say] : []);
  $('event-say').hidden = !say;
  $('event-date').textContent = honestDate(state.event, L);
  $('event-summary').textContent = tr(state.event.summary, L);
  const sides = sidesLine(state.event, L);
  $('event-sides').replaceChildren(...sides ? [sides] : []);
  $('event-sides').hidden = !sides;

  buildBeats();

  muteBtn.hidden = !state.event.audioFiles[L];
  updateDynamic();
}

const beatsEl = $('beats');
let beatEls: HTMLButtonElement[] = [];
let beatCurrent = -2;
let beatLayout: BeatLabelLayout = { show: [], x: [] };
let beatWidths: number[] = [];

/** One focusable marker per beat; which labels show is decided by layoutBeats. */
function buildBeats(): void {
  const L = state.lang;
  beatsEl.innerHTML = '';
  beatEls = (state.event.beats ?? []).map((b, k) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'beat';
    el.style.left = `${b.t * 100}%`;
    const label = tr(b.label, L);
    el.setAttribute('aria-label', label);
    const span = document.createElement('span');
    span.textContent = label;
    span.setAttribute('aria-hidden', 'true');
    el.append(span);
    el.addEventListener('click', () => { seekTo(b.t); writeRoute(); });
    // A revealed hidden label covers its neighbours: fade those out while it shows.
    const reveal = (on: boolean): void => {
      for (const j of collidingShown(k, beatLayout, beatWidths, 10)) beatEls[j]?.classList.toggle('yield', on);
    };
    el.addEventListener('mouseenter', () => reveal(true));
    el.addEventListener('mouseleave', () => reveal(false));
    el.addEventListener('focus', () => reveal(true));
    el.addEventListener('blur', () => reveal(false));
    beatsEl.append(el);
    return el;
  });
  beatCurrent = -2;
  layoutBeats();
}

/** Recomputed only on resize, language or event change, and when the current beat changes. */
function layoutBeats(): void {
  if (!state.event) return; // the bar is observed before the first event has loaded
  const beats = state.event.beats ?? [];
  const positions = beats.map((b) => b.t);
  beatCurrent = currentBeat(positions, state.t);
  const barWidth = beatsEl.clientWidth;
  if (!barWidth) return;
  const widths = beatEls.map((el) => (el.firstElementChild as HTMLElement).offsetWidth);
  const { show, x } = layoutBeatLabels({ positions, widths, barWidth, gap: 10, current: beatCurrent, focus: state.t });
  beatLayout = { show, x }; beatWidths = widths;
  beatEls.forEach((el) => el.classList.remove('yield'));
  beatEls.forEach((el, k) => {
    const span = el.firstElementChild as HTMLElement;
    span.style.left = `calc(50% + ${x[k] - positions[k] * barWidth}px)`;
    el.classList.toggle('shown', show[k]);
    el.classList.toggle('current', k === beatCurrent);
  });
}

new ResizeObserver(() => layoutBeats()).observe(beatsEl);

let selSayKey = '';
function updateDynamic(): void {
  const L = state.lang;
  if (beatEls.length && currentBeat((state.event.beats ?? []).map((b) => b.t), state.t) !== beatCurrent) layoutBeats();
  scrubber.value = String(Math.round(state.t * 1000));
  playBtn.innerHTML = state.playing ? ICONS.pause : ICONS.play;
  playBtn.setAttribute('aria-label', ui(state.playing ? 'pause' : 'play', L));
  muteBtn.innerHTML = narration?.muted ? ICONS.muted : ICONS.sound;
  muteBtn.setAttribute('aria-label', ui(narration?.muted ? 'unmute' : 'mute', L));

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  $('time-label').textContent = `${fmt(playhead)} / ${fmt(clock.duration)}`;

  // Selection panel.
  const panel = $('selection-panel');
  const info = state.selected ? stage.info?.(state.selected, state.t) : null;
  panel.hidden = !info;
  if (info) {
    $('sel-title').textContent = info.title;
    // How to say their name: rebuilt only when the selection or the language changes.
    const sayKey = `${state.selected}|${L}`;
    if (selSayKey !== sayKey) {
      selSayKey = sayKey;
      const say = sayHint(characterMap.get(state.selected!)?.pronounce, L);
      $('sel-say').replaceChildren(...say ? [say] : []);
      $('sel-say').hidden = !say;
    }
    $('sel-subtitle').textContent = info.subtitle ?? '';
    $('sel-body').textContent = info.body;
    $('sel-thought').textContent = info.thought ?? '';
    // The selected character's life, lane by lane.
    const life = $<HTMLAnchorElement>('sel-life');
    const href = state.selected && index.lanes[state.selected]?.length ? livesHref([state.selected], L) : '';
    life.hidden = !href;
    if (href && life.getAttribute('href') !== href) { life.href = href; life.textContent = `${ui('followLife', L)} →`; }
  }
}

/** Narration text: the passage being read, revealed as it is read. Runs every frame. */
function renderNarration(): void {
  let text = '', shown = 1;
  const seg = clock.segmentAt(playhead);
  if (loadError) text = ui('loadFailed', state.lang);
  else if (!state.playing && playhead === 0) text = ui('pressPlay', state.lang);
  else if (seg) {
    text = tr(seg.segment.text, state.lang);
    // Speech usually ends a little before the next passage starts, so finish revealing early.
    shown = Math.min(seg.progress / 0.85, 1);
  }
  // Reveal whole words only.
  let cut = Math.round(text.length * shown);
  if (cut < text.length) { const sp = text.indexOf(' ', cut); cut = sp < 0 ? text.length : sp; }
  const a = text.slice(0, cut), b = text.slice(cut);
  if (spoken.textContent !== a) spoken.textContent = a;
  if (unspoken.textContent !== b) unspoken.textContent = b;
}

function seekTo(t: number): void {
  state.t = t;
  playhead = clock.secondsAt(t);
  updateDynamic();
}

function setPlaying(on: boolean): void {
  if (on && playhead >= clock.duration) { playhead = 0; state.t = 0; }
  state.playing = on;
  if (!on) writeRoute();
  updateDynamic();
}

playBtn.addEventListener('click', () => setPlaying(!state.playing));
muteBtn.addEventListener('click', () => { narration.muted = !narration.muted; updateDynamic(); });
scrubber.addEventListener('input', () => { seekTo(Number(scrubber.value) / 1000); });
scrubber.addEventListener('change', writeRoute);
prevBtn.addEventListener('click', () => step(-1));
nextBtn.addEventListener('click', () => step(1));
function step(dir: number): void {
  const list = playable();
  const i = list.findIndex((e) => e.id === state.event.id);
  const target = list[i + dir];
  if (target) openEvent(target.id);
}
menuBtn.addEventListener('click', () => sidebar.setDrawer(true));
$('scrim').addEventListener('click', () => sidebar.setDrawer(false));
$('zoom').addEventListener('click', (e) => {
  const z = (e.target as HTMLElement).closest<HTMLButtonElement>('button')?.dataset.zoom;
  if (z === 'cosmos') { const c = homeId(); if (c && (page || state.event?.id !== c)) openEvent(c); }
  if (z === 'event' && !page && state.event?.stage === 'cosmos') {
    const d = lastDiorama ?? playable().find((x) => x.stage !== 'cosmos')?.id;
    if (d) openEvent(d);
  }
});

// ---------- Meanwhile: what is linked to this event, and what overlaps it in time ----------
function closeMeanwhile(): void {
  meanwhilePanel.hidden = true;
  meanwhileBtn.setAttribute('aria-expanded', 'false');
}
function renderMeanwhile(): void {
  const L = state.lang;
  const ev = state.event;
  meanwhilePanel.innerHTML = '';
  // Every event is a link: staged ones open their stage, the others their page.
  const row = (e: EventSummary, note?: string) => h('li', {},
    h('a', { class: e.stage ? 'mw-item' : 'mw-item dim', href: eventHref(e.id, L), title: ui(e.stage ? 'playable' : 'readable', L) },
      h('span', { class: 'mw-name' }, h('span', { class: 'ev-dot', 'aria-hidden': 'true' }), tr(e.title, L), foretoldBadge(e, L)),
      h('span', { class: 'mw-note' }, note ?? '')));
  const section = (title: string | HTMLElement, items: HTMLElement[], note?: string) => {
    if (!items.length) return;
    meanwhilePanel.append(typeof title === 'string' ? h('h3', {}, title) : title);
    if (note) meanwhilePanel.append(h('p', { class: 'mw-sub-note' }, note));
    meanwhilePanel.append(h('ul', {}, ...items));
  };
  const placeOf = (e: EventSummary) => tr(index.places.find((p) => p.id === e.place)?.name, L);
  section(ui('connected', L), linkedEvents(ev).map(({ event: e, link: l }) => row(e, ui(`link_${l.type}` as UiKey, L))));
  // Likely: our best guess, each with a "why" that explains how it was placed (docs/DESIGN.md §4.4).
  const same = sameTime(ev);
  section(h('h3', {}, ui('likelySameTime', L), h('span', { class: 'guess' }, ` — ${ui('ourBestGuess', L)}`)), same.likely.map((e) => {
    const [btn, note] = whyToggle(`${ui('whyLikely', L)}: ${tr(e.title, L)}`, likelyParts(ev, e, L), L);
    const li = row(e, placeOf(e));
    const a = li.firstElementChild!;
    li.replaceChildren(h('div', { class: 'mw-row' }, a, btn), note);
    return li;
  }));
  section(ui('possiblySameTime', L), same.possibly.map(({ event: e }) => row(e, placeOf(e))), ui('possiblyWhy', L));
  if (!meanwhilePanel.childElementCount) meanwhilePanel.append(h('p', { class: 'muted' }, ui('nothingMeanwhile', L)));
  // Everything else at this moment, everywhere: the time cursor, with the way back here.
  meanwhilePanel.append(h('a', { class: 'mw-timeline', href: timeHrefFor(ev) }, h('span', { html: ICONS.time }), `${ui('seeOnTimeline', L)} →`));
}
meanwhileBtn.addEventListener('click', () => {
  const open = meanwhilePanel.hidden;
  if (open) renderMeanwhile();
  meanwhilePanel.hidden = !open;
  meanwhileBtn.setAttribute('aria-expanded', String(open));
});

// ---------- About this scene: who, where, before and after, the books (learn.ts) ----------
const learnBtn = $<HTMLButtonElement>('learn');
const learnPanel = $('learn-panel');
function closeLearn(): void {
  learnPanel.hidden = true;
  learnBtn.setAttribute('aria-expanded', 'false');
}
function openLearn(): void {
  renderLearn(learnPanel, state.event, {
    lang: () => state.lang,
    // A name selects that character on the stage, when the stage has them; else their life opens.
    select: (id) => {
      if (!stage.info?.(id, state.t)) return false;
      state.selected = id;
      stage.select?.(id);
      writeRoute();
      updateDynamic();
      return true;
    },
  });
  learnPanel.hidden = false;
  learnBtn.setAttribute('aria-expanded', 'true');
}
learnBtn.addEventListener('click', () => {
  if (learnPanel.hidden) { closeMeanwhile(); openLearn(); } else closeLearn();
});
meanwhileBtn.addEventListener('click', closeLearn); // one panel at a time

// ---------- The opening (opening.ts): a first visit's welcome, or #/start ----------
/** Where "Follow a story" begins: The Hobbit's first scene. */
const storyStart = () => eventById('unexpected-party')?.id ?? index.events.find((e) => e.source?.book === 'the-hobbit')?.id ?? homeId() ?? '';
const opening = new Opening($('opening'), {
  lang: () => state.lang,
  seek: (t) => { if (!state.event) return; seekTo(t); if (!state.playing) setPlaying(true); },
  toggleLang: () => setLang(LANGS[(LANGS.indexOf(state.lang) + 1) % LANGS.length]),
  storyHref: () => eventHref(storyStart(), state.lang),
  timeHref: () => timeHref(undefined, state.lang),
  lifeHref: () => livesHref(['bilbo'], state.lang),
  lifeName: () => tr(characterMap.get('bilbo')?.name, state.lang),
  closed: () => {
    writeRoute(); // back to the cosmos' own route
    if (!state.event) return;
    renderStatic();
    resize();
    const h1 = $('event-title');
    h1.tabIndex = -1;
    h1.focus({ preventScroll: true });
  },
});

/** Open the opening over the cosmos, with the Ainulindalë playing from its first moment. */
function startOpening(): void {
  const id = homeId();
  if (!id) return;
  focusHeading = false; // the opening takes focus itself
  closeMeanwhile();
  closeLearn();
  sidebar.setDrawer(false);
  opening.show();
  if (state.event?.id === id && !pending) {
    if (page) hidePage();
    state.selected = null;
    state.t = 0;
    state.playing = true;
    if (stageStale) { void loadStage(); return; } // the language changed under a page: rebuild (it seeks to state.t)
    playhead = 0;
    stage.select?.(null);
    renderStatic();
    resize();
    writeRoute();
    return;
  }
  if (pending?.id === id) return;
  void loadStage({ id, view: () => ({ t: 0, selected: null }), onSwitch: () => { closeMeanwhile(); closeLearn(); state.playing = true; } });
}

addEventListener('keydown', (e) => {
  const tgt = e.target as HTMLElement;
  if (e.code === 'Escape') { closeMeanwhile(); closeLearn(); sidebar.setDrawer(false); }
  if (e.code === 'Space' && !page && stage && !tgt.closest('input, textarea, select, button, a')) { e.preventDefault(); setPlaying(!state.playing); }
});
addEventListener('hashchange', () => { focusHeading = true; applyRoute(parseRoute()); });

// Click (not drag) on the scene selects a character.
const ray = new THREE.Raycaster();
let down: { x: number; y: number } | null = null;
renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down || page || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5 || !stage.pick) return;
  const r = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, stage.camera);
  state.selected = stage.pick(ray);
  stage.select?.(state.selected);
  writeRoute();
  updateDynamic();
});

// ---------- Loop ----------
function resize(): void {
  const w = viewport.clientWidth || innerWidth, h = viewport.clientHeight || innerHeight;
  renderer.setSize(w, h);
  labelRenderer.setSize(w, h);
  stage.resize(w, h);
}
addEventListener('resize', () => { if (stage) resize(); });
new ResizeObserver(() => { if (stage) resize(); }).observe(viewport);

// The event card folds down to its title and date (desktop); remembered per visitor.
const eventCard = $('event-panel');
const eventFold = $('event-fold');
function paintFold(): void {
  const folded = eventCard.classList.contains('folded');
  eventFold.setAttribute('aria-expanded', String(!folded));
  eventFold.setAttribute('aria-label', ui(folded ? 'expandCard' : 'collapseCard', state.lang));
  eventFold.innerHTML = ICONS.chevron;
}
try { if (localStorage.getItem('ardatir.cardFolded') === '1') eventCard.classList.add('folded'); } catch { /* storage unavailable */ }
eventFold.addEventListener('click', () => {
  const folded = eventCard.classList.toggle('folded');
  try { localStorage.setItem('ardatir.cardFolded', folded ? '1' : '0'); } catch { /* storage unavailable */ }
  paintFold();
});

const flash = $('flash');
const frameClock = new THREE.Clock();
let ambient = 0;
let lastUi = 0;

function frame(): void {
  const dt = Math.min(frameClock.getDelta(), 0.1);
  requestAnimationFrame(frame);
  if (page) { narration.sync(playhead, false); return; } // hidden under a page: nothing to draw
  ambient += dt;
  if (state.playing) {
    playhead = Math.min(playhead + dt, clock.duration);
    state.t = clock.tAt(playhead);
    if (playhead >= clock.duration) setPlaying(false);
  }
  narration.sync(playhead, state.playing);
  renderNarration();
  stage.update(state.t, ambient);
  opening.sync(state.t);
  flash.style.opacity = String(stage.flash?.(state.t) ?? 0);
  controls.update();
  renderer.render(stage.scene, stage.camera);
  labelRenderer.render(stage.scene, stage.camera);
  if (ambient - lastUi > 0.1) { lastUi = ambient; updateDynamic(); }
}

async function start(): Promise<void> {
  await loadIndex();
  // A staged event (or the cosmos) loads its stage, which starts the frame loop; any other
  // event opens its page, and no stage loads until one is needed. A first visit to the front
  // door opens with the opening (docs/DESIGN.md §3.5); deep links are never interrupted.
  const frontDoor = route.kind === 'event' && !route.eventId;
  applyRoute(frontDoor && !openingSeen() ? { kind: 'start', lang: route.lang } : route);
}
start().catch(showLoadError);

// Handy for debugging and automated screenshots.
Object.assign(window, { ardatir: { state, seek: seekTo, page: () => page } });
