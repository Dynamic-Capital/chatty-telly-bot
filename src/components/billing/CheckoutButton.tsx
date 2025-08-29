import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { CreditCard, Shield, Zap } from "lucide-react";

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
    <div className="space-y-3">
      <Button 
        onClick={handleCheckout} 
        className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg hover:shadow-xl transition-all duration-300 group"
      >
        <CreditCard className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
        Complete Purchase
        <Zap className="w-4 h-4 ml-2 text-yellow-300" />
      </Button>
      
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Shield className="w-3 h-3" />
          <span>Secure Payment</span>
        </div>
        <span>•</span>
        <span>Instant Access</span>
        <span>•</span>
        <span>30-day Guarantee</span>
      </div>
    </div>
  );
};

export default CheckoutButton;

