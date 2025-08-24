import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

export default function UploadMiniApp() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<string>('');

  const uploadHtml = async () => {
    setUploading(true);
    setResult('');
    
    try {
      const { data, error } = await supabase.functions.invoke('upload-miniapp-html');
      
      if (error) {
        setResult(`Error: ${error.message}`);
      } else {
        setResult(`Success: ${JSON.stringify(data, null, 2)}`);
      }
    } catch (err) {
      setResult(`Error: ${err}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Mini App HTML</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={uploadHtml} 
            disabled={uploading}
            className="w-full"
          >
            {uploading ? 'Uploading...' : 'Upload Mini App HTML to Storage'}
          </Button>
          
          {result && (
            <div className="p-4 bg-muted rounded-lg">
              <pre className="text-sm whitespace-pre-wrap">{result}</pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}