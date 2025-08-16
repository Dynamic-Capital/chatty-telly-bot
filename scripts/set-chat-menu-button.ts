// scripts/set-chat-menu-button.ts
// Sets a persistent chat menu button to open your Mini App.
// Env needed: TELEGRAM_BOT_TOKEN and MINI_APP_URL
const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
const urlRaw = Deno.env.get("MINI_APP_URL");

if (!token) {
  console.error("Need TELEGRAM_BOT_TOKEN in env.");
  Deno.exit(1);
}

if (!urlRaw) {
  console.error(
    "MINI_APP_URL is required. Configure the chat menu button via BotFather instead if you prefer.",
  );
  Deno.exit(1);
}

let parsed: URL;
try {
  parsed = new URL(urlRaw);
} catch {
  console.error("MINI_APP_URL must be a valid URL.");
  Deno.exit(1);
}

if (parsed.protocol !== "https:") {
  console.error("MINI_APP_URL must start with https://");
  Deno.exit(1);
}

if (!parsed.pathname.endsWith("/")) parsed.pathname += "/";
const url = parsed.toString();

const payload = {
  menu_button: {
    type: "web_app",
    text: "Join",
    web_app: { url },
  },
};

const res = await fetch(
  `https://api.telegram.org/bot${token}/setChatMenuButton`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  },
);
const text = await res.text();
console.log("setChatMenuButton", res.status, text.slice(0, 500));
