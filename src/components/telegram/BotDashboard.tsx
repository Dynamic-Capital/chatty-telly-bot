import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BotIcon, SendIcon, Settings, Activity, MessageSquare, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BotDashboard = () => {
  const [botToken, setBotToken] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [message, setMessage] = useState("");
  const { toast } = useToast();

  const handleConnect = () => {
    if (!botToken.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid bot token",
        variant: "destructive",
      });
      return;
    }
    setIsConnected(true);
    toast({
      title: "Bot Connected",
      description: "Your Telegram bot is now active!",
    });
  };

  const handleSendMessage = () => {
    if (!message.trim()) {
      toast({
        title: "Error",
        description: "Please enter a message to send",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Message Sent",
      description: "Your message has been sent to all subscribers",
    });
    setMessage("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-accent/10 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-telegram rounded-2xl shadow-telegram">
            <BotIcon className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-telegram bg-clip-text text-transparent">
              Telegram Bot Dashboard
            </h1>
            <p className="text-muted-foreground text-lg">
              Manage your Telegram bot with ease
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6 bg-gradient-card border-0 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-telegram/10 rounded-lg">
                <Activity className="w-5 h-5 text-telegram" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="font-semibold">
                  {isConnected ? (
                    <Badge variant="outline" className="border-green-500 text-green-600">Active</Badge>
                  ) : (
                    <Badge variant="outline" className="border-orange-500 text-orange-600">Disconnected</Badge>
                  )}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-card border-0 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-telegram/10 rounded-lg">
                <Users className="w-5 h-5 text-telegram" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Subscribers</p>
                <p className="font-semibold text-2xl">1,247</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-card border-0 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-telegram/10 rounded-lg">
                <MessageSquare className="w-5 h-5 text-telegram" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Messages Today</p>
                <p className="font-semibold text-2xl">89</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-card border-0 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-telegram/10 rounded-lg">
                <SendIcon className="w-5 h-5 text-telegram" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sent Today</p>
                <p className="font-semibold text-2xl">156</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bot Configuration */}
          <Card className="p-6 bg-gradient-card border-0 shadow-lg">
            <div className="flex items-center gap-2 mb-6">
              <Settings className="w-5 h-5 text-telegram" />
              <h2 className="text-xl font-semibold">Bot Configuration</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="token">Bot Token</Label>
                <Input
                  id="token"
                  type="password"
                  placeholder="Enter your bot token..."
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  className="mt-1"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Get your token from @BotFather on Telegram
                </p>
              </div>
              
              <Button 
                onClick={handleConnect}
                variant="telegram"
                className="w-full"
                disabled={isConnected}
              >
                {isConnected ? "Connected" : "Connect Bot"}
              </Button>
            </div>
          </Card>

          {/* Send Message */}
          <Card className="p-6 bg-gradient-card border-0 shadow-lg">
            <div className="flex items-center gap-2 mb-6">
              <SendIcon className="w-5 h-5 text-telegram" />
              <h2 className="text-xl font-semibold">Send Message</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="message">Message</Label>
                <textarea
                  id="message"
                  placeholder="Type your message here..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full min-h-[120px] px-3 py-2 border border-input rounded-md bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>
              
              <Button 
                onClick={handleSendMessage}
                variant="telegram"
                className="w-full"
                disabled={!isConnected}
              >
                <SendIcon className="w-4 h-4" />
                Send to All Subscribers
              </Button>
            </div>
          </Card>
        </div>

        {/* Recent Messages */}
        <Card className="p-6 bg-gradient-card border-0 shadow-lg">
          <div className="flex items-center gap-2 mb-6">
            <MessageSquare className="w-5 h-5 text-telegram" />
            <h2 className="text-xl font-semibold">Recent Messages</h2>
          </div>
          
          <div className="space-y-4">
            {[
              { user: "John Doe", message: "Hello, how can I get started?", time: "2 minutes ago" },
              { user: "Jane Smith", message: "Thank you for the update!", time: "15 minutes ago" },
              { user: "Mike Johnson", message: "/start", time: "1 hour ago" },
            ].map((msg, index) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <div className="w-8 h-8 bg-telegram rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {msg.user.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{msg.user}</span>
                    <span className="text-sm text-muted-foreground">{msg.time}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{msg.message}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default BotDashboard;