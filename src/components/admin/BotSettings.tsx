import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Settings, Save, Loader2 } from 'lucide-react';

interface BotSetting {
  id: string;
  setting_key: string;
  setting_value: string;
  setting_type: string;
  description: string;
}

export const BotSettings = () => {
  const [settings, setSettings] = useState<BotSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bot_settings')
        .select('*')
        .eq('is_active', true)
        .order('setting_key');

      if (error) throw error;
      setSettings(data || []);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast({
        title: "Error",
        description: "Failed to fetch bot settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (settingKey: string, newValue: string) => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('bot_settings')
        .update({ setting_value: newValue, updated_at: new Date().toISOString() })
        .eq('setting_key', settingKey);

      if (error) throw error;

      setSettings(prev => 
        prev.map(setting => 
          setting.setting_key === settingKey 
            ? { ...setting, setting_value: newValue }
            : setting
        )
      );

      toast({
        title: "Success",
        description: `Setting "${settingKey}" updated successfully`,
      });
    } catch (error) {
      console.error('Error updating setting:', error);
      toast({
        title: "Error",
        description: "Failed to update setting",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (settingKey: string, value: string) => {
    setSettings(prev => 
      prev.map(setting => 
        setting.setting_key === settingKey 
          ? { ...setting, setting_value: value }
          : setting
      )
    );
  };

  const handleSwitchChange = (settingKey: string, checked: boolean) => {
    const value = checked ? 'true' : 'false';
    updateSetting(settingKey, value);
  };

  const handleSave = (settingKey: string) => {
    const setting = settings.find(s => s.setting_key === settingKey);
    if (setting) {
      updateSetting(settingKey, setting.setting_value);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6" />
        <h2 className="text-2xl font-bold">Bot Settings</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {settings.map((setting) => (
          <Card key={setting.id}>
            <CardHeader>
              <CardTitle className="text-lg">{setting.setting_key.replace(/_/g, ' ').toUpperCase()}</CardTitle>
              {setting.description && (
                <CardDescription>{setting.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {setting.setting_type === 'boolean' ? (
                <div className="flex items-center space-x-2">
                  <Switch
                    id={setting.setting_key}
                    checked={setting.setting_value === 'true'}
                    onCheckedChange={(checked) => handleSwitchChange(setting.setting_key, checked)}
                    disabled={saving}
                  />
                  <Label htmlFor={setting.setting_key}>
                    {setting.setting_value === 'true' ? 'Enabled' : 'Disabled'}
                  </Label>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor={setting.setting_key}>Value</Label>
                  <div className="flex gap-2">
                    <Input
                      id={setting.setting_key}
                      type={setting.setting_type === 'number' ? 'number' : 'text'}
                      value={setting.setting_value}
                      onChange={(e) => handleInputChange(setting.setting_key, e.target.value)}
                      disabled={saving}
                    />
                    <Button
                      onClick={() => handleSave(setting.setting_key)}
                      disabled={saving}
                      size="sm"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {settings.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">No bot settings found. Settings will appear here once configured.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};