// The offline player's runtime: plain JavaScript inlined into a one-file HTML
// page with the ROM and the js7800 core (src/player/player.ts). It runs the
// emulator on the page itself, so the file works when opened from a disk, a
// phone or a smart TV's browser, with no server. Mirrors CoreHost
// (src/emulator/core-host.ts) and the preview's input and audio.
/* global JS7800, GAME */
(function () {
  "use strict";
  // Scripts run here, so the "this preview can't play it" note can go.
  document.documentElement.className = "js";
  var core = window.JS7800;
  var W = 320, H = 240, SURFACE_H = 300, NTSC_TOP = 2, PAL_TOP = 26;
  var RIGHT = 0, LEFT = 1, DOWN = 2, UP = 3, BUTTON1 = 4, PAUSE = 14, LEFT_DIFF = 15, RIGHT_DIFF = 16;
  /** Frames the Pause switch is held for each press, so the game sees it however short the tap. */
  var PAUSE_FRAMES = 6;
  var HOLD_TO_LEAVE_MS = 1000;
  var PREROLL_MS = 2600;

  var $ = function (id) { return document.getElementById(id); };
  var canvas = $("screen"), stage = $("stage"), startButton = $("start");
  var ctx = canvas.getContext("2d");
  var image = ctx.createImageData(W, H);
  var surface = new Array(W * SURFACE_H).fill(0);
  var input = new Array(19).fill(false);
  var palette = [], top = NTSC_TOP;
  var IDLE = function () { return { up: false, down: false, left: false, right: false, fire: false }; };
  var keys = IDLE(), pad = IDLE(), touch = IDLE();
  window.__input = input;

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
    startButton.textContent = "This game file is damaged.";
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

  // ---- The box front: the title and the game's own sprites, for a moment while it starts. ----
  var box = $("box"), skip = $("skip"), boxUp = false;
  function rgb(hex) {
    var c = parseInt(hex.slice(1), 16) * 3;
    return "rgb(" + palette[c] + "," + palette[c + 1] + "," + palette[c + 2] + ")";
  }
  function drawBox(art) {
    var g = box.querySelector("canvas").getContext("2d");
    var hero = art.sprites[0];
    box.style.setProperty("--box-bg", rgb(art.background));
    box.style.setProperty("--c1", rgb(hero.colors[0]));
    box.style.setProperty("--c2", rgb(hero.colors[1]));
    // Where each sprite goes (as a share of the box) and how big, the hero biggest.
    var spots = [[0.5, 0.56, 1], [0.15, 0.8, 0.5], [0.85, 0.8, 0.5], [0.15, 0.42, 0.4]];
    art.sprites.forEach(function (s, n) {
      var w = s.rows[0].length, h = s.rows.length, spot = spots[n];
      // 160A pixels are twice as wide as they are tall.
      var scale = Math.max(2, Math.floor(Math.min(96 / h, 128 / (2 * w)) * spot[2]));
      var x0 = Math.round(W * spot[0] - w * scale), y0 = Math.round(H * spot[1] - (h * scale) / 2);
      for (var y = 0; y < h; y++)
        for (var x = 0; x < w; x++) {
          var v = s.rows[y].charCodeAt(x) - 48;
          if (v < 1 || v > 3) continue;
          g.fillStyle = rgb(s.colors[v - 1]);
          g.fillRect(x0 + x * 2 * scale, y0 + y * scale, 2 * scale, scale);
        }
    });
  }
  function endBox() {
    if (!boxUp) return;
    boxUp = false;
    box.className = "gone";
    skip.className = "plain gone";
    if (document.activeElement === skip) startButton.focus();
  }
  if (GAME.art && GAME.art.sprites && GAME.art.sprites.length) {
    try {
      drawBox(GAME.art);
      boxUp = true;
      setTimeout(endBox, PREROLL_MS);
    } catch (e) { boxUp = true; endBox(); }
  } else {
    boxUp = true;
    endBox();
  }
  skip.addEventListener("click", endBox);

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

  // ---- Console switches: Pause (the game freezes itself) and a restart from the title. ----
  var paused = false, pauseHold = 0;
  var pauseButton = $("pause"), pausedNote = $("paused");
  function showPaused() {
    pauseButton.textContent = paused ? "Resume" : "Pause";
    pausedNote.hidden = !paused;
    document.body.classList.toggle("paused", paused);
    window.__paused = paused;
  }
  function pressPause() {
    if (!started) return;
    pauseHold = PAUSE_FRAMES;
    paused = !paused;
    showPaused();
  }
  function restart() {
    if (!started) { begin(); return; }
    paused = false;
    pauseHold = 0;
    showPaused();
    quietly(function () {
      input[LEFT_DIFF] = !!core.Cartridge.GetLeftSwitch();
      input[RIGHT_DIFF] = !!core.Cartridge.GetRightSwitch();
      core.ProSystem.Reset(function () {});
    });
  }
  pauseButton.addEventListener("click", pressPause);
  $("restart").addEventListener("click", function () { restart(); playHere(); });

  // ---- Keyboard: the game's keys, except while a button or link has focus (Space and Enter are theirs). ----
  var MAP = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", " ": "fire", z: "fire", Z: "fire" };
  function onControl(t) { return !!(t && t.closest && t.closest("button, a, summary, input, select, textarea, [contenteditable]")); }
  window.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || onControl(e.target)) return;
    if (e.key === "p" || e.key === "P") { if (!e.repeat) pressPause(); return; }
    var k = MAP[e.key];
    if (!k) return;
    e.preventDefault();
    keys[k] = true;
    begin();
  });
  window.addEventListener("keyup", function (e) {
    var k = MAP[e.key];
    if (k) keys[k] = false;
  });
  window.addEventListener("blur", function () { keys = IDLE(); });

  // ---- Gamepad: stick or d-pad, any face button fires; Start pauses, Select plays again, hold Select to leave full screen. ----
  var was = [], selectDown = 0, selectUsed = false;
  function pollPad() {
    var pads = navigator.getGamepads ? navigator.getGamepads() : [];
    var p = null;
    for (var i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) { p = pads[i]; break; }
    if (!p) return;
    var b = function (i) { return !!(p.buttons[i] && p.buttons[i].pressed); };
    // Note the buttons first: begin() runs a frame, which polls again.
    var before = was;
    was = [];
    for (var j = 0; j < p.buttons.length; j++) was[j] = b(j);
    var pressed = function (i) { return b(i) && !before[i]; };
    var ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    pad = { up: b(12) || ay < -0.5, down: b(13) || ay > 0.5, left: b(14) || ax < -0.5, right: b(15) || ax > 0.5, fire: b(0) || b(1) || b(2) || b(3) };
    var now = performance.now();
    if (pressed(8)) { selectDown = now; selectUsed = false; }
    if (b(8) && !selectUsed && now - selectDown >= HOLD_TO_LEAVE_MS) { selectUsed = true; leaveFullscreen(); }
    var released8 = !b(8) && before[8] && !selectUsed;
    if (pad.fire) begin();
    if (pressed(9)) { if (started) pressPause(); else begin(); }
    if (released8) restart();
  }

  // ---- Touch: a pad and a fire button, several fingers at once. ----
  var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  function useTouch() {
    if (document.body.classList.contains("touch")) return;
    document.body.classList.add("touch");
    var line = $("controls");
    line.textContent = line.getAttribute("data-touch");
    startButton.textContent = "Tap to play";
  }
  if (coarse) useTouch();
  window.addEventListener("touchstart", useTouch, { passive: true });
  var dpad = $("dpad"), fire = $("fire");
  var lrOnly = !!dpad && dpad.className.indexOf("lr") >= 0;
  var fingers = {};
  function direction(x, y) {
    var r = dpad.getBoundingClientRect();
    var dx = (x - (r.left + r.width / 2)) / (r.width / 2), dy = (y - (r.top + r.height / 2)) / (r.height / 2);
    if (lrOnly) return { left: dx < -0.1, right: dx > 0.1, up: false, down: false };
    // Eight ways, with a small dead zone in the middle; diagonals cover 45 degrees each.
    var dead = 0.25, ax = Math.abs(dx), ay = Math.abs(dy);
    var h = ax > dead && ax >= ay * 0.4142, v = ay > dead && ay >= ax * 0.4142;
    return { left: h && dx < 0, right: h && dx > 0, up: v && dy < 0, down: v && dy > 0 };
  }
  function updateTouch() {
    var t = IDLE();
    for (var id in fingers) {
      var f = fingers[id];
      if (f.fire) { t.fire = true; continue; }
      var d = direction(f.x, f.y);
      t.up = t.up || d.up; t.down = t.down || d.down; t.left = t.left || d.left; t.right = t.right || d.right;
    }
    touch = t;
    if (dpad) {
      var arrows = dpad.children;
      for (var i = 0; i < arrows.length; i++) {
        var dir = arrows[i].className.replace(/arrow| on/g, "").trim();
        arrows[i].className = "arrow " + dir + (t[dir] ? " on" : "");
      }
    }
    fire.className = t.fire ? "on" : "";
  }
  function onTouch(e) {
    e.preventDefault(); // no scrolling, zooming, text selection or pretend mouse clicks
    var isFire = e.currentTarget === fire;
    for (var i = 0; i < e.changedTouches.length; i++) {
      var c = e.changedTouches[i];
      if (e.type === "touchstart") fingers[c.identifier] = { fire: isFire, x: c.clientX, y: c.clientY };
      else if (e.type === "touchmove") { if (fingers[c.identifier]) { fingers[c.identifier].x = c.clientX; fingers[c.identifier].y = c.clientY; } }
      else delete fingers[c.identifier];
    }
    updateTouch();
    if (e.type === "touchstart" && isFire) { endBox(); begin(); }
    // iOS only lets sound start when a finger lifts.
    if (e.type === "touchend") startAudio();
  }
  [dpad, fire].forEach(function (el) {
    if (!el) return;
    ["touchstart", "touchmove", "touchend", "touchcancel"].forEach(function (type) { el.addEventListener(type, onTouch, { passive: false }); });
    el.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  });
  // The screen itself: no double-tap zoom or long-press menu while playing.
  stage.addEventListener("contextmenu", function (e) { if (started) e.preventDefault(); });

  // ---- Full screen: the screen alone, or with the touch controls on a phone or tablet. ----
  var fsButton = $("fullscreen");
  var root = document.documentElement;
  var canFullscreen = !!(stage.requestFullscreen || stage.webkitRequestFullscreen);
  if (!canFullscreen) fsButton.hidden = true; // iPhones only do full screen for videos
  function leaveFullscreen() {
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
  }
  fsButton.addEventListener("click", function () {
    var el = document.body.classList.contains("touch") ? root : stage;
    var req = el.requestFullscreen || el.webkitRequestFullscreen;
    var r = req.call(el);
    if (r && r.catch) r.catch(function () {});
    begin();
  });

  // ---- Running: start on the first key, click, tap or button (browsers need a gesture for sound). ----
  var started = false, nextAt = 0, frames = 0;
  /** Hands the keyboard to the game (unless someone is on a button). */
  function playHere() {
    var a = document.activeElement;
    if (!a || a === document.body || a === startButton || a === skip || a === fsButton || a.id === "restart") canvas.focus({ preventScroll: true });
  }
  function begin() {
    startAudio();
    endBox();
    if (started) return;
    started = true;
    document.body.classList.add("playing");
    playHere();
    quietly(function () {
      input[LEFT_DIFF] = !!core.Cartridge.GetLeftSwitch();
      input[RIGHT_DIFF] = !!core.Cartridge.GetRightSwitch();
      core.ProSystem.Reset(function () { nextAt = performance.now(); tick(); });
    });
  }
  function tick() {
    pollPad();
    input[UP] = keys.up || pad.up || touch.up; input[DOWN] = keys.down || pad.down || touch.down;
    input[LEFT] = keys.left || pad.left || touch.left; input[RIGHT] = keys.right || pad.right || touch.right;
    input[BUTTON1] = keys.fire || pad.fire || touch.fire;
    input[PAUSE] = pauseHold > 0;
    if (pauseHold > 0) pauseHold--;
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
  startButton.addEventListener("click", begin);
  canvas.addEventListener("click", begin);
  box.addEventListener("click", begin);
  // Show the title screen right away, before anyone presses anything: a second of play, silently,
  // is long enough for a game to draw it.
  quietly(function () {
    core.ProSystem.Reset(function () {
      for (var f = 0; f < 60; f++) { core.ProSystem.ExecuteFrame(input); core.Sound.Store(); core.Audio.takeSamples(); }
      render();
    });
  });
  setInterval(function () {
    if (started) return;
    pollPad();
    for (var i = 0; i < was.length; i++) if (was[i]) endBox();
  }, 100);
})();
