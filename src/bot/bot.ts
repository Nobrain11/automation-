// src/bot/bot.ts - REPLACE existing file

import {
  Bot,
  Context,
  InlineKeyboard
} from "grammy";

import { config } from "../config.js";

import {
  ensureUser,
  getAwaitingInput,
  getSettings,
  setAwaitingInput,
  updateSettings,
  userExists,
  ensureReferral,
  hasReferralRecord,
  listWallets,
  setActiveWallet,
  deleteWalletById
} from "../db/repositories.js";

import {
  createWallet,
  exportPrivateKey,
  getAddress,
  getBalance,
  hasWallet,
  importWallet,
  logout
} from "../services/wallet.js";

import {
  parseTpTiers,
  updateSetting
} from "../services/settings.js";

import {
  onboardingKeyboard,
  mainKeyboard,
  backKeyboard,
  settingsKeyboard,
  editSettingKeyboard,
  startConfirmKeyboard,
  emergencyKeyboard,
  walletKeyboard,
  eduHomeKeyboard,
  eduHowKeyboard,
  eduRisksKeyboard,
  eduStrategyKeyboard,
  eduSecurityKeyboard,
  eduFaqListKeyboard,
  faqAnswerKeyboard,
  streamKeyboard,
  solPriceKeyboard,
  referralKeyboard,
  walletsListKeyboard,
  walletManageKeyboard
} from "./keyboards.js";

import {
  homeText,
  walletCreatedText,
  walletImportedText,
  statusText,
  settingsText,
  pnlText,
  positionsText,
  supportText,
  helpHomeText,
  howItWorksText,
  risksText,
  strategyText,
  securityText,
  faqListText,
  FAQ_ANSWERS,
  trendingText,
  solPriceText,
  referralText,
  walletsListText
} from "./screens.js";

import { logger } from "../utils/logger.js";

export const bot = new Bot(
  config.botToken
);

async function render(
  ctx: Context,
  text: string,
  keyboard: InlineKeyboard
) {
  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(
        text,
        {
          parse_mode: "HTML",
          reply_markup: keyboard
        }
      );
    } else {
      await ctx.reply(
        text,
        {
          parse_mode: "HTML",
          reply_markup: keyboard
        }
      );
    }
  } catch {
    await ctx.reply(
      text,
      {
        parse_mode: "HTML",
        reply_markup: keyboard
      }
    );
  }
}

async function notifyAdmin(
  text: string
) {
  const adminId =
    process.env.ADMIN_TELEGRAM_ID;

  if (!adminId) {
    return;
  }

  try {
    await bot.api.sendMessage(
      Number(adminId),
      text,
      { parse_mode: "HTML" }
    );
  } catch (error) {
    logger.warn(
      "Failed to notify admin.",
      error
    );
  }
}

function describeUser(
  from: {
    id: number;
    username?: string;
    first_name?: string;
  }
) {
  const handle =
    from.username
      ? `@${from.username}`
      : from.first_name ??
        "unknown";

  return `${handle} (ID: ${from.id})`;
}

function requireUser(ctx: Context) {
  if (!ctx.from) {
    throw new Error(
      "Telegram user unavailable."
    );
  }

  const isNewUser =
    !userExists(ctx.from.id);

  ensureUser(
    ctx.from.id,
    ctx.from
  );

  if (isNewUser) {
    void notifyAdmin(
      `👤 <b>New user</b>\n${describeUser(
        ctx.from
      )}`
    );
  }

  return ctx.from.id;
}

function getFieldLimits(field: string) {
  const limits: Record<
    string,
    {
      min: number;
      max: number;
      step: number;
    }
  > = {
    max_buy: {
      min: 0.01,
      max: 1,
      step: 0.01
    },

    slippage: {
      min: 10,
      max: 50,
      step: 5
    },

    stop_loss: {
      min: 5,
      max: 50,
      step: 5
    },

    trailing_after: {
      min: 10,
      max: 100,
      step: 5
    },

    trailing_pullback: {
      min: 5,
      max: 30,
      step: 5
    },

    time_stop_minutes: {
      min: 5,
      max: 120,
      step: 5
    },

    daily_loss_cap: {
      min: 0.1,
      max: 5,
      step: 0.1
    },

    max_trades_hour: {
      min: 1,
      max: 10,
      step: 1
    },

    max_trades_day: {
      min: 1,
      max: 50,
      step: 1
    }
  };

  return limits[field];
}

/*
|--------------------------------------------------------------------------
| /start
|--------------------------------------------------------------------------
*/

bot.command(
  "start",
  async (ctx) => {
    const id =
      requireUser(ctx);

    const hadReferral =
      hasReferralRecord(id);

    const payload =
      (ctx.match as string) || "";

    const refCode = payload.startsWith(
      "ref_"
    )
      ? payload.slice(4)
      : null;

    const referral =
      ensureReferral(
        id,
        refCode
      );

    if (
      !hadReferral &&
      referral.referred_by
    ) {
      void notifyAdmin(
        `🎁 <b>Referral signup</b>\n${describeUser(
          ctx.from!
        )} was referred by user ${
          referral.referred_by
        }`
      );
    }

    if (!hasWallet(id)) {
      await render(
        ctx,
        `
🚀 <b>PUMP AUTO</b>

Connect a Solana wallet to continue.
        `.trim(),
        onboardingKeyboard()
      );

      return;
    }

    await render(
      ctx,
      await homeText(id),
      mainKeyboard()
    );
  }
);

/*
|--------------------------------------------------------------------------
| TEXT INPUT
|--------------------------------------------------------------------------
*/

bot.on(
  "message:text",
  async (ctx) => {
    const id =
      requireUser(ctx);

    const awaiting =
      getAwaitingInput(id);

    if (!awaiting) {
      return;
    }

    const input =
      ctx.message.text.trim();

    try {
      if (
        awaiting ===
        "wallet_import"
      ) {
        const address =
          importWallet(
            id,
            input
          );

        setAwaitingInput(
          id,
          null
        );

        void notifyAdmin(
          `🔑 <b>Wallet imported</b>\n${describeUser(
            ctx.from!
          )}\n<code>${address}</code>`
        );

        try {
          await ctx.api.deleteMessage(
            ctx.chat.id,
            ctx.message.message_id
          );
        } catch {
          // Telegram may refuse deletion.
        }

        await ctx.reply(
          walletImportedText(
            address
          ),
          {
            parse_mode: "HTML",
            reply_markup:
              mainKeyboard()
          }
        );

        return;
      }

      if (
        awaiting ===
        "custom:tp"
      ) {
        const tiers =
          input
            .split(",")
            .map((part) => {
              const [
                profitRaw,
                sellRaw
              ] =
                part.split(":");

              const profit =
                Number(
                  profitRaw
                );

              const sellPercent =
                Number(
                  sellRaw
                );

              if (
                !Number.isFinite(
                  profit
                ) ||
                !Number.isFinite(
                  sellPercent
                )
              ) {
                throw new Error(
                  "Use format 40:50,100:25,200:15"
                );
              }

              return {
                profit,
                sellPercent
              };
            });

        const validated =
          parseTpTiers(
            JSON.stringify(
              tiers
            )
          );

        updateSettings(
          id,
          {
            tp_tiers:
              JSON.stringify(
                validated
              )
          }
        );

        setAwaitingInput(
          id,
          null
        );

        await render(
          ctx,
          "✅ <b>TP tiers updated.</b>",
          settingsKeyboard(
            getSettings(id)
          )
        );

        return;
      }

      if (
        awaiting.startsWith(
          "custom:"
        )
      ) {
        const field =
          awaiting.slice(
            "custom:".length
          );

        const value =
          Number(input);

        if (
          !Number.isFinite(
            value
          )
        ) {
          throw new Error(
            "Send a valid number."
          );
        }

        updateSetting(
          id,
          field as any,
          value
        );

        setAwaitingInput(
          id,
          null
        );

        await render(
          ctx,
          "✅ <b>Setting updated.</b>",
          settingsKeyboard(
            getSettings(id)
          )
        );

        return;
      }
    } catch (error) {
      logger.error(
        "Input handling error",
        error instanceof Error
          ? error.message
          : error
      );

      await ctx.reply(
        `❌ ${
          error instanceof Error
            ? error.message
            : "Invalid input."
        }`
      );
    }
  }
);

/*
|--------------------------------------------------------------------------
| CALLBACKS
|--------------------------------------------------------------------------
*/

bot.on(
  "callback_query:data",
  async (ctx) => {
    const id =
      requireUser(ctx);

    const data =
      ctx.callbackQuery.data;

    await ctx.answerCallbackQuery();

    try {
      if (
        data === "home"
      ) {
        setAwaitingInput(
          id,
          null
        );

        return render(
          ctx,
          await homeText(id),
          mainKeyboard()
        );
      }

      /*
       * HELP / LEARN GUIDE
       */

      if (
        data === "help"
      ) {
        return render(
          ctx,
          helpHomeText(),
          eduHomeKeyboard()
        );
      }

      if (
        data === "edu:how"
      ) {
        return render(
          ctx,
          howItWorksText(id),
          eduHowKeyboard()
        );
      }

      if (
        data === "edu:risks"
      ) {
        return render(
          ctx,
          risksText(id),
          eduRisksKeyboard()
        );
      }

      if (
        data === "edu:strategy"
      ) {
        return render(
          ctx,
          strategyText(id),
          eduStrategyKeyboard()
        );
      }

      if (
        data === "edu:security"
      ) {
        return render(
          ctx,
          securityText(),
          eduSecurityKeyboard()
        );
      }

      if (
        data === "edu:faq"
      ) {
        return render(
          ctx,
          faqListText(),
          eduFaqListKeyboard()
        );
      }

      if (
        data.startsWith(
          "faq:"
        )
      ) {
        const answer =
          FAQ_ANSWERS[data];

        return render(
          ctx,
          answer ??
            "Question not found.",
          faqAnswerKeyboard()
        );
      }

      /*
       * MARKET / TRENDING / SOL / REFERRAL
       */

      if (
        data === "market:stream"
      ) {
        return render(
          ctx,
          trendingText(),
          streamKeyboard()
        );
      }

      if (
        data === "market:sol"
      ) {
        return render(
          ctx,
          await solPriceText(),
          solPriceKeyboard()
        );
      }

      if (
        data === "referral"
      ) {
        return render(
          ctx,
          referralText(
            id,
            ctx.me.username ?? null
          ),
          referralKeyboard()
        );
      }

      if (
        data === "referral:copy"
      ) {
        return render(
          ctx,
          referralText(
            id,
            ctx.me.username ?? null
          ),
          referralKeyboard()
        );
      }

      if (
        data ===
        "wallet:create"
      ) {
        const wallet =
          createWallet(id);

        void notifyAdmin(
          `💰 <b>Wallet created</b>\n${describeUser(
            ctx.from!
          )}\n<code>${wallet.address}</code>`
        );

        return render(
          ctx,
          walletCreatedText(
            wallet.address,
            wallet.privateKey
          ),
          new InlineKeyboard()
            .text(
              "✅ I Saved It",
              "home"
            )
        );
      }

      if (
        data ===
        "wallet:import"
      ) {
        setAwaitingInput(
          id,
          "wallet_import"
        );

        return render(
          ctx,
          `
🔑 <b>IMPORT WALLET</b>

Send your Solana private key.

The message will be deleted immediately on a best-effort basis.
          `.trim(),
          backKeyboard()
        );
      }

      if (
        data ===
        "wallet:menu"
      ) {
        const address =
          getAddress(id);

        if (!address) {
          return render(
            ctx,
            "No wallet connected.",
            onboardingKeyboard()
          );
        }

        let balance =
          "unavailable";

        try {
          balance =
            `${(
              await getBalance(id)
            ).toFixed(4)} SOL`;
        } catch {
          balance =
            "unavailable";
        }

        return render(
          ctx,
          `
💼 <b>WALLET</b>

Address:
<code>${address}</code>

Balance:
${balance}
          `.trim(),
          walletKeyboard()
        );
      }

      if (
        data === "wallet:list"
      ) {
        const wallets =
          listWallets(id);

        return render(
          ctx,
          walletsListText(
            wallets
          ),
          walletsListKeyboard(
            wallets
          )
        );
      }

      if (
        data === "wallet:add"
      ) {
        return render(
          ctx,
          `
➕ <b>ADD WALLET</b>

Create a new wallet or import an existing one. It will become your active wallet.
          `.trim(),
          new InlineKeyboard()
            .text(
              "💰 Create Wallet",
              "wallet:create"
            )
            .row()
            .text(
              "🔑 Import Wallet",
              "wallet:import"
            )
            .row()
            .text(
              "↩️ Back",
              "wallet:list"
            )
        );
      }

      if (
        data.startsWith(
          "wallet:switch:"
        )
      ) {
        const walletId = Number(
          data.split(":")[2]
        );

        setActiveWallet(
          id,
          walletId
        );

        const wallets =
          listWallets(id);

        return render(
          ctx,
          walletsListText(
            wallets
          ),
          walletsListKeyboard(
            wallets
          )
        );
      }

      if (
        data.startsWith(
          "wallet:remove:"
        )
      ) {
        const walletId = Number(
          data.split(":")[2]
        );

        deleteWalletById(
          id,
          walletId
        );

        const wallets =
          listWallets(id);

        return render(
          ctx,
          walletsListText(
            wallets
          ),
          walletsListKeyboard(
            wallets
          )
        );
      }

      if (
        data ===
        "wallet:export"
      ) {
        return render(
          ctx,
          `
⚠️ <b>EXPORT PRIVATE KEY</b>

Anyone with this key controls the wallet.

Only export it if you understand the risk.
          `.trim(),
          new InlineKeyboard()
            .text(
              "⚠️ Confirm Export",
              "wallet:export:confirm"
            )
            .row()
            .text(
              "❌ Cancel",
              "wallet:menu"
            )
        );
      }

      if (
        data ===
        "wallet:export:confirm"
      ) {
        const key =
          exportPrivateKey(id);

        if (!key) {
          return render(
            ctx,
            "No wallet found.",
            onboardingKeyboard()
          );
        }

        return render(
          ctx,
          `
🔑 <b>PRIVATE KEY</b>

<code>${key}</code>

Delete this message after saving.
          `.trim(),
          walletKeyboard()
        );
      }

      if (
        data ===
        "wallet:copy"
      ) {
        const address =
          getAddress(id);

        if (!address) {
          return render(
            ctx,
            "No wallet connected.",
            onboardingKeyboard()
          );
        }

        return render(
          ctx,
          `
📥 <b>ADDRESS</b>

<code>${address}</code>
          `.trim(),
          walletKeyboard()
        );
      }

      if (
        data ===
        "wallet:logout"
      ) {
        logout(id);

        return render(
          ctx,
          "🚪 Wallet disconnected.",
          onboardingKeyboard()
        );
      }

      if (
        data === "settings"
      ) {
        return render(
          ctx,
          settingsText(id),
          settingsKeyboard(
            getSettings(id)
          )
        );
      }

      if (
        data.startsWith(
          "setting:"
        )
      ) {
        const field =
          data.slice(
            "setting:".length
          );

        if (
          field ===
          "smart_money"
        ) {
          const s =
            getSettings(id);

          updateSettings(
            id,
            {
              smart_money_boost:
                s.smart_money_boost
                  ? 0
                  : 1
            }
          );

          return render(
            ctx,
            settingsText(id),
            settingsKeyboard(
              getSettings(id)
            )
          );
        }

        const s =
          getSettings(id);

        let current: any =
          (s as any)[field];

        if (
          field === "tp"
        ) {
          current =
            s.tp_tiers;
        }

        return render(
          ctx,
          `
✏️ <b>EDIT</b>

Field: <b>${field}</b>
Current: <b>${current}</b>
          `.trim(),
          editSettingKeyboard(
            field === "tp"
              ? "tp"
              : field
          )
        );
      }

      if (
        data.startsWith(
          "adjust:"
        )
      ) {
        const parts =
          data.split(":");

        const field =
          parts[1];

        const direction =
          parts[2];

        const limits =
          getFieldLimits(
            field
          );

        if (!limits) {
          return render(
            ctx,
            "Unknown field.",
            backKeyboard()
          );
        }

        const s =
          getSettings(id);

        let value =
          Number(
            (s as any)[field]
          );

        if (
          direction ===
          "plus"
        ) {
          value +=
            limits.step;
        } else {
          value -=
            limits.step;
        }

        value = Math.min(
          limits.max,
          Math.max(
            limits.min,
            value
          )
        );

        updateSetting(
          id,
          field as any,
          value
        );

        return render(
          ctx,
          `
✏️ <b>EDIT</b>

Field: <b>${field}</b>
Current: <b>${value}</b>
          `.trim(),
          editSettingKeyboard(
            field
          )
        );
      }

      if (
        data.startsWith(
          "custom:"
        )
      ) {
        const field =
          data.slice(
            "custom:".length
          );

        if (
          field === "tp"
        ) {
          setAwaitingInput(
            id,
            "custom:tp"
          );

          return render(
            ctx,
            `
✏️ <b>CUSTOM TP TIERS</b>

Send tiers like:
40:50,100:25,200:15
            `.trim(),
            backKeyboard()
          );
        }

        setAwaitingInput(
          id,
          `custom:${field}`
        );

        return render(
          ctx,
          `
✏️ <b>CUSTOM VALUE</b>

Send the new value.
          `.trim(),
          backKeyboard()
        );
      }

      if (
        data ===
        "auto:start"
      ) {
        const s =
          getSettings(id);

        return render(
          ctx,
          `
▶️ <b>START AUTO BOT</b>

Max Buy:
${s.max_buy} SOL

Slippage:
${s.slippage}%

TP:
${JSON.parse(
  s.tp_tiers
)
  .map(
    (tier: any) =>
      `+${tier.profit}/${tier.sellPercent}`
  )
  .join(" · ")}

Stop Loss:
-${s.stop_loss}%

Trailing:
+${s.trailing_after}% / ${s.trailing_pullback}%

Time Stop:
${s.time_stop_minutes} min

Daily Loss Cap:
${s.daily_loss_cap} SOL

Max Trades:
${s.max_trades_hour}/hour
${s.max_trades_day}/day

Smart Money:
${s.smart_money_boost ? "ON" : "OFF"}
          `.trim(),
          startConfirmKeyboard()
        );
      }

      if (
        data ===
        "auto:start:confirm"
      ) {
        const s =
          getSettings(id);

        if (
          !hasWallet(id)
        ) {
          return render(
            ctx,
            "⚠️ Connect a wallet first.",
            onboardingKeyboard()
          );
        }

        if (
          s.kill_switch
        ) {
          return render(
            ctx,
            `
🛑 <b>EMERGENCY KILL ACTIVE</b>

Automated operation is locked.
          `.trim(),
            backKeyboard()
          );
        }

        updateSettings(
          id,
          {
            auto_state:
              "running"
          }
        );

        return render(
          ctx,
          `
🟢 <b>AUTO BOT STARTED</b>

Automation state is now <b>RUNNING</b>.
          `.trim(),
          mainKeyboard()
        );
      }

      if (
        data ===
        "auto:stop"
      ) {
        updateSettings(
          id,
          {
            auto_state:
              "stopped"
          }
        );

        return render(
          ctx,
          `
⏹ <b>AUTO BOT STOPPED</b>

No automated activity is active.
          `.trim(),
          new InlineKeyboard()
            .text(
              "⚡ Resume",
              "auto:resume"
            )
            .row()
            .text(
              "↩️ Back",
              "home"
            )
        );
      }

      if (
        data ===
        "auto:resume"
      ) {
        const s =
          getSettings(id);

        if (
          s.kill_switch
        ) {
          return render(
            ctx,
            "🛑 Emergency Kill is active.",
            backKeyboard()
          );
        }

        updateSettings(
          id,
          {
            auto_state:
              "running"
          }
        );

        return render(
          ctx,
          "▶️ <b>AUTO BOT RESUMED</b>",
          mainKeyboard()
        );
      }

      if (
        data ===
        "auto:kill"
      ) {
        return render(
          ctx,
          `
🆘 <b>EMERGENCY KILL</b>

This disables automated operation until manually re-enabled.
          `.trim(),
          emergencyKeyboard()
        );
      }

      if (
        data ===
        "auto:kill:confirm"
      ) {
        updateSettings(
          id,
          {
            auto_state:
              "stopped",
            kill_switch: 1
          }
        );

        return render(
          ctx,
          `
🛑 <b>EMERGENCY KILL ACTIVE</b>

Automated operation is locked.
          `.trim(),
          backKeyboard()
        );
      }

      if (
        data === "pnl"
      ) {
        return render(
          ctx,
          pnlText(id),
          backKeyboard()
        );
      }

      if (
        data === "positions"
      ) {
        return render(
          ctx,
          positionsText(id),
          backKeyboard()
        );
      }

      if (
        data === "support"
      ) {
        return render(
          ctx,
          supportText(),
          backKeyboard()
        );
      }

      if (
        data ===
        "status"
      ) {
        return render(
          ctx,
          statusText(id),
          new InlineKeyboard()
            .text(
              "📊 Refresh",
              "status"
            )
            .row()
            .text(
              "↩️ Back",
              "home"
            )
        );
      }

    } catch (error) {
      logger.error(
        "Callback error",
        error instanceof Error
          ? error.message
          : error
      );

      await render(
        ctx,
        "❌ Something went wrong.",
        backKeyboard()
      );
    }
  }
);

bot.catch(
  (error) => {
    logger.error(
      "Bot error",
      error.error
    );
  }
);
