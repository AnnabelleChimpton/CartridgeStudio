// Kit code generation, step 3 of 3: emit 7800basic from the IR (ir.ts). Compiled,
// not interpreted: each kind of thing gets its own update and draw loop over
// its known slot range, with its size, speeds and reactions written in as
// literals, and a part it doesn't have is no code at all. Rules compile to
// straight-line checks. There's no per-frame dispatch on type or behaviour.
//
// Sections are tagged with source spans (`@@span kind:id` … `@@end` lines),
// which generate.ts strips into a line map for coder mode.

import { SPEED_STEPS } from "./schema.ts";
import { ROOMTOP, kitText, type IR, type IRAction, type IRCompare, type IRRule, type IRTarget, type IRType, type IRValue, type Span } from "./ir.ts";

/** Variables a rule body uses: the main rules phase, or a rule that runs inside another's action. */
interface Ctx {
  it: string;
  other: string;
  /** The current action's target slot, when it has one. */
  target?: string;
  targetType?: number;
  /** Loop variable for "every X" targets. */
  loop: string;
  itType: number | null;
  otherType: number | null;
  event: boolean;
}
const MAIN: Omit<Ctx, "itType" | "otherType"> = { it: "oi", other: "oj", loop: "ak", event: false };
const EVENT: Omit<Ctx, "itType" | "otherType"> = { it: "ei", other: "ej", loop: "ek", event: true };

const BIT = { left: 1, right: 2, top: 4, bottom: 8 } as const;
const raw16 = (v16: number) => (v16 * 16) & 0xffff;
const hi = (v16: number) => raw16(v16) >> 8;
const lo = (v16: number) => raw16(v16) & 255;
const byte = (n: number) => ((n % 256) + 256) % 256;

export interface Emitted {
  /** Handlebars inputs for templates/kit/engine.bas.hbs. */
  view: Record<string, unknown>;
  /** Graphics files, by name. */
  graphics: { name: string; rows: string[]; label: string }[];
  /** Variables and arrays, for the memory map and RUNTIME notes. */
  memory: { name: string; at: string; bytes: number; what: string }[];
}

export interface EmitOptions {
  /** Each rule's sentence, for its rem line. */
  sentence: (r: IRRule) => string;
}

export function emitKit(ir: IR, opts: EmitOptions): Emitted {
  let uniq = 0;
  const L = (p: string) => `${p}_${++uniq}`;
  const T = (k: number) => ir.types[k]!;
  const f = ir.features;
  const spanOpen = (s: Span) => `@@span ${s.kind}:${s.id}`;
  const SPAN_END = "@@end";
  const range = (t: IRType) => t.loop;
  const live = (t: IRType) => t.loop[1] >= t.loop[0];
  const hasWalls = f.walls;

  // ---- RAM: per-slot arrays and game state at $2200 ----
  const memory: Emitted["memory"] = [];
  let addr = 0x2200;
  const dims: string[] = [];
  const alloc = (name: string, bytes: number, what: string) => {
    const at = `$${addr.toString(16).toUpperCase()}`;
    dims.push(` dim ${name} = ${at}`);
    memory.push({ name, at, bytes, what });
    addr += bytes;
  };
  const SLOT_ARRAYS: [string, string, boolean][] = [
    ["otype", "kind of thing (255: empty)", true],
    ["ox", "x, whole pixels", true],
    ["oy", "y, whole pixels", true],
    ["ofx", "x, 1/256ths", true],
    ["ofy", "y, 1/256ths", true],
    ["ovx", "vx, whole pixels (signed)", true],
    ["ovxl", "vx, 1/256ths", true],
    ["ovy", "vy, whole pixels (signed)", true],
    ["ovyl", "vy, 1/256ths", true],
    ["osx", "start x", true],
    ["osy", "start y", true],
    ["ofacing", "facing, 0-7 clockwise from right", f.facing],
    ["oa", "per-thing variable a", f.vars],
    ["ob", "per-thing variable b", f.vars],
    ["otimer", "timer, tenths of a second", f.timers],
    ["oback", "kind to turn back into (255: none)", f.timedTurns],
    ["oprot", "protected for this many tenths", f.protect],
    ["olatch", "fires-once memory of rules about it", f.latchThings],
    ["ocontact", "against a wall or edge (kept until it moves away): 1 left, 2 right, 4 top, 8 bottom", f.contact],
    ["oplace", "which placement it came from (255: created)", f.remember],
  ];
  for (const [name, what, on] of SLOT_ARRAYS) if (on) alloc(name, 24, what);
  const counterVars = ir.counters.filter((c) => c.name !== "lives" && c.name !== "levelnum");
  for (const c of counterVars) alloc(c.name, 1, `counter: ${c.label}`);
  for (const ev of f.everyCounters) alloc(ev, 1, "countdown for an every-N rule");
  if (f.remember) alloc("taken", 3 * f.rooms, "taken items: a bit per placed thing per room");
  if (f.rooms > 1 && f.tileMap) alloc("roomwalls", 220, "the current room's tiles");
  if (addr > 0x2800) throw new Error("The kit's RAM layout doesn't fit.");

  // ---- small builders ----
  const slotRange = (t: IRType, v: string, body: string[], next: string): string[] => {
    const [a, b] = range(t);
    if (a === b) return [` ${v} = ${a}`, ` if otype[${v}] <> ${t.sym} then goto ${next}`, ...body, next];
    return [` for ${v} = ${a} to ${b}`, ` if otype[${v}] <> ${t.sym} then goto ${next}`, ...body, next, " next"];
  };
  /** Negates the 16-bit velocity in (h, l) of slot s. */
  const negate16 = (h: string, l: string, s: string) => [` tmp = ${l}[${s}] : px = ${h}[${s}]`, ` if tmp = 0 then ${h}[${s}] = 0 - px`, ` if tmp <> 0 then ${l}[${s}] = 0 - tmp : ${h}[${s}] = 255 - px`];
  const setVel = (axis: "x" | "y", s: string, v16: number) => [` ov${axis}[${s}] = ${hi(v16)} : ov${axis}l[${s}] = ${lo(v16)}`];
  /** Writes the signed sixteenths in `src` to slot s's velocity. */
  const writeVel = (axis: "x" | "y", s: string, src: string) => [
    ` ov${axis}[${s}] = ${src} / 16`,
    ` if ${src} >= 128 then ov${axis}[${s}] = ov${axis}[${s}] | 240`,
    ` ov${axis}l[${s}] = ${src} * 16`,
  ];
  const readVel = (axis: "x" | "y", s: string, dest: string) => [` ${dest} = ov${axis}[${s}] * 16`, ` vt = ov${axis}l[${s}] / 16`, ` ${dest} = ${dest} | vt`];

  // ---- values ----
  const whoVar = (c: Ctx, of: "it" | "other" | "target") => (of === "it" ? c.it : of === "other" ? c.other : c.target!);
  const PROP_ARRAY: Record<string, string> = { x: "ox", y: "oy", a: "oa", b: "ob", timer: "otimer", facing: "ofacing" };
  /** A value with no work to do, as an operand: a number, a variable or an array element. */
  const simple = (v: IRValue, c: Ctx): string | null => {
    if (v.times || v.div || v.neg || v.plus) return null;
    if (v.src.k === "lit") return String(byte(v.src.n));
    if (v.src.k === "var") return v.src.name;
    if (v.src.k === "prop" && PROP_ARRAY[v.src.prop]) return `${PROP_ARRAY[v.src.prop]}[${whoVar(c, v.src.of)}]`;
    return null;
  };
  const value = (v: IRValue, dest: string, c: Ctx): string[] => {
    const out: string[] = [];
    const s = v.src;
    if (s.k === "lit") out.push(` ${dest} = ${byte(s.n)}`);
    else if (s.k === "var") out.push(` ${dest} = ${s.name}`);
    else if (s.k === "prop") {
      const slot = whoVar(c, s.of);
      if (s.prop === "vx" || s.prop === "vy") out.push(...readVel(s.prop === "vx" ? "x" : "y", slot, dest));
      else out.push(` ${dest} = ${PROP_ARRAY[s.prop]}[${slot}]`);
    } else if (s.k === "count") {
      const t = T(s.type);
      if (!live(t)) out.push(` ${dest} = 0`);
      else if (t.loop[0] === t.loop[1]) out.push(` ${dest} = 0`, ` if otype[${t.loop[0]}] = ${t.sym} then ${dest} = 1`);
      else out.push(` ${dest} = 0`, ` for ck = ${t.loop[0]} to ${t.loop[1]}`, ` if otype[ck] = ${t.sym} then ${dest} = ${dest} + 1`, " next");
    } else if (s.k === "random") {
      const n = s.n;
      if (n >= 255) out.push(` ${dest} = rand`);
      else if (((n + 1) & n) === 0) out.push(` ${dest} = rand & ${n}`);
      else {
        let m = 1;
        while (m < n) m = m * 2 + 1;
        const again = L("rnd");
        out.push(again, ` ${dest} = rand & ${m}`, ` if ${dest} > ${n} then goto ${again}`);
      }
    } else if (s.k === "joy") {
      const [neg, pos] = s.axis === "x" ? [2, 3] : [0, 1];
      out.push(` ${dest} = 0`, ` if pad1{${neg}} then ${dest} = 255`, ` if pad1{${pos}} then ${dest} = 1`);
    } else if (s.k === "facing") {
      out.push(` vt = ofacing[${whoVar(c, s.of)}]`, ` ${dest} = face${s.axis}[vt]`);
    } else {
      out.push(` ${dest} = ocontact[${whoVar(c, s.of)}] & ${BIT[s.side]}`, ` if ${dest} then ${dest} = 1`);
    }
    if (v.times && v.times > 1) out.push(` ${dest} = ${dest} * ${v.times}`);
    if (v.div) out.push(` ${dest} = ${dest} / ${v.div}`);
    if (v.neg) out.push(` ${dest} = 0 - ${dest}`);
    if (v.plus) out.push(v.plus > 0 ? ` ${dest} = ${dest} + ${v.plus}` : ` ${dest} = ${dest} - ${-v.plus}`);
    return out;
  };
  /** An operand for v: as is when simple, else computed into dest first. */
  const operand = (v: IRValue, dest: string, c: Ctx): [string[], string] => {
    const s = simple(v, c);
    return s !== null ? [[], s] : [value(v, dest, c), dest];
  };
  const NOT: Record<string, string> = { eq: "<>", ne: "=", gt: "<=", gte: "<", lt: ">=", lte: ">" };
  /** Lines that `goto fail` (or return, with fail "return") unless the comparison holds. */
  const check = (cmp: IRCompare, fail: string, c: Ctx): string[] => {
    const signed = cmp.a.signed || cmp.b.signed;
    const go = fail === "return" ? "return" : `goto ${fail}`;
    if (signed) {
      const out = [...value(cmp.a, "tmp2", c), ` tmp2 = tmp2 ^ 128`];
      const b = simple(cmp.b, c);
      if (b !== null && /^\d+$/.test(b)) out.push(` if tmp2 ${NOT[cmp.op]} ${byte(Number(b) ^ 128)} then ${go}`);
      else out.push(...value(cmp.b, "tmp3", c), ` tmp3 = tmp3 ^ 128`, ` if tmp2 ${NOT[cmp.op]} tmp3 then ${go}`);
      return out;
    }
    const [la, a] = operand(cmp.a, "tmp2", c);
    const [lb, b] = operand(cmp.b, "tmp3", c);
    // An array element compared with another needs one side in a variable.
    if (a.includes("[") && b.includes("[")) return [...la, ` tmp2 = ${a}`, ...lb, ` if tmp2 ${NOT[cmp.op]} ${b} then ${go}`];
    return [...la, ...lb, ` if ${a} ${NOT[cmp.op]} ${b} then ${go}`];
  };

  // ---- targets ----
  /** Runs body once for each slot the target names, with the slot in a variable. */
  const withTarget = (t: IRTarget, c: Ctx, body: (slot: string, type: IRType) => string[]): string[] => {
    const type = T(t.type);
    if (t.k === "it") return body(c.it, type);
    if (t.k === "other") return body(c.other, type);
    if (!live(type)) return [` rem (no ${type.label} can exist)`];
    const v = c.loop;
    if (t.k === "every") {
      const next = L("tgt");
      const inner = { ...c, target: v, targetType: t.type };
      return slotRange(type, v, [...(t.where ? check(t.where, next, inner) : []), ...body(v, type)], next);
    }
    const skip = L("tgt");
    if (t.k === "nearest") {
      return [
        ` nfrom = ${c.it} : ntype = ${type.sym} : nlo = ${type.loop[0]} : nhi = ${type.loop[1]}`,
        " gosub nearest",
        ` if nbest = EMPTY then goto ${skip}`,
        ` ${v} = nbest`,
        ...body(v, type),
        skip,
      ];
    }
    // A random one: a random slot in its range, then the next one that holds one.
    const size = type.loop[1] - type.loop[0] + 1;
    const scan = L("tgt");
    const found = L("tgt");
    return [
      ...value({ src: { k: "random", n: size - 1 }, signed: false }, v, c),
      ` ${v} = ${v} + ${type.loop[0]} : rc = ${size}`,
      scan,
      ` if otype[${v}] = ${type.sym} then goto ${found}`,
      ` ${v} = ${v} + 1`,
      ` if ${v} > ${type.loop[1]} then ${v} = ${type.loop[0]}`,
      " rc = rc - 1",
      ` if rc then goto ${scan}`,
      ` goto ${skip}`,
      found,
      ...body(v, type),
      skip,
    ];
  };

  // ---- rules: which kinds have event rules ----
  const rulesFor = (k: IRRule["trigger"]["k"], type: number) => ir.rules.filter((r) => r.trigger.k === k && "type" in r.trigger && r.trigger.type === type);
  /** Calls the event rules for slot `slot` of a kind (created, destroyed, timer out). */
  const fireEvent = (k: "created" | "destroyed" | "timerOut", type: number, slot: string): string[] =>
    rulesFor(k, type).flatMap((r) => [` ${k === "timerOut" ? "oi" : "ei"} = ${slot} : gosub ${r.label}`]);

  /** Starting velocity (and the rest) of a new thing in slot s. */
  const initThing = (t: IRType, s: string): string[] => [
    ` ofx[${s}] = 0 : ofy[${s}] = 0`,
    ...(t.move.pace ? [` ps = ${s} : gosub pace_${t.name}`] : [...setVel("x", s, t.move.vx), ...setVel("y", s, t.move.vy)]),
    ...(f.vars ? [` oa[${s}] = ${t.vars.a} : ob[${s}] = ${t.vars.b}`] : []),
    ...(f.timers ? [` otimer[${s}] = 0`] : []),
    ...(f.timedTurns ? [` oback[${s}] = EMPTY`] : []),
    ...(f.protect ? [` oprot[${s}] = 0`] : []),
    ...(f.latchThings ? [` olatch[${s}] = 0`] : []),
    ...(f.contact ? [` ocontact[${s}] = 0`] : []),
    ...(f.facing ? [` ofacing[${s}] = ${facingOf(t.move.vx, t.move.vy)}`] : []),
    ...(f.remember ? [` oplace[${s}] = EMPTY`] : []),
  ];

  /** Keeps slot s on the screen after its x or y changed. */
  const clampX = (s: string, w: number) => [` if ox[${s}] >= 208 then ox[${s}] = 0`, ` if ox[${s}] > ${160 - w} then ox[${s}] = ${160 - w}`];
  const clampY = (s: string, h: number) => [` if oy[${s}] >= 240 then oy[${s}] = ROOMTOP`, ` if oy[${s}] < ROOMTOP then oy[${s}] = ROOMTOP`, ` if oy[${s}] > ${192 - h} then oy[${s}] = ${192 - h}`];

  // ---- actions ----
  const action = (a: IRAction, c: Ctx, rule: IRRule): string[] => {
    const out: string[] = [spanOpen(a.span)];
    const push = (...ls: string[]) => out.push(...ls);
    switch (a.k) {
      case "counter": {
        const [lv, v] = operand(a.value, "tmp", c);
        push(...lv);
        if (a.mode === "set") push(` ${a.name} = ${v}`, ` if ${a.name} > 99 then ${a.name} = 99`);
        else if (a.mode === "add") push(...(v === "tmp" ? [] : [` tmp = ${v}`]), " if tmp > 99 then tmp = 99", ` ${a.name} = ${a.name} + tmp`, ` if ${a.name} > 99 then ${a.name} = 99`);
        else push(...(v === "tmp" ? [] : [` tmp = ${v}`]), ` if ${a.name} < tmp then ${a.name} = 0 else ${a.name} = ${a.name} - tmp`);
        break;
      }
      case "score": {
        const n = a.value.src.k === "lit" ? a.value.src.n : 0;
        if (a.mode === "set") push(" score0 = 0");
        else push(` score0 = score0 ${a.mode === "add" ? "+" : "-"} ${n}`);
        break;
      }
      case "prop":
        push(
          ...withTarget(a.who, c, (s, type) => {
            const inner = { ...c, target: s, targetType: type.index };
            const [lv, v] = operand(a.value, "tmp", inner);
            if (a.prop === "vx" || a.prop === "vy") {
              const axis = a.prop === "vx" ? "x" : "y";
              const lines = [...lv, ...(v === "tmp" ? [] : [` tmp = ${v}`])];
              if (a.mode !== "set") lines.push(...readVel(axis, s, "tmp2"), ` tmp = tmp2 ${a.mode === "add" ? "+" : "-"} tmp`);
              return [...lines, ...writeVel(axis, s, "tmp")];
            }
            const arr = `${PROP_ARRAY[a.prop]}[${s}]`;
            const lines = [...lv, a.mode === "set" ? ` ${arr} = ${v}` : ` ${arr} = ${arr} ${a.mode === "add" ? "+" : "-"} ${v}`];
            if (a.prop === "x") lines.push(...clampX(s, type.width));
            if (a.prop === "y") lines.push(...clampY(s, type.height));
            if (a.prop === "facing") lines.push(` ${arr} = ${arr} & 7`);
            return lines;
          }),
        );
        break;
      case "step":
        push(
          ...withTarget(a.who, c, (s, type) => {
            const inner = { ...c, target: s, targetType: type.index };
            const mover = type.move.wall === "through" || !hasWalls ? "trymoveedge" : "trymovesized";
            return [
              " ms = mi",
              ...value(a.dx, "tmp", inner),
              ...value(a.dy, "sdy", inner),
              ` mi = ${s} : wid = ${type.width} : hgt = ${type.height}`,
              ` nx = ox[mi] + tmp : ny = oy[mi]`,
              ` if tmp then gosub ${mover}`,
              ` nx = ox[mi] : ny = oy[mi] + sdy`,
              ` if sdy then gosub ${mover}`,
              " mi = ms",
            ];
          }),
        );
        break;
      case "create": {
        const t = T(a.type);
        const [s0, s1] = t.own;
        const make = (pos: string[], at: { slot: string; type: IRType } | null): string[] => {
          const free = L("make");
          const done = L("make");
          const inner = at ? { ...c, target: at.slot, targetType: at.type.index } : c;
          const vel: string[] = [];
          if (a.vx) vel.push(...value(a.vx, "tmp", inner), ...writeVel("x", "cs", "tmp"));
          if (a.vy) vel.push(...value(a.vy, "tmp", inner), ...writeVel("y", "cs", "tmp"));
          return [
            ...(s0 === s1 ? [` cs = ${s0}`, ` if otype[cs] = EMPTY then goto ${free}`] : [` for cs = ${s0} to ${s1}`, ` if otype[cs] = EMPTY then goto ${free}`, " next"]),
            ` goto ${done}`,
            free,
            ...pos,
            // On the screen, unless it's meant to come and go past the edges.
            ...(t.move.edge === "pass" ? [] : [...clampX("cs", t.width), ...clampY("cs", t.height)]),
            ` otype[cs] = ${t.sym}`,
            " osx[cs] = ox[cs] : osy[cs] = oy[cs]",
            ...initThing(t, "cs"),
            ...vel,
            ...fireEvent("created", t.index, "cs"),
            done,
          ];
        };
        if ("x" in a.at) {
          const at = a.at;
          push(...make([...value(at.x, "tmp", c), ` ox[cs] = tmp + ${byte(a.dx)}`, ...value(at.y, "tmp", c), ` oy[cs] = tmp + ${byte(a.dy)}`], null));
        } else {
          push(
            ...withTarget(a.at, c, (s, type) => {
              const cx = (type.width - t.width) / 2;
              const ox = (a.place === "on" ? 0 : Math.floor(cx)) + a.dx;
              const oy =
                (a.place === "above" ? -t.height : a.place === "below" ? type.height : a.place === "centre" ? Math.floor((type.height - t.height) / 2) : 0) + a.dy;
              const add = (n: number) => (n >= 0 ? `+ ${n}` : `- ${-n}`);
              return make([` ox[cs] = ox[${s}] ${add(ox)}`, ` oy[cs] = oy[${s}] ${add(oy)}`], { slot: s, type });
            }),
          );
        }
        break;
      }
      case "destroy":
        push(...withTarget(a.who, c, (s, type) => [` ds = ${s} : gosub kill_${type.name}`]));
        break;
      case "turn": {
        const into = T(a.into);
        push(
          ...withTarget(a.who, c, (s, from) => [
            ...(a.tenths
              ? [` if oback[${s}] = EMPTY then oback[${s}] = otype[${s}]`, ` otimer[${s}] = ${a.tenths}`]
              : f.timedTurns
                ? [` oback[${s}] = EMPTY`]
                : []),
            ` otype[${s}] = ${into.sym}`,
            // Something turning into a bigger thing could end up past the screen edge, where it could never move again.
            ...(into.width > from.width ? [` if ox[${s}] > ${160 - into.width} && ox[${s}] < 208 then ox[${s}] = ${160 - into.width}`] : []),
            ...(into.height > from.height ? [` if oy[${s}] > ${192 - into.height} && oy[${s}] < 240 then oy[${s}] = ${192 - into.height}`] : []),
          ]),
        );
        break;
      }
      case "toStart":
        push(...withTarget(a.who, c, (s) => [` ox[${s}] = osx[${s}] : oy[${s}] = osy[${s}]`]));
        break;
      case "startHere":
        push(...withTarget(a.who, c, (s) => [` osx[${s}] = ox[${s}] : osy[${s}] = oy[${s}]`]));
        break;
      case "protect":
        push(...withTarget(a.who, c, (s) => [` oprot[${s}] = ${a.tenths}`]));
        break;
      case "sound":
        push(` playsfx ${a.label}`);
        break;
      case "send":
        push(` msgs = msgs | ${1 << a.bit}`);
        break;
      case "restart":
        push(" gosub startroom : ruleexit = 1");
        break;
      case "goRoom":
        push(` roomi = ${a.room} : gosub startroom : ruleexit = 1`);
        break;
      case "nextRoom":
        push(" roomi = roomi + 1", ` if roomi >= ${f.rooms} then roomi = 0`, " gosub startroom : ruleexit = 1");
        break;
      case "resetTaken":
        if (f.remember) push(` for rk = 0 to ${3 * f.rooms - 1} : taken[rk] = 0 : next`);
        else push(" rem (rooms don't remember taken things)");
        break;
      case "gameOver":
        push(
          ` gamestate = ${a.won ? "STATE_WON" : "STATE_LOST"} : statesecs = 0 : ruleexit = 1`,
          ` rem audio: the ${a.won ? "winning" : "losing"} jingle plays here (reserved for kit/audio.ts)`,
        );
        break;
      case "run":
        push(` gosub ${a.label}`);
        break;
    }
    void rule;
    out.push(SPAN_END);
    return out;
  };

  /** A rule's body for one kind of "it": the conditions that read things, then the actions. */
  const ruleBody = (r: IRRule, c: Ctx, label: string): string[] => [
    label,
    ...r.post.flatMap((cmp) => check(cmp, "return", c)),
    ...r.actions.flatMap((a) => action(a, c, r)),
    " return",
  ];
  const ctxFor = (r: IRRule, itType: number | null): Ctx => ({ ...(r.event ? EVENT : MAIN), itType, otherType: r.other });
  /** The "do" label for each kind "it" can be. */
  const doLabel = (r: IRRule, k: number) => (r.its.length > 1 ? `${r.label}_do${k + 1}` : `${r.label}_do`);

  // ---- rules ----
  const ruleCode: string[] = [];
  const ruleBodies: string[] = [];
  const eventRules: string[] = [];
  const roomStartCalls: string[] = [];
  const messageRules: string[] = [];
  const globalLatch = (bit: number) => `${bit < 8 ? "latches" : "latches2"}{${bit % 8}}`;

  for (const r of ir.rules) {
    const head = [spanOpen(r.span), ...remLines(`rule ${r.n}: ${opts.sentence(r)}`), r.label];
    const end = `${r.label}_end`;
    const pre = (fail: string) => r.pre.flatMap((cmp) => check(cmp, fail, ctxFor(r, null)));
    const tr = r.trigger;
    const lines: string[] = [];
    const callDo = (k = 0) => [` gosub ${doLabel(r, k)}`, " if ruleexit then return"];

    /** A state about each thing of one kind: `test` lines jump to hit when true for the thing in `v`. */
    const perThing = (t: IRType, v: string, test: (hit: string) => string[], skipProtected: boolean) => {
      if (!live(t)) return [` rem (never true: no ${t.label} can exist)`];
      const hit = `${r.label}_hit`;
      const next = `${r.label}_next`;
      const bit = r.latch?.k === "thing" ? 1 << r.latch.bit : 0;
      const out: string[] = [];
      const body = [
        ...(skipProtected && f.protect ? [` if oprot[${v}] then goto ${next}`] : []),
        ...test(hit),
        ...(bit ? [` olatch[${v}] = olatch[${v}] & ${255 - bit}`] : []),
        ` goto ${next}`,
        hit,
      ];
      if (r.any) {
        const latched = r.latch?.k === "global" ? globalLatch(r.latch.bit) : null;
        body.push(...(latched ? [` if ${latched} then goto ${end}`, ` ${latched} = 1`] : []), ...callDo(), ` goto ${end}`);
        out.push(...slotRange(t, v, body, next));
        if (latched) out.push(` ${latched} = 0`);
        return out;
      }
      if (bit) body.push(` tmp = olatch[${v}] & ${bit}`, ` if tmp then goto ${next}`, ` olatch[${v}] = olatch[${v}] | ${bit}`);
      body.push(...callDo());
      return slotRange(t, v, body, next);
    };

    if (tr.k === "touch") {
      const a = T(tr.a);
      const b = T(tr.b);
      if (!live(a) || !live(b)) {
        ruleCode.push([...head, ` rem (never true: no ${!live(a) ? a.label : b.label} can exist)`, SPAN_END].join("\n"));
        ruleBodies.push(ruleBody(r, ctxFor(r, tr.a), doLabel(r, 0)).join("\n"));
        continue;
      }
      lines.push(...pre(end));
      const inner = (hit: string, outerV: string, innerT: IRType, innerV: string, outerT: IRType, allPairs: boolean) => {
        const nj = L(`${r.label}_nj`);
        const [s0, s1] = innerT.loop;
        const pair = [
          ` if otype[${innerV}] <> ${innerT.sym} then goto ${nj}`,
          ...(innerT.index === outerT.index ? [` if ${innerV} = ${outerV} then goto ${nj}`] : []),
          ...(f.protect ? [` if oprot[${innerV}] then goto ${nj}`] : []),
          ` x2 = ox[${innerV}] : y2 = oy[${innerV}]`,
        ];
        const box = `boxcollision(x1, y1, ${outerT.width}, ${outerT.height}, x2, y2, ${innerT.width}, ${innerT.height})`;
        const hitLines = allPairs
          ? [` if ${box} then gosub ${doLabel(r, 0)}`, " if ruleexit then return", ` if otype[${outerV}] <> ${outerT.sym} then goto ${hit}`]
          : [` if ${box} then goto ${hit}`];
        const loop = s0 === s1 ? [` ${innerV} = ${s0}`, ...pair, ...hitLines, nj] : [` for ${innerV} = ${s0} to ${s1}`, ...pair, ...hitLines, nj, " next"];
        return [` x1 = ox[${outerV}] : y1 = oy[${outerV}]`, ...loop];
      };
      if (r.fires === "while" && !r.any) {
        // Every touching pair fires, as in v1; the outer loop runs over the scarcer kind.
        // (Either way "it" is in oi and "the other" in oj.)
        const swap = b.population < a.population;
        const [outer, innerT, ov, iv] = swap ? [b, a, "oj", "oi"] : [a, b, "oi", "oj"];
        const ni = `${r.label}_ni`;
        lines.push(
          ...slotRange(outer, ov, [...(f.protect ? [` if oprot[${ov}] then goto ${ni}`] : []), ...inner(ni, ov, innerT, iv, outer, true)], ni),
        );
      } else {
        lines.push(...perThing(a, "oi", (hit) => inner(hit, "oi", b, "oj", a, false), true));
      }
    } else if (tr.k === "tile") {
      const t = T(tr.type);
      lines.push(...(r.fires === "while" ? [` if oddframe = 0 then goto ${end}`] : []), ...pre(end));
      lines.push(
        ...perThing(
          t,
          "oi",
          (hit) => {
            const no = L(`${r.label}_off`);
            return [
              ` px = ox[oi] + ${Math.floor(t.width / 2)} : py = oy[oi] + ${Math.floor(t.height / 2)}`,
              ` if py > 191 then goto ${no}`,
              ` if py < ROOMTOP then goto ${no}`,
              ` if px > 159 then goto ${no}`,
              " gosub wallat",
              ` if cell = ${tr.tile} then goto ${hit}`,
              no,
            ];
          },
          true,
        ),
      );
    } else if (tr.k === "edge") {
      const t = T(tr.type);
      lines.push(...pre(end));
      lines.push(
        ...perThing(
          t,
          "oi",
          (hit) =>
            tr.sides.flatMap((side) => {
              const no = L(`${r.label}_e`);
              if (side === "left") return [` if ox[oi] < 2 then goto ${hit}`, ` if ox[oi] >= 208 then goto ${hit}`];
              if (side === "top") return [` if oy[oi] < ${ROOMTOP + 2} then goto ${hit}`, ` if oy[oi] >= 240 then goto ${hit}`];
              if (side === "right") return [` if ox[oi] >= 208 then goto ${no}`, ` tmp = ox[oi] + ${t.width}`, ` if tmp >= 158 then goto ${hit}`, no];
              return [` if oy[oi] >= 240 then goto ${no}`, ` tmp = oy[oi] + ${t.height}`, ` if tmp >= 190 then goto ${hit}`, no];
            }),
          false,
        ),
      );
    } else if (tr.k === "wall") {
      const t = T(tr.type);
      const mask = tr.sides.reduce((m, s) => m | BIT[s], 0);
      lines.push(...pre(end), ...perThing(t, "oi", (hit) => [` tmp = ocontact[oi] & ${mask}`, ` if tmp then goto ${hit}`], false));
    } else if (tr.k === "leaves") {
      const t = T(tr.type);
      lines.push(...pre(end), ...perThing(t, "oi", (hit) => [` mi = oi : wid = ${t.width} : hgt = ${t.height}`, " gosub offscreen", ` if tmp then goto ${hit}`], false));
    } else if (tr.k === "button" || tr.k === "pushed") {
      const edgeVar = tr.k === "button" && tr.released ? "padreleased" : "padpressed";
      if (tr.k === "button") lines.push(` if !${edgeVar}{4} then goto ${end}`);
      else if (tr.dir === "any") lines.push(" tmp = padpressed & 15", ` if tmp = 0 then goto ${end}`);
      else lines.push(` if !padpressed{${{ up: 0, down: 1, left: 2, right: 3 }[tr.dir]}} then goto ${end}`);
      lines.push(...pre(end));
      if (!tr.types.length) lines.push(...callDo());
      tr.types.forEach((k, i) => {
        const t = T(k);
        if (!live(t)) return;
        const next = L(`${r.label}_p`);
        lines.push(...slotRange(t, "oi", [...callDo(i)], next));
      });
    } else if (tr.k === "every") {
      if (tr.frames && tr.n === 1) lines.push(...pre(end), ...callDo());
      else {
        lines.push(
          ...(tr.frames ? [] : [` if secondtick <> 0 then goto ${end}`]),
          ` ${tr.counter} = ${tr.counter} - 1`,
          ` if ${tr.counter} then goto ${end}`,
          ` ${tr.counter} = ${tr.n}`,
          ...pre(end),
          ...callDo(),
        );
      }
    } else if (tr.k === "after" || tr.k === "test") {
      // Fires once each time it (with its conditions) becomes true; checked on odd frames.
      const flag = r.latch ? globalLatch((r.latch as { bit: number }).bit) : null;
      const off = flag ? `${r.label}_off` : end;
      lines.push(` if oddframe = 0 then goto ${end}`);
      if (tr.k === "after") lines.push(` if seconds <> ${tr.n} then goto ${off}`);
      else lines.push(...check(tr.cmp, off, ctxFor(r, null)));
      lines.push(...pre(off));
      if (flag) lines.push(` if ${flag} then goto ${end}`, ` ${flag} = 1`);
      lines.push(...callDo());
      if (flag) lines.push(` goto ${end}`, off, ` ${flag} = 0`);
    } else if (tr.k === "message") {
      lines.push(` if !msgnow{${tr.bit}} then goto ${end}`, ...pre(end), ...callDo());
    }

    // Event rules are subroutines other code calls with "it" in a variable.
    if (tr.k === "created" || tr.k === "destroyed" || tr.k === "timerOut" || tr.k === "roomStart") {
      const c = ctxFor(r, r.its[0] ?? null);
      eventRules.push([...head, ...r.pre.flatMap((cmp) => check(cmp, "return", c)), ` gosub ${doLabel(r, 0)}`, " return", SPAN_END].join("\n"));
      if (tr.k === "roomStart") roomStartCalls.push(` gosub ${r.label}`, " if ruleexit then return");
    } else {
      const code = [...head, ...lines, end, SPAN_END].join("\n");
      if (tr.k === "message") messageRules.push(code);
      else ruleCode.push(code);
    }
    const bodies = r.its.length ? r.its.map((k, i) => ruleBody(r, ctxFor(r, k), doLabel(r, i))) : [ruleBody(r, ctxFor(r, null), doLabel(r, 0))];
    ruleBodies.push([spanOpen(r.span), ...bodies.flat(), SPAN_END].join("\n"));
  }

  // ---- movement, per kind ----
  const movement: string[] = [];
  const kills: string[] = [];
  const paces: string[] = [];
  const sweeps: string[] = [];
  for (const t of ir.types) {
    const lbl = `upd_${t.name}`;
    const next = `${lbl}_next`;
    const kill = (v: string) => [` ds = ${v} : gosub kill_${t.name}`, ` goto ${next}`];
    // kill_<n>: removes the thing in slot ds, then runs its "destroyed" rules (it can still be read).
    kills.push(
      [
        spanOpen(t.span),
        `kill_${t.name}`,
        ` rem remove a ${t.label}`,
        ...(f.remember ? [" tmp = oplace[ds]", " if tmp <> EMPTY then tmp2 = sptakebyte[tmp] : taken[tmp2] = taken[tmp2] | sptakebit[tmp]"] : []),
        " otype[ds] = EMPTY",
        ...fireEvent("destroyed", t.index, "ds"),
        " return",
        SPAN_END,
      ].join("\n"),
    );
    if (t.move.pace) {
      const step = (v: number) => SPEED_STEPS.indexOf(Math.abs(v) as never);
      const axis = (a: "x" | "y", v: number) =>
        v === 0
          ? [` ov${a}[ps] = 0 : ov${a}l[ps] = 0`]
          : [
              ` tmp = ${step(v)} + ${t.move.pace!.plus}`,
              ` if tmp > ${t.move.pace!.max} then tmp = ${t.move.pace!.max}`,
              v > 0 ? ` ov${a}[ps] = speedhi[tmp] : ov${a}l[ps] = speedlo[tmp]` : ` ov${a}[ps] = nspeedhi[tmp] : ov${a}l[ps] = nspeedlo[tmp]`,
            ];
      paces.push([`pace_${t.name}`, ` rem ${t.label}: starting speed, faster with ${t.move.pace.plus}`, ...axis("x", t.move.vx), ...axis("y", t.move.vy), " return"].join("\n"));
    }
    const lx = t.axes.x;
    const ly = t.axes.y;
    const anything = lx || ly || !!t.hook || t.uses.contact;
    if (!live(t) || !anything) {
      movement.push([spanOpen(t.span), ` rem ${t.label}: ${live(t) ? "doesn't move" : "none can exist"}`, SPAN_END].join("\n"));
      continue;
    }
    const body: string[] = [];
    if (t.move.sliced) body.push(" tmp = mi ^ frame", " tmp = tmp & 1", ` if tmp then goto ${next}`);
    // Part 1: control.
    const speedOf = (sp: { step: number; plus?: string; max: number }, sign: 1 | -1, a: "x" | "y") =>
      sp.plus
        ? [` sp = ${sp.step} + ${sp.plus}`, ` if sp > ${sp.max} then sp = ${sp.max}`, sign > 0 ? ` ov${a}[mi] = speedhi[sp] : ov${a}l[mi] = speedlo[sp]` : ` ov${a}[mi] = nspeedhi[sp] : ov${a}l[mi] = nspeedlo[sp]`]
        : [...setVel(a, "mi", sign * SPEED_STEPS[sp.step]!)];
    if (t.control) {
      const c = t.control;
      const done = `${lbl}_ctl`;
      const xs = c.axes !== "ud";
      const ys = c.axes !== "lr";
      if (c.mode === "keep") body.push(" tmp = pad1 & 15", ` if tmp = 0 then goto ${done}`);
      body.push(...(xs ? setVel("x", "mi", 0) : []), ...(ys ? setVel("y", "mi", 0) : []));
      const dir = (bit: number, a: "x" | "y", sign: 1 | -1, face: number) => {
        const sk = L(lbl);
        return [` if !pad1{${bit}} then goto ${sk}`, ...speedOf(c.speed, sign, a), ...(t.uses.facing ? [` ofacing[mi] = ${face}`] : []), ...(c.axes === "4way" ? [` goto ${done}`] : []), sk];
      };
      if (xs) body.push(...dir(2, "x", -1, 4), ...dir(3, "x", 1, 0));
      if (ys) body.push(...dir(0, "y", -1, 6), ...dir(1, "y", 1, 2));
      body.push(done);
    }
    // Part 2: steer toward (or away from) the nearest thing of a kind.
    if (t.steer) {
      const s = t.steer;
      const target = T(s.target);
      const done = `${lbl}_str`;
      if (s.every > 1) body.push(` tmp = mi + frame`, ` tmp = tmp & ${s.every - 1}`, ` if tmp then goto ${done}`);
      if (!live(target)) body.push(` goto ${done}`);
      else if (target.loop[0] === target.loop[1] && target.index !== t.index) body.push(` sk = ${target.loop[0]}`, ` if otype[sk] <> ${target.sym} then goto ${done}`);
      else body.push(` nfrom = mi : ntype = ${target.sym} : nlo = ${target.loop[0]} : nhi = ${target.loop[1]}`, " gosub nearest", " sk = nbest", ` if sk = EMPTY then goto ${done}`);
      const toward = s.away ? -1 : 1;
      const axis = (a: "x" | "y", arr: string) => {
        const less = L(lbl);
        const more = L(lbl);
        const end = L(lbl);
        // v1's flee moved on when level with the target; a chaser waits.
        return [
          ...setVel(a, "mi", 0),
          ` tmp = ${arr}[sk]`,
          ` if ${arr}[mi] < tmp then goto ${less}`,
          s.away ? ` goto ${more}` : ` if ${arr}[mi] = tmp then goto ${end}`,
          more,
          ...speedOf(s.speed, toward > 0 ? -1 : 1, a),
          ` goto ${end}`,
          less,
          ...speedOf(s.speed, toward > 0 ? 1 : -1, a),
          end,
        ];
      };
      // A chaser that's level on an axis stays still on it.
      body.push(...axis("x", "ox"), ...axis("y", "oy"), done);
    }
    // Part 3: gravity.
    if (t.gravity) {
      const gr = t.gravity;
      const a = gr.axis;
      const times = t.move.sliced ? 2 : 1;
      if (typeof gr.amount === "number") {
        const g16 = gr.amount * times;
        const add = raw16(g16);
        const carry = L(lbl);
        body.push(` tmp = ov${a}l[mi] + ${add & 255}`, ` if tmp >= ov${a}l[mi] then goto ${carry}`, ` ov${a}[mi] = ov${a}[mi] + 1`, carry, ` ov${a}l[mi] = tmp`, ` ov${a}[mi] = ov${a}[mi] + ${add >> 8}`);
        if ((add & 255) === 0) body.splice(body.length - 5, 4);
      } else {
        const arr = gr.amount === "a" ? "oa" : "ob";
        for (let i = 0; i < times; i++) {
          const carry = L(lbl);
          body.push(` gg = ${arr}[mi]`, ` tmp2 = gg * 16`, ` tmp3 = gg / 16`, ` if gg >= 128 then tmp3 = tmp3 | 240`, ` tmp = ov${a}l[mi] + tmp2`, ` if tmp >= ov${a}l[mi] then goto ${carry}`, ` tmp3 = tmp3 + 1`, carry, ` ov${a}l[mi] = tmp`, ` ov${a}[mi] = ov${a}[mi] + tmp3`);
        }
      }
      // Top speed, both ways.
      const max = gr.max;
      body.push(...readVel(a, "mi", "tmp"), ` if tmp < 128 && tmp > ${max} then ${setVel(a, "mi", max)[0]!.trim()}`, ` if tmp >= 128 && tmp < ${256 - max} then ${setVel(a, "mi", -max)[0]!.trim()}`);
    }
    // Part 4: velocity, one axis at a time, and part 5: reactions.
    const exitsOn = t.uses.exits;
    const axisCode = (a: "x" | "y", after: string): string[] => {
      const out: string[] = [];
      const [o, of, v, vl] = a === "x" ? ["ox", "ofx", "ovx", "ovxl"] : ["oy", "ofy", "ovy", "ovyl"];
      out.push(` tmp = ${of}[mi] + ${vl}[mi] : stp = ${v}[mi]`, ` if tmp < ${of}[mi] then stp = stp + 1`);
      if (t.move.sliced) out.push(` amt = tmp + ${vl}[mi] : stp = stp + ${v}[mi]`, " if amt < tmp then stp = stp + 1", " tmp = amt");
      out.push(` ${of}[mi] = tmp`, ` if stp = 0 then goto ${after}`);
      const free = t.move.edge === "pass" && (t.move.wall === "through" || !hasWalls);
      if (free && !exitsOn) {
        // No checks at all; a thing that may have left the screen is looked at once both axes have moved.
        out.push(` ${o}[mi] = ${o}[mi] + stp`, a === "x" ? ` if ox[mi] >= 160 then offcheck = 1` : ` if oy[mi] >= ${192 - 0} then offcheck = 1`);
        if (a === "y") out.push(` if oy[mi] < ROOMTOP then offcheck = 1`);
        return out;
      }
      out.push(a === "x" ? " nx = ox[mi] + stp : ny = oy[mi]" : " nx = ox[mi] : ny = oy[mi] + stp", ` wid = ${t.width} : hgt = ${t.height}`);
      const [neg, pos] = a === "x" ? (["left", "right"] as const) : (["top", "bottom"] as const);
      // Contact: a step along an axis that goes through forgets that axis's contacts; one that's blocked sets one.
      const axisBits = BIT[neg] | BIT[pos];
      out.push(
        ` gosub ${t.move.wall === "through" || !hasWalls ? "trymoveedge" : "trymovesized"}`,
        t.uses.contact ? ` if blocked = 0 then ocontact[mi] = ocontact[mi] & ${255 - axisBits} : goto ${after}` : ` if blocked = 0 then goto ${after}`,
      );
      if (t.uses.contact) out.push(` if stp >= 128 then ocontact[mi] = ocontact[mi] | ${BIT[neg]} else ocontact[mi] = ocontact[mi] | ${BIT[pos]}`);
      const edgeL = L(lbl);
      out.push(` if blocked = 1 then goto ${edgeL}`);
      const react = (r: string): string[] => {
        switch (r) {
          case "stop":
            return [...setVel("x", "mi", 0), ...setVel("y", "mi", 0)];
          case "slide":
            return setVel(a, "mi", 0);
          case "bounce":
            return negate16(v, vl, "mi");
          case "turn":
            // A quarter turn clockwise: (vx, vy) becomes (-vy, vx).
            return [" sp = ovx[mi] : amt = ovxl[mi]", ...negate16("ovy", "ovyl", "mi"), " ovx[mi] = ovy[mi] : ovxl[mi] = ovyl[mi]", " ovy[mi] = sp : ovyl[mi] = amt"];
          case "destroy":
            return kill("mi");
          case "wrap":
            return a === "x"
              ? [` if stp < 128 then ox[mi] = 0 else ox[mi] = ${160 - t.width}`]
              : [` if stp < 128 then oy[mi] = ROOMTOP else oy[mi] = ${192 - t.height}`];
          case "pass":
            return [` ${o}[mi] = ${a === "x" ? "nx" : "ny"}`];
          default:
            return [];
        }
      };
      const wallLines = t.move.wall === "through" ? [] : react(t.move.wall);
      const endsInGoto = /^ goto /.test(wallLines.at(-1) ?? "");
      out.push(...wallLines, ...(endsInGoto ? [] : [` goto ${after}`]), edgeL);
      if (exitsOn) {
        // Through an exit: on to the next room, coming in at the opposite edge.
        const [negSide, posSide] = a === "x" ? ["left", "right"] : ["up", "down"];
        const negL = L(lbl);
        const noExit = L(lbl);
        out.push(
          ` if stp >= 128 then goto ${negL}`,
          ` tmp = exit${posSide}[roomi]`,
          ` if tmp = EMPTY then goto ${noExit}`,
          ` goroom = tmp + 1 : ${a === "x" ? "ox[mi] = 0" : "oy[mi] = ROOMTOP"}`,
          ` goto ${after}`,
          negL,
          ` tmp = exit${negSide}[roomi]`,
          ` if tmp = EMPTY then goto ${noExit}`,
          ` goroom = tmp + 1 : ${a === "x" ? `ox[mi] = ${160 - t.width}` : `oy[mi] = ${192 - t.height}`}`,
          ` goto ${after}`,
          noExit,
        );
      }
      out.push(...react(t.move.edge));
      return out;
    };
    const ylabel = `${lbl}_y`;
    const dlabel = `${lbl}_d`;
    if (lx) body.push(...axisCode("x", ylabel));
    body.push(ylabel);
    if (ly) body.push(...axisCode("y", dlabel));
    body.push(dlabel);
    if (t.move.edge === "pass" && !t.uses.leavesRule) {
      // Gone once wholly off the screen (nothing brings it back).
      const free = t.move.wall === "through" || !hasWalls;
      if (free && !exitsOn) body.splice(t.move.sliced ? 3 : 0, 0, " offcheck = 0");
      body.push(...(free && !exitsOn ? [` if offcheck = 0 then goto ${next}`] : []), ` wid = ${t.width} : hgt = ${t.height}`, " gosub offscreen", ` if tmp then ${kill("mi")[0]!.trim()}`);
    }
    if (t.uses.facing && !t.control && (lx || ly)) body.push(" gosub setfacing");
    if (t.hook) body.push(` rem user_update_${t.id.replace(/-/g, "_")}: your code for each ${t.label} (its slot is in mi)`, ...indent(t.hook));
    const parts = [
      t.control && `joystick ${t.control.joystick} (${t.control.axes}, ${t.control.mode})`,
      t.steer && `steers ${t.steer.away ? "away from" : "toward"} the nearest ${T(t.steer.target).label}`,
      t.gravity && "gravity",
      `velocity${t.move.sliced ? " (alternate frames)" : ""}`,
      `walls: ${t.move.wall}`,
      `edges: ${t.move.edge}`,
    ].filter(Boolean);
    movement.push([spanOpen(t.span), ` rem ---- ${t.label}: ${parts.join(", ")} ----`, ...slotRangeMi(t, body, next), SPAN_END].join("\n"));
    if (t.move.edge === "pass" && t.uses.leavesRule) {
      // Things that left the screen and weren't brought back by a rule this frame go.
      const n2 = `${lbl}_gone`;
      sweeps.push(slotRange(t, "mi", [` wid = ${t.width} : hgt = ${t.height}`, " gosub offscreen", ` if tmp then ds = mi : gosub kill_${t.name}`], n2).join("\n"));
    }
  }
  function slotRangeMi(t: IRType, body: string[], next: string) {
    return slotRange(t, "mi", body, next);
  }

  // ---- drawing, per kind ----
  const draws = ir.types.map((t) => {
    if (!live(t)) return [spanOpen(t.span), ` rem ${t.label}: none can exist`, SPAN_END].join("\n");
    const next = `drw_${t.name}_next`;
    const body: string[] = [];
    if (f.protect) {
      // Protected things blink slowly enough to be safe (WCAG 2.3.1): 16 frames on, 16 off, under 2 Hz.
      body.push(" if oprot[oi] then tmp = frame & 16 else tmp = 0", ` if tmp then goto ${next}`);
    }
    if (t.move.edge === "pass" || t.move.edge === "wrap") body.push(` if oy[oi] >= 192 then goto ${next}`);
    body.push(" px = ox[oi] : py = oy[oi]");
    let frame = "";
    if (t.anim === 2 || t.dirSets > 1) {
      body.push(" fr = 0");
      if (t.dirSets === 2) body.push(" tmp = ofacing[oi]", " if tmp >= 3 && tmp <= 5 then fr = 1");
      if (t.dirSets === 4) body.push(" tmp = ofacing[oi]", " fr = dir4[tmp]");
      if (t.dirSets > 1 && t.anim === 2) body.push(" fr = fr * 2");
      if (t.anim === 2) {
        if (t.animate === "moving") body.push(" tmp = ox[oi] + oy[oi]", " tmp = tmp & 4", " if tmp then fr = fr + 1");
        else body.push(` tmp = frame & ${t.animate}`, " if tmp then fr = fr + 1");
      }
      frame = " fr";
    }
    body.push(` plotsprite4 ${t.sprite} ${t.palette} px py${frame}`);
    return [spanOpen(t.span), ` rem ${t.label}`, ...slotRange(t, "oi", body, next), SPAN_END].join("\n");
  });

  // ---- data ----
  const dataTable = (name: string, values: number[], header?: string) => {
    const rows: string[] = [];
    for (let i = 0; i < values.length; i += 20) rows.push(` ${values.slice(i, i + 20).join(", ")}`);
    return `${header ? ` rem ${header}\n` : ""} data ${name}\n${rows.join("\n") || " 0"}\nend`;
  };
  const allSpawns = ir.rooms.flatMap((r) => r.spawns.map((s) => ({ ...s, room: r.index })));
  let first = 0;
  const roomFirst: number[] = [];
  const roomEnd: number[] = [];
  for (const r of ir.rooms) {
    roomFirst.push(first);
    first += r.spawns.length;
    roomEnd.push(first);
  }
  const typeNames = ir.types.map((t) => t.sym).join(", ");
  const speedTable = SPEED_STEPS.map((s) => s);
  const data: string[] = [
    dataTable("typew", ir.types.map((t) => t.width), `per kind (${typeNames}): width`),
    dataTable("typeh", ir.types.map((t) => t.height), "per kind: height"),
    dataTable("typevx", ir.types.map((t) => hi(t.move.vx)), "per kind: starting velocity (8.8: whole pixels, then 1/256ths)"),
    dataTable("typevxl", ir.types.map((t) => lo(t.move.vx))),
    dataTable("typevy", ir.types.map((t) => hi(t.move.vy))),
    dataTable("typevyl", ir.types.map((t) => lo(t.move.vy))),
    ...(f.vars ? [dataTable("typea", ir.types.map((t) => t.vars.a), "per kind: starting a and b"), dataTable("typeb", ir.types.map((t) => t.vars.b))] : []),
    ...(f.facing ? [dataTable("typefacing", ir.types.map((t) => facingOf(t.move.vx, t.move.vy)), "per kind: starting facing")] : []),
    dataTable("speedhi", speedTable.map(hi), "speed steps 0-6 in 8.8 (whole pixels, 1/256ths), and negated"),
    dataTable("speedlo", speedTable.map(lo)),
    dataTable("nspeedhi", speedTable.map((s) => hi(-s))),
    dataTable("nspeedlo", speedTable.map((s) => lo(-s))),
    ...(f.facing
      ? [
          dataTable("facetab", [5, 4, 3, 6, 255, 2, 7, 0, 1], "facing from the signs of (vx, vy): (x sign x 3 + y sign), 255 keeps it"),
          dataTable("facex", [1, 1, 0, 255, 255, 255, 0, 1], "facing as x and y steps (-1 is 255)"),
          dataTable("facey", [0, 1, 1, 1, 0, 255, 255, 255]),
          dataTable("dir4", [0, 1, 1, 2, 2, 3, 3, 0], "facing to 4 direction frame sets: right, down, left, up"),
        ]
      : []),
    dataTable("rowoffset", Array.from({ length: 11 }, (_, r) => r * 20), "room rows: first tile of each"),
    ...ir.rooms.map((r) => dataTable(f.rooms > 1 ? `roomtiles${r.index}` : "roomwalls", r.tiles, `room ${r.index + 1} tiles: 0 empty, TILE_WALL, TILE_HAZARD, TILE_GOAL`)),
    dataTable("sptype", allSpawns.map((s) => s.type), "placements, every room: kind, x, y, slot"),
    dataTable("spx", allSpawns.map((s) => s.x)),
    dataTable("spy", allSpawns.map((s) => s.y)),
    dataTable("spslot", allSpawns.map((s) => s.slot)),
    dataTable("roomfirst", roomFirst, "each room's first placement, and one past its last"),
    dataTable("roomend", roomEnd),
    ...(f.remember
      ? [
          dataTable("sptakebyte", allSpawns.map((s) => s.room * 3 + Math.floor(s.place / 8)), "taken items: each placement's byte and bit"),
          dataTable("sptakebit", allSpawns.map((s) => 1 << (s.place % 8))),
        ]
      : []),
    ...(f.exits
      ? (["left", "right", "up", "down"] as const).map((side, i) =>
          dataTable(`exit${side}`, ir.rooms.map((r) => r.exits[side] ?? 255), i === 0 ? "exits per room (255: none)" : undefined),
        )
      : []),
    ...(ir.flow.attract ? [dataTable("demoinput", [...ir.flow.attract.input, 0, 0], "attract mode: recorded input, (bits, frames) pairs; 0 frames ends it")] : []),
  ];
  const TILE_CHARS = ["  ", "##", "~~", "**"];
  const maps = ir.rooms.map((r) => {
    const rows = Array.from({ length: 11 }, (_, row) => r.tiles.slice(row * 20, row * 20 + 20).map((t) => TILE_CHARS[t]).join(""));
    return ` alphadata roommap${f.rooms > 1 ? r.index : ""} font\n${rows.flatMap((x) => [x, x]).map((l) => ` '${l}'`).join("\n")}\nend`;
  });

  // ---- startroom ----
  const keep = ir.types.filter((t) => t.uses.exits);
  const startClear = keep.length
    ? (() => {
        const kept = new Set(keep.flatMap((t) => Array.from({ length: t.own[1] - t.own[0] + 1 }, (_, i) => t.own[0] + i)));
        const lines = [" if keepplayers = 0 then goto srclearall"];
        for (let s = 0; s < 24; s++) if (!kept.has(s)) lines.push(` otype[${s}] = EMPTY`);
        lines.push(...keep.flatMap((t) => slotRange(t, "oi", [" osx[oi] = ox[oi] : osy[oi] = oy[oi]"], L("keep"))));
        lines.push(" goto srcleared", "srclearall", " for oi = 0 to 23 : otype[oi] = EMPTY : next", "srcleared");
        return lines;
      })()
    : [" for oi = 0 to 23 : otype[oi] = EMPTY : next"];
  const roomDraw =
    f.rooms > 1
      ? ir.rooms.flatMap((r) => [
          ` if roomi <> ${r.index} then goto srmap${r.index}`,
          ` plotmap roommap${r.index} ${ir.wallPalette} 0 2 20 22 0 0 40`,
          ` plotmap roommap${r.index} ${ir.wallPalette} 80 2 20 22 20 0 40`,
          ...(f.tileMap ? [` for rk = 0 to 219 : roomwalls[rk] = roomtiles${r.index}[rk] : next`] : []),
          `srmap${r.index}`,
        ])
      : [` plotmap roommap ${ir.wallPalette} 0 2 20 22 0 0 40`, ` plotmap roommap ${ir.wallPalette} 80 2 20 22 20 0 40`];
  // Starting speeds that grow with a counter count it as it is once the room's start rules have run.
  const paceAfterStart = ir.types.filter((t) => t.move.pace && live(t)).flatMap((t) => slotRange(t, "sl", [` ps = sl : gosub pace_${t.name}`], L("pace")));
  const placeLoop = [
    " tk = roomfirst[roomi] : tend = roomend[roomi]",
    " if tk = tend then goto srplaced",
    "srplace",
    " sl = spslot[tk]",
    " if otype[sl] <> EMPTY then goto srnext",
    ...(f.remember ? [" tmp = sptakebyte[tk] : tmp2 = taken[tmp] & sptakebit[tk]", " if tmp2 then goto srnext", " oplace[sl] = tk"] : []),
    " ot = sptype[tk] : otype[sl] = ot",
    " ox[sl] = spx[tk] : oy[sl] = spy[tk]",
    " osx[sl] = ox[sl] : osy[sl] = oy[sl]",
    " ofx[sl] = 0 : ofy[sl] = 0",
    " ovx[sl] = typevx[ot] : ovxl[sl] = typevxl[ot]",
    " ovy[sl] = typevy[ot] : ovyl[sl] = typevyl[ot]",
    ...(f.vars ? [" oa[sl] = typea[ot] : ob[sl] = typeb[ot]"] : []),
    ...(f.facing ? [" ofacing[sl] = typefacing[ot]"] : []),
    ...(f.timers ? [" otimer[sl] = 0"] : []),
    ...(f.timedTurns ? [" oback[sl] = EMPTY"] : []),
    ...(f.protect ? [" oprot[sl] = 0"] : []),
    ...(f.latchThings ? [" olatch[sl] = 0"] : []),
    ...(f.contact ? [" ocontact[sl] = 0"] : []),
    "srnext",
    " tk = tk + 1",
    " if tk < tend then goto srplace",
    "srplaced",
  ];
  const roomCounters = ir.counters.filter((c) => c.keep === "room").map((c) => ` ${c.name} = ${c.start}`);
  const everyInit = ir.rules.flatMap((r) => (r.trigger.k === "every" && !(r.trigger.frames && r.trigger.n === 1) ? [` ${r.trigger.counter} = ${r.trigger.n}`] : []));

  // ---- tick: per-thing timers and protection, four slots a frame (each slot every tenth of a second) ----
  const timerOutRules = ir.types.flatMap((t) => rulesFor("timerOut", t.index).map((r) => ` if ot = ${t.sym} then oi = tk : gosub ${r.label} : if ruleexit then return`));
  const tick =
    f.timers || f.protect
      ? [
          "tick",
          " tick6 = tick6 + 1",
          " if tick6 >= 6 then tick6 = 0",
          " tk = tick6 * 4 : tend = tk + 4",
          "tickloop",
          ...(f.protect ? [" if oprot[tk] then oprot[tk] = oprot[tk] - 1"] : []),
          ...(f.timers
            ? [
                " if otimer[tk] = 0 then goto ticknext",
                " otimer[tk] = otimer[tk] - 1",
                " if otimer[tk] then goto ticknext",
                " ot = otype[tk]",
                " if ot = EMPTY then goto ticknext",
                ...(f.timedTurns
                  ? [
                      " if oback[tk] = EMPTY then goto tickout",
                      " rem a timed turn is over: turn back, and keep it on the screen",
                      " ot = oback[tk] : otype[tk] = ot : oback[tk] = EMPTY",
                      " tmp = 160 - typew[ot]",
                      " if ox[tk] > tmp && ox[tk] < 208 then ox[tk] = tmp",
                      " tmp = 192 - typeh[ot]",
                      " if oy[tk] > tmp && oy[tk] < 240 then oy[tk] = tmp",
                      " goto ticknext",
                      "tickout",
                    ]
                  : []),
                ...timerOutRules,
              ]
            : []),
          "ticknext",
          " tk = tk + 1",
          " if tk < tend then goto tickloop",
          " return",
        ].join("\n")
      : "";

  // ---- HUD and screens ----
  const textLine = (s: string, y: number) => {
    const t = kitText(s);
    if (!t) return "";
    return ` plotchars '${t}' ${ir.textPalette} ${Math.floor((160 - t.length * 4) / 2)} ${y}`;
  };
  /** The credit under the title, one line in the kit font: "BY SAM AND ROBIN". */
  const madeByLine = (by: string) => (kitText(by) ? textLine(kitText(`BY ${by}`).replace(/ +/g, " "), 10) : "");
  const HUD_X = { left: 4, middle: 76, "middle-right": 120, right: 152 };
  const hud = ir.hud.map((h, i) => {
    if (h.name === "score") return ` plotvalue font ${ir.textPalette} score0 6 ${HUD_X[h.at] === 4 ? 4 : HUD_X[h.at] - 8} 0`;
    return [` hud${i} = converttobcd(${h.name})`, ` plotvalue font ${ir.textPalette} hud${i} 2 ${Math.min(HUD_X[h.at], 152)} 0`].join("\n");
  });
  const endValues = ir.flow.end.show.map((v, i) => {
    const label = kitText(v.label, 20);
    const x = Math.floor((160 - (label.length + 1) * 4 - (v.name === "score" ? 24 : 8)) / 2);
    const vx = x + (label.length + 1) * 4;
    return v.name === "score"
      ? [` plotchars '${label}' ${ir.textPalette} ${x} ${14 + i}`, ` plotvalue font ${ir.textPalette} score0 6 ${vx} ${14 + i}`].join("\n")
      : [` plotchars '${label}' ${ir.textPalette} ${x} ${14 + i}`, ` endbcd${i} = converttobcd(${v.name})`, ` plotvalue font ${ir.textPalette} endbcd${i} 2 ${vx} ${14 + i}`].join("\n");
  });

  const indentBody = (s: string) => indent(s).join("\n");
  const graphics: Emitted["graphics"] = ir.types.flatMap((t) => t.frames.map((rows, n) => ({ name: n === 0 ? t.sprite : `${t.sprite}_${n + 1}`, rows, label: `${t.label}${n ? ` frame ${n + 1}` : ""}` })));

  /** Who draws with palette i, for its rem line: the labels of the kinds that use it, "walls", "text". */
  const paletteUsers = (i: number) =>
    [...ir.types.filter((t) => t.palette === i).map((t) => t.label), ...(ir.wallPalette === i ? ["walls"] : []), ...(ir.textPalette === i ? ["text"] : [])].join(", ");
  const counterInit = ir.counters.map((c) => ` ${c.name} = ${c.start}`);
  const autos = [
    ...ir.hud.map((_, i) => `hud${i}`),
    ...ir.flow.end.show.map((_, i) => `endbcd${i}`),
  ];

  const view = {
    constants: [
      ...ir.types.map((t) => ` const ${t.sym} = ${t.index}`),
      " const TILE_WALL = 1",
      " const TILE_HAZARD = 2",
      " const TILE_GOAL = 3",
      ` const ROOMS = ${f.rooms}`,
    ].join("\n"),
    dims: dims.join("\n"),
    autodims: autos.map((a) => ` autodim byte ${a}`).join("\n"),
    memoryMap: memory.map((m) => ` rem ${m.at} ${m.name.padEnd(9)} ${String(m.bytes).padStart(3)} bytes: ${m.what}`).join("\n"),
    graphics: graphics.map((g) => ` rem ${g.label}\n incgraphic ${g.name}.png 160A 0 1 2 3`).join("\n"),
    palettes: ir.palettes.map((p, i) => `${remLines(`P${i}: ${paletteUsers(i) || `nothing uses it (${p.id})`}`).join("\n")}\n P${i}C1 = ${p.colors[0]} : P${i}C2 = ${p.colors[1]} : P${i}C3 = ${p.colors[2]}`).join("\n"),
    background: ir.background,
    counterInit: counterInit.join("\n") || " rem no counters",
    titleScreen: ir.flow.title,
    attract: ir.flow.attract,
    attractFrames: ir.flow.attract ? ir.flow.attract.after : 0,
    endAfter: ir.flow.end.after,
    timers: !!tick,
    tick,
    movement: movement.join("\n"),
    sweeps: sweeps.join("\n") || " rem nothing leaves the screen and waits for a rule",
    kills: kills.join("\n\n"),
    paces: paces.join("\n\n"),
    exits: f.exits,
    rules: ruleCode.join("\n\n"),
    messages: f.messages,
    messageRules: messageRules.join("\n\n"),
    ruleActions: ruleBodies.join("\n\n"),
    eventRules: eventRules.join("\n\n"),
    roomStartRules: [...roomStartCalls, ...paceAfterStart].join("\n") || " rem no room start rules",
    hud: hud.join("\n"),
    draws: draws.join("\n"),
    titleText: [textLine(ir.text.title, 9), madeByLine(ir.madeBy), textLine("PRESS FIRE", 12)].filter(Boolean).join("\n") || " rem no title",
    winText: [textLine(ir.text.win, 11), ...endValues].filter(Boolean).join("\n") || " rem no win text",
    loseText: [textLine(ir.text.lose, 11), ...endValues].filter(Boolean).join("\n") || " rem no lose text",
    demoText: textLine("DEMO", 2),
    startClear: startClear.join("\n"),
    roomDraw: roomDraw.join("\n"),
    placeLoop: placeLoop.join("\n"),
    roomCounters: [...roomCounters, ...everyInit].join("\n") || " rem nothing resets per room",
    hasWalls,
    hasTileMap: f.tileMap,
    walls: hasWalls,
    protect: f.protect,
    facing: f.facing,
    contact: f.contact,
    remember: f.remember,
    rememberBytes: 3 * f.rooms - 1,
    latches: true,
    nearest: true,
    offscreen: true,
    dataTables: [...data, ...maps].join("\n\n"),
    userInit: ir.code.init.trim() ? indentBody(ir.code.init) : " rem (empty)",
    userStartroom: ir.code.startroom.trim() ? indentBody(ir.code.startroom) : " rem (empty)",
    userFrame: ir.code.frame.trim() ? indentBody(ir.code.frame) : " rem (empty)",
    userDraw: ir.code.draw.trim() ? indentBody(ir.code.draw) : " rem (empty)",
    routines: ir.code.routines.map((r) => `${r.label}\n${indentBody(r.body)}\n return`).join("\n\n"),
  };
  return { view, graphics, memory };
}

/**
 * A sentence as rem lines: plain ASCII (7800basic reads rems as source
 * lines), wrapped at word breaks, since a very long line breaks its parser.
 */
export function remLines(text: string, width = 100): string[] {
  const ascii = text.replace(/×/g, "x").replace(/÷/g, "/").replace(/[−–]/g, "-").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/…/g, "...").replace(/[^\x20-\x7e]/g, "");
  const out: string[] = [];
  let line = "";
  for (const word of ascii.split(" ")) {
    if (line && line.length + word.length + 1 > width) {
      out.push(` rem ${line}`);
      line = `  ${word}`;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) out.push(` rem ${line}`);
  return out;
}

/** Facing (0-7 clockwise from right) for a velocity; 0 when still. */
export function facingOf(vx: number, vy: number): number {
  const sx = Math.sign(vx) + 1;
  const sy = Math.sign(vy) + 1;
  const f = [5, 4, 3, 6, 255, 2, 7, 0, 1][sx * 3 + sy]!;
  return f === 255 ? 0 : f;
}

/** Code from the project (hooks), with statements indented as 7800basic needs; labels stay at the margin. */
function indent(s: string): string[] {
  return s
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => (l.trim() === "" ? "" : /^\S/.test(l) && /^[A-Za-z_]\w*$/.test(l.trim()) ? l.trim() : ` ${l.trim()}`))
    .filter((l) => l !== "");
}
