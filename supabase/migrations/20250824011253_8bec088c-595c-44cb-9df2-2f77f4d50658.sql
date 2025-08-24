-- Create miniapp storage bucket for serving the mini app files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('miniapp', 'miniapp', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for public access to miniapp files
CREATE POLICY "Public read access for miniapp files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'miniapp');

CREATE POLICY "Service role can manage miniapp files" 
ON storage.objects 
FOR ALL 
TO service_role
USING (bucket_id = 'miniapp');