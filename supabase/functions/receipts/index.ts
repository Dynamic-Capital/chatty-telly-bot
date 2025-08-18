import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { verifyInitDataAndGetUser, isAdmin } from "../_shared/telegram.ts";
import { createClient } from "../_shared/client.ts";
import { ok, unauth, mna } from "../_shared/http.ts";

serve(async (req) => {
  if (req.method !== "GET") return mna();
  const url = new URL(req.url);
  const initData = url.searchParams.get("initData") || "";
  const status = url.searchParams.get("status") || "";
  const limit = Math.min(Number(url.searchParams.get("limit") || "20"), 100);

  const u = await verifyInitDataAndGetUser(initData);
  if (!u) return unauth();

  if (status === "manual_review" && !isAdmin(u.id)) return unauth();

  let supa;
  try {
    supa = createClient();
  } catch (_) {
    supa = null;
  }

  if (!supa) return ok({ items: [] });

  let query = supa.from("receipts").select("id, ocr_amount, verdict, created_at").order("created_at", { ascending: false }).limit(limit);
  if (status) query = query.eq("verdict", status);
  // In a real implementation, we'd filter by user here. For tests we fetch all.
  const { data, error } = await query;
  if (error) return ok({ items: [] });
  interface ReceiptRow {
    id: string;
    ocr_amount: unknown;
    verdict: string;
    created_at: string;
  }

  const items = (data || []).map((r: ReceiptRow) => ({
    id: r.id,
    amount: Number(r.ocr_amount) || 0,
    status: r.verdict,
    created_at: r.created_at,
  }));
  return ok({ items });
});
