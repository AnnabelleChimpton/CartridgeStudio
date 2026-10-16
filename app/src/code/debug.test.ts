import { describe, expect, it } from "vitest";
import { KIT_WATCH } from "../kit/tests.ts";
import { addSample, areaOf, frameRate, hexAddress, objectRanges, objectSlots, parseSymbolTable, seedWatches, watchRange, watchValue } from "./debug.ts";

// Lines as dasm 2.20 writes them with -s (7800basic 0.41).
const TABLE = `--- Symbol List (sorted by symbol)
0.1skipL0169foroi        8287              (R )
0.afterupdate            827a                  
altgamestart             0000 ????         (R )
game                     8000              (R )
lives                    0142              (R )
loopshi                  0167              (R )
loopslo                  0166              (R )
otimer                   22b8              (R )
otype                    2200              (R )
ox                       2218              (R )
oy                       2230              (R )
score0                   01a6              (R )
STARTLIVES               0003
var0                     0140
--- End of Symbol List.
`;

describe("dasm symbols", () => {
  it("lists named symbols, RAM first, without local labels or unresolved ones", () => {
    const list = parseSymbolTable(TABLE);
    expect(list.map((s) => s.name)).toEqual(["lives", "loopshi", "loopslo", "otimer", "otype", "ox", "oy", "score0", "var0", "game", "STARTLIVES"]);
    expect(list.find((s) => s.name === "score0")).toEqual({ name: "score0", address: 0x1a6, area: "ram" });
    expect(list.find((s) => s.name === "game")?.area).toBe("rom");
    expect(list.find((s) => s.name === "STARTLIVES")?.area).toBe("other");
  });

  it("knows the 7800's RAM from its registers and the cartridge", () => {
    expect([0x3f, 0x40, 0xff, 0x100, 0x140, 0x1ff, 0x17ff, 0x1800, 0x27ff, 0x2800, 0x4000, 0xffff].map(areaOf)).toEqual([
      "other", "ram", "ram", "other", "ram", "ram", "other", "ram", "ram", "other", "rom", "rom",
    ]);
  });

  it("writes addresses as 7800basic does", () => {
    expect(hexAddress(0x1a6)).toBe("$01A6");
    expect(hexAddress(0xfffa)).toBe("$FFFA");
  });
});

describe("watches", () => {
  const symbols = new Map(parseSymbolTable(TABLE).map((s) => [s.name, s.address]));

  it("starts with the kit's variables this ROM has", () => {
    const seeded = seedWatches(KIT_WATCH, symbols);
    expect(seeded.map((w) => w.label)).toEqual(["score", "lives", "loops", "heroX", "heroY"]);
    expect(seeded[0]).toEqual({ label: "score", symbol: "score0", bytes: 3, bcd: true });
  });

  it("reads a symbol plus an offset, or nothing when the build lacks it", () => {
    expect(watchRange({ label: "ghostX", symbol: "ox", offset: 1 }, symbols)).toEqual([0x2219, 1]);
    expect(watchRange({ label: "loops", symbol: "loopslo", bytes: 2 }, symbols)).toEqual([0x166, 2]);
    expect(watchRange({ label: "gone", symbol: "nothere" }, symbols)).toBeNull();
  });

  it("shows hex and decimal: little-endian numbers, and the score's BCD digits", () => {
    expect(watchValue({ label: "lives", symbol: "lives" }, Uint8Array.of(3))).toEqual({ value: 3, hex: "$03" });
    expect(watchValue({ label: "x", symbol: "x" }, Uint8Array.of(0xc8))).toEqual({ value: 200, hex: "$C8" });
    expect(watchValue({ label: "loops", symbol: "loopslo", bytes: 2 }, Uint8Array.of(0x34, 0x12))).toEqual({ value: 0x1234, hex: "$1234" });
    expect(watchValue({ label: "score", symbol: "score0", bytes: 3, bcd: true }, Uint8Array.of(0x00, 0x12, 0x50))).toEqual({ value: 1250, hex: "$001250" });
  });
});

describe("frame rate from the main-loop counter", () => {
  it("is 60 when the loop comes round every frame", () => {
    let s = addSample([], { frame: 100, loops: 500 });
    s = addSample(s, { frame: 160, loops: 560 });
    expect(frameRate(s)).toEqual({ fps: 60, msPerLoop: 1000 / 60, frames: 60 });
  });

  it("drops when a pass takes two frames, and counts across the 16-bit wrap", () => {
    const r = frameRate([
      { frame: 0, loops: 0xffe0 },
      { frame: 120, loops: 0x0020 },
    ])!;
    expect(r.fps).toBe(32);
    expect(r.msPerLoop).toBeCloseTo((1000 / 60) * (120 / 64));
  });

  it("has nothing to say before frames run, or if the loop never came round", () => {
    expect(frameRate([])).toBeNull();
    expect(frameRate([{ frame: 5, loops: 1 }])).toBeNull();
    expect(frameRate([{ frame: 5, loops: 1 }, { frame: 65, loops: 1 }])).toEqual({ fps: 0, msPerLoop: Infinity, frames: 60 });
  });

  it("keeps a window of frames, and starts again after a restart", () => {
    let s: ReturnType<typeof addSample> = [];
    for (let f = 0; f <= 300; f += 10) s = addSample(s, { frame: f, loops: f });
    expect(s[0]!.frame).toBeGreaterThanOrEqual(300 - 120);
    expect(addSample(s, { frame: 3, loops: 3 })).toEqual([{ frame: 3, loops: 3 }]);
    expect(addSample([{ frame: 3, loops: 3 }], { frame: 3, loops: 4 })).toEqual([{ frame: 3, loops: 4 }]);
  });
});

describe("the object table", () => {
  it("is four 24-byte arrays, when the ROM has them", () => {
    const symbols = new Map(parseSymbolTable(TABLE).map((s) => [s.name, s.address]));
    expect(objectRanges(symbols)).toEqual([[0x2200, 24], [0x2218, 24], [0x2230, 24], [0x22b8, 24]]);
    expect(objectRanges(new Map([["otype", 0x2200]]))).toBeNull();
  });

  it("reads slots, with 255 as empty", () => {
    const type = new Uint8Array(24).fill(255);
    type[0] = 0;
    type[3] = 2;
    const x = new Uint8Array(24).map((_, i) => i * 4);
    const y = new Uint8Array(24).fill(16);
    const timer = new Uint8Array(24);
    timer[3] = 90;
    const slots = objectSlots([type, x, y, timer]);
    expect(slots).toHaveLength(24);
    expect(slots[0]).toEqual({ slot: 0, type: 0, x: 0, y: 16, timer: 0 });
    expect(slots[3]).toEqual({ slot: 3, type: 2, x: 12, y: 16, timer: 90 });
    expect(slots[1]!.type).toBeNull();
  });
});
