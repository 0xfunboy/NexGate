import type { FastifyReply } from "fastify";

import { AccountManager } from "./accounts.js";
import { SessionManager } from "./browser/session-manager.js";
import { QuotaExhaustedError } from "./errors.js";
import { ProviderRegistry } from "./providers/registry.js";
import type { CompletionRequest, GatewayConfig, ProviderId } from "./types.js";
import { randomId, toPrompt } from "./utils.js";

export class FrontendGateway {
  constructor(
    private readonly registry: ProviderRegistry,
    private readonly sessions: SessionManager,
    private readonly accounts: AccountManager,
    private readonly config: GatewayConfig,
  ) {
    void this.config;
  }

  async login(providerId: ProviderId): Promise<{ provider: ProviderId; url: string }> {
    const provider = this.registry.get(providerId);
    const relativeDir = this.accounts.getActiveRelativeDir(providerId);
    const page = await this.sessions.openForLogin(provider.config, relativeDir);
    return { provider: providerId, url: page.url() };
  }

  async reset(providerId: ProviderId): Promise<{ provider: ProviderId; reset: true }> {
    await this.sessions.close(providerId);
    return { provider: providerId, reset: true };
  }

  /**
   * Silently opens sessions for all providers that have a persisted profile.
   * Called at server startup — fire-and-forget, errors are non-fatal.
   */
  async autoLogin(): Promise<void> {
    const providerIds: ProviderId[] = ["chatgpt", "claude", "gemini", "grok"];

    await Promise.allSettled(
      providerIds.map(async (pid) => {
        const relativeDir = this.accounts.getActiveRelativeDir(pid);
        const hasPersisted = await this.sessions.hasPersistedProfile(relativeDir);
        if (!hasPersisted) return;
        await this.login(pid);
      }),
    );
  }

  async status(providerId: ProviderId): Promise<{
    provider: ProviderId;
    ready: boolean;
    launched: boolean;
    persisted: boolean;
    url?: string;
    title?: string;
    code?: string;
    error?: string;
    hint?: string;
    account: string;
    quotaState: string;
  }> {
    const provider = this.registry.get(providerId);
    const relativeDir = this.accounts.getActiveRelativeDir(providerId);
    const persisted = await this.sessions.hasPersistedProfile(relativeDir);
    const account = this.accounts.getActiveEmail(providerId);
    const quotaState = this.accounts.getQuotaState(providerId);

    const session = this.sessions.getExisting(providerId);
    if (!session) {
      return {
        provider: providerId,
        ready: false,
        launched: false,
        persisted,
        account,
        quotaState,
        code: persisted ? "SAVED_PROFILE" : undefined,
        error: persisted ? "Profilo browser salvato ma sessione non aperta" : undefined,
        hint: persisted ? "Premi Apri login per riaprire il browser sul profilo gia' salvato." : undefined,
      };
    }

    const page = session.page;
    const title = await page.title().catch(() => undefined);
    const url = page.url();

    const ready = await provider.isReady(page);

    const bodyText = await page.locator("body").innerText().catch(() => "");

    if (!ready) {
      const normalizedText = `${title ?? ""}\n${url}\n${bodyText}`.toLowerCase();

      if (normalizedText.includes("verify you are human") || normalizedText.includes("security verification") || normalizedText.includes("cloudflare")) {
        return {
          provider: providerId,
          ready: false,
          launched: true,
          persisted,
          url,
          title,
          account,
          quotaState,
          code: "MANUAL_CHALLENGE",
          error: "Challenge manuale richiesta dal provider",
          hint: "Completa captcha o verifica umana nella finestra Playwright, poi premi Verifica.",
        };
      }

      if (normalizedText.includes("error 502") || normalizedText.includes("server error")) {
        return {
          provider: providerId,
          ready: false,
          launched: true,
          persisted,
          url,
          title,
          account,
          quotaState,
          code: "PROVIDER_TEMP_ERROR",
          error: "Il provider sta mostrando una pagina errore temporanea",
          hint: "Ricarica dalla finestra Playwright o usa Reset e Apri login dopo qualche secondo.",
        };
      }

      const isLoginUrl =
        url.includes("/auth/login") ||
        url.includes("/login") ||
        url.includes("accounts.google.com") ||
        url.includes("auth.openai.com");

      const hasLoginText =
        normalizedText.includes("sign in to your account") ||
        normalizedText.includes("create your account") ||
        normalizedText.includes("log in to claude") ||
        (normalizedText.includes("sign in") && !normalizedText.includes("sign in to continue"));

      if (isLoginUrl || hasLoginText) {
        return {
          provider: providerId,
          ready: false,
          launched: true,
          persisted,
          url,
          title,
          account,
          quotaState,
          code: "LOGIN_REQUIRED",
          error: "Login non ancora completato",
          hint: "Completa il login nella finestra Playwright. Se compare l'account picker Google, scegli lo stesso account usato in precedenza.",
        };
      }
    }

    return {
      provider: providerId,
      ready,
      launched: true,
      persisted,
      url,
      title,
      account,
      quotaState,
    };
  }

  async complete(request: CompletionRequest): Promise<{ id: string; text: string }> {
    const providerId = request.provider;
    const provider = this.registry.get(providerId);
    const totalAccounts = this.accounts.getAll(providerId).length;

    for (let attempt = 0; attempt < totalAccounts; attempt++) {
      const activeEmail = this.accounts.getActiveEmail(providerId);
      const profilePath = this.accounts.getActiveProfilePath(providerId);
      const { page } = await this.sessions.getOrCreate(provider.config, profilePath);
      const prompt = toPrompt(request.messages);
      await provider.ensureConversationNotFull(page);
      const baseline = await provider.snapshotConversation(page);
      await provider.sendPrompt(page, prompt);

      let fullText = "";
      try {
        for await (const chunk of provider.streamResponse(page, { ...baseline, prompt })) {
          fullText += chunk;
        }

        const text = fullText.trim();
        if (provider.isQuotaExhausted(text)) {
          throw new QuotaExhaustedError(providerId, activeEmail, text);
        }

        return { id: randomId("cmpl"), text };
      } catch (err) {
        if (err instanceof QuotaExhaustedError) {
          const newEmail = this.accounts.rotate(providerId);
          await this.sessions.close(providerId);
          if (newEmail !== null) continue;
        }
        throw err;
      }
    }

    throw new Error(`Tutti gli account per ${request.provider} hanno la quota esaurita.`);
  }

  async stream(
    request: CompletionRequest,
    handlers: {
      onToken: (token: string) => Promise<void> | void;
      onComplete: (fullText: string) => Promise<void> | void;
      onQuotaRotating?: (info: { fromEmail: string; toEmail: string }) => Promise<void> | void;
    },
  ): Promise<{ id: string; text: string }> {
    const providerId = request.provider;
    const provider = this.registry.get(providerId);
    const totalAccounts = this.accounts.getAll(providerId).length;

    for (let attempt = 0; attempt < totalAccounts; attempt++) {
      const activeEmail = this.accounts.getActiveEmail(providerId);
      const profilePath = this.accounts.getActiveProfilePath(providerId);
      const { page } = await this.sessions.getOrCreate(provider.config, profilePath);
      const prompt = toPrompt(request.messages);
      await provider.ensureConversationNotFull(page);
      const baseline = await provider.snapshotConversation(page);
      await provider.sendPrompt(page, prompt);

      let fullText = "";
      try {
        for await (const chunk of provider.streamResponse(page, { ...baseline, prompt })) {
          fullText += chunk;
          await handlers.onToken(chunk);
        }

        const text = fullText.trim();
        if (provider.isQuotaExhausted(text)) {
          throw new QuotaExhaustedError(providerId, activeEmail, text);
        }

        await handlers.onComplete(text);
        return { id: randomId("cmpl"), text };
      } catch (err) {
        if (err instanceof QuotaExhaustedError) {
          const newEmail = this.accounts.rotate(providerId);
          await this.sessions.close(providerId);

          if (newEmail !== null) {
            await handlers.onQuotaRotating?.({ fromEmail: activeEmail, toEmail: newEmail });
            continue;
          }
        }
        throw err;
      }
    }

    throw new Error(`Tutti gli account per ${request.provider} hanno la quota esaurita.`);
  }

  async close(): Promise<void> {
    await this.sessions.closeAll();
  }

  async captureAudio(providerId: ProviderId): Promise<{ provider: ProviderId; data: Buffer; mimeType: string }> {
    const provider = this.registry.get(providerId);
    const profilePath = this.accounts.getActiveProfilePath(providerId);
    const { page } = await this.sessions.getOrCreate(provider.config, profilePath);
    const audio = await provider.captureReadAloud(page);
    return { provider: providerId, ...audio };
  }
}

export async function writeSse(reply: FastifyReply, event: unknown): Promise<void> {
  reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
}

export async function writeOpenAiDone(reply: FastifyReply): Promise<void> {
  reply.raw.write("data: [DONE]\n\n");
}

export function setupSseHeaders(reply: FastifyReply): void {
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
}

export async function writeNdjson(reply: FastifyReply, event: unknown): Promise<void> {
  reply.raw.write(`${JSON.stringify(event)}\n`);
}

export function setupNdjsonHeaders(reply: FastifyReply): void {
  reply.raw.writeHead(200, {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
}
