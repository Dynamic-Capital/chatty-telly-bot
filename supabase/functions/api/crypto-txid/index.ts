Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const body = await req.json().catch(() => ({}));
  // TODO: verify crypto TXID
  return new Response(JSON.stringify({ ok: true, body }), {
    headers: { "content-type": "application/json" },
  });
});
