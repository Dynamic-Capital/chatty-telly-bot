import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  BotIcon,
  CreditCard,
  FileText,
  Gift,
  Copy,
  HeadphonesIcon,
  MessageSquare,
  Package,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DashboardStats {
  totalUsers: number;
  vipMembers: number;
  totalRevenue: number;
  pendingPayments: number;
  lastUpdated: string;
}

const BotDashboard = () => {
  const [currentView, setCurrentView] = useState<
    "welcome" | "config" | "packages" | "support" | "analytics" | "promos"
  >("welcome");
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    vipMembers: 0,
    totalRevenue: 0,
    pendingPayments: 0,
    lastUpdated: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchBotStats();
    checkBotStatus();
  }, []);

  const fetchBotStats = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("analytics-data");

      if (error) throw error;

      setStats({
        totalUsers: data?.total_users || 0,
        vipMembers: data?.vip_users || 0,
        totalRevenue: data?.total_revenue || 0,
        pendingPayments: data?.pending_payments || 0,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching bot stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkBotStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke(
        "test-bot-status",
      );
      setIsConnected(!error && data?.bot_status?.includes("✅"));
    } catch (error) {
      console.error("Error checking bot status:", error);
      setIsConnected(false);
    }
  };

  const renderWelcomeScreen = () => (
    <div className="space-y-8">
      {/* Webhook Secret Missing Alert */}
      {!isConnected && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription>
            Bot appears to be offline. Please ensure TELEGRAM_WEBHOOK_SECRET is
            configured in your Supabase secrets.
          </AlertDescription>
        </Alert>
      )}

      {/* Welcome Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl shadow-lg">
          <BotIcon className="w-10 h-10 text-white" />
        </div>
        <div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Welcome to VIP Bot
          </h1>
          <p className="text-muted-foreground text-xl max-w-2xl mx-auto">
            Your premium Telegram bot for subscription management, payments, and
            customer support
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6 bg-gradient-to-br from-background to-muted border-0 shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Activity className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Bot Status</p>
              <div className="font-semibold">
                {loading
                  ? (
                    <Badge
                      variant="outline"
                      className="border-gray-500 text-gray-600"
                    >
                      Loading...
                    </Badge>
                  )
                  : isConnected
                  ? (
                    <Badge
                      variant="outline"
                      className="border-green-500 text-green-600"
                    >
                      Online
                    </Badge>
                  )
                  : (
                    <Badge
                      variant="outline"
                      className="border-orange-500 text-orange-600"
                    >
                      Offline
                    </Badge>
                  )}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-background to-muted border-0 shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Users</p>
              <p className="font-semibold text-2xl">
                {loading ? "..." : stats.totalUsers.toLocaleString()}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-background to-muted border-0 shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <CreditCard className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">VIP Members</p>
              <p className="font-semibold text-2xl">
                {loading ? "..." : stats.vipMembers.toLocaleString()}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-background to-muted border-0 shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <BarChart3 className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Revenue</p>
              <p className="font-semibold text-2xl">
                ${loading ? "..." : stats.totalRevenue.toLocaleString()}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Menu */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card
          className="p-8 bg-gradient-to-br from-background to-muted border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer group"
          onClick={() => setCurrentView("packages")}
        >
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/10 rounded-2xl group-hover:bg-blue-500/20 transition-colors">
              <Package className="w-8 h-8 text-blue-500" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">
                Subscription Packages
              </h3>
              <p className="text-muted-foreground">
                Manage VIP subscription plans, pricing, and features for your
                users
              </p>
            </div>
          </div>
        </Card>

        <Card
          className="p-8 bg-gradient-to-br from-background to-muted border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer group"
          onClick={() => setCurrentView("support")}
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
          className="p-8 bg-gradient-to-br from-background to-muted border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer group"
          onClick={() => setCurrentView("config")}
        >
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600/10 rounded-2xl group-hover:bg-blue-600/20 transition-colors">
              <Settings className="w-8 h-8 text-blue-600" />
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
          className="p-8 bg-gradient-to-br from-background to-muted border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer group"
          onClick={() => setCurrentView("analytics")}
        >
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-500/10 rounded-2xl group-hover:bg-purple-500/20 transition-colors">
              <BarChart3 className="w-8 h-8 text-purple-500" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2">
                Analytics & Reports
              </h3>
              <p className="text-muted-foreground">
                View detailed statistics, user engagement, and revenue reports
              </p>
            </div>
          </div>
        </Card>

        <Card
          className="p-8 bg-gradient-to-br from-background to-muted border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer group"
          onClick={() => setCurrentView("promos")}
        >
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

        <Card className="p-8 bg-gradient-to-br from-background to-muted border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer group">
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
      <Card className="p-6 bg-gradient-to-br from-background to-muted border-0 shadow-lg">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => window.open("/admin", "_blank")}
          >
            <FileText className="w-4 h-4" />
            View Admin Panel
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={checkBotStatus}
          >
            <Shield className="w-4 h-4" />
            Check Bot Status
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={fetchBotStats}
          >
            <Activity className="w-4 h-4" />
            Refresh Stats
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
          <p className="text-muted-foreground">
            Configure your bot settings and behavior
          </p>
        </div>
        <Button variant="outline" onClick={() => setCurrentView("welcome")}>
          Back to Dashboard
        </Button>
      </div>
      <div className="text-center p-8">
        <p className="text-muted-foreground">
          Bot settings configuration will be available here.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Please use the Admin dashboard for full settings management.
        </p>
      </div>
    </div>
  );

  const renderPackagesScreen = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Subscription Packages</h2>
          <p className="text-muted-foreground">
            Manage your VIP subscription plans
          </p>
        </div>
        <Button variant="outline" onClick={() => setCurrentView("welcome")}>
          Back to Dashboard
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            name: "1 Month VIP",
            price: "$9.99",
            duration: "1 month",
            popular: false,
          },
          {
            name: "3 Month VIP",
            price: "$24.99",
            duration: "3 months",
            popular: true,
          },
          {
            name: "6 Month VIP",
            price: "$44.99",
            duration: "6 months",
            popular: false,
          },
          {
            name: "Lifetime VIP",
            price: "$99.99",
            duration: "Lifetime",
            popular: false,
          },
        ].map((plan, index) => (
          <Card
            key={index}
            className="p-6 bg-gradient-to-br from-background to-muted border-0 shadow-lg relative"
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-blue-600 text-white">Most Popular</Badge>
              </div>
            )}
            <div className="text-center space-y-4">
              <div>
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                <p className="text-3xl font-bold text-blue-600">{plan.price}</p>
                <p className="text-muted-foreground">{plan.duration}</p>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>✓ Premium signals</p>
                <p>✓ VIP chat access</p>
                <p>✓ Priority support</p>
                <p>✓ Market analysis</p>
              </div>
              <Button variant="default" className="w-full">
                Edit Plan
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderAnalyticsScreen = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Revenue Analytics</h2>
          <p className="text-muted-foreground">
            Track revenue performance and package analytics
          </p>
        </div>
        <Button variant="outline" onClick={() => setCurrentView("welcome")}>
          Back to Dashboard
        </Button>
      </div>

      {/* Revenue Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 bg-gradient-to-br from-background to-muted border-0 shadow-lg">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">Today</p>
            <p className="text-2xl font-bold text-green-500">$1,240</p>
            <p className="text-xs text-muted-foreground">+12% vs yesterday</p>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-background to-muted border-0 shadow-lg">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">This Week</p>
            <p className="text-2xl font-bold text-blue-500">$8,650</p>
            <p className="text-xs text-muted-foreground">+8% vs last week</p>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-background to-muted border-0 shadow-lg">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">14 Days</p>
            <p className="text-2xl font-bold text-purple-500">$18,420</p>
            <p className="text-xs text-muted-foreground">+15% vs previous</p>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-background to-muted border-0 shadow-lg">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">This Month</p>
            <p className="text-2xl font-bold text-blue-600">$34,890</p>
            <p className="text-xs text-muted-foreground">+23% vs last month</p>
          </div>
        </Card>
      </div>

      {/* Package Performance */}
      <Card className="p-6 bg-gradient-to-br from-background to-muted border-0 shadow-lg">
        <h3 className="text-lg font-semibold mb-4">Package Performance</h3>
        <div className="space-y-4">
          {[
            {
              name: "1 Month VIP",
              sales: 156,
              revenue: "$1,540",
              percentage: 32,
              trend: "+8%",
            },
            {
              name: "3 Month VIP",
              sales: 89,
              revenue: "$2,225",
              percentage: 45,
              trend: "+15%",
            },
            {
              name: "12 Month VIP",
              sales: 34,
              revenue: "$1,632",
              percentage: 28,
              trend: "+12%",
            },
            {
              name: "Lifetime VIP",
              sales: 12,
              revenue: "$1,199",
              percentage: 18,
              trend: "+25%",
            },
          ].map((pkg, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-4 bg-background/50 rounded-lg"
            >
              <div className="flex items-center gap-4">
                <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                <div>
                  <p className="font-medium">{pkg.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {pkg.sales} sales
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold">{pkg.revenue}</p>
                <p className="text-sm text-green-500">{pkg.trend}</p>
              </div>
              <div className="w-24 bg-muted rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${pkg.percentage}%` }}
                >
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Revenue Chart Placeholder */}
      <Card className="p-6 bg-gradient-to-br from-background to-muted border-0 shadow-lg">
        <h3 className="text-lg font-semibold mb-4">
          Revenue Trend (Last 30 Days)
        </h3>
        <div className="h-64 bg-background/30 rounded-lg flex items-center justify-center">
          <p className="text-muted-foreground">
            Chart visualization would go here
          </p>
        </div>
      </Card>

      {/* Quick Analytics Actions */}
      <Card className="p-6 bg-gradient-to-br from-background to-muted border-0 shadow-lg">
        <h3 className="text-lg font-semibold mb-4">Analytics Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" size="sm" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Export Revenue Report
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Package className="w-4 h-4" />
            Package Performance Report
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Users className="w-4 h-4" />
            User Analytics
          </Button>
          <Button variant="default" size="sm" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            Edit via Telegram
          </Button>
        </div>
      </Card>
    </div>
  );

  const renderSupportScreen = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Customer Support</h2>
          <p className="text-muted-foreground">
            Manage user inquiries and support tickets
          </p>
        </div>
        <Button variant="outline" onClick={() => setCurrentView("welcome")}>
          Back to Dashboard
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 bg-gradient-to-br from-background to-muted border-0 shadow-lg">
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

        <Card className="p-6 bg-gradient-to-br from-background to-muted border-0 shadow-lg">
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

        <Card className="p-6 bg-gradient-to-br from-background to-muted border-0 shadow-lg">
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

      <Card className="p-6 bg-gradient-to-br from-background to-muted border-0 shadow-lg">
        <h3 className="text-lg font-semibold mb-4">Recent Support Requests</h3>
        <div className="space-y-4">
          {[
            {
              user: "John Doe",
              issue: "Payment not processed",
              status: "Open",
              time: "2 min ago",
            },
            {
              user: "Jane Smith",
              issue: "VIP access expired",
              status: "Pending",
              time: "15 min ago",
            },
            {
              user: "Mike Johnson",
              issue: "Cannot access premium signals",
              status: "Resolved",
              time: "1 hour ago",
            },
          ].map((ticket, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {ticket.user.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <p className="font-medium">{ticket.user}</p>
                  <p className="text-sm text-muted-foreground">
                    {ticket.issue}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <Badge
                  variant="outline"
                  className={ticket.status === "Open"
                    ? "border-red-500 text-red-600"
                    : ticket.status === "Pending"
                    ? "border-yellow-500 text-yellow-600"
                    : "border-green-500 text-green-600"}
                >
                  {ticket.status}
                </Badge>
                <p className="text-sm text-muted-foreground mt-1">
                  {ticket.time}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  const renderPromosScreen = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Promo Codes Management</h2>
          <p className="text-muted-foreground">
            Create and manage discount codes for your users
          </p>
        </div>
        <Button variant="outline" onClick={() => setCurrentView("welcome")}>
          Back to Dashboard
        </Button>
      </div>

      {/* Active Launch Promo */}
      <Card className="p-6 bg-gradient-to-br from-background to-muted border-0 shadow-lg border-l-4 border-l-green-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/10 rounded-lg">
              <Gift className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-green-600">
                🚀 VIP Bot Launch Special!
              </h3>
              <p className="text-muted-foreground">
                VIPBOTLAUNCH50 - 50% OFF Lifetime Access
              </p>
              <div className="flex items-center gap-4 mt-2">
                <Badge className="bg-green-500 text-white">ACTIVE</Badge>
                <span className="text-sm text-muted-foreground">
                  Valid for 30 days • 0/100 uses
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <Button variant="outline" size="sm" className="mr-2">
              Edit
            </Button>
            <Button variant="destructive" size="sm">
              Disable
            </Button>
          </div>
        </div>
      </Card>

      {/* Promo Codes List */}
      <Card className="p-6 bg-gradient-to-br from-background to-muted border-0 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">All Promo Codes</h3>
          <Button variant="default" className="gap-2">
            <Gift className="w-4 h-4" />
            Create New Promo
          </Button>
        </div>

        <div className="space-y-4">
          {[
            {
              code: "VIPBOTLAUNCH50",
              description: "VIP Bot Launch - 50% OFF Lifetime",
              discount: "50%",
              type: "Percentage",
              uses: "0/100",
              status: "Active",
              expires: "30 days",
            },
            {
              code: "WELCOME20",
              description: "Welcome discount for new users",
              discount: "20%",
              type: "Percentage",
              uses: "45/500",
              status: "Disabled",
              expires: "60 days",
            },
            {
              code: "SUMMER25",
              description: "Summer special offer",
              discount: "$25",
              type: "Fixed",
              uses: "123/200",
              status: "Disabled",
              expires: "Expired",
            },
          ].map((promo, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <Gift className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-mono font-semibold">{promo.code}</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      aria-label={`Copy promo code ${promo.code}`}
                      title="Copy code"
                      onClick={async () => {
                        await navigator.clipboard.writeText(promo.code);
                        toast({ description: "Promo code copied" });
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Badge
                      variant="outline"
                      className={
                        promo.status === "Active"
                          ? "border-green-500 text-green-600"
                          : promo.status === "Disabled"
                          ? "border-orange-500 text-orange-600"
                          : "border-red-500 text-red-600"
                      }
                    >
                      {promo.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {promo.description}
                  </p>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    <span>{promo.discount} {promo.type}</span>
                    <span>Uses: {promo.uses}</span>
                    <span>Expires: {promo.expires}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  {promo.status === "Active" ? "Disable" : "Enable"}
                </Button>
                <Button variant="outline" size="sm">
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Promo Performance */}
      <Card className="p-6 bg-gradient-to-br from-background to-muted border-0 shadow-lg">
        <h3 className="text-lg font-semibold mb-4">Promo Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-background/50 rounded-lg">
            <p className="text-2xl font-bold text-green-500">$2,450</p>
            <p className="text-sm text-muted-foreground">Revenue from promos</p>
          </div>
          <div className="text-center p-4 bg-background/50 rounded-lg">
            <p className="text-2xl font-bold text-blue-500">168</p>
            <p className="text-sm text-muted-foreground">Total redemptions</p>
          </div>
          <div className="text-center p-4 bg-background/50 rounded-lg">
            <p className="text-2xl font-bold text-purple-500">23%</p>
            <p className="text-sm text-muted-foreground">Conversion rate</p>
          </div>
        </div>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-accent/10 p-6">
      <div className="max-w-7xl mx-auto">
        {currentView === "welcome" && renderWelcomeScreen()}
        {currentView === "config" && renderConfigScreen()}
        {currentView === "packages" && renderPackagesScreen()}
        {currentView === "support" && renderSupportScreen()}
        {currentView === "analytics" && renderAnalyticsScreen()}
        {currentView === "promos" && renderPromosScreen()}
      </div>
    </div>
  );
};

export default BotDashboard;
