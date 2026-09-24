import { setDefaultResultOrder } from "node:dns";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { resilientFetch } from "@/lib/resilient-fetch";

// Su alcune reti Windows il browser raggiunge Supabase correttamente mentre
// Node tenta prima un percorso IPv6 instabile. Preferire IPv4 evita i "fetch failed"
// intermittenti senza disabilitare IPv6 quando è realmente disponibile.
try {
  setDefaultResultOrder("ipv4first");
} catch {
  // Ambiente non Node o impostazione non disponibile: resilientFetch resta attivo.
}

export async function createClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Variabili Supabase mancanti");

  return createServerClient(url, key, {
    global: { fetch: resilientFetch },
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options as never));
        } catch {
          // Nei Server Component il rinnovo viene applicato alla successiva azione/route.
        }
      }
    }
  });
}
