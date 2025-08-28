import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LucideIcon } from "lucide-react";

interface StatusCardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
  status?: "online" | "offline" | "loading" | "success" | "warning" | "error";
  description?: string;
  loading?: boolean;
}

export const StatusCard = ({ 
  icon: Icon, 
  title, 
  value, 
  status = "success", 
  description,
  loading = false 
}: StatusCardProps) => {
  const getStatusColor = () => {
    switch (status) {
      case "online":
      case "success":
        return "text-green-500";
      case "offline":
      case "warning":
        return "text-orange-500";
      case "error":
        return "text-red-500";
      case "loading":
        return "text-muted-foreground";
      default:
        return "text-telegram";
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case "online":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">✅ Online</Badge>;
      case "offline":
        return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100">⚠️ Offline</Badge>;
      case "loading":
        return <Badge variant="outline" className="animate-pulse">Loading...</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card className="bot-card p-6 group">
      <div className="flex items-center gap-4">
        <div className={`bot-icon-wrapper p-3 w-16 h-16 ${getStatusColor()}/10 group-hover:${getStatusColor()}/20`}>
          <Icon className={`w-8 h-8 ${getStatusColor()} transition-transform group-hover:scale-110`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="bot-label">{title}</p>
          <div className="flex items-center gap-3 mt-2">
            {status === "online" || status === "offline" || status === "loading" ? (
              getStatusBadge()
            ) : (
              <p className="bot-metric">
                {loading ? (
                  <span className="animate-pulse">...</span>
                ) : (
                  <span className="animate-fade-in">{value}</span>
                )}
              </p>
            )}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground mt-1 truncate">{description}</p>
          )}
        </div>
      </div>
    </Card>
  );
};