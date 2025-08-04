-- Create user_subscriptions table to replace/complement bot_users
CREATE TABLE public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id TEXT NOT NULL UNIQUE,
  telegram_username TEXT,
  plan_id UUID REFERENCES public.subscription_plans(id),
  payment_method TEXT,
  payment_instructions TEXT,
  bank_details TEXT,
  receipt_file_path TEXT,
  receipt_telegram_file_id TEXT,
  payment_status TEXT DEFAULT 'pending',
  is_active BOOLEAN DEFAULT false,
  subscription_start_date TIMESTAMPTZ,
  subscription_end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create promotions table for promo codes
CREATE TABLE public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC NOT NULL,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create promotion_usage table to track who used what promo
CREATE TABLE public.promotion_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES public.promotions(id),
  telegram_user_id TEXT NOT NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(promotion_id, telegram_user_id)
);

-- Create storage bucket for payment receipts
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-receipts', 'payment-receipts', false);

-- Enable RLS on new tables
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_usage ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_subscriptions (bot can manage all)
CREATE POLICY "Bot can manage user subscriptions" ON public.user_subscriptions
FOR ALL USING (true);

-- RLS policies for promotions (readable by all, manageable by bot)
CREATE POLICY "Anyone can view active promotions" ON public.promotions
FOR SELECT USING (is_active = true);

CREATE POLICY "Bot can manage promotions" ON public.promotions
FOR ALL USING (true);

-- RLS policies for promotion_usage (bot can manage all)
CREATE POLICY "Bot can manage promotion usage" ON public.promotion_usage
FOR ALL USING (true);

-- Storage policies for payment receipts
CREATE POLICY "Bot can upload receipts" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'payment-receipts');

CREATE POLICY "Bot can view receipts" ON storage.objects
FOR SELECT USING (bucket_id = 'payment-receipts');

CREATE POLICY "Bot can update receipts" ON storage.objects
FOR UPDATE USING (bucket_id = 'payment-receipts');

-- Add triggers for updated_at
CREATE TRIGGER update_user_subscriptions_updated_at
BEFORE UPDATE ON public.user_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_promotions_updated_at
BEFORE UPDATE ON public.promotions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some sample promo codes
INSERT INTO public.promotions (code, description, discount_type, discount_value, max_uses, valid_from, valid_until) VALUES
('SAVE20', '20% off any subscription', 'percentage', 20, 100, now(), now() + interval '30 days'),
('WELCOME10', '$10 off your first subscription', 'fixed', 10, 50, now(), now() + interval '60 days'),
('LIFETIME50', '$50 off lifetime subscription', 'fixed', 50, 25, now(), now() + interval '7 days');