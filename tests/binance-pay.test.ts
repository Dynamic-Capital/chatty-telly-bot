import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { verifyBinancePayment } from "../supabase/functions/payments-auto-review/binance.ts";

denoEnvCleanup();

denoTest("verifyBinancePayment returns true when status PAID", async () => {
  setEnv();
  const mockFetch: typeof fetch = () =>
    Promise.resolve(
      new Response(JSON.stringify({ data: { status: "PAID" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  const ok = await verifyBinancePayment("123", mockFetch);
  assertEquals(ok, true);
});

denoTest("verifyBinancePayment returns false when not paid", async () => {
  setEnv();
  const mockFetch: typeof fetch = () =>
    Promise.resolve(
      new Response(JSON.stringify({ data: { status: "PENDING" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  const ok = await verifyBinancePayment("123", mockFetch);
  assertEquals(ok, false);
});

denoTest("verifyBinancePayment throws on HTTP error", async () => {
  setEnv();
  const mockFetch: typeof fetch = () =>
    Promise.resolve(new Response("oops", { status: 500 }));
  await assertRejects(() => verifyBinancePayment("123", mockFetch));
});

function setEnv() {
  Deno.env.set("BINANCE_API_KEY", "k");
  Deno.env.set("BINANCE_SECRET_KEY", "s");
}

function denoEnvCleanup() {
  // Make sure env vars aren't leaking across tests
  Deno.env.delete("BINANCE_API_KEY");
  Deno.env.delete("BINANCE_SECRET_KEY");
}

function denoTest(name: string, fn: () => Promise<void>) {
  Deno.test(name, async () => {
    try {
      await fn();
    } finally {
      denoEnvCleanup();
    }
  });
}
