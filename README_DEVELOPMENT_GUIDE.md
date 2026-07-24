# Taj IT Ticket Management System - Master Development Guide

Welcome to the development blueprint for the **Taj IT Ticket Management Application**. This project is structured to be built in 5 distinct phases.

## Phase Overview

| Phase File | Core Focus | Key Deliverables |
| :--- | :--- | :--- |
| `PHASE_1_FOUNDATION_AND_ADMIN.md` | Core Infrastructure | Next.js setup, Supabase DB & Auth, Admin User/Location/Issue Management |
| `PHASE_2_TICKETING_AND_WORKFLOWS.md` | Complaint Workflows | Dual workflow engine (Site vs HO), Auto-assignment, Visit Scheduling, 72h Re-open |
| `PHASE_3_GAMIFICATION_AND_SLA.md` | Gamification & Analytics | Points calculation, Hourly SLA cron penalties, Leaderboard, Admin charts |
| `PHASE_4_PWA_AND_NOTIFICATIONS.md` | Mobile & Communications | PWA installation, Realtime updates, Resend Transactional Email alerts |
| `PHASE_5_MOBILE_REACT_NATIVE.md` | Mobile Native App | Expo / React Native migration plan & shared Supabase infrastructure |

## Visual & UX Standards
- **Theme:** Clean Light Mode (`#F8FAFC` background, `#0F172A` primary headers, `#10B981` success green, `#F59E0B` pending amber).
- **Interactions:** Framer Motion transitions, responsive cards for mobile views, minimal clutter.