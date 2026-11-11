// npm run model:pack -- <blender-export.glb> <path under assets/>
//
// Compresses a Blender glTF export with meshopt (gltfpack) into assets/, and says how it sits
// against its budget. For example:
//
//   npm run model:pack -- ~/exports/bilbo.glb characters/bilbo/bilbo.glb
//
// See docs/MODELS.md for the Blender export settings that come before this step.

import fs from 'node:fs';
import path from 'node:path';
import { pack as gltfpack } from 'gltfpack';
import { kB, MODEL_BUDGETS, readGlb, type AssetType } from '../content/models.ts';

/**
 * The project's gltfpack settings: meshopt compression with the higher ratio (`-cc`), keeping
 * named nodes and materials (`-kn -km`) so attach points and clip targets survive. Geometry is
 * quantized (KHR_mesh_quantization) and animations resampled at 30 Hz, gltfpack's defaults.
 */
export const PACK_ARGS = ['-cc', '-kn', '-km'];

export async function pack(input: string, output: string): Promise<string> {
  return gltfpack(['-i', input, '-o', output, ...PACK_ARGS], {
    read: (p: string) => fs.readFileSync(p),
    write: (p: string, data: Uint8Array) => fs.writeFileSync(p, data),
  });
}

if (import.meta.filename === process.argv[1]) {
  const [input, target] = process.argv.slice(2);
  if (!input || !target || !target.endsWith('.glb')) {
    console.error('usage: npm run model:pack -- <blender-export.glb> <path under assets/, e.g. characters/bilbo/bilbo.glb>');
    process.exit(1);
  }
  const root = path.resolve(import.meta.dirname, '../..');
  const out = path.join(root, 'assets', target);
  const kind = target.split('/')[0] as AssetType;
  if (!(kind in MODEL_BUDGETS)) {
    console.error(`"${kind}/" is not an asset type (${Object.keys(MODEL_BUDGETS).join(', ')})`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const log = await pack(path.resolve(input), out);
  if (log.trim()) console.log(log.trim());
  const glb = readGlb(out);
  const clips = ((glb.json?.animations as { name?: string }[] | undefined) ?? []).map((a) => a.name).join(', ');
  const size = fs.statSync(out).size, budget = MODEL_BUDGETS[kind];
  console.log(`assets/${target}: ${kB(fs.statSync(input).size)} → ${kB(size)} (budget ${kB(budget)}${size > budget ? ', OVER: the build will reject it' : ''})`);
  console.log(`clips: ${clips || 'none (the diorama keeps the placeholder motion)'}`);
  if (size > budget) process.exit(1);
}
