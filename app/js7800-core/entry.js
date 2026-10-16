// Entry point of the worker build of the js7800 emulation core
// (public/vendor/js7800-core/js7800-core.js, built by scripts/build-js7800.mjs).
//
// It re-exports js7800's ProSystem core modules, built from unmodified upstream
// source, with two worker-safe I/O stand-ins: the two modules that touch the
// page (web/audio.js, web/mouse.js) are swapped for the ones in this folder at
// bundle time. Like ProSystem, this file is GPL v2 or later.

import * as ProSystem from "@js7800/prosystem/ProSystem.js";
import * as Cartridge from "@js7800/prosystem/Cartridge.js";
import * as Database from "@js7800/prosystem/Database.js";
import * as Maria from "@js7800/prosystem/Maria.js";
import * as Memory from "@js7800/prosystem/Memory.js";
import * as Region from "@js7800/prosystem/Region.js";
import * as Sound from "@js7800/prosystem/Sound.js";
import * as Events from "@js7800/events.js";
import * as Audio from "./audio-stub.js";

export { ProSystem, Cartridge, Database, Maria, Memory, Region, Sound, Events, Audio };
