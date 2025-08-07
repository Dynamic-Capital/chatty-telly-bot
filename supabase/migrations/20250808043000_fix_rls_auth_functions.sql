-- Ensure auth functions in policies are executed once per statement
-- Replace direct auth.uid() calls with subquery selects

-- Profiles policies
ALTER POLICY "Users can view their own profile"
ON profiles
USING (id = (select auth.uid()));

ALTER POLICY "Users can update their own profile"
ON profiles
USING (id = (select auth.uid()))
WITH CHECK (id = (select auth.uid()));

ALTER POLICY "Admins can view all profiles"
ON profiles
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = (select auth.uid())
      AND p.role = 'admin'
  )
);

ALTER POLICY "Admins can update all profiles"
ON profiles
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = (select auth.uid())
      AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = (select auth.uid())
      AND p.role = 'admin'
  )
);

ALTER POLICY "Admins can insert profiles"
ON profiles
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = (select auth.uid())
      AND p.role = 'admin'
  )
);

-- User package assignments policies
ALTER POLICY "Users can view their own assignments"
ON user_package_assignments
USING (user_id = (select auth.uid()));

ALTER POLICY "Admins can manage all assignments"
ON user_package_assignments
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = (select auth.uid())
      AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = (select auth.uid())
      AND p.role = 'admin'
  )
);

-- Channel memberships policies
ALTER POLICY "Users can view their own memberships"
ON channel_memberships
USING (user_id = (select auth.uid()));

ALTER POLICY "Admins can manage all memberships"
ON channel_memberships
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = (select auth.uid())
      AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = (select auth.uid())
      AND p.role = 'admin'
  )
);

-- Remove duplicate indexes by keeping a single useful index
DROP INDEX IF EXISTS idx_bot_users_telegram_id_lookup;
DROP INDEX IF EXISTS idx_user_interactions_telegram_user_id;
