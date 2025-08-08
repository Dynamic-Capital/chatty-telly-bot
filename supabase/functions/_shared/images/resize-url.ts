const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

export function resizeUrl(path: string, width = 1280): string {
  const url = new URL(
    `${SUPABASE_URL}/storage/v1/render/image/authenticated/receipts/${path}`,
  );
  url.searchParams.set("width", String(width));
  return url.toString();
}
