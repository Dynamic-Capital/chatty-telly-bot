-- Fix security issues from the linter

-- Fix search_path issues for functions that don't have it set
ALTER FUNCTION public.add_admin(text, text) SET search_path = '';
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';

-- Add RLS policies for bot_content table
ALTER TABLE public.bot_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage bot content" 
ON public.bot_content 
FOR ALL 
TO service_role 
USING (true);

CREATE POLICY "Anyone can view active bot content" 
ON public.bot_content 
FOR SELECT 
USING (is_active = true);

-- Add RLS policies for bot_settings table  
ALTER TABLE public.bot_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage bot settings" 
ON public.bot_settings 
FOR ALL 
TO service_role 
USING (true);

CREATE POLICY "Authenticated users can read active settings" 
ON public.bot_settings 
FOR SELECT 
TO authenticated 
USING (is_active = true);