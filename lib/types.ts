export type AiContext = "message" | "suggestion" | "maintenance";

export type AiAssistResult = {
  /** Sintesi non diagnostica di ciò che il messaggio sta cercando di comunicare. */
  lettura?: string;
  proposta: string;
  nota: string;
  avviso: string | null;
  modalita: "ia" | "locale";
  invariato: boolean;
};

export type DailyMediationReport = {
  titolo: string;
  sintesi: string;
  lettura_persona_a: string;
  lettura_persona_b: string;
  dinamiche: string[];
  punti_di_contatto: string[];
  nodi_da_chiarire: string[];
  passi_concreti: string[];
  frase_per_ripartire: string;
  avviso: string | null;
};

export type DailyMediationRow = {
  id: string;
  mediation_date: string;
  status: "processing" | "complete" | "failed";
  message_count: number;
  latest_message_at: string | null;
  report: DailyMediationReport | null;
  generated_at: string | null;
  updated_at: string;
};

export type Workspace = {
  user: { id: string; email?: string; displayName: string };
  couple: { id: string; name: string; inviteCode: string };
  progress: { completedPages: number; totalPages: number; completedAt: string | null };
};
