import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Bot, 
  Zap, 
  DollarSign, 
  GraduationCap, 
  MessageSquare,
  TrendingUp,
  Shield,
  Clock,
  Users,
  Star
} from 'lucide-react';

export const WelcomeMessage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/80 to-primary/5">
      <div className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
            <Bot className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent mb-4">
            AI Trading Assistant
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Your intelligent trading companion powered by cutting-edge AI technology. 
            Get real-time market analysis, trading signals, and education all in one place.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            <Badge variant="secondary" className="text-sm px-3 py-1">
              <Zap className="w-3 h-3 mr-1" />
              Real-time Analysis
            </Badge>
            <Badge variant="secondary" className="text-sm px-3 py-1">
              <Shield className="w-3 h-3 mr-1" />
              24/7 Support
            </Badge>
            <Badge variant="secondary" className="text-sm px-3 py-1">
              <Star className="w-3 h-3 mr-1" />
              Expert Insights
            </Badge>
          </div>
          <Button size="lg" className="mr-4">
            Start Trading Journey
          </Button>
          <Button size="lg" variant="outline">
            View Demo
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4">
                <MessageSquare className="w-6 h-6 text-blue-500" />
              </div>
              <CardTitle>AI Chat Assistant</CardTitle>
              <CardDescription>
                Get instant answers to your trading questions from our advanced AI trained on market data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Real-time market analysis</li>
                <li>• Trading strategy recommendations</li>
                <li>• Risk management advice</li>
                <li>• 24/7 availability</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-green-500" />
              </div>
              <CardTitle>Trading Tools</CardTitle>
              <CardDescription>
                Advanced tools and real-time data to help you make informed trading decisions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Live cryptocurrency prices</li>
                <li>• Market trend analysis</li>
                <li>• Portfolio tracking</li>
                <li>• Risk calculators</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4">
                <GraduationCap className="w-6 h-6 text-purple-500" />
              </div>
              <CardTitle>Education Hub</CardTitle>
              <CardDescription>
                Comprehensive trading education from beginner basics to advanced strategies
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Structured learning paths</li>
                <li>• Expert-led courses</li>
                <li>• Practical exercises</li>
                <li>• Certification programs</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-orange-500/10 flex items-center justify-center mb-4">
                <DollarSign className="w-6 h-6 text-orange-500" />
              </div>
              <CardTitle>VIP Subscriptions</CardTitle>
              <CardDescription>
                Unlock premium features and exclusive content with our VIP membership plans
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Premium signals</li>
                <li>• Exclusive market insights</li>
                <li>• Priority support</li>
                <li>• Advanced analytics</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-red-500/10 flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 text-red-500" />
              </div>
              <CardTitle>Real-time Alerts</CardTitle>
              <CardDescription>
                Never miss important market movements with our intelligent alert system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Price alerts</li>
                <li>• Trend notifications</li>
                <li>• News updates</li>
                <li>• Custom triggers</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-teal-500/10 flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-teal-500" />
              </div>
              <CardTitle>Community</CardTitle>
              <CardDescription>
                Join thousands of traders in our active community for discussions and insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Trading discussions</li>
                <li>• Strategy sharing</li>
                <li>• Expert AMAs</li>
                <li>• Networking events</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Pricing Section */}
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">Choose Your Plan</h2>
          <p className="text-muted-foreground mb-8">
            Start with our free plan or upgrade to unlock premium features
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="relative">
              <CardHeader>
                <CardTitle>Free Plan</CardTitle>
                <div className="text-3xl font-bold">$0<span className="text-sm font-normal">/month</span></div>
                <CardDescription>Perfect for getting started</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  <li>✓ 10 AI chat messages/hour</li>
                  <li>✓ Basic market data</li>
                  <li>✓ Educational content</li>
                  <li>✓ Community access</li>
                </ul>
                <Button className="w-full" variant="outline">Get Started</Button>
              </CardContent>
            </Card>

            <Card className="relative border-2 border-primary">
              <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
              </div>
              <CardHeader>
                <CardTitle>VIP Monthly</CardTitle>
                <div className="text-3xl font-bold">$49<span className="text-sm font-normal">/month</span></div>
                <CardDescription>Best for active traders</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  <li>✓ Unlimited AI chat</li>
                  <li>✓ Premium signals</li>
                  <li>✓ Advanced analytics</li>
                  <li>✓ Priority support</li>
                  <li>✓ Exclusive content</li>
                </ul>
                <Button className="w-full">Upgrade Now</Button>
              </CardContent>
            </Card>

            <Card className="relative">
              <CardHeader>
                <CardTitle>Lifetime VIP</CardTitle>
                <div className="text-3xl font-bold">$999<span className="text-sm font-normal"> once</span></div>
                <CardDescription>Best value for serious traders</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  <li>✓ Everything in VIP Monthly</li>
                  <li>✓ Lifetime access</li>
                  <li>✓ All future features</li>
                  <li>✓ 1-on-1 consultations</li>
                  <li>✓ Custom strategies</li>
                </ul>
                <Button className="w-full" variant="outline">Get Lifetime</Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl p-12">
          <h2 className="text-3xl font-bold mb-4">Ready to Start Trading Smarter?</h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of traders who are already using our AI assistant to make better trading decisions. 
            Start your free trial today!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-8">
              <Bot className="w-5 h-5 mr-2" />
              Start with Telegram Bot
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8">
              Learn More
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};