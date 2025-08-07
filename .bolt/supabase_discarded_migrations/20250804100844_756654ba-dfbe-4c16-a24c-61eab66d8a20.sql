-- Create education categories table
CREATE TABLE public.education_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT, -- For category icons
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create education packages table (mentorship programs)
CREATE TABLE public.education_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES public.education_categories(id),
  name TEXT NOT NULL,
  description TEXT,
  detailed_description TEXT,
  price NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  duration_weeks INTEGER NOT NULL, -- Duration in weeks
  is_lifetime BOOLEAN NOT NULL DEFAULT false,
  max_students INTEGER, -- Maximum number of students (NULL = unlimited)
  current_students INTEGER DEFAULT 0,
  features TEXT[], -- Array of features/benefits
  requirements TEXT[], -- Prerequisites
  learning_outcomes TEXT[], -- What students will learn
  instructor_name TEXT,
  instructor_bio TEXT,
  instructor_image_url TEXT,
  thumbnail_url TEXT,
  video_preview_url TEXT,
  difficulty_level TEXT CHECK (difficulty_level IN ('Beginner', 'Intermediate', 'Advanced')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  starts_at TIMESTAMP WITH TIME ZONE, -- When the program starts
  enrollment_deadline TIMESTAMP WITH TIME ZONE, -- Last date to enroll
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create education enrollments table
CREATE TABLE public.education_enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id UUID NOT NULL REFERENCES public.education_packages(id),
  student_telegram_id TEXT NOT NULL,
  student_telegram_username TEXT,
  student_first_name TEXT,
  student_last_name TEXT,
  student_email TEXT,
  student_phone TEXT,
  enrollment_status TEXT NOT NULL DEFAULT 'pending' CHECK (enrollment_status IN ('pending', 'confirmed', 'active', 'completed', 'cancelled', 'suspended')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_method TEXT,
  payment_amount NUMERIC,
  payment_reference TEXT,
  enrollment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  start_date TIMESTAMP WITH TIME ZONE,
  completion_date TIMESTAMP WITH TIME ZONE,
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  notes TEXT, -- Admin notes
  receipt_file_path TEXT,
  receipt_telegram_file_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure one enrollment per student per package
  UNIQUE(package_id, student_telegram_id)
);

-- Enable Row Level Security
ALTER TABLE public.education_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_enrollments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for education_categories
CREATE POLICY "Anyone can view active categories" 
ON public.education_categories 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Bot can manage categories" 
ON public.education_categories 
FOR ALL 
USING (true);

-- Create RLS policies for education_packages
CREATE POLICY "Anyone can view active packages" 
ON public.education_packages 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Bot can manage packages" 
ON public.education_packages 
FOR ALL 
USING (true);

-- Create RLS policies for education_enrollments
CREATE POLICY "Bot can manage enrollments" 
ON public.education_enrollments 
FOR ALL 
USING (true);

-- Create function to update updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_education_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_education_categories_updated_at
BEFORE UPDATE ON public.education_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_education_updated_at_column();

CREATE TRIGGER update_education_packages_updated_at
BEFORE UPDATE ON public.education_packages
FOR EACH ROW
EXECUTE FUNCTION public.update_education_updated_at_column();

CREATE TRIGGER update_education_enrollments_updated_at
BEFORE UPDATE ON public.education_enrollments
FOR EACH ROW
EXECUTE FUNCTION public.update_education_updated_at_column();

-- Insert sample education categories
INSERT INTO public.education_categories (name, description, icon, display_order) VALUES
('Trading Fundamentals', 'Learn the basics of trading and market analysis', '📈', 1),
('Advanced Strategies', 'Advanced trading techniques and risk management', '🎯', 2),
('Crypto Mastery', 'Cryptocurrency trading and DeFi strategies', '₿', 3),
('Personal Development', 'Mindset and psychology for successful trading', '🧠', 4);

-- Insert sample education packages
INSERT INTO public.education_packages (
  category_id, 
  name, 
  description, 
  detailed_description,
  price, 
  duration_weeks, 
  max_students,
  features,
  requirements,
  learning_outcomes,
  instructor_name,
  instructor_bio,
  difficulty_level,
  is_featured
) VALUES
(
  (SELECT id FROM public.education_categories WHERE name = 'Trading Fundamentals' LIMIT 1),
  'Complete Trading Bootcamp',
  'Master the fundamentals of trading in 8 weeks',
  'A comprehensive program designed for beginners who want to learn trading from scratch. This course covers market analysis, risk management, and practical trading strategies.',
  299.99,
  8,
  50,
  ARRAY['Weekly live sessions', '1-on-1 mentoring', 'Trading tools access', 'Community access', 'Certificate of completion'],
  ARRAY['Basic computer skills', 'Willingness to learn', 'Minimum $500 trading capital recommended'],
  ARRAY['Understand market fundamentals', 'Develop trading strategies', 'Manage risk effectively', 'Build confidence in trading'],
  'John Smith',
  'Professional trader with 10+ years experience in forex and crypto markets',
  'Beginner',
  true
),
(
  (SELECT id FROM public.education_categories WHERE name = 'Advanced Strategies' LIMIT 1),
  'Pro Trader Mentorship',
  'Advanced 1-on-1 mentorship program',
  'Exclusive mentorship program for experienced traders looking to take their skills to the next level with personalized guidance.',
  999.99,
  12,
  10,
  ARRAY['Weekly 1-on-1 sessions', 'Custom strategy development', 'Live trading sessions', 'Unlimited support', 'Advanced tools access'],
  ARRAY['6+ months trading experience', 'Basic technical analysis knowledge', 'Minimum $2000 trading capital'],
  ARRAY['Develop personalized strategies', 'Advanced risk management', 'Psychology mastery', 'Consistent profitability'],
  'Sarah Johnson',
  'Former hedge fund manager and trading educator with 15 years of experience',
  'Advanced',
  true
);