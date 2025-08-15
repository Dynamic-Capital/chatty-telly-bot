import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface CheckoutButtonProps {
  plan: string;
}

export const CheckoutButton = ({ plan }: CheckoutButtonProps) => {
  const navigate = useNavigate();

  const handleCheckout = () => {
    // In a real app, this would call a payment provider.
    navigate(`/payment-status?status=success&plan=${encodeURIComponent(plan)}`);
  };

  return (
    <Button onClick={handleCheckout} className="w-full">
      Confirm and Pay
    </Button>
  );
};

export default CheckoutButton;

