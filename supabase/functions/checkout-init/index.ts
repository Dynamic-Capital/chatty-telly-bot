import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getEnv } from "../_shared/env.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Body = {
  telegram_id: string;
  plan_id: string;
  method: "bank_transfer" | "binance_pay" | "crypto";
};

type BankAccount = {
  bank_name: string;
  account_name: string;
  account_number: string;
  currency: string;
  is_active: boolean;
};

type BankInstructions = { type: "bank_transfer"; banks: BankAccount[] };
type NoteInstructions = { type: "binance_pay" | "crypto"; note: string };
type Instructions = BankInstructions | NoteInstructions;

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const url = getEnv("SUPABASE_URL");
  const srv = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supa = createClient(url, srv, { auth: { persistSession: false } });

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
    return new Response(
      JSON.stringify({ ok: false, error: "user_not_found" }),
      { status: 500 },
    );
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
    return new Response(
      JSON.stringify({ ok: false, error: perr.message }),
      { status: 500 },
    );
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
  } else if (body.method === "binance_pay") {
    instructions = {
      type: "binance_pay",
      note: "Open Binance Pay and pay to the presented QR/ID. Then upload receipt.",
    };
  } else {
    instructions = {
      type: "crypto",
      note: "Send to the provided address (shown in UI). Then upload receipt.",
    };
  }

  return new Response(
    JSON.stringify({ ok: true, payment_id: pay!.id, instructions }),
    { headers: { "content-type": "application/json" } },
  );
});
