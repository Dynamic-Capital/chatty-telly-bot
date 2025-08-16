const base = Deno.env.get("FUNCTIONS_BASE");
if (!base) {
  console.error("FUNCTIONS_BASE not set");
  Deno.exit(1);
}

async function expect(path: string, init: RequestInit, status: number) {
  const res = await fetch(`${base}${path}`, init);
  if (res.status !== status) {
    console.error(
      `${init.method ?? "GET"} ${path} -> ${res.status} (expected ${status})`,
    );
    Deno.exit(1);
  }
  console.log(`${init.method ?? "GET"} ${path} -> ${res.status}`);
}

await expect("/telegram-bot", { method: "GET" }, 405);
await expect(
  "/telegram-bot",
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  },
  401,
);

console.log("smoke-bot ok");
