import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Workspace from "@/components/Workspace";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <Suspense>
      <Workspace userId={user.id} userEmail={user.email ?? ""} />
    </Suspense>
  );
}
