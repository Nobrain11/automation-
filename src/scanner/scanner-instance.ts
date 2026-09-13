// src/scanner/scanner-instance.ts

import { PumpScanner } from "./scanner.js";
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
    if (decisionHandler) {
      await decisionHandler(telegramId, token);
    }
  }
});
