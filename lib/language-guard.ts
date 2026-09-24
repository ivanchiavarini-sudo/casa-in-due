/**
 * Filtro linguistico dello spazio di coppia.
 * Le espressioni aggressive non vengono cancellate: sono sostituite con parole
 * pulite che conservano, per quanto possibile, significato e intensità emotiva.
 */
const BLOCKED_EXPRESSIONS = [
  "figlio di puttana",
  "figlia di puttana",
  "pezzo di merda",
  "testa di cazzo",
  "mi hai rotto i coglioni",
  "mi hai rotto il cazzo",
  "mi avete rotto i coglioni",
  "mi avete rotto il cazzo",
  "non me ne frega un cazzo",
  "non me ne importa un cazzo",
  "non capisci un cazzo",
  "non sai un cazzo",
  "porca puttana",
  "vaffanculo",
  "affanculo",
  "fanculo",
  "porco dio",
  "dio cane",
  "dio porco",
  "madonna puttana",
  "rompicoglioni",
  "rompicoglione",
  "coglione",
  "coglioni",
  "cogliona",
  "stronzo",
  "stronza",
  "stronzi",
  "stronze",
  "bastardo",
  "bastarda",
  "bastardi",
  "bastarde",
  "puttana",
  "puttane",
  "troia",
  "troie",
  "merda",
  "merde",
  "cazzo",
  "cazzi",
  "cazzata",
  "cazzate",
  "minchia",
  "minchiate",
  "deficiente",
  "deficienti",
  "idiota",
  "idioti",
  "idiote",
  "cretino",
  "cretina",
  "cretini",
  "cretine",
  "imbecille",
  "imbecilli",
] as const;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const alternation = [...BLOCKED_EXPRESSIONS]
  .sort((a, b) => b.length - a.length)
  .map(escapeRegExp)
  .join("|");

const blockedPattern = new RegExp(
  `(^|[^a-zà-öø-ÿ0-9])(${alternation})(?=$|[^a-zà-öø-ÿ0-9])`,
  "giu",
);

type ReplacementRule = {
  pattern: RegExp;
  replacement: string;
};

/**
 * Le regole più specifiche vengono applicate prima di quelle generiche.
 * L'obiettivo non è edulcorare il contenuto, ma tradurre l'aggressività in un
 * vissuto o in una richiesta comprensibile.
 */
const REPLACEMENT_RULES: ReplacementRule[] = [
  { pattern: /\bnon me ne (?:frega|importa) un cazzo\b/giu, replacement: "non mi importa affatto" },
  { pattern: /\bmi hai rotto (?:i coglioni|il cazzo)\b/giu, replacement: "sono esasperato da questa situazione" },
  { pattern: /\bmi avete rotto (?:i coglioni|il cazzo)\b/giu, replacement: "sono esasperato da questa situazione" },
  { pattern: /\bnon capisci un cazzo di\s+/giu, replacement: "faccio fatica a sentirmi compreso su " },
  { pattern: /\bnon capisci un cazzo\b/giu, replacement: "su questo non mi sento compreso" },
  { pattern: /\bnon sai un cazzo\b/giu, replacement: "su questo credo che tu non abbia tutte le informazioni" },
  { pattern: /\bche cazzo\b/giu, replacement: "che cosa" },
  { pattern: /\bcol cazzo\b/giu, replacement: "assolutamente no" },
  { pattern: /\b(questo|questa|quel|quella) cazzo di\b/giu, replacement: "$1 esasperante" },
  { pattern: /\b(un|uno|una) cazzo di\b/giu, replacement: "$1 esasperante" },
  { pattern: /\b(?:del cazzo|di merda)\b/giu, replacement: "terribile" },
  {
    pattern: /\bsei\s+(?:un|uno|una)\s+(?:figlio di puttana|figlia di puttana|pezzo di merda|testa di cazzo|coglione|cogliona|stronzo|stronza|bastardo|bastarda|idiota|cretino|cretina|imbecille|deficiente|puttana|troia)\b/giu,
    replacement: "mi hai ferito profondamente",
  },
  {
    pattern: /\bsiete\s+(?:dei|degli|delle)\s+(?:pezzi di merda|coglioni|stronzi|stronze|bastardi|bastarde|idioti|idiote|cretini|cretine|imbecilli|deficienti)\b/giu,
    replacement: "mi avete ferito profondamente",
  },
  { pattern: /\b(?:vaffanculo|affanculo|fanculo),?\s*lasciami stare\b/giu, replacement: "lasciami in pace" },
  { pattern: /\b(?:vaffanculo|affanculo|fanculo)\b/giu, replacement: "lasciami in pace" },
  { pattern: /\b(?:porco dio|dio cane|dio porco|madonna puttana|porca puttana)\b/giu, replacement: "sono davvero fuori di me" },
  { pattern: /\b(?:figlio di puttana|figlia di puttana|pezzo di merda|testa di cazzo)\b/giu, replacement: "persona che mi ha ferito profondamente" },
  { pattern: /\b(?:stronzo|coglione|bastardo|idiota|cretino|imbecille|deficiente)\b/giu, replacement: "irrispettoso" },
  { pattern: /\b(?:stronza|cogliona|bastarda|cretina)\b/giu, replacement: "irrispettosa" },
  { pattern: /\b(?:stronzi|coglioni|bastardi|idioti|cretini|imbecilli|deficienti)\b/giu, replacement: "irrispettosi" },
  { pattern: /\b(?:stronze|bastarde|idiote|cretine)\b/giu, replacement: "irrispettose" },
  { pattern: /\b(?:puttana|troia)\b/giu, replacement: "persona che mi ha mancato di rispetto" },
  { pattern: /\b(?:puttane|troie)\b/giu, replacement: "persone che mi hanno mancato di rispetto" },
  { pattern: /\brompicoglioni\b/giu, replacement: "estenuante" },
  { pattern: /\brompicoglione\b/giu, replacement: "persona estenuante" },
  { pattern: /\buna (?:cazzata|minchiata) assurda\b/giu, replacement: "qualcosa di assurdo" },
  { pattern: /\b(?:cazzata|minchiata)\b/giu, replacement: "cosa assurda" },
  { pattern: /\b(?:cazzate|minchiate)\b/giu, replacement: "assurdità" },
  { pattern: /\bun cazzo\b/giu, replacement: "nulla" },
  { pattern: /\b(?:cazzo|minchia)\b/giu, replacement: "accidenti" },
  { pattern: /\b(?:cazzi)\b/giu, replacement: "problemi" },
  { pattern: /\b(?:merda|merde)\b/giu, replacement: "disastro" },
];

function tidy(value: string) {
  return value
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,.;:!?]){2,}/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function containsBlockedLanguage(value: string) {
  blockedPattern.lastIndex = 0;
  return blockedPattern.test(String(value || ""));
}

export function substituteBlockedLanguage(value: string) {
  let output = String(value || "");
  for (const rule of REPLACEMENT_RULES) {
    output = output.replace(rule.pattern, rule.replacement);
  }

  // Rete di sicurezza: nessuna espressione esplicita deve restare nel testo.
  blockedPattern.lastIndex = 0;
  output = output.replace(blockedPattern, (_match, prefix: string) => `${prefix}parole che mi hanno ferito`);
  output = tidy(output);

  const source = String(value || "").trimStart();
  if (/^[A-ZÀ-ÖØ-Þ]/u.test(source) && /^[a-zà-öø-ÿ]/u.test(output)) {
    output = output.charAt(0).toUpperCase() + output.slice(1);
  }
  return output;
}

/** Alias mantenuto per compatibilità con le versioni precedenti. */
export function redactBlockedLanguage(value: string) {
  return substituteBlockedLanguage(value);
}

/** Alias mantenuto per compatibilità: ora sostituisce, non cancella. */
export function removeBlockedLanguage(value: string) {
  return substituteBlockedLanguage(value);
}
