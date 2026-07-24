# PHASE 3: Gamification, SLA Engine & Performance Analytics

## Objective
Implement the SLA monitoring background engine, 24-hour inactivity negative point deduction, performance score calculation, responder leaderboard, and comprehensive Admin analytics dashboard.

---

## 1. Gamification & Points Logic

### A. Point Calculation Formula
When a ticket is successfully marked `Closed`:

$$\text{Total Points} = \text{Base Points} \times \text{Rating Multiplier} - \text{SLA Penalty}$$

#### Base Points Grid
- **Low:** 10 Points
- **Medium:** 20 Points
- **High:** 35 Points
- **Critical:** 50 Points

#### Star Rating Multiplier
- **5 Stars:** $1.5\times$
- **4 Stars:** $1.25\times$
- **3 Stars:** $1.0\times$
- **2 Stars:** $0.8\times$
- **1 Star:** $0.5\times$

### B. 24-Hour SLA Inactivity Rule & Penalty
- If a ticket remains in `Pending` status without any responder update for **> 24 hours** from creation:
  1. Ticket is flagged: `sla_breached = TRUE`.
  2. **-15 points** penalty is applied to the assigned responder.
  3. Escalation record is created for the Admin dashboard.

---

## 2. Background SLA Cron Job Setup

Create a Supabase Edge Function or Scheduled API Route (`/api/cron/check-sla`) triggered hourly via `pg_cron` or Vercel Cron.

```sql
-- SQL Query executed by Cron Job
UPDATE tickets
SET sla_breached = TRUE,
    updated_at = NOW()
WHERE status = 'Pending'
  AND sla_breached = FALSE
  AND created_at < (NOW() - INTERVAL '24 hours');
```

---

## 3. UI Components & Dashboards to Implement

### A. Monthly Leaderboard Page (`/leaderboard`)
- Available to all users to promote healthy competition.
- Ranking table showing:
  - Responder Name & Assigned Locations
  - Total Points Earned (Current Month)
  - Avg Star Rating
  - Total Resolved Complaints
  - SLA Compliance Rate (%)
  - Top Performer Badge (Gold, Silver, Bronze highlights)

### B. Admin Analytics Overview (`/admin/analytics`)
- High-level metric cards:
  - Total Open Complaints vs. Resolved Complaints
  - Average Resolution Time (Hours)
  - SLA Breach Percentage
  - Overall Customer Satisfaction Score (CSAT)
- Visual charts (using Recharts or Chart.js):
  - Complaint Volume by Site / Location
  - Complaints by Category (Hardware, Router, ERP, etc.)
  - Responder Monthly Points Breakdown

### C. Responder Performance Scorecard (`/responder/profile`)
- Breakdown of points earned per ticket.
- History of ratings and feedback received from site managers and head office staff.

---

## 4. Acceptance Criteria
- [ ] Point calculation correctly computes base points, multipliers, and penalties upon closure.
- [ ] Automated SLA Cron job flags tickets pending over 24 hours and records breach penalties.
- [ ] Leaderboard accurately ranks responders by monthly performance points.
- [ ] Admin Analytics renders clear charts and metrics for management oversight.