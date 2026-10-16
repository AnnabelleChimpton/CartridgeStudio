// Cartridge Studio's own icons: a 20 px grid, round 1.75 px strokes in the
// text colour. Always decorative: the button or text beside it says what it
// does (see design/DIRECTION.md, Iconography).

const PATHS = {
  undo: "M7.5 5 4 8.5 7.5 12M4.5 8.5h7a4.5 4.5 0 0 1 0 9H9",
  redo: "M12.5 5 16 8.5 12.5 12M15.5 8.5h-7a4.5 4.5 0 0 0 0 9H11",
  save: "M10 3.5v9M6.5 9 10 12.5 13.5 9M4 14.5v1A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5v-1",
  open: "M3 6.5V15a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 17 15V8.5A1.5 1.5 0 0 0 15.5 7H10L8.5 5H4.5A1.5 1.5 0 0 0 3 6.5Z",
  plus: "M10 4.5v11M4.5 10h11",
  chevron: "M6 8l4 4 4-4",
  sun: "M10 6.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM10 2.5v1.5M10 16v1.5M2.5 10H4M16 10h1.5M4.7 4.7l1 1M14.3 14.3l1 1M4.7 15.3l1-1M14.3 5.7l1-1",
  moon: "M15.5 12.5A6.5 6.5 0 0 1 7.5 4.5a6.5 6.5 0 1 0 8 8Z",
  system: "M3.5 4.5h13v9h-13zM7.5 16.5h5M10 13.5v3",
  play: "M6.5 4.5v11l9-5.5z",
  pause: "M7 4.5v11M13 4.5v11",
  restart: "M4.5 10a5.5 5.5 0 1 0 1.8-4.1M4.5 3.5v3h3",
  sound: "M3.5 8v4h3l4 3.5v-11L6.5 8zM13.5 7.5a3.5 3.5 0 0 1 0 5M15.5 5.5a6.5 6.5 0 0 1 0 9",
  mute: "M3.5 8v4h3l4 3.5v-11L6.5 8zM13.5 8l4 4M17.5 8l-4 4",
  expand: "M3.5 7.5v-4h4M12.5 3.5h4v4M16.5 12.5v4h-4M7.5 16.5h-4v-4",
  tv: "M3 5.5h14v9.5H3zM7 2.5l3 3 3-3M6.5 17.5h7",
  send: "M3.5 9.5 16.5 3.5l-4 13-3-5.5zM9.5 11 16.5 3.5",
  clip: "M3.5 5.5h13v9h-13zM3.5 8.5h13M7 5.5 8.5 8.5M11 5.5l1.5 3",
  cartridge: "M5 3.5h10v8.5l-1.5 1.5v3H6.5v-3L5 12zM7.5 6.5h5v3.5h-5z",
  print: "M6 7.5V3.5h8v4M5 14.5H3.5v-6a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v6H15M6 11.5h8v5H6z",
  check: "M4.5 10.5 8.5 14.5 15.5 6",
  close: "M5.5 5.5l9 9M14.5 5.5l-9 9",
  code: "M7 6 3 10l4 4M13 6l4 4-4 4M11.5 4.5l-3 11",
  star: "M10 3.5 12 8l4.5.4-3.4 3 1 4.6L10 13.6 5.9 16l1-4.6-3.4-3L8 8z",
  copy: "M7.5 7.5h8v9h-8zM4.5 12.5v-9h8",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="ico"
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
