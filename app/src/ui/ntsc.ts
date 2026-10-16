// Approximate NTSC colors for 7800 palette values, for showing colors in the
// editor. Computed, not copied from an emulator's palette file: high nibble is
// hue (0 = gray, 1 = gold, 4 = red, 8 = blue, 13 = green), low nibble is luma.

const cache = new Map<number, string>();

export function ntscRgb(value: number): [number, number, number] {
  const hue = (value >> 4) & 15;
  const luma = value & 15;
  const y = 0.05 + (0.9 * luma) / 15;
  let u = 0;
  let v = 0;
  if (hue > 0) {
    const angle = ((167 - (hue - 1) * 24) * Math.PI) / 180;
    u = 0.22 * Math.cos(angle);
    v = 0.22 * Math.sin(angle);
  }
  const to8 = (c: number) => Math.round(Math.min(1, Math.max(0, c)) * 255);
  return [to8(y + 1.14 * v), to8(y - 0.395 * u - 0.581 * v), to8(y + 2.032 * u)];
}

/** CSS color for a palette value such as `$3A`. */
export function ntscCss(color: string): string {
  const value = parseInt(color.slice(1), 16);
  let css = cache.get(value);
  if (!css) {
    const [r, g, b] = ntscRgb(value);
    css = `rgb(${r} ${g} ${b})`;
    cache.set(value, css);
  }
  return css;
}

export const toColor = (value: number) => `$${value.toString(16).toUpperCase().padStart(2, "0")}`;
