// src/scanner/scanner-instance.ts

import { PumpScanner } from "./scanner.js";
import { httpDiscovery } from "./http-discovery.js";
import { notifyScannerToken } from "./notifier.js";
import { TokenCandidate } from "./types.js";

export type DecisionHandler = (
  telegramId: number,
  token: TokenCandidate
) => Promise<void>;

let decisionHandler: DecisionHandler | null = null;

export function setDecisionHandler(
  handler: DecisionHandler
): void {
  decisionHandler = handler;
}

export const scanner = new PumpScanner({
  onToken: async (telegramId, token) => {
    await notifyScannerToken(token);
    if (decisionHandler) {
      await decisionHandler(telegramId, token);
    }
  }
});

export { httpDiscovery };

export function isDiscoveryRunning(): boolean {
  return scanner.getStats().running || httpDiscovery.getStats().running;
}

export async function startAllDiscovery(): Promise<void> {
  await scanner.start();
  httpDiscovery.start();
}

export async function stopAllDiscovery(): Promise<void> {
  httpDiscovery.stop();
  await scanner.stop();
}
