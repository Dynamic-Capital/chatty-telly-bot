import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Eye,
  Info,
  Loader2,
  MessageSquare,
  RotateCcw,
  Save,
  Sparkles,
} from "lucide-react";

interface WelcomeContent {
  id: string;
  content_key: string;
  content_value: string;
  content_type: string;
  description: string;
  is_active: boolean;
  updated_at: string;
  last_modified_by: string;
}

export const WelcomeMessageEditor = () => {
  const [welcomeMessage, setWelcomeMessage] = useState<WelcomeContent | null>(
    null,
  );
  const [editedMessage, setEditedMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const { toast } = useToast();

  const fetchWelcomeMessage = async () => {
    try {
      setLoading(true);
      console.log("Fetching welcome message from database...");

      const { data, error } = await supabase
        .from("bot_content")
        .select("*")
        .eq("content_key", "welcome_message")
        .single();

      if (error) {
        console.error("Error fetching welcome message:", error);

        // Create default welcome message if it doesn't exist
        if (error.code === "PGRST116") {
          console.log("Welcome message not found, creating default...");
          await createDefaultWelcomeMessage();
        } else {
          toast({
            title: "Error",
            description: `Failed to load welcome message: ${error.message}`,
            variant: "destructive",
          });
        }
        return;
      }

      console.log("Welcome message loaded successfully:", data);
      setWelcomeMessage(data);
      setEditedMessage(data.content_value);
    } catch (error) {
      console.error("Error in fetchWelcomeMessage:", error);
      toast({
        title: "Error",
        description: "Failed to load welcome message",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWelcomeMessage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createDefaultWelcomeMessage = async () => {
    const defaultMessage = `🎯 Welcome to Dynamic Capital VIP Bot!

📈 Get premium trading signals & education
💎 Join our VIP community

👇 Choose what you need:`;

    try {
      console.log("Creating default welcome message...");

      const { data, error } = await supabase
        .from("bot_content")
        .insert({
          content_key: "welcome_message",
          content_value: defaultMessage,
          content_type: "text",
          description: "Main welcome message shown on /start",
          is_active: true,
          created_by: "admin",
          last_modified_by: "admin",
        })
        .select()
        .single();

      if (error) throw error;

      console.log("Default welcome message created:", data);
      setWelcomeMessage(data);
      setEditedMessage(data.content_value);

      toast({
        title: "Default Created",
        description: "Default welcome message has been created",
      });
    } catch (error) {
      console.error("Error creating default welcome message:", error);
      toast({
        title: "Error",
        description: "Failed to create default welcome message",
        variant: "destructive",
      });
    }
  };

  const saveWelcomeMessage = async () => {
    if (!welcomeMessage) return;

    try {
      setSaving(true);
      console.log("Saving welcome message...", {
        id: welcomeMessage.id,
        content: editedMessage,
      });

      const { error } = await supabase
        .from("bot_content")
        .update({
          content_value: editedMessage,
          last_modified_by: "admin",
          updated_at: new Date().toISOString(),
        })
        .eq("id", welcomeMessage.id);

      if (error) throw error;

      console.log("Welcome message saved successfully");
      setWelcomeMessage((prev) =>
        prev
          ? {
            ...prev,
            content_value: editedMessage,
            updated_at: new Date().toISOString(),
            last_modified_by: "admin",
          }
          : null
      );

      toast({
        title: "Success",
        description: "Welcome message updated successfully!",
      });
    } catch (error) {
      console.error("Error saving welcome message:", error);
      toast({
        title: "Error",
        description: `Failed to save welcome message: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const resetToOriginal = () => {
    if (welcomeMessage) {
      setEditedMessage(welcomeMessage.content_value);
      toast({
        title: "Reset",
        description: "Message reset to original content",
      });
    }
  };

  const applyTemplate = (template: string) => {
    setEditedMessage(template);
    toast({
      title: "Template Applied",
      description: "Template has been loaded into the editor",
    });
  };

  const templates = [
    {
      name: "Professional",
      content: `🏢 Welcome to Dynamic Capital VIP!

📊 Professional trading signals & analysis
💎 Join our exclusive VIP community
🎓 Access premium education resources

👇 Select your option:`,
    },
    {
      name: "Friendly",
      content: `👋 Hey there! Welcome to Dynamic Capital VIP!

🚀 Ready to level up your trading game?
💰 Get premium signals & expert guidance
🎯 Join thousands of successful traders

What would you like to do? 👇`,
    },
    {
      name: "Simple",
      content: `🎯 Welcome to Dynamic Capital VIP Bot!

📈 Premium trading signals
💎 VIP community access
🎓 Trading education

Choose an option below:`,
    },
  ];

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
        <MessageSquare className="h-6 w-6" />
        <h2 className="text-2xl font-bold">Welcome Message Editor</h2>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          This message is shown to users when they first interact with your
          Telegram bot using the /start command.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editor Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Edit Welcome Message
            </CardTitle>
            <CardDescription>
              Customize the first message users see when they start your bot
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Message Content</label>
              <Textarea
                value={editedMessage}
                onChange={(e) => setEditedMessage(e.target.value)}
                placeholder="Enter your welcome message..."
                className="min-h-[200px] font-mono text-sm"
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground">
                Use emojis and line breaks to make your message engaging.
                Telegram supports basic formatting.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={saveWelcomeMessage}
                disabled={saving || !editedMessage.trim()}
                className="flex-1"
              >
                {saving
                  ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  : <Save className="h-4 w-4 mr-2" />}
                Save Changes
              </Button>
              <Button
                variant="outline"
                onClick={resetToOriginal}
                disabled={saving}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
              <Button
                variant="outline"
                onClick={() => setPreviewMode(!previewMode)}
                disabled={saving}
              >
                <Eye className="h-4 w-4 mr-2" />
                {previewMode ? "Edit" : "Preview"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview/Templates Section */}
        <Card>
          <CardHeader>
            <CardTitle>
              {previewMode ? "Message Preview" : "Quick Templates"}
            </CardTitle>
            <CardDescription>
              {previewMode
                ? "How your message will appear to users"
                : "Choose from pre-made templates"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {previewMode
              ? (
                <div className="space-y-4">
                  <div className="bg-telegram/10 border border-telegram/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 bg-telegram rounded-full flex items-center justify-center text-white text-sm">
                        🤖
                      </div>
                      <span className="font-medium">
                        Dynamic Capital VIP Bot
                      </span>
                    </div>
                    <div className="whitespace-pre-wrap text-sm bg-white rounded-lg p-3 shadow-sm">
                      {editedMessage || "Enter a message to see preview..."}
                    </div>
                  </div>

                  {welcomeMessage && (
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>
                        <strong>Last updated:</strong>{" "}
                        {new Date(welcomeMessage.updated_at).toLocaleString()}
                      </p>
                      <p>
                        <strong>Modified by:</strong>{" "}
                        {welcomeMessage.last_modified_by}
                      </p>
                      <p>
                        <strong>Status:</strong>
                        <Badge
                          variant={welcomeMessage.is_active
                            ? "default"
                            : "secondary"}
                          className="ml-1"
                        >
                          {welcomeMessage.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </p>
                    </div>
                  )}
                </div>
              )
              : (
                <div className="space-y-3">
                  {templates.map((template, index) => (
                    <div key={index} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{template.name}</h4>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            applyTemplate(template.content)}
                          disabled={saving}
                        >
                          Use Template
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted/50 rounded p-2">
                        {template.content}
                      </div>
                    </div>
                  ))}

                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-medium text-blue-800 mb-2">
                      💡 Template Usage
                    </h4>
                    <p className="text-sm text-blue-700">
                      Click "Use Template" to load any template into the editor.
                      You can then customize it further before saving.
                    </p>
                  </div>
                </div>
              )}
          </CardContent>
        </Card>
      </div>

      {/* Tips Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">💡 Writing Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">✅ Best Practices:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Keep it short and engaging</li>
                <li>• Use emojis to add personality</li>
                <li>• Clearly state what you offer</li>
                <li>• Include a call-to-action</li>
                <li>• Test with different user types</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">🎯 Key Elements:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Greeting (Welcome/Hello)</li>
                <li>• Value proposition (What you offer)</li>
                <li>• Social proof (Community size)</li>
                <li>• Next steps (Choose option below)</li>
                <li>• Professional but friendly tone</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
