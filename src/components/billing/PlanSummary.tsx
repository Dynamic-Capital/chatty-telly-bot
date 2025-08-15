import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";

interface PlanSummaryProps {
  name: string;
  price: string;
  features: string[];
}

export const PlanSummary = ({ name, price, features }: PlanSummaryProps) => (
  <Card>
    <CardHeader>
      <CardTitle>{name}</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="mb-4 text-2xl font-bold">{price}</p>
      <ul className="space-y-2">
        {features.map((feature) => (
          <li key={feature} className="flex items-center">
            <Check className="mr-2 h-4 w-4" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </CardContent>
  </Card>
);

export default PlanSummary;

