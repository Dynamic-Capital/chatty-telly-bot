// Simple in-process job queue with optional persistence
// Jobs are processed FIFO with exponential backoff retry logic.

export type BackoffStrategy = 'exp';

export interface EnqueueOptions {
  maxAttempts?: number;
  backoff?: BackoffStrategy;
  delayMs?: number;
}

export interface JobRecord {
  id: number;
  type: string;
  payload: unknown;
  status: 'pending' | 'completed' | 'failed';
  attempts: number;
  maxAttempts: number;
  nextRunAt: number;
  lastError?: string;
}

export type Processor = (payload: unknown, job: JobRecord) => Promise<void>;
export type ProcessorMap = Record<string, Processor>;

let processors: ProcessorMap = {};
let running = false;
let jobIdCounter = 1;
const jobStore = new Map<number, JobRecord>();
let queue: number[] = [];
let backoffBaseMs = 1000; // can be tuned for tests
const backoffCapMs = 30000;
let loopPromise: Promise<void> | null = null;

// Optional persistence via Supabase if available
let supabaseClient: unknown = null;
export function setSupabase(client: unknown) {
  supabaseClient = client;
}

function sortQueue() {
  queue.sort((a, b) => {
    const ja = jobStore.get(a)!;
    const jb = jobStore.get(b)!;
    return ja.nextRunAt - jb.nextRunAt;
  });
}

async function persist(job: JobRecord) {
  if (!supabaseClient) return;
  try {
    // deno-lint-ignore no-explicit-any
    await (supabaseClient as any).from('jobs').upsert({
      id: job.id,
      type: job.type,
      payload: job.payload,
      status: job.status,
      attempts: job.attempts,
      next_run_at: new Date(job.nextRunAt).toISOString(),
      last_error: job.lastError ?? null,
    });
  } catch (_) {
    // ignore persistence errors
  }
}

export function setBackoffBase(ms: number) {
  backoffBaseMs = ms;
}

export function enqueue(type: string, payload: unknown, opts: EnqueueOptions = {}) {
  const job: JobRecord = {
    id: jobIdCounter++,
    type,
    payload,
    status: 'pending',
    attempts: 0,
    maxAttempts: opts.maxAttempts ?? 5,
    nextRunAt: Date.now() + (opts.delayMs ?? 0),
  };
  jobStore.set(job.id, job);
  queue.push(job.id);
  sortQueue();
  persist(job);
  return job.id;
}

function calculateBackoff(attempt: number): number {
  const delay = backoffBaseMs * Math.pow(2, attempt - 1);
  return Math.min(delay, backoffCapMs);
}

async function sleep(ms: number) {
  await Promise.resolve(); // satisfy require-await

  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processJob(job: JobRecord) {
  const processor = processors[job.type];
  if (!processor) {
    job.status = 'failed';
    job.lastError = 'no processor';
    await persist(job);
    return;
  }
  try {
    await processor(job.payload, job);
    job.status = 'completed';
    await persist(job);
  } catch (err) {
    job.attempts += 1;
    job.lastError = err instanceof Error ? err.message : String(err);
    if (job.attempts < job.maxAttempts) {
      job.nextRunAt = Date.now() + calculateBackoff(job.attempts);
      queue.push(job.id);
      sortQueue();
    } else {
      job.status = 'failed';
    }
    await persist(job);
  }
}

export async function workerLoop() {
  while (running) {
    if (queue.length === 0) {
      await sleep(50);
      continue;
    }
    const id = queue[0];
    const job = jobStore.get(id);
    if (!job) {
      queue.shift();
      continue;
    }
    const now = Date.now();
    if (job.nextRunAt > now) {
      await sleep(job.nextRunAt - now);
      continue;
    }
    queue.shift();
    await processJob(job);
  }
}

export function startWorker(map: ProcessorMap) {
  processors = map;
  if (running) return;
  running = true;
  loopPromise = workerLoop();
}

export async function stopWorker() {
  running = false;
  if (loopPromise) {
    await loopPromise;
    loopPromise = null;
  }
}

export function pendingJobs(): JobRecord[] {
  return queue.map((id) => jobStore.get(id)!).filter(Boolean);
}

export function clearQueue() {
  queue = [];
  jobStore.clear();
  jobIdCounter = 1;
}
