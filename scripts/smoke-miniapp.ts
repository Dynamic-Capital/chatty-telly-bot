const base = Deno.env.get("FUNCTIONS_BASE");
if (!base) {
  console.error("FUNCTIONS_BASE not set");
  Deno.exit(1);
}

async function expect(path: string, status: number) {
  const res = await fetch(`${base}${path}`);
  if (res.status !== status) {
    console.error(`${path} -> ${res.status} (expected ${status})`);
    Deno.exit(1);
  }
  console.log(`${path} -> ${res.status}`);
}

await expect("/miniapp/version", 200);
await expect("/nonexistent", 404);

console.log("smoke-miniapp ok");
