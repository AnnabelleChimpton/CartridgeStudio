// Emulator adapter over the unmodified js7800 bundle (public/vendor/js7800).
// js7800 is loaded as its own script and reached only through its public UMD
// exports; everything js7800-specific stays in this file.

import type { Emulator, JoystickState } from "./emulator.ts";

/** The parts of js7800's UMD global this adapter uses. */
interface Js7800Global {
  Main: {
    init(containerId: string, props?: { debug?: boolean }): void;
    startEmulation(cart: number[]): void;
    restart(): void;
    setErrorHandler(handler: (message: string) => void): void;
  };
  Events: {
    Listener: new (topic: string, cb: (event: unknown) => void) => object;
    addListener(listener: object): void;
  };
  Keyboard: {
    p1KeyMap: { setButton1(keyCode: number): void };
  };
  ControlsBar: {
    pauseButton: { setValue(v: boolean): void; onClick(): void };
  };
}

declare global {
  interface Window {
    js7800?: Js7800Global;
  }
}

const SCRIPT_URL = `${import.meta.env.BASE_URL}vendor/js7800/js7800.min.js`;

const KEY = { left: 37, up: 38, right: 39, down: 40, fire: 32 } as const;

type KeyHandler = (event: { keyCode: number; target?: EventTarget | null; preventDefault?: () => void }) => void;

function loadScript(): Promise<Js7800Global> {
  if (window.js7800) return Promise.resolve(window.js7800);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_URL;
    s.onload = () => (window.js7800 ? resolve(window.js7800) : reject(new Error("js7800 did not load")));
    s.onerror = () => reject(new Error(`Could not load ${SCRIPT_URL}`));
    document.head.appendChild(s);
  });
}

function isEditable(target: EventTarget | null | undefined): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

export class Js7800Emulator implements Emulator {
  private frame = 0;
  private running = false;
  private frameListeners = new Set<(frame: number) => void>();
  private onStarted: (() => void) | null = null;
  private loading: Promise<void> = Promise.resolve();
  private input: JoystickState = { up: false, down: false, left: false, right: false, fire: false };

  private constructor(
    private readonly js: Js7800Global,
    private readonly canvas: HTMLCanvasElement,
    private readonly keyDown: KeyHandler,
    private readonly keyUp: KeyHandler,
  ) {}

  private static instance: Promise<Js7800Emulator> | undefined;

  /**
   * Creates the js7800 instance inside `container`. js7800 is a page-wide
   * singleton, so later calls return the first instance.
   */
  static create(container: HTMLElement, onError: (message: string) => void): Promise<Js7800Emulator> {
    Js7800Emulator.instance ??= Js7800Emulator.init(container, onError);
    return Js7800Emulator.instance;
  }

  private static async init(container: HTMLElement, onError: (message: string) => void): Promise<Js7800Emulator> {
    const js = await loadScript();
    container.id ||= "js7800-target";
    js.Main.setErrorHandler(onError);
    js.Main.init(container.id);

    // Fire on Space as well as js7800's default Z, per the spec's key map.
    js.Keyboard.p1KeyMap.setButton1(KEY.fire);

    // js7800 binds document.onkeydown/onkeyup globally. Keep those handlers but
    // stop them from swallowing keys typed into the page's own form fields.
    const down = document.onkeydown as unknown as KeyHandler;
    const up = document.onkeyup as unknown as KeyHandler;
    document.onkeydown = (e) => (isEditable(e.target) ? undefined : down(e));
    document.onkeyup = (e) => (isEditable(e.target) ? undefined : up(e));

    const canvas = container.querySelector<HTMLCanvasElement>("canvas#js7800__screen");
    if (!canvas) throw new Error("js7800 canvas not found");

    const emu = new Js7800Emulator(js, canvas, down, up);
    emu.hookFrames();
    js.Events.addListener(new js.Events.Listener("onEmulationStarted", () => emu.onStarted?.()));
    return emu;
  }

  /** js7800 calls putImageData once per displayed frame; count those calls. */
  private hookFrames() {
    const ctx = this.canvas.getContext("2d")!;
    const put = ctx.putImageData.bind(ctx) as (...args: unknown[]) => void;
    (ctx as { putImageData: (...args: unknown[]) => void }).putImageData = (...args) => {
      put(...args);
      if (!this.running) return;
      this.frame++;
      for (const cb of this.frameListeners) cb(this.frame);
    };
  }

  load(rom: Uint8Array, _format: "a78" | "bin"): Promise<void> {
    // js7800 detects .a78 vs raw .bin from the header itself. It ignores a
    // startEmulation call while another start is in flight, so serialize them.
    this.loading = this.loading.then(
      () =>
        new Promise<void>((resolve) => {
          this.running = false;
          this.onStarted = () => {
            this.onStarted = null;
            this.frame = 0;
            this.running = true;
            resolve();
          };
          this.js.Main.startEmulation(Array.from(rom));
        }),
    );
    return this.loading;
  }

  reset() {
    this.js.Main.restart();
  }

  pause(paused: boolean) {
    const button = this.js.ControlsBar.pauseButton;
    button.setValue(paused);
    button.onClick();
  }

  setInput(state: JoystickState) {
    for (const k of Object.keys(KEY) as (keyof JoystickState)[]) {
      if (state[k] !== this.input[k]) {
        (state[k] ? this.keyDown : this.keyUp)({ keyCode: KEY[k] });
      }
    }
    this.input = { ...state };
  }

  onFrame(cb: (frame: number) => void): () => void {
    this.frameListeners.add(cb);
    return () => this.frameListeners.delete(cb);
  }

  /** Waits for `n` more frames. js7800 runs in real time, so this is not lockstep. */
  stepFrames(n: number): Promise<void> {
    const target = this.frame + n;
    return new Promise((resolve) => {
      const off = this.onFrame((f) => {
        if (f >= target) {
          off();
          resolve();
        }
      });
    });
  }

  async framebufferHash(): Promise<string> {
    const ctx = this.canvas.getContext("2d")!;
    const pixels = ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
    const digest = await crypto.subtle.digest("SHA-256", pixels);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
}
