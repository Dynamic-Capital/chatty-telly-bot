// Admin command registry builders to keep core bot navigation focused

// Minimal Telegram message type for command context
interface TelegramMessage {
  chat: { id: number; type?: string };
  from?: { id?: number; username?: string };
  text?: string;
  [key: string]: unknown;
}

export interface CommandContext {
  msg: TelegramMessage;
  chatId: number;
  args: string[];
  miniAppValid: boolean;
}

export type CommandHandler = (ctx: CommandContext) => Promise<void>;

type AdminHandlers = typeof import("./admin-handlers/index.ts");

export function buildAdminCommandHandlers(
  load: () => Promise<AdminHandlers>,
  notify: (chatId: number, text: string) => Promise<unknown>,
): Record<string, CommandHandler> {
  return {
    "/ping": async ({ chatId }) => {
      const mod = await load();
      await notify(chatId, JSON.stringify(mod.handlePing()));
    },
    "/version": async ({ chatId }) => {
      const mod = await load();
      await notify(chatId, JSON.stringify(mod.handleVersion()));
    },
    "/env": async ({ chatId }) => {
      const mod = await load();
      const envStatus = await mod.handleEnvStatus();
      await notify(chatId, JSON.stringify(envStatus));
    },
    "/reviewlist": async ({ chatId }) => {
      const mod = await load();
      const list = await mod.handleReviewList();
      await notify(chatId, JSON.stringify(list));
    },
    "/replay": async ({ chatId, args }) => {
      const id = args[0];
      if (id) {
        const mod = await load();
        await notify(chatId, JSON.stringify(mod.handleReplay(id)));
      }
    },
    "/webhookinfo": async ({ chatId }) => {
      const mod = await load();
      const info = await mod.handleWebhookInfo();
      await notify(chatId, JSON.stringify(info));
    },
    "/admin": async ({ msg, chatId }) => {
      const mod = await load();
      const userId = String(msg.from?.id ?? chatId);
      await mod.handleAdminDashboard(chatId, userId);
    },
  };
}
