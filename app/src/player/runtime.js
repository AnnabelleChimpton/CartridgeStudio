// The offline player's runtime: plain JavaScript inlined into a one-file HTML
// page with the ROM and the js7800 core (src/player/player.ts). It runs the
// emulator on the page itself, so the file works when opened from a disk, a
// phone or a smart TV's browser, with no server. Mirrors CoreHost
// (src/emulator/core-host.ts) and the preview's input and audio.
/* global JS7800, GAME */
(function () {
  "use strict";
  var core = window.JS7800;
  var W = 320, H = 240, SURFACE_H = 300, NTSC_TOP = 2, PAL_TOP = 26;
  var RIGHT = 0, LEFT = 1, DOWN = 2, UP = 3, BUTTON1 = 4, LEFT_DIFF = 15, RIGHT_DIFF = 16;

  var canvas = document.getElementById("screen");
  var ctx = canvas.getContext("2d");
  var image = ctx.createImageData(W, H);
  var surface = new Array(W * SURFACE_H).fill(0);
  var input = new Array(19).fill(false);
  var palette = [], top = NTSC_TOP;
  var keys = { up: false, down: false, left: false, right: false, fire: false };
  var pad = { up: false, down: false, left: false, right: false, fire: false };

  function quietly(fn) {
    var log = console.log;
    console.log = function () {};
    try { return fn(); } finally { console.log = log; }
  }

  core.Events.fireEvent("init", { Region: core.Region, keyboardData: input, debug: false });
  core.Events.fireEvent("highScoreCallbackChanged", {
    getRom: function () { return null; },
    write: function () {},
    loadSram: function (done) { done(null); },
  });
  core.Maria.SetSurface(surface);

  var bin = atob(GAME.rom), rom = new Array(bin.length);
  for (var i = 0; i < bin.length; i++) rom[i] = bin.charCodeAt(i);
  if (!quietly(function () { return core.Cartridge.Load(rom, rom.length); })) {
    document.getElementById("start").textContent = "This game file is damaged.";
    return;
  }
  quietly(function () { core.Database.Load(core.Cartridge.GetDigest()); });
  var pal = core.Cartridge.GetRegion() === core.Region.REGION_PAL;
  palette = pal ? core.Region.getPalPalette() : core.Region.getNtscPalette();
  top = pal ? PAL_TOP : NTSC_TOP;

  function render() {
    var d = image.data, start = top * W;
    for (var i = 0, o = 0; i < W * H; i++, o += 4) {
      var c = surface[start + i] * 3;
      d[o] = palette[c]; d[o + 1] = palette[c + 1]; d[o + 2] = palette[c + 2]; d[o + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  }

  // ---- Sound: a ring buffer drained by a ScriptProcessor (works everywhere, no extra files). ----
  var audio = null, ring = new Float32Array(1 << 15), rd = 0, wr = 0;
  function startAudio() {
    if (audio) { if (audio.state === "suspended") audio.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audio = new AC();
    core.Audio.setOutputRate(audio.sampleRate);
    core.Sound.SetSampleRate(audio.sampleRate);
    var node = audio.createScriptProcessor(2048, 0, 1);
    node.onaudioprocess = function (e) {
      var out = e.outputBuffer.getChannelData(0);
      for (var i = 0; i < out.length; i++) {
        if (rd === wr) out[i] = 0;
        else { out[i] = ring[rd]; rd = (rd + 1) % ring.length; }
      }
    };
    node.connect(audio.destination);
  }
  function pushAudio() {
    var s = core.Audio.takeSamples();
    for (var i = 0; i < s.length; i++) {
      ring[wr] = s[i]; wr = (wr + 1) % ring.length;
      if (wr === rd) rd = (rd + 1) % ring.length;
    }
    var max = audio ? Math.floor(0.15 * audio.sampleRate) : 0;
    var buffered = (wr - rd + ring.length) % ring.length;
    if (max && buffered > max) rd = (wr - max + ring.length) % ring.length;
  }

  // ---- Input: the whole page is the game, so keys work anywhere on it. ----
  var MAP = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", " ": "fire", z: "fire", Z: "fire" };
  function onKey(down) {
    return function (e) {
      var k = MAP[e.key];
      if (!k || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      keys[k] = down;
      begin();
    };
  }
  window.addEventListener("keydown", onKey(true));
  window.addEventListener("keyup", onKey(false));
  window.addEventListener("blur", function () { keys = { up: false, down: false, left: false, right: false, fire: false }; });
  function pollPad() {
    var pads = navigator.getGamepads ? navigator.getGamepads() : [];
    var p = null;
    for (var i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) { p = pads[i]; break; }
    if (!p) return;
    var b = function (i) { return !!(p.buttons[i] && p.buttons[i].pressed); };
    var ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    pad = { up: b(12) || ay < -0.5, down: b(13) || ay > 0.5, left: b(14) || ax < -0.5, right: b(15) || ax > 0.5, fire: b(0) || b(1) || b(2) || b(3) };
    if (pad.fire) begin();
  }

  // ---- Running: start on the first key, click, tap or button (browsers need a gesture for sound). ----
  var started = false, nextAt = 0, frames = 0;
  function begin() {
    startAudio();
    if (started) return;
    started = true;
    document.body.classList.add("playing");
    quietly(function () {
      input[LEFT_DIFF] = !!core.Cartridge.GetLeftSwitch();
      input[RIGHT_DIFF] = !!core.Cartridge.GetRightSwitch();
      core.ProSystem.Reset(function () { nextAt = performance.now(); tick(); });
    });
  }
  function tick() {
    pollPad();
    input[UP] = keys.up || pad.up; input[DOWN] = keys.down || pad.down;
    input[LEFT] = keys.left || pad.left; input[RIGHT] = keys.right || pad.right;
    input[BUTTON1] = keys.fire || pad.fire;
    var now = performance.now();
    if (now - nextAt > 250) nextAt = now; // hidden tab: don't fast-forward
    core.ProSystem.ExecuteFrame(input);
    core.Sound.Store();
    frames++;
    window.__frames = frames;
    pushAudio();
    render();
    nextAt += 1000 / core.ProSystem.GetFrequency();
    setTimeout(tick, Math.max(0, nextAt - performance.now()));
  }
  document.getElementById("start").addEventListener("click", begin);
  canvas.addEventListener("click", begin);
  document.getElementById("fullscreen").addEventListener("click", function () {
    var el = document.getElementById("stage");
    (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    begin();
  });
  // Show the title screen right away, before anyone presses anything.
  quietly(function () { core.ProSystem.Reset(function () { core.ProSystem.ExecuteFrame(input); render(); }); });
  setInterval(function () { if (!started) { pollPad(); } }, 100);
})();
