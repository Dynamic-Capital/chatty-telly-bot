-- Create analytics tracking tables
CREATE TABLE public.user_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_user_id TEXT NOT NULL,
  interaction_type TEXT NOT NULL, -- 'button_click', 'command', 'message', 'file_upload'
  interaction_data JSONB, -- button_name, command_name, etc.
  session_id TEXT, -- to track user sessions
  page_context TEXT, -- main_menu, packages, payment, etc.
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create conversion tracking table
CREATE TABLE public.conversion_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_user_id TEXT NOT NULL,
  conversion_type TEXT NOT NULL, -- 'plan_view', 'payment_start', 'payment_complete'
  plan_id UUID,
  promo_code TEXT,
  conversion_value NUMERIC, -- plan price
  funnel_step INTEGER, -- 1=view, 2=start, 3=complete
  conversion_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create promo performance tracking
CREATE TABLE public.promo_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  promo_code TEXT NOT NULL,
  telegram_user_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'code_entered', 'code_applied', 'payment_completed'
  plan_id UUID,
  discount_amount NUMERIC,
  final_amount NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create daily analytics summary
CREATE TABLE public.daily_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  total_users INTEGER DEFAULT 0,
  new_users INTEGER DEFAULT 0,
  button_clicks JSONB, -- {"view_packages": 45, "contact_support": 23}
  conversion_rates JSONB, -- {"view_to_payment": 0.15, "payment_to_complete": 0.85}
  top_promo_codes JSONB, -- [{"code": "SAVE20", "uses": 15, "conversions": 8}]
  revenue NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversion_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_analytics ENABLE ROW LEVEL SECURITY;

-- Create policies for bot to manage analytics
CREATE POLICY "Bot can manage user interactions" 
ON public.user_interactions 
FOR ALL 
USING (true);

CREATE POLICY "Bot can manage conversion tracking" 
ON public.conversion_tracking 
FOR ALL 
USING (true);

CREATE POLICY "Bot can manage promo analytics" 
ON public.promo_analytics 
FOR ALL 
USING (true);

CREATE POLICY "Bot can manage daily analytics" 
ON public.daily_analytics 
FOR ALL 
USING (true);

-- Create indexes for better performance
CREATE INDEX idx_user_interactions_user_id ON public.user_interactions(telegram_user_id);
CREATE INDEX idx_user_interactions_type ON public.user_interactions(interaction_type);
CREATE INDEX idx_user_interactions_date ON public.user_interactions(created_at);

CREATE INDEX idx_conversion_tracking_user_id ON public.conversion_tracking(telegram_user_id);
CREATE INDEX idx_conversion_tracking_type ON public.conversion_tracking(conversion_type);
CREATE INDEX idx_conversion_tracking_date ON public.conversion_tracking(created_at);

CREATE INDEX idx_promo_analytics_code ON public.promo_analytics(promo_code);
CREATE INDEX idx_promo_analytics_date ON public.promo_analytics(created_at);

CREATE INDEX idx_daily_analytics_date ON public.daily_analytics(date);

-- Create function for updating daily analytics
CREATE OR REPLACE FUNCTION public.update_daily_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.daily_analytics (date)
  VALUES (CURRENT_DATE)
  ON CONFLICT (date) DO NOTHING;
END;
$$;

-- Create trigger for timestamps
CREATE TRIGGER update_daily_analytics_updated_at
BEFORE UPDATE ON public.daily_analytics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();