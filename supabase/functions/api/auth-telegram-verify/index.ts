import { config } from "../../telegram-bot/helpers/config.ts";

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verify(initData: string): Promise<boolean> {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash") ?? "";
  params.delete("hash");
  const dataCheckString = Array.from(params.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const enc = new TextEncoder();
  const secret = await crypto.subtle.importKey(
    "raw",
    enc.encode("WebAppData"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const botKey = await crypto.subtle.sign("HMAC", secret, enc.encode(config.TELEGRAM_BOT_TOKEN ?? ""));
  const key = await crypto.subtle.importKey(
    "raw",
    botKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(dataCheckString));
  return toHex(sig) === hash;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const { initData } = await req.json();
  const ok = initData ? await verify(initData) : false;
  return new Response(JSON.stringify({ ok }), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
});
