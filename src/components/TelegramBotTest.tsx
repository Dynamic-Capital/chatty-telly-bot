import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const TelegramBotTest = () => {
  const { toast } = useToast();

  const setupWebhook = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('setup-telegram-webhook');
      
      if (error) {
        throw error;
      }

      toast({
        title: "Webhook Setup",
        description: data.success ? "Webhook configured successfully!" : "Webhook setup failed: " + (data.error || 'Unknown error'),
        variant: data.success ? "default" : "destructive"
      });

    } catch (error) {
      console.error('Webhook setup error:', error);
      toast({
        title: "Error",
        description: "Failed to setup webhook: " + error.message,
        variant: "destructive"
      });
    }
  };

  const testBot = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('test-bot-status');
      
      if (error) {
        throw error;
      }

      toast({
        title: "Bot Test",
        description: "Bot is responding: " + JSON.stringify(data),
        variant: "default"
      });

    } catch (error) {
      console.error('Bot test error:', error);
      toast({
        title: "Error", 
        description: "Bot test failed: " + error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Telegram Bot Setup</CardTitle>
        <CardDescription>
          Test and configure the Telegram bot
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={setupWebhook} className="w-full">
          Setup Webhook
        </Button>
        <Button onClick={testBot} variant="outline" className="w-full">
          Test Bot Status
        </Button>
      </CardContent>
    </Card>
  );
};