import { SupabaseClient } from "@supabase/supabase-js";
import { Profile } from "@/types/database";

/**
 * Returns the list of responder user IDs assigned under this user's hierarchy.
 * Returns null if the user is a Super Admin ('admin'), meaning no scoping is needed.
 */
export async function getAssignedResponderIds(
  supabase: SupabaseClient,
  currentUser: Profile
): Promise<string[] | null> {
  if (currentUser.role === "admin" || currentUser.role === "hod") {
    return null; // Super Admin and HOD can see all tickets
  }

  if (currentUser.role === "supervisor") {
    // Responders where supervisor_id is this user
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "responder")
      .eq("supervisor_id", currentUser.id);

    return (data || []).map((r) => r.id);
  }

  if (currentUser.role === "line_manager") {
    // 1. Direct responders with line_manager_id = user.id
    // 2. Responders whose supervisor reports to this line manager
    const { data: supervisors } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "supervisor")
      .eq("line_manager_id", currentUser.id);

    const supervisorIds = (supervisors || []).map((s) => s.id);

    let query = supabase
      .from("profiles")
      .select("id")
      .eq("role", "responder");

    if (supervisorIds.length > 0) {
      query = query.or(`line_manager_id.eq.${currentUser.id},supervisor_id.in.(${supervisorIds.join(",")})`);
    } else {
      query = query.eq("line_manager_id", currentUser.id);
    }

    const { data: responders } = await query;
    return (responders || []).map((r) => r.id);
  }

  return [];
}
