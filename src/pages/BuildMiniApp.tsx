import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function BuildMiniApp() {
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildLog, setBuildLog] = useState<string>("");
  const { toast } = useToast();

  const buildMiniApp = async () => {
    setIsBuilding(true);
    setBuildLog("Starting build process...\n");
    
    try {
      const { data, error } = await supabase.functions.invoke('build-miniapp', {
        body: {}
      });
      
      if (error) {
        throw error;
      }
      
      if (data.success) {
        setBuildLog(prev => prev + "\n✅ Build completed successfully!\n");
        setBuildLog(prev => prev + "Build output:\n" + data.buildOutput + "\n");
        setBuildLog(prev => prev + "Sync output:\n" + data.syncOutput + "\n");
        
        toast({
          title: "Build Successful",
          description: "Mini app has been built and deployed to the static directory.",
        });
      } else {
        setBuildLog(prev => prev + "\n❌ Build failed: " + data.error + "\n");
        toast({
          title: "Build Failed",
          description: data.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Build error:", error);
      setBuildLog(prev => prev + "\n❌ Error: " + error.message + "\n");
      toast({
        title: "Build Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsBuilding(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Build Mini App</CardTitle>
          <CardDescription>
            Build and deploy the Telegram Mini App to the static directory.
            This will make the React app available at the miniapp endpoint.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={buildMiniApp} 
            disabled={isBuilding}
            className="w-full"
          >
            {isBuilding ? "Building..." : "Build Mini App"}
          </Button>
          
          {buildLog && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Build Log</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-4 rounded overflow-auto max-h-96 whitespace-pre-wrap">
                  {buildLog}
                </pre>
              </CardContent>
            </Card>
          )}
          
          <div className="text-sm text-muted-foreground">
            <p><strong>What this does:</strong></p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Builds the React app in the <code>miniapp/</code> directory using Vite</li>
              <li>Syncs the built files to <code>supabase/functions/miniapp/static/</code></li>
              <li>Makes the mini app available at the <code>/miniapp/</code> endpoint</li>
              <li>Allows serving from React build instead of storage bucket</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}