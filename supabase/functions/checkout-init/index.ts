import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "../_shared/client.ts";
import { optionalEnv } from "../_shared/env.ts";
import { bad, mna, ok, oops } from "../_shared/http.ts";
import { version } from "../_shared/version.ts";

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

export async function handler(req: Request): Promise<Response> {
  const v = version(req, "checkout-init");
  if (v) return v;
  if (req.method !== "POST") {
    return mna();
  }
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return bad("Bad JSON");
  }

  const supa = createClient();
  const BINANCE_PAY_MERCHANT_ID =
    optionalEnv("BINANCE_PAY_MERCHANT_ID") ?? "<BINANCE_PAY_MERCHANT_ID>";

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
  } else if (body.method === "binance_pay") {
    instructions = {
      type: "binance_pay",
      note: `Use Binance Pay to send to Binance ID ${BINANCE_PAY_MERCHANT_ID}. After sending, upload your receipt – payment remains awaiting admin approval until verified.`,
    };
  } else {
    instructions = {
      type: "crypto",
      note: "Send to the provided address (shown in UI). Then upload receipt.",
    };
  }

  return ok({ ok: true, payment_id: pay!.id, instructions });
}

if (import.meta.main) serve(handler);
