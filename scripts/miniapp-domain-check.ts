const urlEnv = Deno.env.get("MINI_APP_URL") || "";
if (!urlEnv) {
  console.log("MINI_APP_URL not set");
  Deno.exit(0);
}
const url = new URL(urlEnv.endsWith("/") ? urlEnv : urlEnv + "/");
try {
  const r = await fetch(url.toString(), { method: "HEAD" });
  console.log(
    JSON.stringify(
      { url: url.toString(), status: r.status, ok: r.ok },
      null,
      2,
    ),
  );
} catch (e) {
  console.log(
    JSON.stringify({ url: url.toString(), error: String(e) }, null, 2),
  );
}
