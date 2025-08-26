import BotDashboard from "@/components/telegram/BotDashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>🚨 Fix Mini App</CardTitle>
          <CardDescription>
            Your mini app is showing old debug content instead of the coming soon page
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={() => navigate('/build-miniapp')} 
            className="w-full"
            size="lg"
          >
            Build Mini App (Fix Coming Soon Page)
          </Button>
        </CardContent>
      </Card>
      <BotDashboard />
    </div>
  );
};

export default Index;
