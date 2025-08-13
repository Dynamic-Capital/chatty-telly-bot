-- Create enum type for discount types and update related objects
DO $$ BEGIN
    CREATE TYPE discount_type_enum AS ENUM ('percentage', 'fixed');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Alter promotions.discount_type to use the enum
ALTER TABLE promotions
    ALTER COLUMN discount_type TYPE discount_type_enum
        USING discount_type::discount_type_enum;

-- Update validate_promo_code to return the enum
CREATE OR REPLACE FUNCTION validate_promo_code(p_code text, p_telegram_user_id text)
RETURNS TABLE(
    valid boolean,
    reason text,
    promotion_id uuid,
    discount_type discount_type_enum,
    discount_value numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE pr RECORD;
BEGIN
    SELECT * INTO pr FROM promotions WHERE code = p_code;

    IF pr IS NULL THEN
        RETURN QUERY SELECT false, 'not_found', NULL::uuid, NULL::discount_type_enum, NULL::numeric; RETURN;
    END IF;

    IF pr.is_active = false THEN
        RETURN QUERY SELECT false, 'inactive', pr.id, NULL::discount_type_enum, NULL::numeric; RETURN;
    END IF;

    IF pr.valid_until < now() OR pr.valid_from > now() THEN
        RETURN QUERY SELECT false, 'out_of_window', pr.id, NULL::discount_type_enum, NULL::numeric; RETURN;
    END IF;

    IF pr.max_uses IS NOT NULL AND pr.current_uses >= pr.max_uses THEN
        RETURN QUERY SELECT false, 'maxed_out', pr.id, NULL::discount_type_enum, NULL::numeric; RETURN;
    END IF;

    IF EXISTS (
        SELECT 1 FROM promotion_usage
        WHERE promotion_id = pr.id AND telegram_user_id = p_telegram_user_id
    ) THEN
        RETURN QUERY SELECT false, 'already_used', pr.id, NULL::discount_type_enum, NULL::numeric; RETURN;
    END IF;

    RETURN QUERY SELECT true, NULL::text, pr.id, pr.discount_type, pr.discount_value;
END;
$fn$;
