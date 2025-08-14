import { enqueue } from "../queue/index.ts";
import { getFlag } from "../utils/config.ts";

export interface PlanBroadcastOptions {
  segment: number[] | { userIds: number[] };
  text: string;
  media?: string;
  chunkSize?: number;
  pauseMs?: number;
}

export async function resolveTargets(
  segment: PlanBroadcastOptions["segment"],
): Promise<number[]> {
  if (Array.isArray(segment)) return segment;
  if (segment && Array.isArray((segment as { userIds?: number[] }).userIds)) {
    return (segment as { userIds: number[] }).userIds;
  }
  return [];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function planBroadcast(opts: PlanBroadcastOptions) {
  if (!(await getFlag("broadcasts_enabled"))) {
    throw new Error("Broadcasts disabled");
  }
  const { segment, text, media, chunkSize = 25, pauseMs = 500 } = opts;
  const targets = await resolveTargets(segment);
  for (let i = 0; i < targets.length; i += chunkSize) {
    const chunk = targets.slice(i, i + chunkSize);
    enqueue("broadcast:sendBatch", { userIds: chunk, text, media }, {
      maxAttempts: 5,
      backoff: "exp",
    });
    if (pauseMs) await sleep(pauseMs);
  }
  return {
    total: targets.length,
    chunks: Math.ceil(targets.length / chunkSize),
  };
}
