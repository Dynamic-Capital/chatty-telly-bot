import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Body = { payment_id: string };

const need = (k: string) =>
  Deno.env.get(k) || (() => {
    throw new Error(`Missing env ${k}`);
  })();

async function openAiExtract(
  imageUrl: string,
  hints: Record<string, string | number>,
) {
  const api = need("OPENAI_API_KEY");
  // Ask for strict JSON back
  const sys =
    "You are an extraction engine. Return strict JSON with keys: amount (number), currency (string, ISO code), date (yyyy-mm-dd), reference (string|null), payer_name (string|null), bank_name (string|null), confidence (0..1). If uncertain, set fields null and lower confidence.";
  const usr = [
    {
      type: "text",
      text: `Extract fields from this payment receipt. Hints: ${
        JSON.stringify(hints)
      }`,
    },
    { type: "image_url", image_url: { url: imageUrl } },
  ];

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${api}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: sys }, {
        role: "user",
        content: usr,
      }],
    }),
  });
  const j = await r.json();
  try {
    return JSON.parse(j.choices?.[0]?.message?.content ?? "{}");
  } catch {
    return { confidence: 0 };
  }
}

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

  const supa = createClient(
    need("SUPABASE_URL"),
    need("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  // Load payment + plan + receipt path
  const { data: p } = await supa.from("payments")
    .select(
      "id, plan_id, amount, currency, payment_method, webhook_data, created_at",
    )
    .eq("id", body.payment_id).maybeSingle();
  if (!p) return new Response("Payment not found", { status: 404 });

  const path = p.webhook_data?.storage_path;
  const bucket = p.webhook_data?.storage_bucket || "receipts";
  if (!path) return new Response("No receipt on file", { status: 400 });

  // Get a signed URL for the image
  const { data: signed, error: sErr } = await supa.storage.from(bucket)
    .createSignedUrl(path, 600);
  if (sErr || !signed?.signedUrl) {
    return new Response("Cannot sign receipt URL", { status: 500 });
  }

  // Optional plan lookup (to hint expected price/currency)
  const { data: plan } = await supa.from("subscription_plans").select(
    "price,currency",
  ).eq("id", p.plan_id).maybeSingle();

  // OCR via OpenAI (image URL)
  const result = await openAiExtract(signed.signedUrl, {
    expected_amount: plan?.price ?? p.amount ?? "",
    expected_currency: plan?.currency ?? p.currency ?? "",
  });

  // Persist raw analysis into webhook_data. Non-destructive upsert.
  const merged = {
    ...(p.webhook_data || {}),
    ocr: result,
    ocr_at: new Date().toISOString(),
  };
  await supa.from("payments").update({ webhook_data: merged }).eq("id", p.id);

  return new Response(JSON.stringify({ ok: true, ocr: result }), {
    headers: { "content-type": "application/json" },
  });
});
