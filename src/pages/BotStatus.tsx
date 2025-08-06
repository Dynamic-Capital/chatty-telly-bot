import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function BotStatusPage() {
  const [isChecking, setIsChecking] = useState(false);
  const [botStatus, setBotStatus] = useState<any>(null);
  const { toast } = useToast();

  const checkBotStatus = async () => {
    setIsChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-bot-status');
      
      if (error) {
        throw error;
      }

      setBotStatus(data);
      toast({
        title: "Bot Status Checked",
        description: `Bot is ${data.bot_status?.includes('✅') ? 'working' : 'not working'}`,
      });
    } catch (error) {
      console.error("Error checking bot status:", error);
      toast({
        title: "Error",
        description: "Failed to check bot status",
        variant: "destructive",
      });
    } finally {
      setIsChecking(false);
    }
  };

  const resetBot = async () => {
    try {
      toast({
        title: "Resetting Bot...",
        description: "This may take a few seconds",
      });

      const { data, error } = await supabase.functions.invoke('reset-bot');
      
      if (error) {
        throw error;
      }

      toast({
        title: "Bot Reset Successfully",
        description: data.message || "Bot has been reset and webhook reestablished",
      });

      // Recheck status after reset
      setTimeout(() => checkBotStatus(), 3000);
    } catch (error) {
      console.error("Error resetting bot:", error);
      toast({
        title: "Error",
        description: "Failed to reset bot",
        variant: "destructive",
      });
    }
  };

  // Auto-check on mount
  useEffect(() => {
    checkBotStatus();
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">🤖 Bot Status Dashboard</h1>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Bot Diagnostics
            <div className="space-x-2">
              <Button 
                onClick={checkBotStatus} 
                disabled={isChecking}
                variant="outline"
              >
                {isChecking ? "Checking..." : "🔄 Check Status"}
              </Button>
              <Button 
                onClick={resetBot}
                variant="destructive"
              >
                🔄 Reset Bot
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {botStatus ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="font-semibold text-lg">🤖 Bot Status</h4>
                  <Badge variant={botStatus.bot_status?.includes('✅') ? 'default' : 'destructive'} className="text-sm">
                    {botStatus.bot_status || '❌ Unknown'}
                  </Badge>
                  {botStatus.bot_info && (
                    <div className="text-sm space-y-1">
                      <p><strong>Bot:</strong> @{botStatus.bot_info.username}</p>
                      <p><strong>Name:</strong> {botStatus.bot_info.first_name}</p>
                      <p><strong>ID:</strong> {botStatus.bot_info.id}</p>
                    </div>
                  )}
                </div>
                
                <div className="space-y-3">
                  <h4 className="font-semibold text-lg">🔗 Webhook Status</h4>
                  <Badge variant={botStatus.webhook_status?.includes('✅') ? 'default' : 'destructive'} className="text-sm">
                    {botStatus.webhook_status || '❌ Unknown'}
                  </Badge>
                  {botStatus.webhook_info && (
                    <div className="text-sm space-y-1">
                      <p><strong>URL:</strong> {botStatus.webhook_info.url ? '✅ Set' : '❌ Not Set'}</p>
                      <p><strong>Pending Updates:</strong> {botStatus.pending_updates || 0}</p>
                      {botStatus.webhook_info.url && (
                        <p className="text-xs text-muted-foreground break-all">
                          {botStatus.webhook_info.url}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">📊 Diagnosis</h4>
                {botStatus.bot_status?.includes('✅') && botStatus.webhook_status?.includes('✅') ? (
                  <p className="text-green-600">✅ Bot is properly configured and should respond to commands</p>
                ) : (
                  <div className="text-red-600 space-y-1">
                    <p>❌ Bot has configuration issues:</p>
                    {!botStatus.bot_status?.includes('✅') && <p>• Bot API connection failed</p>}
                    {!botStatus.webhook_status?.includes('✅') && <p>• Webhook not properly configured</p>}
                  </div>
                )}
                
                <p className="text-sm text-muted-foreground mt-2">
                  Last checked: {new Date(botStatus.timestamp).toLocaleString()}
                </p>
              </div>

              <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg">
                <h4 className="font-semibold mb-2">🧪 Test Instructions</h4>
                <ol className="text-sm space-y-1 list-decimal list-inside">
                  <li>Open Telegram and search for your bot</li>
                  <li>Send <code>/start</code> command</li>
                  <li>Bot should respond with welcome message and VIP packages</li>
                  <li>If not working, click "Reset Bot" above</li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Click "Check Status" to diagnose bot issues</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}