import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick?: () => void;
  badge?: ReactNode;
  accent?: "blue" | "green" | "purple" | "orange" | "red" | "teal";
}

export const FeatureCard = ({ 
  icon: Icon, 
  title, 
  description, 
  onClick,
  badge,
  accent = "blue"
}: FeatureCardProps) => {
  const getAccentColor = () => {
    switch (accent) {
      case "green":
        return "text-green-500";
      case "purple":
        return "text-purple-500";
      case "orange":
        return "text-orange-500";
      case "red":
        return "text-red-500";
      case "teal":
        return "text-teal-500";
      default:
        return "text-blue-500";
    }
  };

  const getAccentBg = () => {
    switch (accent) {
      case "green":
        return "bg-green-500/10 group-hover:bg-green-500/20";
      case "purple":
        return "bg-purple-500/10 group-hover:bg-purple-500/20";
      case "orange":
        return "bg-orange-500/10 group-hover:bg-orange-500/20";
      case "red":
        return "bg-red-500/10 group-hover:bg-red-500/20";
      case "teal":
        return "bg-teal-500/10 group-hover:bg-teal-500/20";
      default:
        return "bg-blue-500/10 group-hover:bg-blue-500/20";
    }
  };

  return (
    <Card
      className={`p-8 bg-gradient-card border-0 shadow-telegram hover:shadow-xl transition-all duration-300 group hover:scale-105 hover:-translate-y-1 ${
        onClick ? "cursor-pointer" : ""
      }`}
      onClick={onClick}
    >
      <div className="text-center space-y-6 relative">
        {badge && (
          <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
            {badge}
          </div>
        )}
        <div className="relative">
          <div className={`bot-icon-wrapper w-20 h-20 ${getAccentBg()} rounded-3xl group-hover:scale-110`}>
            <Icon className={`w-10 h-10 ${getAccentColor()} transition-transform group-hover:scale-110`} />
          </div>
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-telegram rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>
        <div>
          <h3 className="text-2xl font-bold mb-3 group-hover:text-telegram transition-colors">
            {title}
          </h3>
          <p className="text-muted-foreground leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </Card>
  );
};