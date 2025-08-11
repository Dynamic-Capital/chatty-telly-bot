// scripts/set-chat-menu-button.ts
// Sets a persistent chat menu button to open your Mini App.
// Env needed: TELEGRAM_BOT_TOKEN, MINI_APP_URL
const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
const urlRaw = Deno.env.get("MINI_APP_URL");

if (!token || !urlRaw) {
  console.error("Need TELEGRAM_BOT_TOKEN and MINI_APP_URL in env.");
  Deno.exit(1);
}

const url = urlRaw.endsWith("/") ? urlRaw : urlRaw + "/";
const payload = {
  menu_button: {
    type: "web_app",
    text: "Open VIP Mini App",
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
