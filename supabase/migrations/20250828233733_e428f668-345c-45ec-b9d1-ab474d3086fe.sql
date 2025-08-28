-- Create function to validate promo codes
CREATE OR REPLACE FUNCTION public.validate_promo_code(p_code text, p_telegram_user_id text)
RETURNS TABLE(
  valid boolean,
  reason text,
  promotion_id uuid,
  discount_type text,
  discount_value numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Check if promotion exists and is active
  RETURN QUERY
  SELECT 
    CASE 
      WHEN p.id IS NULL THEN false
      WHEN p.is_active = false THEN false
      WHEN p.valid_from > NOW() THEN false
      WHEN p.valid_until < NOW() THEN false
      WHEN p.max_uses IS NOT NULL AND p.current_uses >= p.max_uses THEN false
      ELSE true
    END as valid,
    CASE 
      WHEN p.id IS NULL THEN 'invalid_code'
      WHEN p.is_active = false THEN 'inactive'
      WHEN p.valid_from > NOW() THEN 'not_started'
      WHEN p.valid_until < NOW() THEN 'expired'
      WHEN p.max_uses IS NOT NULL AND p.current_uses >= p.max_uses THEN 'usage_limit_reached'
      ELSE 'valid'
    END as reason,
    p.id as promotion_id,
    p.discount_type,
    p.discount_value
  FROM public.promotions p
  WHERE p.code = p_code
  LIMIT 1;
  
  -- If no promotion found, return invalid
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'invalid_code'::text, null::uuid, null::text, null::numeric;
  END IF;
END;
$$;

-- Create function to record promo usage
CREATE OR REPLACE FUNCTION public.record_promo_usage(p_promotion_id uuid, p_telegram_user_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Insert usage record
  INSERT INTO public.promotion_usage (promotion_id, telegram_user_id)
  VALUES (p_promotion_id, p_telegram_user_id)
  ON CONFLICT DO NOTHING;
  
  -- Update current uses count
  UPDATE public.promotions 
  SET current_uses = current_uses + 1
  WHERE id = p_promotion_id;
END;
$$;