import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Star, Crown } from "lucide-react";

interface PlanSummaryProps {
  name: string;
  price: string;
  features: string[];
}

export const PlanSummary = ({ name, price, features }: PlanSummaryProps) => {
  const isVip = name.toLowerCase().includes("vip") || name.toLowerCase().includes("pro");
  
  return (
    <Card className="relative overflow-hidden border-2 border-primary/20 hover:border-primary/40 transition-all duration-300">
      {isVip && (
        <div className="absolute top-0 right-0 bg-gradient-to-l from-primary to-primary/80 text-primary-foreground px-3 py-1 text-xs font-medium rounded-bl-lg">
          <Crown className="w-3 h-3 inline mr-1" />
          Premium
        </div>
      )}
      
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2 mb-2">
          <CardTitle className="text-xl">{name}</CardTitle>
          {isVip && <Star className="w-4 h-4 text-primary fill-primary" />}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            {price}
          </span>
          {price.includes("/") && (
            <Badge variant="secondary" className="text-xs">
              Monthly
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            What's included:
          </h4>
          <ul className="space-y-2">
            {features.map((feature, index) => (
              <li key={feature} className="flex items-start gap-3 group">
                <div className="mt-0.5 p-0.5 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Check className="w-3 h-3 text-primary" />
                </div>
                <span className="text-sm leading-relaxed">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
        
        <div className="pt-2 border-t border-muted">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Instant activation</span>
            <span>Cancel anytime</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PlanSummary;

