// Models: the glTF files in assets/ that characters (and per-event tracks) point to with
// `model:`. Checked here for build.ts, which copies them into public/data/models/ for the site.
// See docs/MODELS.md (folder layout, Blender export, budgets) and docs/DESIGN.md §9.

import fs from 'node:fs';
import path from 'node:path';

/**
 * Size budgets per asset type (the first folder under assets/), in bytes on disk after
 * meshopt compression. One place to change them. GitHub Pages serves no Git LFS, so every
 * model lives in git and on every visitor's connection: these keep both comfortable.
 */
export const MODEL_BUDGETS = {
  /** One rigged character with its clips (Bilbo, Thorin, a troll, Smaug). */
  characters: 300_000,
  /** One kit file: a set of reusable pieces for a place (hobbit-holes, hedges, gardens). */
  kits: 800_000,
  /** One small thing a scene needs (a cart, a barrel, the Arkenstone). */
  props: 100_000,
} as const;
export type AssetType = keyof typeof MODEL_BUDGETS;

/** Blender sources (`.blend`) may sit next to their exports, but past this they don't belong in git. */
export const SOURCE_BUDGET = 20_000_000;

/** Clip names the diorama plays from a character's pose (src/scene/modelClips.ts). */
export const CLIP_NAMES = ['idle', 'walk', 'run', 'talk', 'hide', 'fight'] as const;

/** Where the site finds models: public/data/models/<path under assets/>. */
export const MODELS_URL = 'data/models/';

/** A size in words: 8.5 kB, 20 MB. */
export const kB = (n: number) => (n >= 1e6 ? `${Math.round(n / 1e5) / 10} MB` : `${Math.round(n / 100) / 10} kB`);

/** What a .glb says about itself, for the checks: its glTF JSON, or why it isn't one. */
export function readGlb(file: string): { json?: Record<string, unknown>; error?: string } {
  const buf = fs.readFileSync(file);
  if (buf.length < 20 || buf.toString('ascii', 0, 4) !== 'glTF') return { error: 'not a binary glTF (.glb): export with Format "glTF Binary"' };
  if (buf.readUInt32LE(4) !== 2) return { error: `glTF version ${buf.readUInt32LE(4)}, expected 2` };
  if (buf.readUInt32LE(8) !== buf.length) return { error: 'truncated or padded: the header length does not match the file' };
  const len = buf.readUInt32LE(12);
  if (buf.toString('ascii', 16, 20) !== 'JSON' || 20 + len > buf.length) return { error: 'no JSON chunk' };
  try {
    return { json: JSON.parse(buf.toString('utf8', 20, 20 + len)) };
  } catch {
    return { error: 'unreadable JSON chunk' };
  }
}

export interface ModelReport {
  error(file: string, msg: string): void;
  warn(file: string, msg: string): void;
}

/**
 * Check a `model:` value (a path under assets/, `characters/bilbo/bilbo.glb`): it exists,
 * is a .glb the site can load, fits its type's budget. Returns the URL the site loads it from
 * and adds it to `copies` (once), or undefined after reporting why not.
 */
export function readModel(
  R: ModelReport, file: string, v: unknown, what: string, assetsDir: string,
  copies: { from: string; to: string }[], type?: AssetType,
): string | undefined {
  if (typeof v !== 'string' || !/^[a-z0-9-]+(\/[a-z0-9-]+)*\.glb$/.test(v)) {
    R.error(file, `${what}: a .glb path under assets/, like characters/bilbo/bilbo.glb (lowercase, no ..)`);
    return undefined;
  }
  const kind = v.split('/')[0];
  if (!Object.hasOwn(MODEL_BUDGETS, kind)) { R.error(file, `${what}: "${kind}/" is not an asset type (${Object.keys(MODEL_BUDGETS).join(', ')})`); return undefined; }
  if (type && kind !== type) { R.error(file, `${what}: expected a model under ${type}/, got ${v}`); return undefined; }
  const src = path.join(assetsDir, v);
  if (!fs.existsSync(src)) { R.error(file, `${what}: assets/${v} not found (export it from Blender, then npm run model:pack; see docs/MODELS.md)`); return undefined; }
  const size = fs.statSync(src).size;
  const budget = MODEL_BUDGETS[kind as AssetType];
  if (size > budget) { R.error(file, `${what}: assets/${v} is ${kB(size)}, over the ${kind} budget of ${kB(budget)} (see docs/MODELS.md, "Budgets")`); return undefined; }
  const to = MODELS_URL + v;
  if (!copies.some((c) => c.to === to)) {
    const glb = readGlb(src);
    if (glb.error) { R.error(file, `${what}: assets/${v}: ${glb.error}`); return undefined; }
    const j = glb.json!;
    const used = (j.extensionsUsed as string[] | undefined) ?? [];
    for (const ext of ['KHR_draco_mesh_compression', 'KHR_texture_basisu']) {
      if (used.includes(ext)) { R.error(file, `${what}: assets/${v} uses ${ext}, which the site doesn't decode; pack with meshopt (npm run model:pack)`); return undefined; }
    }
    if (!used.includes('EXT_meshopt_compression')) R.warn(src, 'not meshopt-compressed: run npm run model:pack on the Blender export (docs/MODELS.md)');
    const scenes = (j.scenes as unknown[] | undefined) ?? [];
    if (scenes.length !== 1) R.warn(src, `has ${scenes.length} scenes; export one scene per asset`);
    if (type === 'characters') {
      const clips = ((j.animations as { name?: string }[] | undefined) ?? []).map((a) => a.name ?? '');
      if (clips.length && !clips.includes('idle')) R.warn(src, 'has animations but no "idle" clip; the diorama falls back to it for every action without its own');
      for (const c of clips) if (!(CLIP_NAMES as readonly string[]).includes(c)) R.warn(src, `animation "${c}" is not one the diorama plays (${CLIP_NAMES.join(', ')})`);
    }
    copies.push({ from: src, to });
  }
  return to;
}

/** Blender sources too big for git (no LFS): warn before they get committed. */
export function checkSources(R: ModelReport, assetsDir: string): void {
  if (!fs.existsSync(assetsDir)) return;
  for (const f of fs.readdirSync(assetsDir, { recursive: true, withFileTypes: true })) {
    if (!f.isFile() || !f.name.endsWith('.blend')) continue;
    const p = path.join(f.parentPath, f.name);
    const size = fs.statSync(p).size;
    if (size > SOURCE_BUDGET) R.warn(p, `${kB(size)}, over ${kB(SOURCE_BUDGET)} for a Blender source in git; purge unused data (File → Clean Up) or keep it outside the repo`);
  }
}
