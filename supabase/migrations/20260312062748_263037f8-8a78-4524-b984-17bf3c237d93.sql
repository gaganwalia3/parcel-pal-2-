-- 1. DROP EXISTING TRIGGER/FUNCTION TO PREVENT CONFLICTS
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. UPDATED FUNCTION: Reads metadata and assigns roles dynamically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    assigned_role public.app_role;
BEGIN
    -- Determine role from the metadata sent by Auth.tsx (default to 'user')
    assigned_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'user');

    -- Insert basic profile
    INSERT INTO public.profiles (id, full_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

    -- Assign Role to user_roles table
    INSERT INTO public.user_roles (user_id, role) 
    VALUES (NEW.id, assigned_role);

    -- If the user signed up as a driver, initialize their driver profile
    IF assigned_role = 'driver' THEN
        INSERT INTO public.driver_profiles (id, vehicle_type, is_online)
        VALUES (NEW.id, 'bike', false);
    END IF;

    -- ADMIN OVERRIDE: Check for your specific email
    IF NEW.email = 'gagan.walia5678@gmail.com' THEN
        -- Add Admin role (User and Driver roles can stay or be removed)
        INSERT INTO public.user_roles (user_id, role) 
        VALUES (NEW.id, 'admin')
        ON CONFLICT (user_id, role) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

-- 3. RE-CREATE THE TRIGGER
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. ADD MISSING COLUMNS TO ORDERS (If not already there)
-- This ensures 'payment_method' exists to match your Payment.tsx code
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'COD';