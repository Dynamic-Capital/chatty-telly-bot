import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export const RefreshBot = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const handleRefreshBot = async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-bot');
      
      if (error) {
        throw error;
      }

      toast({
        title: "Bot Refreshed Successfully",
        description: data.message || "Bot has been reset and webhook reestablished",
      });
    } catch (error) {
      console.error("Error refreshing bot:", error);
      toast({
        title: "Error",
        description: "Failed to refresh bot. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Auto-refresh on component mount
  useEffect(() => {
    handleRefreshBot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Bot Refresh</CardTitle>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleRefreshBot} 
            disabled={isRefreshing}
            className="w-full"
          >
            {isRefreshing ? "Refreshing Bot..." : "Refresh Bot Again"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};