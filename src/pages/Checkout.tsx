import PlanSummary from "@/components/billing/PlanSummary";
import CheckoutButton from "@/components/billing/CheckoutButton";
import { useSearchParams } from "react-router-dom";

const Checkout = () => {
  const [params] = useSearchParams();
  const plan = params.get("plan") || "Pro";
  const price = params.get("price") || "$10/mo";
  const features = [
    "Unlimited chats",
    "Priority support",
    "Early access to new features",
  ];

  return (
    <div className="flex justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <PlanSummary name={plan} price={price} features={features} />
        <CheckoutButton plan={plan} />
      </div>
    </div>
  );
};

export default Checkout;

