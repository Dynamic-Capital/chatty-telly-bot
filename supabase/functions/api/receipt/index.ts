Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  // TODO: handle image upload and queue OCR
  return new Response(JSON.stringify({ queued: true }), {
    headers: { "content-type": "application/json" },
  });
});
