import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { characterMap, index, loadEvent, loadIndex } from './chronicle';
import { LANGS, type EventDetail, type EventSummary, type Lang } from './data/types';
import { initialLang, LANG_NAMES, rememberLang, t as ui, tr } from './i18n';
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
labelRenderer.domElement.style.position = 'fixed';
labelRenderer.domElement.style.inset = '0';
labelRenderer.domElement.style.pointerEvents = 'none';
document.body.appendChild(labelRenderer.domElement);

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
const eventSelect = $<HTMLSelectElement>('event-select');
const langSelect = $<HTMLSelectElement>('lang-select');

function formatDate(e: EventSummary): string {
  const L = state.lang;
  const age = index.ages.find((a) => a.id === e.age);
  if (!e.when) return tr(age?.name, L);
  const d = e.when.start;
  const dAge = index.ages.find((a) => a.id === d.age);
  const parts: string[] = [];
  if (d.season) { const s = ui(d.season, L); parts.push(s[0].toUpperCase() + s.slice(1)); }
  const month = d.month ? new Date(2000, d.month - 1, 1).toLocaleString(L, { month: 'long' }) : '';
  const day = d.day && d.month ? `${d.day} ${month}` : month;
  if (day) parts.push(day);
  parts.push(`${tr(dAge?.abbr, L) || tr(dAge?.name, L)} ${d.year}`);
  return parts.join(' · ');
}

function renderStatic(): void {
  const L = state.lang;
  document.documentElement.lang = L;
  $('tagline').textContent = ui('tagline', L);
  $('disclaimer').textContent = ui('disclaimer', L);
  scrubber.setAttribute('aria-label', ui('progress', L));
  eventSelect.setAttribute('aria-label', ui('events', L));
  langSelect.setAttribute('aria-label', ui('language', L));

  eventSelect.innerHTML = '';
  for (const age of index.ages) {
    const evs = index.events.filter((ev) => ev.age === age.id);
    if (!evs.length) continue;
    const group = document.createElement('optgroup');
    group.label = tr(age.name, L);
    for (const e of evs) {
      // Outline and scripted events are listed but can't be played yet.
      const opt = new Option(tr(e.title, L) + (e.stage ? '' : ` · ${ui('notStaged', L)}`), e.id, false, e.id === state.event.id);
      opt.disabled = !e.stage;
      group.append(opt);
    }
    eventSelect.append(group);
  }
  langSelect.innerHTML = '';
  for (const lang of LANGS) langSelect.append(new Option(LANG_NAMES[lang], lang, false, lang === L));

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
  playBtn.textContent = state.playing ? '❚❚' : '▶';
  playBtn.setAttribute('aria-label', ui(state.playing ? 'pause' : 'play', L));
  muteBtn.textContent = narration?.muted ? '🔇' : '🔊';
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
eventSelect.addEventListener('change', async () => {
  state.event = await loadEvent(eventSelect.value);
  state.t = 0;
  state.playing = false;
  state.selected = null;
  loadStage();
  writeRoute();
});
langSelect.addEventListener('change', () => {
  state.lang = langSelect.value as Lang;
  rememberLang(state.lang);
  loadStage(); // labels and names are baked into the stage
  writeRoute();
});
addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !(e.target instanceof HTMLSelectElement)) { e.preventDefault(); setPlaying(!state.playing); }
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
  const ndc = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, stage.camera);
  state.selected = stage.pick(ray);
  stage.select?.(state.selected);
  writeRoute();
  updateDynamic();
});

// ---------- Loop ----------
function resize(): void {
  renderer.setSize(innerWidth, innerHeight);
  labelRenderer.setSize(innerWidth, innerHeight);
  stage.resize(innerWidth, innerHeight);
}
addEventListener('resize', resize);

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
