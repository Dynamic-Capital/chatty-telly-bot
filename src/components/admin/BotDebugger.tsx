import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

interface BotStatusResponse {
  bot_status: string;
  bot_info?: {
    username?: string;
    first_name?: string;
  };
  webhook_status: string;
  webhook_info?: {
    url?: string;
  };
  pending_updates?: number;
  timestamp: string;
}

export const BotDebugger = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [botStatus, setBotStatus] = useState<BotStatusResponse | null>(null);
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
        title: 'Bot Status Checked',
        description: `Bot is ${data.bot_status.includes('✅') ? 'working' : 'not working'}`,
      });
    } catch (error) {
      console.error('Error checking bot status:', error);
      toast({
        title: 'Error',
        description: 'Failed to check bot status',
        variant: 'destructive',
      });
    } finally {
      setIsChecking(false);
    }
  };

  const resetBot = async () => {
    try {
      const { data: _data, error } = await supabase.functions.invoke('reset-bot');

      if (error) {
        throw error;
      }

      toast({
        title: 'Bot Reset',
        description: 'Bot has been reset successfully',
      });

      // Recheck status after reset
      setTimeout(() => checkBotStatus(), 2000);
    } catch (error) {
      console.error('Error resetting bot:', error);
      toast({
        title: 'Error',
        description: 'Failed to reset bot',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center justify-between'>
            🔧 Bot Diagnostics
            <div className='space-x-2'>
              <Button
                onClick={checkBotStatus}
                disabled={isChecking}
                variant='outline'
              >
                {isChecking ? 'Checking...' : 'Check Status'}
              </Button>
              <Button
                onClick={resetBot}
                variant='destructive'
              >
                Reset Bot
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {botStatus
            ? (
              <div className='space-y-4'>
                <div className='grid grid-cols-2 gap-4'>
                  <div className='space-y-2'>
                    <h4 className='font-semibold'>Bot Status</h4>
                    <Badge
                      variant={botStatus.bot_status.includes('✅') ? 'default' : 'destructive'}
                    >
                      {botStatus.bot_status}
                    </Badge>
                    {botStatus.bot_info && (
                      <div className='text-sm'>
                        <p>Bot: @{botStatus.bot_info.username}</p>
                        <p>Name: {botStatus.bot_info.first_name}</p>
                      </div>
                    )}
                  </div>

                  <div className='space-y-2'>
                    <h4 className='font-semibold'>Webhook Status</h4>
                    <Badge
                      variant={botStatus.webhook_status.includes('✅') ? 'default' : 'destructive'}
                    >
                      {botStatus.webhook_status}
                    </Badge>
                    {botStatus.webhook_info && (
                      <div className='text-sm'>
                        <p>URL: {botStatus.webhook_info.url ? '✅ Set' : '❌ Not Set'}</p>
                        <p>Updates: {botStatus.pending_updates} pending</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className='mt-4 p-3 bg-muted rounded'>
                  <p className='text-sm text-muted-foreground'>
                    Last checked: {new Date(botStatus.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            )
            : <p className='text-muted-foreground'>Click "Check Status" to diagnose bot issues</p>}
        </CardContent>
      </Card>
    </div>
  );
};
