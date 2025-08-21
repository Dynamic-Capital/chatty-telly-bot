import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "../_shared/client.ts";
import { getEnv } from "../_shared/env.ts";
import { bad, mna, ok, oops, json } from "../_shared/http.ts";
import { createClient as createSupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { version } from "../_shared/version.ts";

type Body = {
  telegram_id: string;
  plan_id: string;
  method: "bank_transfer" | "crypto";
};

type BankAccount = {
  bank_name: string;
  account_name: string;
  account_number: string;
  currency: string;
  is_active: boolean;
};

type BankInstructions = { type: "bank_transfer"; banks: BankAccount[] };
type CryptoInstructions = { type: "crypto"; note: string };
type Instructions = BankInstructions | CryptoInstructions;

export async function handler(req: Request): Promise<Response> {
  const v = version(req, "checkout-init");
  if (v) return v;
  if (req.method !== "POST") {
    return mna();
  }
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "unauthorized" }, 401);
  }
  const supaAuth = createSupabaseClient(
    getEnv("SUPABASE_URL"),
    getEnv("SUPABASE_ANON_KEY"),
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );
  const { data: { user } } = await supaAuth.auth.getUser();
  if (!user) {
    return json({ error: "unauthorized" }, 401);
  }
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return bad("Bad JSON");
  }

  const supa = createClient();
  const { data: bu } = await supa
    .from("bot_users")
    .select("id")
    .eq("telegram_id", body.telegram_id)
    .limit(1);
  let userId = bu?.[0]?.id as string | undefined;
  if (!userId) {
    const { data: ins } = await supa
      .from("bot_users")
      .insert({ telegram_id: body.telegram_id })
      .select("id")
      .single();
    userId = ins?.id;
  }
  if (!userId) {
    return oops("user_not_found");
  }

  const { data: pay, error: perr } = await supa
    .from("payments")
    .insert({
      user_id: userId,
      plan_id: body.plan_id,
      amount: null,
      currency: "USD",
      payment_method: body.method,
      status: "pending",
    })
    .select("id,created_at")
    .single();
  if (perr) {
    const message =
      typeof perr === "object" && perr && "message" in perr
        ? String((perr as { message: string }).message)
        : "Unknown error";
    return oops(message);
  }

  let instructions: Instructions;
  if (body.method === "bank_transfer") {
    const { data: banks } = await supa
      .from("bank_accounts")
      .select(
        "bank_name,account_name,account_number,currency,is_active",
      )
      .eq("is_active", true)
      .order("display_order");
    instructions = { type: "bank_transfer", banks: (banks as BankAccount[]) || [] };
  } else {
    instructions = {
      type: "crypto",
      note: "Send to the provided address (shown in UI). Then upload receipt.",
    };
  }

  return ok({ ok: true, payment_id: pay!.id, instructions });
}

if (import.meta.main) serve(handler);
