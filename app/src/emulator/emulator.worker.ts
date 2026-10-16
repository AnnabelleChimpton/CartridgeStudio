/// <reference lib="webworker" />
// Emulator worker (SPEC.md, "Emulator preview"): runs the js7800 core off the
// main thread, draws to an OffscreenCanvas and sends sound straight to an
// AudioWorklet. It runs in real time, and `step` advances exact frames for
// tests (lockstep).

import { CoreHost, HEIGHT, WIDTH, type Js7800Core } from "./core-host.ts";
import type { EmuRequest, EmuResponse } from "./protocol.ts";

declare const self: DedicatedWorkerGlobalScope;

let host: CoreHost | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let image: ImageData | null = null;
let audioPort: MessagePort | null = null;
let paused = false;
let running = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let nextAt = 0;
let clip: { every: number; max: number; frames: Uint8Array[] } | null = null;

const post = (msg: EmuResponse, transfer: Transferable[] = []) => self.postMessage(msg, transfer);
const reply = (id: number, value?: unknown, transfer: Transferable[] = []) => post({ type: "reply", id, value }, transfer);

function render() {
  if (!host || !ctx || !image) return;
  host.rgba(image.data);
  ctx.putImageData(image, 0, 0);
}

function flushAudio() {
  if (!host) return;
  const samples = host.takeSamples();
  if (audioPort && samples.length) audioPort.postMessage(samples, [samples.buffer]);
}

/** Real-time loop, paced by setTimeout with drift correction. */
function tick() {
  timer = null;
  if (!host || !running || paused) return;
  const frameMs = 1000 / host.frequency;
  const now = performance.now();
  if (now - nextAt > 250) nextAt = now; // we fell far behind (tab hidden?): don't fast-forward
  host.step(1);
  flushAudio();
  render();
  keepClipFrame();
  post({ type: "frame", frame: host.frame });
  nextAt += frameMs;
  timer = setTimeout(tick, Math.max(0, nextAt - performance.now()));
}

function keepClipFrame() {
  if (!clip || !host || host.frame % clip.every !== 0 || clip.frames.length >= clip.max) return;
  clip.frames.push(host.indices());
  if (clip.frames.length === clip.max) post({ type: "clip-full" });
}

function startLoop() {
  if (timer !== null || !running || paused) return;
  nextAt = performance.now();
  timer = setTimeout(tick, 0);
}

function stopLoop() {
  if (timer !== null) clearTimeout(timer);
  timer = null;
}

async function hash(): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", host!.indices());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

self.onmessage = async (e: MessageEvent<EmuRequest>) => {
  const msg = e.data;
  try {
    switch (msg.type) {
      case "init": {
        try {
          const core = (await import(/* @vite-ignore */ msg.coreUrl)) as Js7800Core;
          host = new CoreHost(core);
          ctx = msg.canvas.getContext("2d");
          image = new ImageData(WIDTH, HEIGHT);
          post({ type: "ready" });
        } catch (err) {
          post({ type: "init-error", message: String(err) });
        }
        return;
      }
      case "audio":
        audioPort = msg.port;
        host?.core.Audio.setOutputRate(msg.sampleRate);
        host?.core.Sound.SetSampleRate(msg.sampleRate);
        return;
      case "load":
        stopLoop();
        await host!.load(msg.rom);
        running = true;
        render();
        startLoop();
        reply(msg.id);
        return;
      case "reset":
        await host?.reset();
        return;
      case "pause":
        paused = msg.paused;
        if (paused) stopLoop();
        else startLoop();
        return;
      case "input":
        host?.setInput(msg.state);
        return;
      case "step":
        host!.step(msg.frames);
        flushAudio();
        render();
        post({ type: "frame", frame: host!.frame });
        reply(msg.id, host!.frame);
        return;
      case "hash":
        reply(msg.id, await hash());
        return;
      case "memory": {
        const bytes = host!.readMemory(msg.address, msg.length);
        reply(msg.id, bytes, [bytes.buffer]);
        return;
      }
      case "clip-start":
        clip = { every: msg.every, max: msg.max, frames: [] };
        return;
      case "clip-stop": {
        const frames = clip?.frames ?? [];
        clip = null;
        reply(msg.id, { frames, palette: [...(host?.paletteRgb ?? [])] }, frames.map((f) => f.buffer));
        return;
      }
      case "pixels": {
        const all = host!.rgba();
        const out = new Uint8ClampedArray(msg.width * msg.height * 4);
        for (let y = 0; y < msg.height; y++) {
          const from = ((msg.y + y) * WIDTH + msg.x) * 4;
          out.set(all.subarray(from, from + msg.width * 4), y * msg.width * 4);
        }
        reply(msg.id, out, [out.buffer]);
        return;
      }
    }
  } catch (err) {
    if ("id" in msg) post({ type: "reply", id: msg.id, error: String(err) });
    else console.error(err);
  }
};
