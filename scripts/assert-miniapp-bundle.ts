const p = new URL("../supabase/functions/miniapp/static/index.html", import.meta.url);
try {
  const txt = await Deno.readTextFile(p);
  if (!txt || txt.length < 32) {
    console.error(JSON.stringify({ ok:false, error:"index.html too short", path: p.pathname }));
    Deno.exit(1);
  }
  console.log(JSON.stringify({ ok:true, bytes: txt.length, path: p.pathname }));
} catch (e) {
  console.error(JSON.stringify({ ok:false, error:"index.html missing", path: p.pathname, detail: String(e) }));
  Deno.exit(1);
}
