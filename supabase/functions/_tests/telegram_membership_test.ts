import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isMemberLike, getChatMemberStatus } from "../_shared/telegram_membership.ts";
import { recomputeVipForUser } from "../_shared/vip_sync.ts";
import { createMockSupabaseClient } from "./mock_supabase.ts";

Deno.test("isMemberLike works", () => {
  assert(isMemberLike("member"));
  assert(isMemberLike("administrator"));
  assert(!isMemberLike("left"));
});

Deno.test("getChatMemberStatus parses", async () => {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, result: { status: "left" } }));
  try {
    const status = await getChatMemberStatus("t", "-100", "1");
    assertEquals(status, "left");
  } finally {
    globalThis.fetch = oldFetch;
  }
});

Deno.test("recomputeVipForUser sets VIP", async () => {
  const supa = createMockSupabaseClient();
  supa.bot_users["1"] = { telegram_id: "1", is_vip: false };
  Deno.env.set("TELEGRAM_BOT_TOKEN", "t");
  Deno.env.set("VIP_CHANNELS", "-1001");
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, result: { status: "member" } }));
  try {
    const res = await recomputeVipForUser("1", supa);
    assert(res?.is_vip);
    assert(supa.channel_memberships["1:-1001"].is_active);
  } finally {
    globalThis.fetch = oldFetch;
    Deno.env.delete("TELEGRAM_BOT_TOKEN");
    Deno.env.delete("VIP_CHANNELS");
  }
});
