// Read-only sprite thumbnail. Pixels are drawn 2:1 wide, as 160A shows them.

import { useEffect, useRef } from "react";
import type { Palette, Sprite } from "../project/schema.ts";
import { ntscCss } from "./ntsc.ts";

export function SpritePreview({ sprite, palette, scale = 4 }: { sprite: Sprite; palette?: Palette; scale?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const w = sprite.width * scale * 2;
  const h = sprite.height * scale;

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    sprite.frames[0]!.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const v = row.charCodeAt(x) - 48;
        if (v <= 0 || !palette) continue;
        ctx.fillStyle = ntscCss(palette.colors[v - 1]!);
        ctx.fillRect(x * scale * 2, y * scale, scale * 2, scale);
      }
    });
  }, [sprite, palette, w, h, scale]);

  return <canvas ref={ref} width={w} height={h} className="sprite-preview" aria-label={`${sprite.id} sprite`} />;
}
