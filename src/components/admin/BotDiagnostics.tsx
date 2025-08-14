import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Webhook,
  Bot
} from "lucide-react";

interface BotInfoData {
  id: number;
  username: string;
  first_name: string;
  can_read_all_group_messages: boolean;
  supports_inline_queries: boolean;
}

interface WebhookInfoData {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
  max_connections: number;
  allowed_updates?: string[];
}

interface BotStatus {
  bot_info: {
    success: boolean;
    data?: BotInfoData | null;
    error?: string | null;
  };
  webhook_info: {
    success: boolean;
    data?: WebhookInfoData | null;
    error?: string | null;
  };
  secrets: {
    db_secret_exists: boolean;
    env_secret_exists: boolean;
    secrets_match: boolean;
    db_secret_preview?: string | null;
  };
  database: {
    total_users: number;
    connection_successful: boolean;
  };
  recommendations: string[];
}

export const BotDiagnostics = () => {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const { toast } = useToast();

  const checkBotStatus = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<BotStatus>('bot-status-check');

      if (error) throw error;

      setStatus(data);
      toast({
        title: "Status Check Complete",
        description: "Bot diagnostics updated successfully",
      });
    } catch (error) {
      console.error("Error checking bot status:", error);
      toast({
        title: "Error",
        description: "Failed to check bot status. Please try again.",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const setupWebhook = async () => {
    setSetupLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ webhook_secret: string }>('setup-webhook-helper');
      
      if (error) throw error;
      
      toast({
        title: "Webhook Setup Complete",
        description: `Webhook configured successfully! Secret: ${data.webhook_secret}`,
      });
      
      // Refresh status after setup
      setTimeout(() => {
        checkBotStatus();
      }, 2000);
      
    } catch (error) {
      console.error("Error setting up webhook:", error);
      toast({
        title: "Setup Failed",
        description: "Failed to setup webhook. Please try again.",
        variant: "destructive",
      });
    }
    setSetupLoading(false);
  };

  const getStatusIcon = (success: boolean, warning = false) => {
    if (success && !warning) return <CheckCircle className="h-4 w-4 text-success" />;
    if (warning) return <AlertTriangle className="h-4 w-4 text-warning" />;
    return <XCircle className="h-4 w-4 text-destructive" />;
  };

  const getStatusBadge = (success: boolean, warning = false) => {
    if (success && !warning) return <Badge variant="default" className="bg-success text-success-foreground">OK</Badge>;
    if (warning) return <Badge variant="secondary" className="bg-warning text-warning-foreground">Warning</Badge>;
    return <Badge variant="destructive">Error</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Bot Diagnostics
          </CardTitle>
          <CardDescription>
            Check the status of your Telegram bot configuration and fix any issues
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={checkBotStatus} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Check Status
            </Button>
            <Button onClick={setupWebhook} disabled={setupLoading} variant="outline">
              {setupLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Webhook className="h-4 w-4 mr-2" />}
              Setup Webhook
            </Button>
          </div>

          {status && (
            <div className="space-y-4">
              {/* Bot Info */}
              <div className="flex items-center justify-between p-3 bg-card rounded-lg border">
                <div className="flex items-center gap-2">
                  {getStatusIcon(status.bot_info.success)}
                  <span className="font-medium">Bot Connection</span>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(status.bot_info.success)}
                  {status.bot_info.data && (
                    <span className="text-sm text-muted-foreground">
                      @{status.bot_info.data.username}
                    </span>
                  )}
                </div>
              </div>

              {/* Webhook Info */}
              <div className="flex items-center justify-between p-3 bg-card rounded-lg border">
                <div className="flex items-center gap-2">
                  {getStatusIcon(
                    status.webhook_info.success && !!status.webhook_info.data?.url,
                    status.webhook_info.data?.pending_update_count > 0
                  )}
                  <span className="font-medium">Webhook Configuration</span>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(
                    status.webhook_info.success && !!status.webhook_info.data?.url,
                    status.webhook_info.data?.pending_update_count > 0
                  )}
                  {status.webhook_info.data?.pending_update_count > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {status.webhook_info.data.pending_update_count} pending
                    </span>
                  )}
                </div>
              </div>

              {/* Secrets */}
              <div className="flex items-center justify-between p-3 bg-card rounded-lg border">
                <div className="flex items-center gap-2">
                  {getStatusIcon(
                    status.secrets.env_secret_exists && status.secrets.secrets_match,
                    status.secrets.db_secret_exists && !status.secrets.env_secret_exists
                  )}
                  <span className="font-medium">Webhook Secret</span>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(
                    status.secrets.env_secret_exists && status.secrets.secrets_match,
                    status.secrets.db_secret_exists && !status.secrets.env_secret_exists
                  )}
                  {status.secrets.db_secret_preview && (
                    <span className="text-sm text-muted-foreground font-mono">
                      {status.secrets.db_secret_preview}
                    </span>
                  )}
                </div>
              </div>

              {/* Database */}
              <div className="flex items-center justify-between p-3 bg-card rounded-lg border">
                <div className="flex items-center gap-2">
                  {getStatusIcon(status.database.connection_successful)}
                  <span className="font-medium">Database Connection</span>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(status.database.connection_successful)}
                  <span className="text-sm text-muted-foreground">
                    {status.database.total_users} users
                  </span>
                </div>
              </div>

              {/* Recommendations */}
              {status.recommendations.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <p className="font-medium">Recommendations:</p>
                      <ul className="space-y-1">
                        {status.recommendations.map((rec, index) => (
                          <li key={index} className="text-sm">{rec}</li>
                        ))}
                      </ul>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};