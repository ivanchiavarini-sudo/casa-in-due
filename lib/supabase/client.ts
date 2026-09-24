"use client";

import { createBrowserClient } from "@supabase/ssr";
import { resilientFetch } from "@/lib/resilient-fetch";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Variabili Supabase mancanti");
  return createBrowserClient(url, key, { global: { fetch: resilientFetch } });
}
