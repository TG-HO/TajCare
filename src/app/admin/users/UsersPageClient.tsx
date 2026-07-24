"use client";

import { useState } from "react";
import { Profile, Location } from "@/types/database";
import UserModals from "./UserModals";
import UserTable from "./UserTable";

export default function UsersPageClient({
  users,
  locations,
  responders,
}: {
  users: Profile[];
  locations: Location[];
  responders: Profile[];
}) {
  const [responderToEdit, setResponderToEdit] = useState<Profile | null>(null);

  return (
    <>
      <UserModals
        locations={locations}
        responders={responders}
        responderToEdit={responderToEdit}
        onResponderEditClose={() => setResponderToEdit(null)}
      />
      <UserTable
        initialUsers={users}
        locations={locations}
        onEditResponder={(user) => setResponderToEdit(user)}
      />
    </>
  );
}
