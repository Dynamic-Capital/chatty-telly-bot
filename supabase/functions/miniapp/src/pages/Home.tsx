import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { CreditCard, Users, TrendingUp, Star } from "lucide-react";
import TopBar from "../components/TopBar";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <TopBar title="Dynamic Capital VIP" />
      
      {/* Header */}
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary via-green-400 to-blue-400 bg-clip-text text-transparent">
            Welcome to VIP
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto">
            Access premium trading signals, market analysis, and exclusive investment opportunities.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 mb-8">
          <Link to="/bank">
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur hover:bg-slate-800/70 transition-colors">
              <CardHeader className="text-center">
                <div className="flex items-center justify-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <CardTitle className="text-white">Bank Deposit</CardTitle>
                </div>
                <CardDescription className="text-slate-400">
                  Make a payment via bank transfer
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
          
          <Link to="/crypto">
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur hover:bg-slate-800/70 transition-colors">
              <CardHeader className="text-center">
                <div className="flex items-center justify-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <CardTitle className="text-white">Crypto Deposit</CardTitle>
                </div>
                <CardDescription className="text-slate-400">
                  Pay with cryptocurrency
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
          
          <Link to="/me">
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur hover:bg-slate-800/70 transition-colors">
              <CardHeader className="text-center">
                <div className="flex items-center justify-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <CardTitle className="text-white">My Account</CardTitle>
                </div>
                <CardDescription className="text-slate-400">
                  View receipts and subscription status
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>

        {/* Features */}
        <Card className="bg-gradient-to-r from-primary/20 to-blue-500/20 border-primary/30 backdrop-blur">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-white mb-2">
              VIP Benefits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Star className="h-5 w-5 text-yellow-400" />
              <span className="text-slate-300">Exclusive trading signals</span>
            </div>
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-green-400" />
              <span className="text-slate-300">Daily market analysis</span>
            </div>
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-blue-400" />
              <span className="text-slate-300">Private VIP community</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
