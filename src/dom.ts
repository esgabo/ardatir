// A tiny element builder: the site has no UI framework (CLAUDE.md), just this.

export type Child = Node | string | null | undefined | false;

/** Create an element; `html` sets innerHTML (only for our own icons), `false`/`undefined` attributes are skipped. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | boolean | undefined> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === 'html') el.innerHTML = String(v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children) if (c) el.append(c);
  return el;
}

/** Fold case and accents, for search ("turin" finds Túrin). */
export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
