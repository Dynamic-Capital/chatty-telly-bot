import PlanSummary from "@/components/billing/PlanSummary";
import CheckoutButton from "@/components/billing/CheckoutButton";
import PromoCodeInput from "@/components/billing/PromoCodeInput";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Shield, Clock, Users } from "lucide-react";

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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="text-center space-y-2">
          <Badge variant="secondary" className="mb-2">
            Secure Checkout
          </Badge>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            Complete Your Purchase
          </h1>
          <p className="text-muted-foreground">
            Join thousands of traders already using our premium tools
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Plan Summary */}
          <div className="space-y-4">
            <PlanSummary name={plan} price={price} features={features} />
            
            {/* Trust Indicators */}
            <Card className="border-dashed border-muted">
              <CardContent className="pt-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="space-y-1">
                    <Shield className="w-5 h-5 mx-auto text-primary" />
                    <p className="text-xs text-muted-foreground">Secure</p>
                  </div>
                  <div className="space-y-1">
                    <Clock className="w-5 h-5 mx-auto text-primary" />
                    <p className="text-xs text-muted-foreground">Instant</p>
                  </div>
                  <div className="space-y-1">
                    <Users className="w-5 h-5 mx-auto text-primary" />
                    <p className="text-xs text-muted-foreground">5000+ Users</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Checkout Form */}
          <div className="space-y-4">
            <Card className="hover-scale">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  🎁 Have a Promo Code?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PromoCodeInput planId={plan} />
              </CardContent>
            </Card>

            <Separator className="my-4" />
            
            <CheckoutButton plan={plan} />
            
            <p className="text-xs text-center text-muted-foreground">
              By proceeding, you agree to our Terms of Service and Privacy Policy.
              Secure payment powered by Telegram.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;

