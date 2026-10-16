-- MAME autoboot script for one template behaviour test. mame.ts prepends a
-- preamble that defines:
--   STEPS        the test's steps, with an `id` on every expect and until step
--   WATCH        name -> { address, bytes, bcd } for every watched variable
--   OUT          path of the file to write results to, one JSON object per line
--   BOOT_FRAMES  how long to wait for the cartridge to take over from the BIOS
--
-- Frames are counted from the end of the first frame in which the cartridge
-- runs (the BIOS writes INPTCTRL with "lock" and "BIOS off" set), so frame 0
-- lines up with js7800, which starts the cartridge at reset.
--
-- `until` conditions are evaluated here because they decide how many frames
-- run. Every `expect` and `until` timeout reports raw bytes, and mame.ts
-- decodes and checks them.

local machine = manager.machine
local mem = machine.devices[":maincpu"].spaces["program"]
local out = assert(io.open(OUT, "w"))

local function emit(line)
  out:write(line, "\n")
  out:flush()
end

local function quote(s)
  return '"' .. tostring(s):gsub('[%c"\\]', function(c) return string.format("\\u%04x", c:byte()) end) .. '"'
end

local function fail(message)
  emit('{"type":"error","message":' .. quote(message) .. '}')
  out:close()
  machine:exit()
end

-- Joystick fields, found by name so a MAME port rename fails loudly.
local fields = {}
for _, port in pairs(machine.ioport.ports) do
  for name, field in pairs(port.fields) do fields[name] = field end
end
local CONTROLS = {
  up = "P1 Up", down = "P1 Down", left = "P1 Left", right = "P1 Right", fire = "P1 Button 1",
}
for control, name in pairs(CONTROLS) do
  if not fields[name] then
    local known = {}
    for n in pairs(fields) do known[#known + 1] = n end
    table.sort(known)
    fail("No input field \"" .. name .. "\" for " .. control .. ". Fields: " .. table.concat(known, ", "))
    return
  end
end

local function set_input(held)
  for control, name in pairs(CONTROLS) do
    fields[name]:set_value(held[control] and 1 or 0)
  end
end

local function bytes(w)
  local b = {}
  for i = 0, w.bytes - 1 do b[#b + 1] = mem:read_u8(w.address + i) end
  return b
end

-- Same decoding as app/src/harness/behaviour.ts.
local function value(w)
  local b = bytes(w)
  local n = 0
  if w.bcd then
    for _, x in ipairs(b) do
      local hi, lo = x >> 4, x & 15
      if hi > 9 or lo > 9 then return 0 / 0 end
      n = n * 100 + hi * 10 + lo
    end
  else
    for i, x in ipairs(b) do n = n + (x << (8 * (i - 1))) end
  end
  return n
end

local function holds(cond)
  for name, c in pairs(cond) do
    local v = value(WATCH[name])
    if type(c) == "number" then c = { eq = c } end
    if (c.eq ~= nil and v ~= c.eq) or (c.ne ~= nil and v == c.ne)
      or (c.gt ~= nil and not (v > c.gt)) or (c.gte ~= nil and not (v >= c.gte))
      or (c.lt ~= nil and not (v < c.lt)) or (c.lte ~= nil and not (v <= c.lte))
      or (c.multipleOf ~= nil and v % c.multipleOf ~= 0) then
      return false
    end
  end
  return true
end

local frame = 0

local function report(kind, id, cond)
  local parts = {}
  for name in pairs(cond) do
    parts[#parts + 1] = quote(name) .. ":[" .. table.concat(bytes(WATCH[name]), ",") .. "]"
  end
  emit('{"type":"' .. kind .. '","id":' .. id .. ',"frame":' .. frame ..
    ',"bytes":{' .. table.concat(parts, ",") .. "}}")
end

local Stop = {}

local function exec(steps)
  for _, step in ipairs(steps) do
    if step.expect then
      report("expect", step.id, step.expect)
      if not holds(step.expect) then error(Stop) end
    elseif step["repeat"] then
      for _ = 1, step["repeat"] do exec(step.steps) end
    elseif step["until"] then
      local start = frame
      while not holds(step["until"]) do
        if frame - start >= step.maxFrames then
          report("timeout", step.id, step["until"])
          error(Stop)
        end
        local before = frame
        exec(step.steps)
        if frame == before then error("An `until` step must advance frames") end
      end
    else
      local held = {}
      for _, c in ipairs(step.hold or {}) do held[c] = true end
      set_input(held)
      for _ = 1, step.frames do coroutine.yield() end
      set_input({})
    end
  end
end

local runner = coroutine.create(function()
  local ok, err = pcall(exec, STEPS)
  if not ok and err ~= Stop then
    emit('{"type":"error","message":' .. quote(err) .. '}')
  end
  emit('{"type":"done","frame":' .. frame .. '}')
end)

-- Wait for the cartridge: the first INPTCTRL write ($01, before the lock)
-- with lock and BIOS-off set. After the lock $01 is TIA's VBLANK, so the tap
-- comes off at the next frame.
local cart_running = false
local boot_frames = 0
local tap = mem:install_write_tap(0x0001, 0x0001, "inptctrl", function(offset, data, mask)
  if (data & 5) == 5 then cart_running = true end
  return data
end)

-- A global: MAME unsubscribes when the subscription is garbage collected.
FRAME_SUBSCRIPTION = emu.add_machine_frame_notifier(function()
  if coroutine.status(runner) == "dead" then return end
  if not cart_running then
    boot_frames = boot_frames + 1
    if boot_frames > BOOT_FRAMES then
      fail("The cartridge never started: the BIOS did not hand over within " .. BOOT_FRAMES ..
        " frames (is the ROM signed?)")
    end
    return
  end
  if tap then
    tap:remove()
    tap = nil
    emit('{"type":"boot","frames":' .. boot_frames .. '}')
    set_input({})
  else
    frame = frame + 1
  end
  local ok, err = coroutine.resume(runner)
  if not ok then emit('{"type":"error","message":' .. quote(err) .. '}') end
  if coroutine.status(runner) == "dead" then
    out:close()
    machine:exit()
  end
end)
