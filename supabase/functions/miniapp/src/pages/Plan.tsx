import { useEffect, useState } from "react";
import TopBar from "../components/TopBar";
import GlassPanel from "../components/GlassPanel";
import PrimaryButton from "../components/PrimaryButton";
import SecondaryButton from "../components/SecondaryButton";
import { functionUrl } from "../lib/edge";
import { useTelegramMainButton } from "../hooks/useTelegram";

interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
}

interface BankAccount {
  bank_name: string;
  account_name: string;
  account_number: string;
  currency: string;
}

type Instructions =
  | { type: "bank_transfer"; banks: BankAccount[] }
  | { type: "binance_pay" | "crypto"; note: string };

export default function Plan() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [method, setMethod] = useState<"bank_transfer" | "binance_pay" | "crypto">(
    "bank_transfer",
  );
  const [instructions, setInstructions] = useState<Instructions | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);

  useEffect(() => {
    const url = functionUrl("plans");
    if (!url) return;
    fetch(url)
      .then((res) => res.json())
      .then((d) => setPlans(d.plans || []))
      .catch(() => setPlans([]));
  }, []);

  const getTelegramId = () => {
    try {
      return String(
        (globalThis as any).Telegram?.WebApp?.initDataUnsafe?.user?.id || "",
      );
    } catch {
      return "";
    }
  };

  const handleCheckout = async () => {
    const url = functionUrl("checkout-init");
    if (!url || !selected) return;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telegram_id: getTelegramId(),
        plan_id: selected,
        method,
      }),
    });
    const json = await res.json().catch(() => null);
    if (json?.ok) {
      setPaymentId(json.payment_id);
      setInstructions(json.instructions as Instructions);
    }
  };

  useTelegramMainButton(!!selected && !instructions, "Confirm", handleCheckout);

  return (
    <div className="dc-screen">
      <TopBar title="Choose Plan" />
      {!instructions && (
        <div className="space-y-4">
          {plans.map((p) => (
            <GlassPanel
              key={p.id}
              className={`cursor-pointer${selected === p.id ? " ring-1 ring-primary" : ""}`}
              onClick={() => setSelected(p.id)}
            >
              <div className="flex items-center justify-between">
                <span>{p.name}</span>
                <span className="text-sm">
                  ${p.price} {p.currency}
                </span>
              </div>
            </GlassPanel>
          ))}
          <div className="flex gap-2">
            <SecondaryButton
              label="Bank"
              onClick={() => setMethod("bank_transfer")}
              className={method === "bank_transfer" ? "opacity-100" : "opacity-60"}
            />
            <SecondaryButton
              label="Binance Pay"
              onClick={() => setMethod("binance_pay")}
              className={method === "binance_pay" ? "opacity-100" : "opacity-60"}
            />
            <SecondaryButton
              label="Crypto"
              onClick={() => setMethod("crypto")}
              className={method === "crypto" ? "opacity-100" : "opacity-60"}
            />
          </div>
          <PrimaryButton
            label="Confirm"
            onClick={handleCheckout}
            disabled={!selected || !!instructions}
            className="mt-4"
          />
        </div>
      )}
      {instructions && (
        <div className="space-y-4">
          {instructions.type === "bank_transfer" ? (
            <div className="space-y-2">
              {instructions.banks.map((b: BankAccount, idx: number) => (
                <GlassPanel key={idx} className="text-sm">
                  <p className="font-medium">{b.bank_name}</p>
                  <p>Account Name: {b.account_name}</p>
                  <p>Account Number: {b.account_number}</p>
                  <p>Currency: {b.currency}</p>
                </GlassPanel>
              ))}
            </div>
          ) : (
            <GlassPanel className="text-sm">{instructions.note}</GlassPanel>
          )}
          {paymentId && (
            <PrimaryButton
              label="View Status"
              onClick={() => {
                globalThis.location.href = `/status?payment_id=${paymentId}`;
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

