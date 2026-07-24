# PHASE 4: PWA Optimization, Realtime Updates & Email Engine

## Objective
Transform the web app into an installable **Progressive Web App (PWA)** with service worker support, implement Supabase Realtime subscriptions for live UI updates, and integrate transactional email notifications using **Resend** or **SendGrid**.

---

## 1. Progressive Web App (PWA) Setup
1. **Manifest & Service Worker:**
   - Configure `@ducanh2912/next-pwa` in Next.js.
   - File `public/manifest.json`:
     - `name`: "Taj IT Support Ticket System"
     - `short_name`: "Taj IT Tickets"
     - `theme_color`: "#0F172A"
     - `background_color`: "#F8FAFC"
     - `display`: "standalone"
     - Icons: 192x192 and 512x512 app icons.
2. **Install Banner & Offline Shell:**
   - Prompt site handlers and staff with an "Add to Home Screen" banner on mobile devices.
   - Cache static assets so app shell renders seamlessly in weak fueling site cellular coverage.

---

## 2. Supabase Realtime Subscriptions
- Implement live update listeners in the dashboard navigation header:
  - **In-App Bell Notifications:** Badge updates instantly when ticket status changes or visit date is set.
  - **Live Ticket Board:** Responders see new tickets appear in real time without refreshing.

---

## 3. Transactional Email Notification System

Integrate **Resend** API via Next.js API route / Supabase Webhooks for the following events:

| Trigger Event | Recipient | Email Contents |
| :--- | :--- | :--- |
| **New Ticket Created** | Assigned Responder & Admin | Ticket ID, Complainant Name, Location, Description |
| **Visit Date Scheduled** | Complainant & Admin | Scheduled Visit Date, Responder Remarks |
| **Status Updated** | Complainant | New Status (`Visited` / `In Progress`), Remarks |
| **Issue Resolved** | Complainant | Resolution Notice + Direct link to Rate & Close |
| **SLA Breach Alert** | Admin & Responder | SLA Escalation Alert for overdue ticket |

---

## 4. Acceptance Criteria
- [ ] Web application can be installed on iOS and Android devices as a standalone PWA.
- [ ] Ticket board and notification bell update in real-time without page reload.
- [ ] Email notifications trigger reliably on all status changes.
- [ ] Email templates feature clean Taj Gasoline corporate styling with direct call-to-action buttons.