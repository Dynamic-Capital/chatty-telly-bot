-- 2025-08-12 Tighten RLS for bot_content and bot_settings (deny-all by default)
-- Purpose: Remove permissive policies and ensure RLS is enabled. Service role keeps access.

-- bot_content
ALTER TABLE public.bot_content ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Bot can manage content" ON public.bot_content;
-- Deny-all default: no policies created

-- bot_settings
ALTER TABLE public.bot_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Bot can manage settings" ON public.bot_settings;
-- Deny-all default: no policies created
