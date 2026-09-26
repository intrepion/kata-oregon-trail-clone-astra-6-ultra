const paths: Record<string, string> = {
  compass:
    '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z"/>',
  trail:
    '<path d="M5 20c0-5 14-2 14-7S5 12 5 7c0-2 3-3 5-3"/><path d="m7 2 3 2-2 3"/>',
  map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16M15 5v16"/>',
  book: '<path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15"/>',
  flag: '<path d="M5 21V3c5-3 9 3 14 0v10c-5 3-9-3-14 0"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  cloud: '<path d="M6 18a5 5 0 0 1-.5-10A7 7 0 0 1 19 9a4.5 4.5 0 0 1-.5 9Z"/>',
  rain: '<path d="M5 15a4 4 0 0 1 0-8 6 6 0 0 1 12-1 4.5 4.5 0 0 1 2 9M7 18l-1 3m6-3-1 3m6-3-1 3"/>',
  food: '<path d="M7 3v7c0 3 5 3 5 0V3M9.5 3v18M18 21V3c-4 2-4 10 0 10M5 3v5"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9m3-10v12"/>',
  ammo: '<path d="M5 21V8l3-5 3 5v13zm8 0V8l3-5 3 5v13zM5 17h6m2 0h6"/>',
  heart:
    '<path d="M20.5 4.5a5 5 0 0 0-7 0L12 6l-1.5-1.5a5 5 0 0 0-7 7L12 20l8.5-8.5a5 5 0 0 0 0-7Z"/>',
  camp: '<path d="m3 20 9-16 9 16ZM12 4V2M6 20l6-10 6 10M9 20l3-5 3 5"/>',
  target:
    '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/>',
  store:
    '<path d="m3 9 2-6h14l2 6M4 10v11h16V10M9 21v-7h6v7M3 9c0 4 5 4 5 0 0 4 8 4 8 0 0 4 5 4 5 0"/>',
  wagon:
    '<path d="M3 15V9a7 7 0 0 1 14 0v6M2 15h18l2-3M7 3v12m6-12v12"/><circle cx="6" cy="19" r="3"/><circle cx="17" cy="19" r="3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  leaf: '<path d="M20 3C10 2 3 6 4 13c1 8 12 10 15 0 1-3 1-6 1-10ZM4 21 16 8"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7Z"/>',
  wrench: '<path d="m14 7 3 3 4-4a6 6 0 0 1-8 8l-7 7-3-3 7-7a6 6 0 0 1 8-8Z"/>',
  medical: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z"/>',
  river:
    '<path d="M3 6c4-4 6 4 10 0s6 4 9 0M3 12c4-4 6 4 10 0s6 4 9 0M3 18c4-4 6 4 10 0s6 4 9 0"/>',
  mountain: '<path d="m2 20 8-15 6 11 3-6 4 10ZM7 11l3 2 3-2"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
};

export function icon(name: string, className = ""): string {
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.compass}</svg>`;
}
