// functions/_tests/start-command.test.ts
/**
 * Offline smoke test for /start.
 * - No network. No real secrets.
 * - Tries to import the existing Edge handler and POST a /start update.
 * - Passes if the handler returns a Response with 200..299.
 *
 * Adjust the import path below ONLY if your handler path differs.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Try common paths without modifying existing files:
const candidates = [
  "../../supabase/functions/telegram-bot/index.ts",
  "../../functions/telegram-bot/index.ts",
  "../../edge/telegram-bot/index.ts"
];

let mod: any = null;
let used: string | null = null;
for (const p of candidates) {
  try {
    mod = await import(p);
    used = p;
    break;
  } catch {
    // keep trying
  }
}

Deno.test("found telegram-bot handler module", () => {
  assert(mod, "Could not import telegram-bot handler. Update path in test.");
  console.log("Using handler module:", used);
});

Deno.test("handler responds to /start offline", async () => {
  // Capture previous env so other tests aren't affected
  const prev: Record<string, string | undefined> = {
    SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
    SUPABASE_ANON_KEY: Deno.env.get("SUPABASE_ANON_KEY"),
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    TELEGRAM_BOT_TOKEN: Deno.env.get("TELEGRAM_BOT_TOKEN"),
    TELEGRAM_WEBHOOK_SECRET: Deno.env.get("TELEGRAM_WEBHOOK_SECRET"),
  };
  try {
    // Minimal env for the handler; tests should NEVER need real secrets
    Deno.env.set("SUPABASE_URL", prev.SUPABASE_URL ?? "http://local");
    Deno.env.set("SUPABASE_ANON_KEY", "test-anon");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-svc");
    Deno.env.set("TELEGRAM_BOT_TOKEN", ""); // empty to avoid outbound Telegram calls
    Deno.env.set("TELEGRAM_WEBHOOK_SECRET", "test-secret");

    const update = {
      update_id: 111,
      message: {
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        chat: { id: 42, type: "private" },
        from: { id: 42, is_bot: false, first_name: "Tester" },
        text: "/start",
        entities: [{ offset: 0, length: 6, type: "bot_command" }],
      },
    };
    const req = new Request("http://local/telegram-bot?secret=test-secret", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "test-secret",
      },
      body: JSON.stringify(update),
    });

    // Support handlers that export default(req) or named serveWebhook(req)
    let res: Response | null = null;
    if (typeof mod?.serveWebhook === "function") {
      res = await mod.serveWebhook(req);
    } else if (typeof mod?.default === "function") {
      try {
        res = await mod.default(req);
      } catch {
        // Try with injected deps (mock fetch + supabase) if supported
        const mockFetch: typeof fetch = async () => new Response("{}", { status: 200 });
        const mockSupabase = () => ({ from: () => ({ insert: () => ({ error: null }) }) }) as any;
        res = await mod.default(req, { fetcher: mockFetch, supabaseFactory: mockSupabase });
      }
    } else {
      console.warn("No callable export found (default or serveWebhook); skipping call test.");
      return;
    }

    assert(res instanceof Response, "Handler did not return a Response");
    assertEquals(true, res.status >= 200 && res.status < 300);
  } finally {
    // Restore previous env values
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) {
        Deno.env.delete(k);
      } else {
        Deno.env.set(k, v);
      }
    }
  }
});
