/**
 * Taj Care - Offline Ticket Draft Persistence Utility
 */

export interface TicketDraft {
  issue_type_id: string;
  custom_issue_title: string;
  description: string;
  savedAt: string;
}

const DRAFT_KEY = "taj_care_offline_ticket_draft";

export function saveTicketDraft(draft: Omit<TicketDraft, "savedAt">) {
  if (typeof window === "undefined") return;
  const payload: TicketDraft = {
    ...draft,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
}

export function loadTicketDraft(): TicketDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearTicketDraft() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DRAFT_KEY);
}
