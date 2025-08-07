-- Create bank accounts table for payment instructions
CREATE TABLE public.bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MVR',
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Bot can manage bank accounts" 
ON public.bank_accounts 
FOR ALL 
USING (true);

CREATE POLICY "Anyone can view active bank accounts" 
ON public.bank_accounts 
FOR SELECT 
USING (is_active = true);

-- Create trigger for timestamps
CREATE TRIGGER update_bank_accounts_updated_at
BEFORE UPDATE ON public.bank_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert the provided bank accounts
INSERT INTO public.bank_accounts (bank_name, account_number, account_name, currency, display_order) VALUES
('BML', '7730000133061', 'ABDL.M.I.AFLHAL', 'MVR', 1),
('MIB', '9010310167224100', 'ABDL.M.I.AFLHAL', 'MVR', 2),
('MIB', '9013101672242000', 'ABDL.M.I.AFLHAL', 'USD', 3);