import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type AuthIdentity = {
  id: string;
  email?: string;
  displayName?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

async function readClaims(): Promise<AuthIdentity | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error) {
    throw new Error(`Verifica della sessione non riuscita: ${error.message}`);
  }

  const claims = asRecord(data?.claims);
  const id = typeof claims.sub === "string" ? claims.sub : "";
  if (!id) return null;

  const metadata = asRecord(claims.user_metadata);
  return {
    id,
    email: typeof claims.email === "string" ? claims.email : undefined,
    displayName: typeof metadata.display_name === "string" ? metadata.display_name : undefined,
  };
}

/** Cache per singolo rendering RSC: layout e pagina non verificano due volte il JWT. */
export const getAuthIdentity = cache(readClaims);
