let lastSent = 0;
export async function alertAdmins(text: string) {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const list = (Deno.env.get("TELEGRAM_ADMIN_IDS") || "").split(",").map((s) =>
    s.trim()
  ).filter(Boolean);
  const now = Date.now();
  if (!token || list.length === 0) return;
  if (now - lastSent < 15_000) return; // throttle 1 per 15s
  lastSent = now;
  const body = JSON.stringify({ parse_mode: "HTML", text });
  await Promise.allSettled(
    list.map((id) =>
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body.replace('"text"', `"text","chat_id":"${id}"`),
      })
    ),
  );
}
