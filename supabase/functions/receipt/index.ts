import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { verifyInitDataAndGetUser, isAdmin } from "../_shared/telegram.ts";
import { createClient } from "../_shared/client.ts";
import { ok, bad, unauth, mna } from "../_shared/http.ts";

serve(async (req) => {
  const url = new URL(req.url);
  const approveMatch = url.pathname.match(/\/receipt\/([^/]+)\/(approve|reject)/);

  // Receipt upload
  if (req.method === "POST" && !approveMatch) {
    const form = await req.formData().catch(() => null);
    if (!form) return bad("Bad form data");
    const initData = String(form.get("initData") || "");
    const u = await verifyInitDataAndGetUser(initData);
    if (!u) return unauth();
    const file = form.get("image");
    if (!(file instanceof File)) return bad("image required");
    let supa;
    try {
      supa = createClient();
    } catch (_) {
      supa = null;
    }
    const ext = file.name.split(".").pop();
    const path = `${u.id}/${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;
    if (supa) {
      await supa.storage.from("receipts").upload(path, file).catch(() => null);
    }
    return ok({ bucket: "receipts", path });
  }

  // Approval / rejection
  if (req.method === "POST" && approveMatch) {
    const id = approveMatch[1];
    const action = approveMatch[2];
    let body: { initData?: string };
    try { body = await req.json(); } catch { body = {}; }
    const u = await verifyInitDataAndGetUser(body.initData || "");
    if (!u || !isAdmin(u.id)) return unauth();
    let supa;
    try {
      supa = createClient();
    } catch (_) {
      supa = null;
    }
    if (supa) {
      const verdict = action === "approve" ? "approved" : "rejected";
      try {
        const { error } = await supa.from("receipts").update({ verdict }).eq("id", id);
        if (error) {
          // ignore error
        }
      } catch (_) {
        // ignore error
      }
    }
    return ok();
  }

  return mna();
});
