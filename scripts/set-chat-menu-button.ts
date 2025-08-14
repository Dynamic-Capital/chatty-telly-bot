// scripts/set-chat-menu-button.ts
// Sets a persistent chat menu button to open your Mini App.
// Env needed: TELEGRAM_BOT_TOKEN and either MINI_APP_URL or MINI_APP_SHORT_NAME
const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
const urlRaw = Deno.env.get("MINI_APP_URL");
const shortName = Deno.env.get("MINI_APP_SHORT_NAME");

if (!token || (!urlRaw && !shortName)) {
  console.error(
    "Need TELEGRAM_BOT_TOKEN and MINI_APP_URL or MINI_APP_SHORT_NAME in env.",
  );
  Deno.exit(1);
}

let url: string;
if (shortName) {
  const meRes = await fetch(
    `https://api.telegram.org/bot${token}/getMe`,
  );
  const me = await meRes.json();
  const username: string | undefined = me.result?.username;
  if (!username) {
    console.error("Could not determine bot username from getMe");
    Deno.exit(1);
  }
  url = `https://t.me/${username}/${shortName}`;
} else {
  url = urlRaw!.endsWith("/") ? urlRaw! : urlRaw! + "/";
}

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
