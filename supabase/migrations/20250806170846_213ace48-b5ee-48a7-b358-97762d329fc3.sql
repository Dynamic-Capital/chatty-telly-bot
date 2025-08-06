-- Create contact_links table for easy management
CREATE TABLE public.contact_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  display_name TEXT NOT NULL,
  icon_emoji TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on contact_links
ALTER TABLE public.contact_links ENABLE ROW LEVEL SECURITY;

-- Create policies for contact_links
CREATE POLICY "Anyone can view active contact links" 
ON public.contact_links 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Bot can manage contact links" 
ON public.contact_links 
FOR ALL 
USING (true);

-- Insert the social media contact links
INSERT INTO public.contact_links (platform, url, display_name, icon_emoji, display_order) VALUES
('instagram', 'https://www.instagram.com/dynamic.capital?igsh=MnMwajhtdm50bDd2&utm_source=qr', 'Dynamic Capital Instagram', '📸', 1),
('facebook', 'https://www.facebook.com/share/1EmFkq4dvG/?mibextid=wwXIfr', 'Dynamic Capital Facebook', '📘', 2),
('tradingview', 'https://www.tradingview.com/u/DynamicCapital-FX/', 'TradingView Profile', '📊', 3),
('tiktok', 'https://www.tiktok.com/@the.wandering.trader?_t=ZS-8x2EvLdLm7k&_r=1', 'The Wandering Trader', '🎵', 4);

-- Update contact_info content to use social media links
UPDATE bot_content 
SET content_value = '📞 Contact Dynamic Capital:\n\n📸 Instagram: @dynamic.capital\n📘 Facebook: Dynamic Capital\n📊 TradingView: DynamicCapital-FX\n🎵 TikTok: @the.wandering.trader\n\nFollow us for updates and trading insights!'
WHERE content_key = 'contact_info';

-- Add trigger for updated_at
CREATE TRIGGER update_contact_links_updated_at
BEFORE UPDATE ON public.contact_links
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();