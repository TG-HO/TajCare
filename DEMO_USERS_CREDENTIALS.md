# Taj Care - Demo User Credentials & Supabase Auth Sync Guide

Below are default user accounts pre-configured for testing all 4 system roles in Taj Care.

| Role | Name | Email | Password | Location Type |
| :--- | :--- | :--- | :--- | :--- |
| **System Admin** | Zayn Malik | `admin@tajgasoline.com` | `TajAdmin123!` | Head Office |
| **IT Responder** | Bilal Khan | `responder@tajgasoline.com` | `TajResp123!` | Multi-Site Bound |
| **Site Manager** | Kamran Akmal | `sitemanager@tajgasoline.com` | `TajSite123!` | Fueling Site (#101) |
| **Employee** | Sara Ahmed | `employee@tajgasoline.com` | `TajEmp123!` | Head Office (3rd Floor) |

---

## 🚀 1-Click Fix via Browser (Recommended)

Since direct SQL `INSERT INTO auth.users` bypasses Supabase GoTrue Auth's native password hashing engine, open your browser and visit:

👉 **`http://localhost:3000/api/seed`**

This endpoint will automatically delete the stale SQL auth rows and re-create all 4 demo users natively via the official Supabase Auth API (the exact same way your successful `test@tajgasoline.com` account was created).

---

## 🛠️ Manual SQL Cleanup (Optional)

If you prefer to clean up the stale SQL-inserted auth rows manually in Supabase SQL Editor:

```sql
-- DELETE STALE SQL AUTH ROWS (Allows Supabase API to create native auth accounts)
DELETE FROM auth.users WHERE email IN (
    'admin@tajgasoline.com',
    'responder@tajgasoline.com',
    'sitemanager@tajgasoline.com',
    'employee@tajgasoline.com'
);
```

Then visit **`http://localhost:3000/api/seed`** in your browser!
