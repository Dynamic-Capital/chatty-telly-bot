-- Create enum types for content and trigger types
DO $$ BEGIN
    CREATE TYPE content_type_enum AS ENUM ('text', 'html', 'markdown');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE trigger_type_enum AS ENUM ('keyword', 'regex', 'command');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Alter bot_content.content_type to use content_type_enum
aLTER TABLE bot_content
    ALTER COLUMN content_type DROP DEFAULT,
    ALTER COLUMN content_type TYPE content_type_enum USING content_type::content_type_enum,
    ALTER COLUMN content_type SET DEFAULT 'text';

-- Alter auto_reply_templates.trigger_type to use trigger_type_enum
ALTER TABLE auto_reply_templates
    ALTER COLUMN trigger_type TYPE trigger_type_enum USING trigger_type::trigger_type_enum;
