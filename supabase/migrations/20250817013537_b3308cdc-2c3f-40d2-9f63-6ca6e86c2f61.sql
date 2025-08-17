-- Fix critical security issue: education_enrollments table lacks proper RLS policies
-- This prevents unauthorized access to sensitive customer data

-- First, let's see current policies (they should only show service role access)
-- We need to add proper user-based access control

-- Add policy for users to view only their own enrollment data
CREATE POLICY "Users can view their own enrollments" 
ON public.education_enrollments 
FOR SELECT 
USING (
  student_telegram_id IN (
    SELECT telegram_id 
    FROM public.bot_users 
    WHERE id = auth.uid()
  )
);

-- Add policy for users to insert their own enrollment data  
CREATE POLICY "Users can create their own enrollments"
ON public.education_enrollments 
FOR INSERT 
WITH CHECK (
  student_telegram_id IN (
    SELECT telegram_id 
    FROM public.bot_users 
    WHERE id = auth.uid()
  )
);

-- Add policy for users to update their own enrollment data (for status updates)
CREATE POLICY "Users can update their own enrollments"
ON public.education_enrollments 
FOR UPDATE 
USING (
  student_telegram_id IN (
    SELECT telegram_id 
    FROM public.bot_users 
    WHERE id = auth.uid()
  )
);

-- Add policy for admins to manage all enrollments
CREATE POLICY "Admins can manage all enrollments"
ON public.education_enrollments 
FOR ALL
USING (
  EXISTS (
    SELECT 1 
    FROM public.bot_users 
    WHERE id = auth.uid() 
    AND is_admin = true
  )
);

-- Add index for performance on student_telegram_id lookups
CREATE INDEX IF NOT EXISTS idx_education_enrollments_student_telegram_id 
ON public.education_enrollments(student_telegram_id);