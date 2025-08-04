-- Create table to store user survey responses for plan recommendations
CREATE TABLE public.user_surveys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_user_id TEXT NOT NULL,
  trading_level TEXT NOT NULL CHECK (trading_level IN ('beginner', 'intermediate', 'advanced')),
  trading_frequency TEXT NOT NULL CHECK (trading_frequency IN ('daily', 'weekly', 'occasionally')),
  main_goal TEXT NOT NULL CHECK (main_goal IN ('learn_improve', 'quality_signals', 'vip_community')),
  monthly_budget TEXT NOT NULL CHECK (monthly_budget IN ('under_15', '15_to_50', 'over_50')),
  recommended_plan_id UUID,
  survey_completed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_surveys ENABLE ROW LEVEL SECURITY;

-- Create policy for bot to manage surveys
CREATE POLICY "Bot can manage user surveys" 
ON public.user_surveys 
FOR ALL 
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_user_surveys_telegram_user_id ON public.user_surveys(telegram_user_id);
CREATE INDEX idx_user_surveys_completed_at ON public.user_surveys(survey_completed_at);

-- Create function to update timestamps
CREATE TRIGGER update_user_surveys_updated_at
BEFORE UPDATE ON public.user_surveys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();