import OpenAI from "openai";
import { instructionsFor } from "@/lib/ai-prompt";
import { containsBlockedLanguage, substituteBlockedLanguage } from "@/lib/language-guard";
import type { AiAssistResult, AiContext } from "@/lib/types";

const allowed = new Set<AiContext>(["message", "suggestion", "maintenance"]);
let openAIClient: OpenAI | null = null;

export class MediationUnavailableError extends Error {
  constructor() {
    super("Mediazione IA non disponibile");
    this.name = "MediationUnavailableError";
  }
}

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!openAIClient) {
    openAIClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 38_000,
      maxRetries: 1,
    });
  }
  return openAIClient;
}

function clean(value: unknown) {
  return String(value ?? "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeResult(
  result: Omit<AiAssistResult, "modalita">,
  source: string,
): AiAssistResult {
  const proposal = clean(result.proposta);
  return {
    lettura: clean(result.lettura),
    proposta: proposal,
    nota: clean(result.nota),
    avviso: result.avviso ? clean(result.avviso) : null,
    modalita: "ia",
    invariato: Boolean(result.invariato) || proposal === source.trim(),
  };
}

function normalizeForComparison(value: string) {
  return value
    .toLocaleLowerCase("it")
    .replace(/[^a-zà-öø-ÿ0-9]+/giu, " ")
    .trim();
}

function tokenSimilarity(a: string, b: string) {
  const first = new Set(normalizeForComparison(a).split(/\s+/).filter(Boolean));
  const second = new Set(normalizeForComparison(b).split(/\s+/).filter(Boolean));
  if (!first.size || !second.size) return 0;
  let intersection = 0;
  for (const token of first) if (second.has(token)) intersection += 1;
  return intersection / new Set([...first, ...second]).size;
}

function isMechanicalResult(source: string, result: AiAssistResult) {
  if (!result.proposta || result.proposta.length < 12 || !result.lettura || result.lettura.length < 15) return true;
  if (
    containsBlockedLanguage(result.proposta) ||
    containsBlockedLanguage(result.lettura || "") ||
    containsBlockedLanguage(result.nota) ||
    Boolean(result.avviso && containsBlockedLanguage(result.avviso))
  ) return true;

  if (!containsBlockedLanguage(source)) return false;

  const mechanicallySubstituted = normalizeForComparison(substituteBlockedLanguage(source));
  const proposal = normalizeForComparison(result.proposta);
  if (proposal === mechanicallySubstituted) return true;
  if (/\b(accidenti|parole che mi hanno ferito|persona irrispettosa|persona irrispettoso)\b/iu.test(result.proposta)) return true;

  // Una semplice sostituzione tende a conservare quasi tutti gli stessi token.
  // Una vera rielaborazione semantica cambia almeno in parte struttura e lessico.
  return tokenSimilarity(substituteBlockedLanguage(source), result.proposta) > 0.86;
}

function modelName() {
  return process.env.OPENAI_MEDIATION_MODEL || process.env.OPENAI_MODEL || "gpt-5-mini";
}

function reasoningFor(model: string) {
  return model.startsWith("gpt-5") ? { effort: "low" as const } : undefined;
}

async function createMediation(
  client: OpenAI,
  context: AiContext,
  text: string,
  retryForQuality: boolean,
): Promise<AiAssistResult> {
  const model = modelName();
  const response = await client.responses.create({
    model,
    store: false,
    reasoning: reasoningFor(model),
    max_output_tokens: 650,
    instructions: instructionsFor(context, retryForQuality),
    input: `TESTO DA MEDIARE:\n${text}`,
    text: {
      verbosity: "medium",
      format: {
        type: "json_schema",
        name: "couple_mediation",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            lettura: { type: "string" },
            proposta: { type: "string" },
            nota: { type: "string" },
            avviso: { anyOf: [{ type: "string" }, { type: "null" }] },
            invariato: { type: "boolean" },
          },
          required: ["lettura", "proposta", "nota", "avviso", "invariato"],
        },
      },
    },
  });

  if (!response.output_text) throw new MediationUnavailableError();
  const parsed = JSON.parse(response.output_text) as Omit<AiAssistResult, "modalita">;
  return normalizeResult(parsed, text);
}

export function validateMediationInput(context: AiContext, text: string) {
  return allowed.has(context) && text.length >= 2 && text.length <= 6000;
}

export async function mediateText(context: AiContext, text: string): Promise<AiAssistResult> {
  const client = getOpenAIClient();
  if (!client) throw new MediationUnavailableError();

  try {
    const first = await createMediation(client, context, text, false);
    if (!isMechanicalResult(text, first)) return first;

    const second = await createMediation(client, context, text, true);
    if (!isMechanicalResult(text, second)) return second;

    throw new MediationUnavailableError();
  } catch (error) {
    console.error("Mediazione OpenAI non riuscita:", error);
    if (error instanceof MediationUnavailableError) throw error;
    throw new MediationUnavailableError();
  }
}


export type VentCalmResult = {
  ironia: string;
  consiglio: string;
  nota: string;
};

export async function calmVentText(text: string, partnerName: string): Promise<VentCalmResult> {
  const client = getOpenAIClient();
  if (!client) throw new MediationUnavailableError();

  const model = modelName();
  try {
    const response = await client.responses.create({
      model,
      store: false,
      reasoning: reasoningFor(model),
      max_output_tokens: 360,
      instructions: `Sei la voce ironica ma responsabile dello Sfogatoio di una coppia.\n\nRicevi una frase privata che descrive, spesso in modo esagerato, cosa l'utente vorrebbe fare al partner in un momento di rabbia. Non approvare, sviluppare o rendere più efficace alcuna azione violenta, umiliante o illegale. Non fare diagnosi e non fare la morale.\n\nRispondi in italiano con tre elementi:\n- ironia: una battuta breve, affettuosamente disinnescante e mai offensiva, che faccia capire che la fantasia resta rigorosamente virtuale;\n- consiglio: un suggerimento concreto, semplice e immediato per abbassare la tensione o preparare una frase dicibile;\n- nota: una frase breve che riconosca l'emozione reale sotto l'esagerazione.\n\nSe il testo indica un rischio reale e imminente per qualcuno, evita la battuta e invita con chiarezza ad allontanarsi, mettere distanza fisica e chiedere subito aiuto a una persona fidata o ai servizi di emergenza. Il partner si chiama ${partnerName}.`,
      input: `FRASE PRIVATA DELLO SFOGATOIO:\n${text}`,
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "vent_calm",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              ironia: { type: "string" },
              consiglio: { type: "string" },
              nota: { type: "string" },
            },
            required: ["ironia", "consiglio", "nota"],
          },
        },
      },
    });

    if (!response.output_text) throw new MediationUnavailableError();
    const parsed = JSON.parse(response.output_text) as VentCalmResult;
    return {
      ironia: clean(parsed.ironia),
      consiglio: clean(parsed.consiglio),
      nota: clean(parsed.nota),
    };
  } catch (error) {
    console.error("Intervento ironico dello Sfogatoio non riuscito:", error);
    throw new MediationUnavailableError();
  }
}
