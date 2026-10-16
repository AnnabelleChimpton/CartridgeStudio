// Which build of Cartridge Studio made a file: package.json's version and the
// git commit, set by vite.config.ts.

declare const __APP_VERSION__: string;

export const APP_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";
