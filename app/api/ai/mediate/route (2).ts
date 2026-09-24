import { NextResponse } from "next/server";
import { getAuthIdentity } from "@/lib/auth-identity";
import { mediateText, validateMediationInput } from "@/lib/ai-service";
import type { AiContext } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Prepara la rotta e verifica la sessione quando si apre la pagina. */
export async function GET() {
  const identity = await getAuthIdentity().catch(() => null);
  return NextResponse.json(
    { ready: Boolean(identity) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const identity = await getAuthIdentity().catch(() => null);
  if (!identity) {
    return NextResponse.json(
      { error: "Sessione non riconosciuta" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const body = await request.json().catch(() => null) as { context?: AiContext; text?: string } | null;
  const context = body?.context as AiContext;
  const text = String(body?.text || "").trim();

  if (!validateMediationInput(context, text)) {
    return NextResponse.json(
      { error: "Testo o contesto non valido" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await mediateText(context, text);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { error: "Non sono riuscito a elaborare bene questo messaggio. Riprova: il testo non è stato inviato." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
