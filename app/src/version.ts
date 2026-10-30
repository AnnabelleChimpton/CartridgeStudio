import pkg from "../package.json";

declare const __APP_VERSION__: string;

export const APP_VERSION: string = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : pkg.version;
