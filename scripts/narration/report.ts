// The listening page narration:render writes: every flagged take first, then a random
// sample of the ones that passed, per narrator. The author listens here before publishing.

import fs from 'node:fs';
import path from 'node:path';
import type { Take } from './render.ts';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** `sample(narratorId)` says how many passed takes of that narrator to put in front of the author. */
export function writeReport(takes: Take[], outFile: string, sample: (narratorId: string) => number): void {
  const flagged = takes.filter((t) => t.flags.length);
  const passed = takes.filter((t) => !t.flags.length);
  const sampled: Take[] = [];
  for (const id of new Set(passed.map((t) => t.narrator))) sampled.push(...shuffle(passed.filter((t) => t.narrator === id)).slice(0, sample(id)));
  const rendered = takes.filter((t) => !t.reused).length;
  const retried = takes.filter((t) => !t.reused && t.tries > 1).length;

  const card = (t: Take) => `
<div class="c${t.flags.length ? ' f' : ''}">
  <h2>${esc(`${t.event}/${t.passage}`)} <small>${esc(t.lang)} · ${esc(t.narrator)} · seed ${t.seed}${t.tries > 1 ? ` · ${t.tries} tries` : ''}</small></h2>
  <audio controls preload="none" src="${esc(path.relative(path.dirname(outFile), t.file))}"></audio>
  ${t.flags.length ? `<ul>${t.flags.map((f) => `<li><b>${esc(f.kind)}</b>: ${esc(f.detail)}</li>`).join('')}</ul>` : ''}
  <p class="h">Heard: “${esc(t.transcript)}”</p>
</div>`;

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Narration report</title>
<style>
:root{--bg:#f6f2ea;--fg:#2a2620;--mute:#6f675b;--card:#fffdf8;--line:#e3dccd;--flag:#a3412a}
@media (prefers-color-scheme:dark){:root{--bg:#16140f;--fg:#ece6da;--mute:#a59d8f;--card:#201d17;--line:#36312a;--flag:#e08a6e}}
body{background:var(--bg);color:var(--fg);font:16px/1.5 Georgia,serif;margin:0;padding:24px 16px}main{max-width:760px;margin:auto}
h1{font-weight:normal;margin:0 0 4px}.s{color:var(--mute)}h3{font-weight:normal;margin:28px 0 8px}
.c{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 16px;margin:0 0 10px}.c.f{border-left:4px solid var(--flag)}
.c h2{font-size:17px;margin:0}.c small,.h,li{color:var(--mute);font-family:system-ui,sans-serif;font-size:13px}audio{width:100%;margin-top:6px}
code{font-size:14px}
</style></head><body><main>
<h1>Narration report</h1>
<p class="s">${takes.length} passages: ${rendered} rendered, ${takes.length - rendered} reused, ${retried} retried, ${flagged.length} flagged.</p>
<h3>Flagged (${flagged.length})</h3>${flagged.map(card).join('') || '<p class="s">None.</p>'}
<h3>Sample of the rest (${sampled.length} of ${passed.length})</h3>${sampled.map(card).join('') || '<p class="s">None.</p>'}
<p class="s">To reject a take, add its <code>event/passage</code> on its own line to <code>out/narration/rejects.txt</code> and run <code>npm run narration:render</code> again: it re-renders that passage with the next seed. Publish with <code>npm run narration:publish</code> (flagged takes need <code>--accept event/passage</code>).</p>
</main></body></html>
`;
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, html);
}
