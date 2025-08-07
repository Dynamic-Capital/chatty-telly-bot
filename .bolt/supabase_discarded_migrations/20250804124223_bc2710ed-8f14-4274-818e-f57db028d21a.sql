-- Create auto-reply templates table
CREATE TABLE public.auto_reply_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('receipt_upload', 'payment_approved', 'payment_rejected', 'plan_selection')),
  conditions JSONB, -- Conditions like payment_method, plan_type, amount_range
  message_template TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.auto_reply_templates ENABLE ROW LEVEL SECURITY;

-- Create policy for bot to manage auto-replies
CREATE POLICY "Bot can manage auto reply templates" 
ON public.auto_reply_templates 
FOR ALL 
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_auto_reply_templates_trigger_type ON public.auto_reply_templates(trigger_type);
CREATE INDEX idx_auto_reply_templates_active ON public.auto_reply_templates(is_active);

-- Create function to update timestamps
CREATE TRIGGER update_auto_reply_templates_updated_at
BEFORE UPDATE ON public.auto_reply_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default auto-reply templates
INSERT INTO public.auto_reply_templates (name, trigger_type, conditions, message_template) VALUES
('Bank Transfer Receipt', 'receipt_upload', '{"payment_method": "bank"}', '🏦 <b>Bank Transfer Receipt Received!</b>

📋 Your payment receipt has been submitted for verification.

⏰ <b>Processing Time:</b> 1-2 business days
💡 <b>Verification Process:</b> Our team manually reviews bank transfers for security
📞 <b>Questions?</b> Contact {support_telegram}

Your patience is appreciated! 🙏'),

('Crypto Receipt', 'receipt_upload', '{"payment_method": "crypto"}', '₿ <b>Crypto Payment Receipt Received!</b>

📋 Your cryptocurrency transaction receipt is being verified.

⏰ <b>Processing Time:</b> 30 minutes - 2 hours
🔍 <b>Verification:</b> Checking blockchain confirmation
📈 <b>Status:</b> Pending confirmation

Thank you for your crypto payment! 🚀'),

('VIP Plan Receipt', 'receipt_upload', '{"plan_type": "vip"}', '💎 <b>VIP Payment Receipt Received!</b>

🌟 Welcome to the VIP experience!

📋 <b>Your {plan_name} receipt is being processed</b>
⏰ <b>Activation:</b> Within 1-2 hours
🎯 <b>Access:</b> Premium signals, analysis & community
🎁 <b>Bonus:</b> Exclusive VIP onboarding session

Get ready for premium trading! 🏆'),

('Standard Plan Receipt', 'receipt_upload', '{"plan_type": "standard"}', '📦 <b>Payment Receipt Received!</b>

✅ Your {plan_name} payment is being verified.

⏰ <b>Processing:</b> 1-2 hours
📈 <b>Access:</b> Trading signals & community
📚 <b>Bonus:</b> Free educational resources

Welcome to Dynamic Capital! 🎉'),

('High Value Receipt', 'receipt_upload', '{"amount_min": 100}', '💰 <b>Premium Payment Received!</b>

🏆 Thank you for your significant investment in your trading future!

📋 <b>Priority Processing:</b> Your high-value payment gets priority review
⏰ <b>Processing:</b> Within 1 hour
🎁 <b>VIP Treatment:</b> Expedited activation
👨‍💼 <b>Dedicated Support:</b> Priority customer service

Your success is our priority! 🌟');