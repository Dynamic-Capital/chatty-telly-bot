/* eslint-disable @typescript-eslint/no-explicit-any */
const accessToken = Deno.env.get("SUPABASE_ACCESS_TOKEN")!;
const projectId = Deno.env.get("SUPABASE_PROJECT_ID")!;
const baseUrl = "https://api.supabase.com/v1/projects";
const fnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/payment-notifier`;

const res = await fetch(`${baseUrl}/${projectId}/webhooks`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});
const hooks = await res.json();
if (!hooks.find((h: any) => h.name === "payment-updates")) {
  await fetch(`${baseUrl}/${projectId}/webhooks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "payment-updates",
      table: "receipts",
      expression: "NEW.verdict = 'approved' OR NEW.status = 'succeeded'",
      url: fnUrl,
    }),
  });
  console.log("webhook created");
} else {
  console.log("webhook exists");
}
