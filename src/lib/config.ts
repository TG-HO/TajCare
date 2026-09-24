/**
 * Taj Care Central System Configuration
 * 
 * Easily change operational policies, timing windows, and system rules here.
 */
export const TICKET_POLICY = {
  /**
   * Reopening Window Duration (in hours):
   * Once a Site Manager closes/rates a complaint, the complainant has this window
   * to re-open the complaint if the issue persists.
   * 
   * ONLY after this window expires without being re-opened does the Field Supervisor
   * get the rating functionality to evaluate the resolution and permanently close it forever.
   * 
   * Change this value (e.g., to 12, 24, 48, etc.) or set NEXT_PUBLIC_REOPEN_WINDOW_HOURS in .env.
   */
  REOPEN_WINDOW_HOURS: Number(process.env.NEXT_PUBLIC_REOPEN_WINDOW_HOURS || 24),
};
