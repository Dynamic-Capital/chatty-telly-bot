// @ts-nocheck: cross-runtime test uses dynamic imports
let registerTest;
let assertEquals;
let assertRejects;
if (typeof Deno !== 'undefined') {
  registerTest = (name, fn) => Deno.test(name, fn);
  const asserts = await import('https://deno.land/std@0.224.0/testing/asserts.ts');
  assertEquals = asserts.assertEquals;
  assertRejects = asserts.assertRejects;
} else {
  const { test } = await import('node:test');
  registerTest = (name, fn) => test(name, { concurrency: false }, fn);
  const assert = (await import('node:assert')).strict;
  assertEquals = (a, b, msg) => assert.equal(a, b, msg);
  assertRejects = assert.rejects;
}

import {
  clearQueue,
  enqueue,
  pendingJobs,
  setBackoffBase,
  startWorker,
  stopWorker,
} from '../src/queue/index.ts';
import { planBroadcast, setBroadcastsEnabled } from '../src/broadcast/index.ts';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

registerTest('retries until success', async () => {
  clearQueue();
  setBackoffBase(10); // speed up for tests
  let attempt = 0;
  startWorker({
    'broadcast:sendBatch': async () => {
      await Promise.resolve(); // satisfy require-await
      attempt++;
      if (attempt < 4) throw new Error('fail');
    },
  });
  enqueue('broadcast:sendBatch', { userIds: [1], text: 'hi' }, { maxAttempts: 5, backoff: 'exp' });
  await sleep(200); // allow retries
  await stopWorker();
  assertEquals(attempt, 4);
});

registerTest('chunking creates 8 jobs for 200 recipients', async () => {
  clearQueue();
  const ids = Array.from({ length: 200 }, (_, i) => i + 1);
  await planBroadcast({ segment: ids, text: 'hello', chunkSize: 25, pauseMs: 0 });
  const jobs = pendingJobs();
  assertEquals(jobs.length, 8);
  // deno-lint-ignore no-explicit-any
  const total = jobs.reduce((sum, j) => sum + (j.payload as any).userIds.length, 0);
  assertEquals(total, 200);
});

registerTest('broadcasts disabled blocks planning', async () => {
  clearQueue();
  setBroadcastsEnabled(false);
  const ids = [1, 2, 3];
  await assertRejects(() => planBroadcast({ segment: ids, text: 'nope' }));
  setBroadcastsEnabled(true);
});
