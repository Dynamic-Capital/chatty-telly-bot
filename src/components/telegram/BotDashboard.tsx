import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  BotIcon, 
  SendIcon, 
  Settings, 
  Activity, 
  MessageSquare, 
  Users, 
  Package, 
  HeadphonesIcon, 
  Gift, 
  CreditCard,
  BarChart3,
  Shield,
  Bell,
  FileText
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BotDashboard = () => {
  const [currentView, setCurrentView] = useState<'welcome' | 'config' | 'packages' | 'support' | 'analytics'>('welcome');
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

  const renderWelcomeScreen = () => (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-telegram rounded-3xl shadow-telegram">
          <BotIcon className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-5xl font-bold bg-gradient-telegram bg-clip-text text-transparent mb-2">
            Welcome to VIP Bot
          </h1>
          <p className="text-muted-foreground text-xl max-w-2xl mx-auto">
            Your premium Telegram bot for subscription management, payments, and customer support
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6 bg-gradient-card border-0 shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-telegram/10 rounded-lg">
              <Activity className="w-5 h-5 text-telegram" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Bot Status</p>
              <div className="font-semibold">
                {isConnected ? (
                  <Badge variant="outline" className="border-green-500 text-green-600">Online</Badge>
                ) : (
                  <Badge variant="outline" className="border-orange-500 text-orange-600">Offline</Badge>
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-card border-0 shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Users</p>
              <p className="font-semibold text-2xl">1,247</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-card border-0 shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <CreditCard className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">VIP Members</p>
              <p className="font-semibold text-2xl">298</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-card border-0 shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <BarChart3 className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Revenue</p>
              <p className="font-semibold text-2xl">$12.4K</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Menu */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card 
          className="p-8 bg-gradient-card border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer group"
          onClick={() => setCurrentView('packages')}
        >
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/10 rounded-2xl group-hover:bg-blue-500/20 transition-colors">
              <Package className="w-8 h-8 text-blue-500" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Subscription Packages</h3>
              <p className="text-muted-foreground">
                Manage VIP subscription plans, pricing, and features for your users
              </p>
            </div>
          </div>
        </Card>

        <Card 
          className="p-8 bg-gradient-card border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer group"
          onClick={() => setCurrentView('support')}
        >
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/10 rounded-2xl group-hover:bg-green-500/20 transition-colors">
              <HeadphonesIcon className="w-8 h-8 text-green-500" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Customer Support</h3>
              <p className="text-muted-foreground">
                Handle user inquiries, manage tickets, and provide assistance
              </p>
            </div>
          </div>
        </Card>

        <Card 
          className="p-8 bg-gradient-card border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer group"
          onClick={() => setCurrentView('config')}
        >
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-telegram/10 rounded-2xl group-hover:bg-telegram/20 transition-colors">
              <Settings className="w-8 h-8 text-telegram" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Bot Configuration</h3>
              <p className="text-muted-foreground">
                Set up your bot token, webhooks, and essential settings
              </p>
            </div>
          </div>
        </Card>

        <Card 
          className="p-8 bg-gradient-card border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer group"
          onClick={() => setCurrentView('analytics')}
        >
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-500/10 rounded-2xl group-hover:bg-purple-500/20 transition-colors">
              <BarChart3 className="w-8 h-8 text-purple-500" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Analytics & Reports</h3>
              <p className="text-muted-foreground">
                View detailed statistics, user engagement, and revenue reports
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-8 bg-gradient-card border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer group">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-500/10 rounded-2xl group-hover:bg-orange-500/20 transition-colors">
              <Gift className="w-8 h-8 text-orange-500" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Promo Codes</h3>
              <p className="text-muted-foreground">
                Create and manage discount codes and promotional campaigns
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-8 bg-gradient-card border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer group">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/10 rounded-2xl group-hover:bg-red-500/20 transition-colors">
              <Bell className="w-8 h-8 text-red-500" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">Notifications</h3>
              <p className="text-muted-foreground">
                Send announcements and updates to your subscribers
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="p-6 bg-gradient-card border-0 shadow-lg">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" size="sm" className="gap-2">
            <FileText className="w-4 h-4" />
            View Logs
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Shield className="w-4 h-4" />
            Security Settings
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            Broadcast Message
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Users className="w-4 h-4" />
            User Management
          </Button>
        </div>
      </Card>
    </div>
  );

  const renderConfigScreen = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Bot Configuration</h2>
          <p className="text-muted-foreground">Set up your Telegram bot settings</p>
        </div>
        <Button variant="outline" onClick={() => setCurrentView('welcome')}>
          Back to Dashboard
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 bg-gradient-card border-0 shadow-lg">
          <div className="flex items-center gap-2 mb-6">
            <Settings className="w-5 h-5 text-telegram" />
            <h3 className="text-xl font-semibold">Bot Token</h3>
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

        <Card className="p-6 bg-gradient-card border-0 shadow-lg">
          <div className="flex items-center gap-2 mb-6">
            <SendIcon className="w-5 h-5 text-telegram" />
            <h3 className="text-xl font-semibold">Send Message</h3>
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
    </div>
  );

  const renderPackagesScreen = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Subscription Packages</h2>
          <p className="text-muted-foreground">Manage your VIP subscription plans</p>
        </div>
        <Button variant="outline" onClick={() => setCurrentView('welcome')}>
          Back to Dashboard
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { name: "1 Month VIP", price: "$9.99", duration: "1 month", popular: false },
          { name: "3 Month VIP", price: "$24.99", duration: "3 months", popular: true },
          { name: "6 Month VIP", price: "$44.99", duration: "6 months", popular: false },
          { name: "Lifetime VIP", price: "$99.99", duration: "Lifetime", popular: false },
        ].map((plan, index) => (
          <Card key={index} className="p-6 bg-gradient-card border-0 shadow-lg relative">
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-telegram text-white">Most Popular</Badge>
              </div>
            )}
            <div className="text-center space-y-4">
              <div>
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                <p className="text-3xl font-bold text-telegram">{plan.price}</p>
                <p className="text-muted-foreground">{plan.duration}</p>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>✓ Premium signals</p>
                <p>✓ VIP chat access</p>
                <p>✓ Priority support</p>
                <p>✓ Market analysis</p>
              </div>
              <Button variant="telegram" className="w-full">
                Edit Plan
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderSupportScreen = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Customer Support</h2>
          <p className="text-muted-foreground">Manage user inquiries and support tickets</p>
        </div>
        <Button variant="outline" onClick={() => setCurrentView('welcome')}>
          Back to Dashboard
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 bg-gradient-card border-0 shadow-lg">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-red-500/10 rounded-lg">
              <MessageSquare className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">12</p>
              <p className="text-sm text-muted-foreground">Open Tickets</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-card border-0 shadow-lg">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-yellow-500/10 rounded-lg">
              <MessageSquare className="w-6 h-6 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">8</p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-card border-0 shadow-lg">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-500/10 rounded-lg">
              <MessageSquare className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">156</p>
              <p className="text-sm text-muted-foreground">Resolved Today</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6 bg-gradient-card border-0 shadow-lg">
        <h3 className="text-lg font-semibold mb-4">Recent Support Requests</h3>
        <div className="space-y-4">
          {[
            { user: "John Doe", issue: "Payment not processed", status: "Open", time: "2 min ago" },
            { user: "Jane Smith", issue: "VIP access expired", status: "Pending", time: "15 min ago" },
            { user: "Mike Johnson", issue: "Cannot access premium signals", status: "Resolved", time: "1 hour ago" },
          ].map((ticket, index) => (
            <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-telegram rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {ticket.user.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <p className="font-medium">{ticket.user}</p>
                  <p className="text-sm text-muted-foreground">{ticket.issue}</p>
                </div>
              </div>
              <div className="text-right">
                <Badge 
                  variant="outline" 
                  className={
                    ticket.status === 'Open' ? 'border-red-500 text-red-600' :
                    ticket.status === 'Pending' ? 'border-yellow-500 text-yellow-600' :
                    'border-green-500 text-green-600'
                  }
                >
                  {ticket.status}
                </Badge>
                <p className="text-sm text-muted-foreground mt-1">{ticket.time}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-accent/10 p-6">
      <div className="max-w-7xl mx-auto">
        {currentView === 'welcome' && renderWelcomeScreen()}
        {currentView === 'config' && renderConfigScreen()}
        {currentView === 'packages' && renderPackagesScreen()}
        {currentView === 'support' && renderSupportScreen()}
      </div>
    </div>
  );
};

export default BotDashboard;