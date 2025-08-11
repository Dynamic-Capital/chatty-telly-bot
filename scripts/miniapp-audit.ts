// Checks that MINI_APP_URL returns HTML and looks like your SPA.
const url = Deno.env.get("MINI_APP_URL");
if (!url) throw new Error("MINI_APP_URL missing");
const u = url.endsWith("/") ? url : url + "/";
const r = await fetch(u);
const text = await r.text();
const ok = r.ok && /<html|<div[^>]+id=["']root["']/i.test(text);
console.log(
  JSON.stringify(
    { url: u, status: r.status, ok, snippet: text.slice(0, 300) },
    null,
    2,
  ),
);
