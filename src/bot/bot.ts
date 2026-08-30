// src/bot/bot.ts — REPLACE existing file

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
  updateSettings
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
  walletKeyboard
} from "./keyboards.js";

import {
  homeText,
  walletCreatedText,
  walletImportedText,
  statusText,
  settingsText
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

function requireUser(ctx: Context) {
  if (!ctx.from) {
    throw new Error(
      "Telegram user unavailable."
    );
  }

  ensureUser(
    ctx.from.id,
    ctx.from
  );

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
      /*
       * Wallet import
       */

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

      /*
       * Take-profit tiers
       */

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

      /*
       * Numeric custom setting
       */

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
      /*
       * HOME
       */

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
       * HELP
       */

      if (
        data === "help"
      ) {
        return render(
          ctx,
          `
📄 <b>HELP</b>

This bot manages an encrypted Solana wallet and prepares automated trading settings.

Token scanning and trade execution are not enabled yet.
          `.trim(),
          backKeyboard()
        );
      }

      /*
       * CREATE WALLET
       */

      if (
        data ===
        "wallet:create"
      ) {
        const wallet =
          createWallet(id);

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

      /*
       * IMPORT WALLET
       */

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

      /*
       * WALLET MENU
       */

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

      /*
       * EXPORT
       */

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
        const privateKey =
          exportPrivateKey(id);

        return render(
          ctx,
          `
🔐 <b>PRIVATE KEY</b>

<code>${privateKey}</code>

⚠️ Never share this key.
          `.trim(),
          backKeyboard()
        );
      }

      /*
       * COPY ADDRESS
       */

      if (
        data ===
        "wallet:copy"
      ) {
        const address =
          getAddress(id);

        return render(
          ctx,
          `
📥 <b>COPY ADDRESS</b>

<code>${address}</code>
          `.trim(),
          backKeyboard()
        );
      }

      /*
       * LOGOUT
       */

      if (
        data ===
        "wallet:logout"
      ) {
        return render(
          ctx,
          `
⚠️ <b>DISCONNECT WALLET</b>

This removes the encrypted wallet from this bot.
          `.trim(),
          new InlineKeyboard()
            .text(
              "🚪 Confirm Logout",
              "wallet:logout:confirm"
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
        "wallet:logout:confirm"
      ) {
        logout(id);

        setAwaitingInput(
          id,
          null
        );

        return render(
          ctx,
          "🚪 Wallet disconnected.",
          onboardingKeyboard()
        );
      }

      /*
       * SETTINGS
       */

      if (
        data ===
        "settings"
      ) {
        return render(
          ctx,
          settingsText(id),
          settingsKeyboard(
            getSettings(id)
          )
        );
      }

      /*
       * SMART MONEY
       */

      if (
        data ===
        "setting:smart_money"
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
          `
⚙️ <b>AUTO SETTINGS</b>

Smart Money Boost:
${
  s.smart_money_boost
    ? "OFF"
    : "ON"
}
          `.trim(),
          settingsKeyboard(
            getSettings(id)
          )
        );
      }

      /*
       * SETTING EDIT
       */

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
          field === "tp"
        ) {
          setAwaitingInput(
            id,
            "custom:tp"
          );

          const s =
            getSettings(id);

          const tiers =
            JSON.parse(
              s.tp_tiers
            );

          return render(
            ctx,
            `
🎯 <b>TAKE PROFIT TIERS</b>

Current:

${tiers
  .map(
    (tier: any) =>
      `+${tier.profit}% → sell ${tier.sellPercent}%`
  )
  .join("\n")}

Send:

<code>40:50,100:25,200:15</code>
            `.trim(),
            backKeyboard()
          );
        }

        const s =
          getSettings(id);

        return render(
          ctx,
          `
⚙️ <b>${field}</b>

Current:
${s[field as keyof typeof s]}

Use − / ＋ or enter a custom value.
          `.trim(),
          editSettingKeyboard(
            field
          )
        );
      }

      /*
       * +/- ADJUSTMENT
       */

      if (
        data.startsWith(
          "adjust:"
        )
      ) {
        const [
          ,
          field,
          operation
        ] =
          data.split(":");

        const limits =
          getFieldLimits(
            field
          );

        if (!limits) {
          throw new Error(
            "Unknown setting."
          );
        }

        const current =
          getSettings(id);

        const oldValue =
          Number(
            current[
              field as keyof typeof current
            ]
          );

        let next =
          operation === "plus"
            ? oldValue +
              limits.step
            : oldValue -
              limits.step;

        next =
          Math.min(
            limits.max,
            Math.max(
              limits.min,
              next
            )
          );

        next =
          Number(
            next.toFixed(4)
          );

        updateSetting(
          id,
          field as any,
          next
        );

        return render(
          ctx,
          `
⚙️ <b>${field}</b>

Current:
${next}
          `.trim(),
          editSettingKeyboard(
            field
          )
        );
      }

      /*
       * CUSTOM INPUT
       */

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

Send:

<code>40:50,100:25,200:15</code>
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

      /*
       * START
       */

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

      /*
       * CONFIRM START
       */

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
🟢 <b>AUTO BOT ARMED</b>

Phase 1 wallet:
READY

Phase 2 controls:
READY

Token scanner:
NOT ACTIVE

Trading execution:
NOT ACTIVE
          `.trim(),
          mainKeyboard()
        );
      }

      /*
       * STOP
       */

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

      /*
       * RESUME
       */

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

      /*
       * EMERGENCY KILL
       */

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

      /*
       * STATUS
       */

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
