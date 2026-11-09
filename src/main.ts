import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { characterMap, index, loadEvent, loadIndex, playable } from './chronicle';
import { LANGS, type EventDetail, type EventSummary, type Lang } from './data/types';
import { overlaps } from './data/calendar';
import { ICONS } from './icons';
import { initialLang, rememberLang, t as ui, tr, type UiKey } from './i18n';
import { Sidebar } from './sidebar';
import { EventClock } from './eventClock';
import { Narration } from './narration';
import { createCosmosStage } from './scene/cosmos';
import { createDioramaStage } from './scene/dioramaStage';
import type { Stage } from './scene/stage';
import './style.css';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------- URL state: #/event/<id>?t=0.42&follow=bilbo&lang=es ----------
interface Route { eventId?: string; t?: number; follow?: string; lang?: string }

function parseRoute(): Route {
  const [path, query = ''] = location.hash.replace(/^#/, '').split('?');
  const q = new URLSearchParams(query);
  const m = path.match(/^\/event\/([\w-]+)/);
  const tv = Number(q.get('t'));
  return {
    eventId: m?.[1],
    t: Number.isFinite(tv) ? Math.min(Math.max(tv, 0), 1) : undefined,
    follow: q.get('follow') ?? undefined,
    lang: q.get('lang') ?? undefined,
  };
}

function writeRoute(): void {
  const q = new URLSearchParams();
  if (state.t > 0) q.set('t', state.t.toFixed(3));
  if (state.selected) q.set('follow', state.selected);
  if (state.lang !== 'en') q.set('lang', state.lang);
  const qs = q.toString();
  history.replaceState(null, '', `#/event/${state.event.id}${qs ? `?${qs}` : ''}`);
}

// ---------- State ----------
const route = parseRoute();
const state = {
  event: undefined as unknown as EventDetail, // set before the first frame
  t: route.t ?? 0,
  playing: false,
  lang: initialLang(route.lang ?? null) as Lang,
  selected: (route.follow ?? null) as string | null,
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

function buildStage(event: EventDetail): Stage {
  if (event.stage === 'cosmos') {
    const L = (k: Parameters<typeof ui>[0]) => ui(k, state.lang);
    return createCosmosStage({
      ambar: L('ambar'), vista: L('vista'), ilmen: L('ilmen'),
      vaiya: L('vaiya'), walls: L('walls'), kuma: L('kuma'),
    });
  }
  return createDioramaStage(event, characterMap, state.lang);
}

function loadStage(): void {
  stage?.dispose();
  controls?.dispose();
  narration?.dispose();

  stage = buildStage(state.event);
  controls = new OrbitControls(stage.camera, renderer.domElement);
  controls.target.copy(stage.target);
  controls.enableDamping = true;
  if (state.event.stage === 'cosmos') {
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
  clock = new EventClock(state.event, state.lang);
  narration = new Narration(state.event, state.lang, clock);
  playhead = clock.secondsAt(state.t);
  stage.select?.(state.selected);
  resize();
  renderStatic();
}

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

/** The last diorama visited, so the zoom switch can return to it from the cosmos. */
let lastDiorama: string | undefined;

async function openEvent(id: string): Promise<void> {
  if (id === state.event.id) return;
  state.event = await loadEvent(id);
  state.t = 0;
  state.playing = false;
  state.selected = null;
  closeMeanwhile();
  loadStage();
  writeRoute();
}

const sidebar = new Sidebar($('sidebar'), {
  lang: () => state.lang,
  currentId: () => state.event?.id ?? '',
  openEvent: (id) => { void openEvent(id); },
  openHome: () => { const c = playable().find((e) => e.stage === 'cosmos'); if (c) void openEvent(c.id); },
  toggleLang: () => setLang(LANGS[(LANGS.indexOf(state.lang) + 1) % LANGS.length]),
  layoutChanged: () => { if (stage) resize(); },
});

function setLang(lang: Lang): void {
  state.lang = lang;
  rememberLang(lang);
  loadStage(); // labels and names are baked into the stage
  writeRoute();
}

function formatDate(e: EventSummary): string {
  const L = state.lang;
  const age = index.ages.find((a) => a.id === e.age);
  if (!e.when) return tr(age?.name, L);
  const d = e.when.start;
  const dAge = index.ages.find((a) => a.id === d.age);
  const parts: string[] = [];
  if (d.season) { const s = ui(d.season, L); parts.push(s[0].toUpperCase() + s.slice(1)); }
  const month = d.month ? new Date(2000, d.month - 1, 1).toLocaleString(L, { month: 'long' }) : '';
  const day = typeof d.day === 'string' ? ui(`day_${d.day}`, L) : d.day && d.month ? `${d.day} ${month}` : month;
  if (day) parts.push(day);
  parts.push(`${tr(dAge?.abbr, L) || tr(dAge?.name, L)} ${d.year}`);
  return parts.join(' · ');
}

function renderStatic(): void {
  const L = state.lang;
  document.documentElement.lang = L;
  $('disclaimer').textContent = ui('disclaimer', L);
  scrubber.setAttribute('aria-label', ui('progress', L));
  const L_ = (k: UiKey) => ui(k, L);
  prevBtn.innerHTML = ICONS.prev; prevBtn.setAttribute('aria-label', L_('prevEvent')); prevBtn.title = L_('prevEvent');
  nextBtn.innerHTML = ICONS.next; nextBtn.setAttribute('aria-label', L_('nextEvent')); nextBtn.title = L_('nextEvent');
  const list = playable();
  const i = list.findIndex((e) => e.id === state.event.id);
  prevBtn.disabled = i <= 0;
  nextBtn.disabled = i < 0 || i >= list.length - 1;
  meanwhileBtn.innerHTML = `${ICONS.clock}<span>${L_('meanwhile')}</span>`;
  menuBtn.innerHTML = ICONS.menu; menuBtn.setAttribute('aria-label', L_('openMenu'));

  // Breadcrumb: age › arc › event.
  const crumbs = $('crumbs');
  crumbs.setAttribute('aria-label', L_('breadcrumb'));
  crumbs.innerHTML = '';
  const age = index.ages.find((a) => a.id === state.event.age);
  const arc = index.arcs.find((a) => state.event.arcs.includes(a.id));
  const crumb = (text: string, onClick: () => void) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'crumb'; b.textContent = text;
    b.addEventListener('click', onClick);
    crumbs.append(b, Object.assign(document.createElement('span'), { className: 'sep', textContent: '›', ariaHidden: 'true' }));
  };
  if (age) crumb(tr(age.name, L), () => sidebar.show('ages', `age:${age.id}`));
  if (arc) crumb(tr(arc.title, L), () => sidebar.show('stories', `arc:${arc.id}`));
  crumbs.append(Object.assign(document.createElement('span'), { className: 'here', textContent: tr(state.event.title, L) }));

  // Zoom switch: the cosmos, the world (not built yet) and event dioramas.
  const zoom = $('zoom');
  zoom.setAttribute('aria-label', L_('zoom'));
  const level = state.event.stage === 'cosmos' ? 'cosmos' : 'event';
  for (const b of zoom.querySelectorAll<HTMLButtonElement>('button')) {
    const z = b.dataset.zoom as 'cosmos' | 'world' | 'event';
    b.textContent = L_(`zoom_${z}`);
    b.setAttribute('aria-pressed', String(z === level));
    if (z === 'world') b.title = L_('worldSoon');
  }
  if (state.event.stage !== 'cosmos') lastDiorama = state.event.id;
  sidebar.render();

  $('event-title').textContent = tr(state.event.title, L);
  $('event-date').textContent = formatDate(state.event);
  $('event-summary').textContent = tr(state.event.summary, L);

  const beats = $('beats');
  beats.innerHTML = '';
  for (const b of state.event.beats ?? []) {
    const el = document.createElement('div');
    el.className = 'beat';
    el.style.left = `${b.t * 100}%`;
    el.innerHTML = '<span></span>';
    el.querySelector('span')!.textContent = tr(b.label, L);
    beats.append(el);
  }

  muteBtn.hidden = !state.event.audioFiles[L];
  updateDynamic();
}

function updateDynamic(): void {
  const L = state.lang;
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
    $('sel-subtitle').textContent = info.subtitle ?? '';
    $('sel-body').textContent = info.body;
    $('sel-thought').textContent = info.thought ?? '';
  }
}

/** Narration text: the passage being read, revealed as it is read. Runs every frame. */
function renderNarration(): void {
  let text = '', shown = 1;
  const seg = clock.segmentAt(playhead);
  if (!state.playing && playhead === 0) text = ui('pressPlay', state.lang);
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
  if (target) void openEvent(target.id);
}
menuBtn.addEventListener('click', () => sidebar.setDrawer(true));
$('scrim').addEventListener('click', () => sidebar.setDrawer(false));
$('zoom').addEventListener('click', (e) => {
  const z = (e.target as HTMLElement).closest<HTMLButtonElement>('button')?.dataset.zoom;
  if (z === 'cosmos') { const c = playable().find((x) => x.stage === 'cosmos'); if (c) void openEvent(c.id); }
  if (z === 'event' && state.event.stage === 'cosmos') {
    const d = lastDiorama ?? playable().find((x) => x.stage !== 'cosmos')?.id;
    if (d) void openEvent(d);
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
  const row = (e: EventSummary, note?: string) => {
    const li = document.createElement('li');
    const el = document.createElement(e.stage ? 'button' : 'span');
    el.className = e.stage ? 'mw-item' : 'mw-item dim';
    if (!e.stage) el.title = ui('notStaged', L);
    el.innerHTML = '<span class="mw-name"></span><span class="mw-note"></span>';
    el.querySelector('.mw-name')!.textContent = tr(e.title, L);
    el.querySelector('.mw-note')!.textContent = note ?? '';
    if (e.stage) el.addEventListener('click', () => { void openEvent(e.id); });
    li.append(el);
    return li;
  };
  const section = (title: string, items: HTMLElement[]) => {
    if (!items.length) return;
    const h = document.createElement('h3'); h.textContent = title;
    const ul = document.createElement('ul'); ul.append(...items);
    meanwhilePanel.append(h, ul);
  };
  const byId = (id: string) => index.events.find((e) => e.id === id);
  const linked = ev.links.map((l) => [byId(l.to), l] as const).filter(([e]) => !!e);
  section(ui('connected', L), linked.map(([e, l]) => row(e!, ui(`link_${l.type}` as UiKey, L))));
  const linkedIds = new Set(ev.links.map((l) => l.to));
  const same = ev.span
    ? index.events.filter((e) => e.id !== ev.id && !linkedIds.has(e.id) && e.span && overlaps(e.span, ev.span!))
      .sort((a, b) => Math.abs((a.at ?? 0) - (ev.at ?? 0)) - Math.abs((b.at ?? 0) - (ev.at ?? 0))).slice(0, 8)
    : [];
  section(ui('sameTime', L), same.map((e) => {
    const place = index.places.find((p) => p.id === e.place);
    return row(e, tr(place?.name, L));
  }));
  if (!meanwhilePanel.childElementCount) {
    const p = document.createElement('p'); p.className = 'muted'; p.textContent = ui('nothingMeanwhile', L);
    meanwhilePanel.append(p);
  }
}
meanwhileBtn.addEventListener('click', () => {
  const open = meanwhilePanel.hidden;
  if (open) renderMeanwhile();
  meanwhilePanel.hidden = !open;
  meanwhileBtn.setAttribute('aria-expanded', String(open));
});

addEventListener('keydown', (e) => {
  const tgt = e.target as HTMLElement;
  if (e.code === 'Escape') { closeMeanwhile(); sidebar.setDrawer(false); }
  if (e.code === 'Space' && !tgt.closest('input, textarea, select, button, a')) { e.preventDefault(); setPlaying(!state.playing); }
});
addEventListener('hashchange', async () => {
  const r = parseRoute();
  if (r.eventId && r.eventId !== state.event.id) {
    state.event = await loadEvent(r.eventId);
    state.t = r.t ?? 0;
    state.selected = r.follow ?? null;
    loadStage();
  }
});

// Click (not drag) on the scene selects a character.
const ray = new THREE.Raycaster();
let down: { x: number; y: number } | null = null;
renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5 || !stage.pick) return;
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
addEventListener('resize', resize);
new ResizeObserver(() => { if (stage) resize(); }).observe(viewport);

const flash = $('flash');
const frameClock = new THREE.Clock();
let ambient = 0;
let lastUi = 0;

function frame(): void {
  const dt = Math.min(frameClock.getDelta(), 0.1);
  ambient += dt;
  if (state.playing) {
    playhead = Math.min(playhead + dt, clock.duration);
    state.t = clock.tAt(playhead);
    if (playhead >= clock.duration) setPlaying(false);
  }
  narration.sync(playhead, state.playing);
  renderNarration();
  stage.update(state.t, ambient);
  flash.style.opacity = String(stage.flash?.(state.t) ?? 0);
  controls.update();
  renderer.render(stage.scene, stage.camera);
  labelRenderer.render(stage.scene, stage.camera);
  if (ambient - lastUi > 0.1) { lastUi = ambient; updateDynamic(); }
  requestAnimationFrame(frame);
}

async function start(): Promise<void> {
  await loadIndex();
  state.event = await loadEvent(route.eventId);
  if (state.event.id !== route.eventId) state.t = 0;
  loadStage();
  writeRoute();
  frame();
}
start().catch((e) => { caption.textContent = String(e); console.error(e); });

// Handy for debugging and automated screenshots.
Object.assign(window, { ardatir: { state, seek: seekTo } });
