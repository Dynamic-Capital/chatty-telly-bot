// deno run -A scripts/tg-chat-menu.ts get|set [url]
const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
if (!token) throw new Error("TELEGRAM_BOT_TOKEN missing");

const base = `https://api.telegram.org/bot${token}`;

async function call(method: string, body?: unknown) {
  const r = await fetch(`${base}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  console.log(method, r.status, JSON.stringify(j, null, 2));
  return j;
}

const [mode, urlArg] = Deno.args;
if (mode === "get") {
  await call("getChatMenuButton", {});
} else if (mode === "set") {
  if (!urlArg) {
    throw new Error("Usage: deno run -A scripts/tg-chat-menu.ts set <url>");
  }
  await call("setChatMenuButton", {
    menu_button: {
      type: "web_app",
      text: "Open VIP Mini App",
      web_app: { url: urlArg },
    },
  });
  await call("getChatMenuButton", {});
} else {
  console.log(
    "Usage:\n  deno run -A scripts/tg-chat-menu.ts get\n  deno run -A scripts/tg-chat-menu.ts set <url>",
  );
}
