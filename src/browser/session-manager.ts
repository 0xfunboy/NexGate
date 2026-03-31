import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";

import { chromium, type BrowserContext, type Page } from "playwright";

import type { GatewayConfig, ProviderConfig, ProviderId } from "../types.js";

interface ProviderSession {
  providerId: ProviderId;
  /** Absolute path of the Chrome profile used for this session. */
  profilePath: string;
  context: BrowserContext;
  page: Page;
}

const STEALTH_INIT_SCRIPT = `
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
`;

/**
 * Manages Playwright browser sessions with multi-profile support.
 *
 * Each unique profile directory gets its own BrowserContext (Chrome window).
 * Multiple providers that share the same profileDir share one context/window
 * (the default "_shared" behavior). Different accounts get different contexts.
 */
export class SessionManager {
  /** One BrowserContext per absolute profile path. */
  private readonly contexts = new Map<string, BrowserContext>();
  /** In-flight launch promises — prevents concurrent opens of the same profile. */
  private readonly pendingLaunches = new Map<string, Promise<BrowserContext>>();
  /** One active session per provider. */
  private readonly sessions = new Map<ProviderId, ProviderSession>();

  constructor(private readonly gatewayConfig: GatewayConfig) {}

  // ── Profile path helpers ──────────────────────────────────

  /** Resolve a relative profile dir name to an absolute file-system path. */
  resolveProfilePath(relativeDir: string): string {
    return path.join(
      this.gatewayConfig.baseProfileDir,
      this.gatewayConfig.browserProfileNamespace,
      relativeDir,
    );
  }

  /** True if the profile directory exists and is non-empty (has saved cookies). */
  async hasPersistedProfile(relativeDir: string): Promise<boolean> {
    try {
      const entries = await readdir(this.resolveProfilePath(relativeDir));
      return entries.length > 0;
    } catch {
      return false;
    }
  }

  // ── Session access ────────────────────────────────────────

  has(providerId: ProviderId): boolean {
    return this.sessions.has(providerId);
  }

  getExisting(providerId: ProviderId): ProviderSession | undefined {
    const session = this.sessions.get(providerId);
    if (!session) return undefined;
    if (!this.isSessionAlive(session)) {
      this.sessions.delete(providerId);
      return undefined;
    }
    return session;
  }

  /**
   * Returns the live session for this provider, creating one if necessary.
   * If the provider already has a session on a DIFFERENT profilePath (account
   * rotation happened), the old page is closed and a new one opened on the
   * new profile's context.
   */
  async getOrCreate(provider: ProviderConfig, profilePath: string): Promise<ProviderSession> {
    const existing = this.sessions.get(provider.id);

    if (existing && this.isSessionAlive(existing)) {
      if (existing.profilePath === profilePath) return existing;
      // Profile changed (account rotation): close old page only, not the context
      // (the context may still be used by other providers sharing the same profile).
      await existing.page.close().catch(() => undefined);
      this.sessions.delete(provider.id);
    } else if (existing) {
      this.sessions.delete(provider.id);
    }

    const context = await this.ensureContext(profilePath);
    const page = await context.newPage();
    const session: ProviderSession = { providerId: provider.id, profilePath, context, page };

    page.on("close", () => {
      const current = this.sessions.get(provider.id);
      if (current?.page === page) this.sessions.delete(provider.id);
    });

    this.sessions.set(provider.id, session);
    return session;
  }

  /**
   * Opens (or reuses) a page for the given provider+profile and navigates to
   * the login or base URL depending on whether the profile has persisted data.
   */
  async openForLogin(provider: ProviderConfig, relativeDir: string): Promise<Page> {
    const profilePath = this.resolveProfilePath(relativeDir);
    const hadPersisted = await this.hasPersistedProfile(relativeDir);
    const session = await this.getOrCreate(provider, profilePath);
    const targetUrl = hadPersisted ? provider.baseUrl : (provider.loginUrl ?? provider.baseUrl);
    await session.page.goto(targetUrl, { waitUntil: "domcontentloaded" });
    await session.page.bringToFront();
    return session.page;
  }

  // ── Session lifecycle ─────────────────────────────────────

  async close(providerId: ProviderId): Promise<void> {
    const session = this.sessions.get(providerId);
    if (!session) return;
    await session.page.close().catch(() => undefined);
    this.sessions.delete(providerId);
    // Tear down the context if no other provider is using it.
    this.maybeCloseContext(session.profilePath);
  }

  async closeAll(): Promise<void> {
    await Promise.allSettled(
      Array.from(this.sessions.values()).map(async (session) => {
        await session.page.close().catch(() => undefined);
      }),
    );
    this.sessions.clear();

    await Promise.allSettled(
      Array.from(this.contexts.values()).map(async (context) => {
        await context.close().catch(() => undefined);
      }),
    );
    this.contexts.clear();
  }

  // ── Internals ─────────────────────────────────────────────

  private async ensureContext(profilePath: string): Promise<BrowserContext> {
    const existing = this.contexts.get(profilePath);
    if (existing) {
      try {
        existing.pages(); // throws if the context was closed
        return existing;
      } catch {
        this.contexts.delete(profilePath);
      }
    }

    // Deduplicate concurrent launches for the same profile directory.
    const pending = this.pendingLaunches.get(profilePath);
    if (pending) return pending;

    const launchPromise = this.doLaunch(profilePath);
    this.pendingLaunches.set(profilePath, launchPromise);
    try {
      return await launchPromise;
    } finally {
      this.pendingLaunches.delete(profilePath);
    }
  }

  private async doLaunch(profilePath: string): Promise<BrowserContext> {
    await mkdir(profilePath, { recursive: true });

    const context = await chromium.launchPersistentContext(profilePath, {
      channel: this.gatewayConfig.browserExecutablePath ? undefined : (this.gatewayConfig.browserChannel ?? "chrome"),
      executablePath: this.gatewayConfig.browserExecutablePath,
      headless: this.gatewayConfig.headless,
      viewport: null,
      locale: "en-US",
      colorScheme: "dark",
      args: [
        "--start-maximized",
        "--disable-blink-features=AutomationControlled",
        "--no-first-run",
        "--no-default-browser-check",
      ],
    });

    await context.addInitScript(STEALTH_INIT_SCRIPT);

    context.on("close", () => {
      this.contexts.delete(profilePath);
      // Remove sessions that were using this context.
      for (const [pid, session] of this.sessions) {
        if (session.profilePath === profilePath) this.sessions.delete(pid);
      }
    });

    this.contexts.set(profilePath, context);
    return context;
  }

  private maybeCloseContext(profilePath: string): void {
    const stillUsed = Array.from(this.sessions.values()).some((s) => s.profilePath === profilePath);
    if (!stillUsed) {
      this.contexts.get(profilePath)?.close().catch(() => undefined);
      this.contexts.delete(profilePath);
    }
  }

  private isSessionAlive(session: ProviderSession): boolean {
    if (session.page.isClosed()) return false;
    try {
      session.context.pages();
      return true;
    } catch {
      return false;
    }
  }
}
