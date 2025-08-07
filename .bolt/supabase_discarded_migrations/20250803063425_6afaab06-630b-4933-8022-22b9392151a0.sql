-- Create subscription plans table
CREATE TABLE public.subscription_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  duration_months INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_lifetime BOOLEAN NOT NULL DEFAULT false,
  features TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bot users table
CREATE TABLE public.bot_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id TEXT NOT NULL UNIQUE,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  is_vip BOOLEAN NOT NULL DEFAULT false,
  subscription_expires_at TIMESTAMP WITH TIME ZONE,
  current_plan_id UUID REFERENCES public.subscription_plans(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payments table
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.bot_users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_method TEXT NOT NULL, -- 'stripe', 'paypal', 'binance', 'bank_transfer'
  payment_provider_id TEXT, -- External payment ID from provider
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'cancelled'
  webhook_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Create policies for subscription_plans (public read)
CREATE POLICY "Anyone can view subscription plans" 
ON public.subscription_plans 
FOR SELECT 
USING (true);

-- Create policies for bot_users (only bot can manage)
CREATE POLICY "Bot can manage users" 
ON public.bot_users 
FOR ALL 
USING (true);

-- Create policies for payments (only bot can manage)
CREATE POLICY "Bot can manage payments" 
ON public.payments 
FOR ALL 
USING (true);

-- Insert default subscription plans
INSERT INTO public.subscription_plans (name, duration_months, price, features) VALUES
('1 Month VIP', 1, 9.99, ARRAY['Priority signals', 'VIP chat access', 'Daily market analysis']),
('3 Month VIP', 3, 24.99, ARRAY['Priority signals', 'VIP chat access', 'Daily market analysis', '15% discount']),
('6 Month VIP', 6, 44.99, ARRAY['Priority signals', 'VIP chat access', 'Daily market analysis', '25% discount']),
('Lifetime VIP', 0, 199.99, ARRAY['Priority signals', 'VIP chat access', 'Daily market analysis', 'Lifetime access', 'Exclusive content']);

-- Update the lifetime plan
UPDATE public.subscription_plans SET is_lifetime = true WHERE name = 'Lifetime VIP';

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bot_users_updated_at
  BEFORE UPDATE ON public.bot_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();