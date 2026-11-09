// Inline stroke icons (24×24, currentColor). Decorative: callers label the button.

const svg = (body: string, fill = false) =>
  `<svg class="icon" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" ${
    fill ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"'
  }>${body}</svg>`;

export const ICONS = {
  star: svg('<path d="M12 2 L13.6 10.4 L22 12 L13.6 13.6 L12 22 L10.4 13.6 L2 12 L10.4 10.4 Z"/>', true),
  ages: svg('<path d="M6 3h12M6 21h12M7.5 3c0 5 4.5 6 4.5 9s-4.5 4-4.5 9M16.5 3c0 5-4.5 6-4.5 9s4.5 4 4.5 9"/>'),
  stories: svg('<path d="M8 3h11v14a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-1h10v1a3 3 0 0 0 3 3"/><path d="M8 3a2 2 0 0 0-2 2v11"/><path d="M10 8h6M10 12h6"/>'),
  lives: svg('<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/>'),
  books: svg('<path d="M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2z"/><path d="M12 6v14"/>'),
  places: svg('<path d="M2.5 19.5l6.5-11 4 6.5 3-4 5.5 8.5z"/><path d="M7.4 11.2l1.6 1.4 1.6-1.4"/>'),
  sidebar: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>'),
  menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  search: svg('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>'),
  plus: svg('<path d="M12 6v12M6 12h12"/>'),
  check: svg('<path d="M5.5 12.5l4.5 4.5 8.5-10"/>'),
  chevron: svg('<path d="M9 6l6 6-6 6"/>'),
  play: svg('<path d="M7 4l13 8-13 8z"/>', true),
  pause: svg('<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>', true),
  prev: svg('<path d="M18 6l-9 6 9 6zM6 6h2v12H6z"/>', true),
  next: svg('<path d="M6 6l9 6-9 6zM16 6h2v12h-2z"/>', true),
  clock: svg('<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>'),
  sound: svg('<path d="M4 9h3l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>'),
  muted: svg('<path d="M4 9h3l5-4v14l-5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>'),
} as const;

export type IconName = keyof typeof ICONS;
