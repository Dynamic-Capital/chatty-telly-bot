-- Harmonize policy roles to reduce duplicate evaluations

-- Profiles
ALTER POLICY "Users can view their own profile"
ON profiles
TO authenticated;

ALTER POLICY "Users can update their own profile"
ON profiles
TO authenticated;

ALTER POLICY "Admins can view all profiles"
ON profiles
TO service_role;

ALTER POLICY "Admins can update all profiles"
ON profiles
TO service_role;

ALTER POLICY "Admins can insert profiles"
ON profiles
TO service_role;

-- User package assignments
ALTER POLICY "Users can view their own assignments"
ON user_package_assignments
TO authenticated;

ALTER POLICY "Admins can manage all assignments"
ON user_package_assignments
TO service_role;

-- Channel memberships
ALTER POLICY "Users can view their own memberships"
ON channel_memberships
TO authenticated;

ALTER POLICY "Admins can manage all memberships"
ON channel_memberships
TO service_role;

-- Bank accounts
ALTER POLICY "Bot can manage bank accounts"
ON bank_accounts
TO service_role;

-- Contact links
ALTER POLICY "Bot can manage contact links"
ON contact_links
TO service_role;

-- Education categories
ALTER POLICY "Bot can manage categories"
ON education_categories
TO service_role;

-- Education packages
ALTER POLICY "Bot can manage packages"
ON education_packages
TO service_role;

-- Promotions
ALTER POLICY "Bot can manage promotions"
ON promotions
TO service_role;
