const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [250, 700, 1500, 3000];

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function copyInput(input: RequestInfo | URL): RequestInfo | URL {
  return input instanceof Request ? input.clone() : input;
}

function retryInit(init?: RequestInit): RequestInit | undefined {
  if (!init) return undefined;

  // Un AbortSignal già consumato renderebbe inutili tutti i tentativi successivi.
  // In quel caso lasciamo che il nuovo tentativo parta senza riutilizzare il segnale scaduto.
  if (init.signal?.aborted) {
    const { signal: _signal, ...rest } = init;
    return rest;
  }

  return init;
}

/**
 * Protegge le richieste tra Next.js e Supabase dagli errori di rete transitori.
 * Non nasconde gli errori reali di autenticazione o autorizzazione.
 */
export async function resilientFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await fetch(copyInput(input), retryInit(init));
      const canRetry = attempt < RETRY_DELAYS_MS.length && RETRYABLE_STATUS.has(response.status);

      if (!canRetry) return response;

      try {
        await response.body?.cancel();
      } catch {
        // Il corpo può essere già chiuso: il tentativo successivo può comunque partire.
      }
    } catch (error) {
      lastError = error;
      if (attempt >= RETRY_DELAYS_MS.length) throw error;
    }

    await sleep(RETRY_DELAYS_MS[attempt]);
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Collegamento temporaneamente non disponibile");
}
