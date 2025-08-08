/* eslint-disable @typescript-eslint/no-explicit-any */
const accessToken = Deno.env.get("SUPABASE_ACCESS_TOKEN")!;
const projectId = Deno.env.get("SUPABASE_PROJECT_ID")!;
const baseUrl = "https://api.supabase.com/v1/projects";
const funcUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/ocr-worker`;

const res = await fetch(`${baseUrl}/${projectId}/schedules`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});
const jobs = await res.json();
if (!jobs.find((j: any) => j.name === "ocr-worker")) {
  await fetch(`${baseUrl}/${projectId}/schedules`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "ocr-worker", url: funcUrl, cron: "*/1 * * * *" }),
  });
  console.log("schedule created");
} else {
  console.log("schedule exists");
}
