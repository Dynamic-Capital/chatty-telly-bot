-- Create storage bucket for bot media
INSERT INTO storage.buckets (id, name, public) VALUES ('bot-media', 'bot-media', true);

-- Create media files table
CREATE TABLE public.media_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL,
  file_size bigint,
  caption text,
  uploaded_by text,
  telegram_file_id text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create broadcast messages table
CREATE TABLE public.broadcast_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text,
  media_file_id uuid REFERENCES public.media_files(id),
  target_audience jsonb DEFAULT '{"type": "all"}'::jsonb,
  scheduled_at timestamp with time zone,
  sent_at timestamp with time zone,
  delivery_status text DEFAULT 'draft',
  total_recipients integer DEFAULT 0,
  successful_deliveries integer DEFAULT 0,
  failed_deliveries integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.media_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for media files
CREATE POLICY "Bot can manage media files" 
ON public.media_files 
FOR ALL 
USING (true);

-- Create RLS policies for broadcast messages
CREATE POLICY "Bot can manage broadcast messages" 
ON public.broadcast_messages 
FOR ALL 
USING (true);

-- Create storage policies for bot-media bucket
CREATE POLICY "Bot can upload media" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'bot-media');

CREATE POLICY "Bot can view media" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'bot-media');

CREATE POLICY "Bot can update media" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'bot-media');

CREATE POLICY "Bot can delete media" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'bot-media');

-- Add indexes for better performance
CREATE INDEX idx_media_files_uploaded_by ON public.media_files(uploaded_by);
CREATE INDEX idx_media_files_created_at ON public.media_files(created_at DESC);
CREATE INDEX idx_broadcast_messages_status ON public.broadcast_messages(delivery_status);
CREATE INDEX idx_broadcast_messages_scheduled ON public.broadcast_messages(scheduled_at);

-- Add updated_at triggers
CREATE TRIGGER update_media_files_updated_at
  BEFORE UPDATE ON public.media_files
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_broadcast_messages_updated_at
  BEFORE UPDATE ON public.broadcast_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();