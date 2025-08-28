import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Shield, Activity, Users } from "lucide-react";

interface QuickActionsProps {
  onRefreshStats?: () => void;
  onCheckStatus?: () => void;
}

export const QuickActions = ({ onRefreshStats, onCheckStatus }: QuickActionsProps) => {
  const actions = [
    {
      icon: FileText,
      label: "Admin Panel",
      action: () => window.open("/admin", "_blank"),
      variant: "outline" as const,
    },
    {
      icon: Shield,
      label: "Check Status",
      action: onCheckStatus,
      variant: "outline" as const,
    },
    {
      icon: Activity,
      label: "Refresh Stats",
      action: onRefreshStats,
      variant: "outline" as const,
    },
    {
      icon: Users,
      label: "User Management",
      action: () => {},
      variant: "outline" as const,
    },
  ];

  return (
    <Card className="p-6 bg-gradient-card border-0 shadow-telegram">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Activity className="w-5 h-5 text-telegram" />
        Quick Actions
      </h3>
      <div className="flex flex-wrap gap-3">
        {actions.map((action, index) => (
          <Button
            key={index}
            variant={action.variant}
            size="sm"
            className="gap-2 hover:scale-105 transition-transform"
            onClick={action.action}
          >
            <action.icon className="w-4 h-4" />
            {action.label}
          </Button>
        ))}
      </div>
    </Card>
  );
};