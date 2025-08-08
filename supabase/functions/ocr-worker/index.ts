import { pullAndProcess } from "../_shared/jobs/worker.ts";
import { log } from "../_shared/logging.ts";

Deno.serve(async () => {
  try {
    await pullAndProcess();
    return new Response("OK", { status: 200 });
  } catch (err) {
    log("worker_fail", { error: (err as Error).message });
    return new Response("Error", { status: 500 });
  }
});
