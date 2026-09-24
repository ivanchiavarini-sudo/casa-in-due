import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthIdentity } from "@/lib/auth-identity";

export type CoupleWorkspace = {
  user: { id: string; email?: string; displayName: string };
  couple: { id: string; name: string };
};

async function loadWorkspace(): Promise<CoupleWorkspace | null> {
  const identity = await getAuthIdentity();
  if (!identity) return null;

  const supabase = await createClient();

  const { data: membership, error: membershipError } = await supabase
    .from("couple_members")
    .select("couple_id")
    .eq("user_id", identity.id)
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership) throw new Error("Questo account non appartiene ancora alla coppia.");

  const [{ data: couple, error: coupleError }, { data: profile, error: profileError }] = await Promise.all([
    supabase.from("couples").select("id,name").eq("id", membership.couple_id).single(),
    supabase.from("profiles").select("display_name").eq("id", identity.id).maybeSingle(),
  ]);

  if (coupleError || !couple) throw coupleError || new Error("Spazio di coppia non trovato");
  if (profileError) throw profileError;

  return {
    user: {
      id: identity.id,
      email: identity.email,
      displayName: profile?.display_name || identity.displayName || identity.email?.split("@")[0] || "Utente",
    },
    couple: { id: couple.id, name: couple.name },
  };
}

export const getWorkspace = cache(loadWorkspace);

export async function requireWorkspace(): Promise<CoupleWorkspace> {
  const workspace = await getWorkspace();
  if (!workspace) redirect("/login");
  return workspace;
}
