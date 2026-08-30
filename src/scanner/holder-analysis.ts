// holder-analysis.ts

import { Connection, PublicKey } from "@solana/web3.js";

import { logger } from "../utils/logger.js";

/*
 * Computes the percentage of total token supply held by the
 * top 10 holder accounts, excluding a given account (normally
 * the bonding curve's own associated token account, which
 * legitimately holds most of the supply pre-graduation and
 * isn't a real concentration risk).
 *
 * Returns null if supply/holder data can't be fetched — never
 * fabricates a percentage.
 */
export async function computeTop10Percent(
  connection: Connection,
  mint: string,
  excludeAccount: string | null
): Promise<number | null> {
  let supplyInfo;
  let largestAccounts;

  try {
    [supplyInfo, largestAccounts] = await Promise.all([
      connection.getTokenSupply(
        new PublicKey(mint),
        "confirmed"
      ),
      connection.getTokenLargestAccounts(
        new PublicKey(mint),
        "confirmed"
      )
    ]);
  } catch (error) {
    logger.warn(
      `Failed to fetch holder data for ${mint}`,
      error
    );

    return null;
  }

  const totalSupply = BigInt(
    supplyInfo.value.amount
  );

  if (totalSupply === 0n) {
    return null;
  }

  /*
   * getTokenLargestAccounts returns token *accounts*, not
   * owners, already sorted descending by balance. We exclude
   * the bonding curve's own token account (if provided), then
   * take the top 10 remaining accounts.
   */
  const holderAccounts = largestAccounts.value
    .filter(
      (acct) =>
        !excludeAccount ||
        acct.address.toBase58() !== excludeAccount
    )
    .slice(0, 10);

  if (holderAccounts.length === 0) {
    return null;
  }

  const top10Total = holderAccounts.reduce(
    (sum, acct) => sum + BigInt(acct.amount),
    0n
  );

  /*
   * Percentage math done in floating point at the end only,
   * after summing with BigInt precision, to avoid overflow
   * on large-supply tokens.
   */
  const percent =
    (Number(top10Total) / Number(totalSupply)) * 100;

  return percent;
}
