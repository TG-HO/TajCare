# PHASE 1: Foundation, Auth, Supabase Setup & Admin Control Panel

## Objective
Initialize the Taj IT Ticket Management Application using **Next.js 14+ (App Router)**, **TypeScript**, **Tailwind CSS**, **Shadcn UI**, and **Supabase**. Build the core database schema, Row Level Security (RLS) policies, authentication system, and full Admin Management dashboard.

---

## 1. Environment & Stack Setup
- **Framework:** Next.js 14+ (App Router, Server Actions, Route Handlers)
- **Styling:** Tailwind CSS, Shadcn UI components, Lucide Icons, Framer Motion
- **Backend/Database:** Supabase (PostgreSQL, Auth, RLS)
- **Theme:** Professional Light Theme (`#F8FAFC` background, `#0F172A` navy primary text/accents, crisp border styling). No AI-style dark default themes.

---

## 2. Database Schema (Execute in Supabase SQL Editor)

```sql
-- ENABLE EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. LOCATIONS TABLE
CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL, -- e.g., "Clifton Site #102", "Head Office - 3rd Floor"
    type TEXT NOT NULL CHECK (type IN ('head_office', 'fueling_site')),
    city TEXT NOT NULL DEFAULT 'Karachi',
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. PROFILES TABLE (Extends auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('employee', 'site_manager', 'responder', 'admin')),
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    phone_number TEXT,
    is_on_leave BOOLEAN DEFAULT FALSE,
    backup_responder_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. RESPONDER LOCATION BINDINGS (Many-to-Many)
CREATE TABLE responder_locations (
    responder_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    PRIMARY KEY (responder_id, location_id)
);

-- 4. PREDEFINED ISSUES TABLE
CREATE TABLE predefined_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL, -- e.g., "Dispenser Hardware", "Network/Router", "Printer/POS", "Software/ERP"
    issue_title TEXT NOT NULL,
    complexity TEXT NOT NULL CHECK (complexity IN ('Low', 'Medium', 'High', 'Critical')) DEFAULT 'Medium',
    base_points INT NOT NULL DEFAULT 20,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. TICKETS TABLE BASELINE
CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number SERIAL UNIQUE,
    complainant_id UUID NOT NULL REFERENCES profiles(id),
    location_id UUID NOT NULL REFERENCES locations(id),
    issue_type_id UUID REFERENCES predefined_issues(id),
    custom_issue_title TEXT, -- Populated if "Other" is selected
    description TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Pending', 'In Progress', 'Visit Date Scheduled', 'Visited', 'Issue Resolved', 'Closed')) DEFAULT 'Pending',
    assigned_responder_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    scheduled_visit_date TIMESTAMP WITH TIME ZONE,
    visit_remarks TEXT,
    closure_rating INT CHECK (closure_rating BETWEEN 1 AND 5),
    closure_remarks TEXT,
    points_awarded INT DEFAULT 0,
    sla_due_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
    sla_breached BOOLEAN DEFAULT FALSE,
    reopened_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS POLICIES ENABLEMENT
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE responder_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE predefined_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- BASIC RLS POLICIES
-- Admins can read/write everything
CREATE POLICY admin_full_access ON profiles FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY admin_locations_all ON locations FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Everyone can read locations and predefined issues
CREATE POLICY read_locations ON locations FOR SELECT TO authenticated USING (true);
CREATE POLICY read_predefined_issues ON predefined_issues FOR SELECT TO authenticated USING (true);

-- User profile read access
CREATE POLICY read_own_profile ON profiles FOR SELECT TO authenticated USING (
    id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
```

---

## 3. Key Functionalities to Implement

### A. Authentication & Onboarding
1. **Login Screen (`/login`):** Clean light UI with Taj Gasoline logo, Email & Password login form.
2. **Role-Based Redirects:**
   - `admin` -> `/admin`
   - `responder` -> `/responder`
   - `employee` / `site_manager` -> `/dashboard`
3. **Password Management:** Profile password update page (`/profile/settings`).

### B. Admin Control Panel (`/admin`)
1. **User Management (`/admin/users`):**
   - View list of all employees, site managers, responders, and admins.
   - Modal to create single user profile.
   - **CSV Bulk Import:** Upload CSV to batch create users and assign roles/locations.
   - Edit User Drawer: Assign locations to responder (multi-select), toggle "On Leave" status, and select a backup responder.
2. **Location Management (`/admin/locations`):**
   - Add/edit fueling sites and head office floors.
   - Assign primary site handlers.
3. **Predefined Issues Management (`/admin/issues`):**
   - Add/edit predefined issues. Set category, issue title, complexity (`Low`, `Medium`, `High`, `Critical`), and default base points (10, 20, 35, 50).

---

## 4. Acceptance Criteria
- [ ] Database schema is deployed to Supabase with proper RLS.
- [ ] Admin can log in, create locations, create predefined issues, and create users.
- [ ] Admin can bulk upload users via CSV.
- [ ] Responders can be bound to multiple locations.
- [ ] Admin can set a responder "On Leave" and pick a backup responder.