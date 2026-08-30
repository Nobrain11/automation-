// src/scanner/scanner-instance.ts — NEW FILE

import { PumpScanner } from "./scanner.js";

/*
 * Single shared scanner instance. index.ts starts/stops it;
 * the bot imports this same instance to read live stats
 * (e.g. for the /start home screen) without creating a
 * second, disconnected scanner.
 */
export const scanner = new PumpScanner();
