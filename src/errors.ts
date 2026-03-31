import type { ProviderId, UiErrorPayload } from "./types.js";

export class QuotaExhaustedError extends Error {
  constructor(
    public readonly providerId: ProviderId,
    public readonly accountEmail: string,
    public readonly rawMessage: string,
  ) {
    super(`Quota esaurita per ${accountEmail} su ${providerId}`);
    this.name = "QuotaExhaustedError";
  }
}

function normalizeDetail(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function toUiError(error: unknown): UiErrorPayload {
  if (error instanceof QuotaExhaustedError) {
    return {
      code: "QUOTA_EXHAUSTED",
      title: "Quota esaurita",
      detail: `L'account ${error.accountEmail} ha raggiunto il limite di utilizzo su ${error.providerId}.`,
      hint: "Il sistema tenterà la rotazione automatica a un account di backup, se disponibile.",
      retryable: true,
    };
  }

  const detail = normalizeDetail(error);

  if (detail.includes("Target page, context or browser has been closed") || detail.includes("sessione browser del provider")) {
    return {
      code: "SESSION_CLOSED",
      title: "Sessione browser chiusa",
      detail: "La finestra Playwright o il tab del provider non sono piu' attivi.",
      hint: "Premi Reset e poi Apri login per ricreare una sessione pulita.",
      retryable: true,
    };
  }

  if (detail.includes("non pronto")) {
    return {
      code: "PROVIDER_NOT_READY",
      title: "Provider non pronto",
      detail: "Il provider e' aperto ma la chat non e' stata riconosciuta.",
      hint: "Completa login o challenge manuali, poi premi Verifica. Se il sito e' cambiato, aggiorna i selettori del provider.",
      retryable: true,
    };
  }

  if (detail.includes("Unexpected token '<'")) {
    return {
      code: "HTML_INSTEAD_OF_JSON",
      title: "Risposta inattesa del sito",
      detail: "Il frontend ha restituito HTML invece del flusso atteso. Di solito significa challenge, redirect o pagina errore.",
      hint: "Controlla la finestra Playwright: potrebbe esserci login incompleto, captcha o una pagina intermedia.",
      retryable: true,
    };
  }

  if (detail.includes("502") || detail.includes("503") || detail.includes("Server Error")) {
    return {
      code: "PROVIDER_TEMP_ERROR",
      title: "Errore temporaneo del provider",
      detail: "Il sito del provider ha risposto con un errore temporaneo.",
      hint: "Aspetta qualche secondo e riprova. Se persiste, usa Reset e riapri la sessione.",
      retryable: true,
    };
  }

  if (detail.includes("ERR_") || detail.includes("net::")) {
    return {
      code: "NETWORK_ERROR",
      title: "Errore di rete del browser",
      detail: "Il browser Playwright non ha completato correttamente la navigazione.",
      hint: "Verifica connettivita', challenge e redirect del provider, poi riprova.",
      retryable: true,
    };
  }

  return {
    code: "UNEXPECTED_ERROR",
    title: "Errore inatteso",
    detail,
    hint: "Usa Reset per ricreare la sessione se il problema persiste.",
    retryable: true,
  };
}
