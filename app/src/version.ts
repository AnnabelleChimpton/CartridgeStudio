// The app's version, written into saved .cartridge files so a file says what made it.

import pkg from "../package.json";

export const APP_VERSION: string = pkg.version;
