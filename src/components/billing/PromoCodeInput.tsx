import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Tag, Percent, DollarSign, Loader2, Check, X } from "lucide-react";

interface PromoCodeInputProps {
  planId: string;
}

interface PromoValidation {
  ok: boolean;
  type?: "percentage" | "fixed";
  value?: number;
  final_amount?: number;
  reason?: string;
}

const PromoCodeInput = ({ planId }: PromoCodeInputProps) => {
  const [promoCode, setPromoCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [validation, setValidation] = useState<PromoValidation | null>(null);
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const { toast } = useToast();

  const validatePromoCode = async () => {
    if (!promoCode.trim()) return;

    setIsValidating(true);
    try {
      const { data, error } = await supabase.functions.invoke("promo-validate", {
        body: {
          code: promoCode.trim().toUpperCase(),
          telegram_id: "123456789", // This would come from auth context in real app
          plan_id: planId,
        },
      });

      if (error) throw error;

      setValidation(data);
      
      if (data.ok) {
        setAppliedPromo(promoCode.trim().toUpperCase());
        toast({
          title: "Promo code applied! 🎉",
          description: `You saved ${data.type === "percentage" ? `${data.value}%` : `$${data.value}`}`,
        });
      } else {
        toast({
          title: "Invalid promo code",
          description: data.reason || "This promo code is not valid",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Promo validation error:", error);
      toast({
        title: "Error",
        description: "Failed to validate promo code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsValidating(false);
    }
  };

  const clearPromoCode = () => {
    setPromoCode("");
    setValidation(null);
    setAppliedPromo(null);
  };

  const getDiscountBadge = () => {
    if (!validation?.ok) return null;
    
    return (
      <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
        <Sparkles className="w-3 h-3 mr-1" />
        {validation.type === "percentage" 
          ? `${validation.value}% OFF` 
          : `$${validation.value} OFF`
        }
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Promo Input */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Enter promo code"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              className="pl-10 font-mono"
              disabled={isValidating || !!appliedPromo}
            />
          </div>
          
          {appliedPromo ? (
            <Button
              variant="outline"
              size="default"
              onClick={clearPromoCode}
              className="shrink-0"
            >
              <X className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={validatePromoCode}
              disabled={!promoCode.trim() || isValidating}
              className="shrink-0"
            >
              {isValidating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Apply"
              )}
            </Button>
          )}
        </div>

        {/* Popular Promo Codes */}
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground">Try:</span>
          {["VIPBOTLAUNCH50", "NEWMEMBER20", "VIP50"].map((code) => (
            <Button
              key={code}
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs font-mono hover:bg-primary/10"
              onClick={() => setPromoCode(code)}
              disabled={!!appliedPromo}
            >
              {code}
            </Button>
          ))}
        </div>
      </div>

      {/* Validation Result */}
      {validation && (
        <Card className={`border transition-all duration-300 ${
          validation.ok 
            ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20" 
            : "border-destructive/50 bg-destructive/5"
        }`}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              {validation.ok ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <X className="w-4 h-4 text-destructive" />
              )}
              <span className="font-medium">
                {validation.ok ? "Promo code applied" : "Invalid code"}
              </span>
              {validation.ok && getDiscountBadge()}
            </div>
            
            {validation.ok && validation.final_amount !== undefined && (
              <div className="space-y-2">
                <Separator />
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Original price:</span>
                  <span className="line-through">$49.00</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Discount:</span>
                  <span className="text-green-600 font-medium">
                    -{validation.type === "percentage" 
                      ? `${validation.value}%` 
                      : `$${validation.value}`
                    }
                  </span>
                </div>
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Final price:</span>
                  <span className="text-primary">${validation.final_amount}</span>
                </div>
              </div>
            )}
            
            {!validation.ok && validation.reason && (
              <p className="text-sm text-muted-foreground mt-1">
                {validation.reason}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Promo Features */}
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="space-y-1">
          <Percent className="w-5 h-5 mx-auto text-primary/70" />
          <p className="text-xs text-muted-foreground">Up to 50% off</p>
        </div>
        <div className="space-y-1">
          <DollarSign className="w-5 h-5 mx-auto text-primary/70" />
          <p className="text-xs text-muted-foreground">Instant savings</p>
        </div>
      </div>
    </div>
  );
};

export default PromoCodeInput;