"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createLocationAction(formData: FormData) {
  const name = formData.get("name") as string;
  const type = formData.get("type") as string;
  const city = (formData.get("city") as string) || "Karachi";
  const address = (formData.get("address") as string) || null;

  if (!name || !type) {
    return { error: "Location Name and Type are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("locations").insert({
    name,
    type,
    city,
    address,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/locations");
  return { success: true, message: `Location "${name}" added successfully!` };
}

export async function updateLocationAction(id: string, formData: FormData) {
  const name = formData.get("name") as string;
  const type = formData.get("type") as string;
  const city = (formData.get("city") as string) || "Karachi";
  const address = (formData.get("address") as string) || null;

  if (!id || !name || !type) {
    return { error: "Missing required fields." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("locations")
    .update({ name, type, city, address })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/locations");
  return { success: true, message: `Location "${name}" updated!` };
}

export async function deleteLocationAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("locations").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/locations");
  return { success: true, message: "Location removed." };
}
