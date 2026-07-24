# PHASE 2: Dual Ticketing Engine & Auto-Routing Workflow

## Objective
Build the end-to-end complaint logging and resolution workflow for both **Head Office** and **Fueling Sites**. Implement auto-assignment logic, location binding, visit scheduling, status acknowledgment, rating on closure, and the **72-hour re-open rule**.

---

## 1. Business Logic Rules

### A. Routing & Auto-Assignment Engine
When a complaint is submitted:
1. System checks complainant's profile `location_id`.
2. Query `responder_locations` for responders assigned to that `location_id`.
3. If primary responder `is_on_leave == true`, check their `backup_responder_id`.
4. Assign `tickets.assigned_responder_id = designated_responder_id`.

### B. Status State Machines
- **Head Office Flow:** `Pending` -> `In Progress` -> `Issue Resolved` -> `Closed`
- **Fueling Site Flow:** `Pending` -> `Visit Date Scheduled` -> `Visited` -> `Issue Resolved` -> `Closed`

### C. Status Transition Rules
1. **First-Time Open / Site Visit Scheduling:** Responder MUST provide a visit date + mandatory remarks.
2. **Rescheduling:** Allowed before the scheduled visit date, requiring acknowledgment remarks.
3. **Status Updates:** Each transition requires mandatory remarks (`visit_remarks`).
4. **Closure & Rating:** Once marked `Issue Resolved`, complainant closes the ticket with a **1 to 5 Star Rating** + feedback remarks.
5. **72-Hour Re-Open Rule:** Complainants can re-open resolved tickets within 72 hours. After 72 hours, status locks to `Closed`.

---

## 2. Key Pages & Components to Implement

### A. Complainant Portal (`/dashboard`)
1. **Complaint Submission Modal/Page (`/tickets/new`):**
   - Complainant Name & Location: **Auto-fetched** from profile (read-only).
   - Current Date: Auto-fetched.
   - Issue Selection: Dropdown with Predefined Issues (grouped by category) + "Other" option.
   - Priority / Description: Rich input box (mandatory).
2. **My Complaints List:**
   - Active Complaints tab vs. Completed Complaints tab.
   - Status indicators with clear color coding:
     - `Pending`: Amber
     - `Visit Date Scheduled` / `In Progress`: Blue
     - `Visited`: Purple
     - `Issue Resolved`: Light Green
     - `Closed`: Slate Grey

### B. Responder Portal (`/responder`)
1. **Assigned Complaints Board:** Card and table view filtered by locations bound to the responder.
2. **Ticket Action Modal:**
   - View full history / logs of remarks.
   - Update Status buttons based on current location type (Head Office vs Site).
   - Require `visit_date` input when transitioning to `Visit Date Scheduled`.
   - Require `visit_remarks` (mandatory text field) for every action.

### C. Complaint Closure & Rating Modal
- Visible on Complainant dashboard when status is `Issue Resolved`.
- Star rating selector (1 to 5 stars).
- Feedback text box.
- "Re-open Ticket" button available if `now() <= updated_at + 72 hours`. Re-opening increments `reopened_count` and sets status back to `Pending`.

---

## 3. Database Triggers & Functions (Supabase)

```sql
-- Function to handle auto-assignment on ticket insert
CREATE OR REPLACE FUNCTION auto_assign_ticket()
RETURNS TRIGGER AS $$
DECLARE
    target_responder UUID;
    responder_on_leave BOOLEAN;
    backup_responder UUID;
BEGIN
    -- Find assigned responder for location
    SELECT responder_id INTO target_responder
    FROM responder_locations
    WHERE location_id = NEW.location_id
    LIMIT 1;

    IF target_responder IS NOT NULL THEN
        SELECT is_on_leave, backup_responder_id INTO responder_on_leave, backup_responder
        FROM profiles WHERE id = target_responder;

        IF responder_on_leave = TRUE AND backup_responder IS NOT NULL THEN
            NEW.assigned_responder_id := backup_responder;
        ELSE
            NEW.assigned_responder_id := target_responder;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_assign_ticket
BEFORE INSERT ON tickets
FOR EACH ROW
EXECUTE FUNCTION auto_assign_ticket();
```

---

## 4. Acceptance Criteria
- [ ] Users can submit complaints with auto-filled location and date.
- [ ] Auto-assignment correctly assigns tickets to bound responders or backup responders if on leave.
- [ ] Head Office tickets bypass visit scheduling and move directly to `In Progress`.
- [ ] Site tickets require visit date scheduling + remarks.
- [ ] Complainants can rate resolved tickets (1-5 stars) to finalize closure.
- [ ] Re-open button is functional for 72 hours after resolution.