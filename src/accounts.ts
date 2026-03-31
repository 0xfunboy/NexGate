import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { AccountConfig, GatewayConfig, ProviderId, QuotaState } from "./types.js";

const PROVIDER_IDS: ProviderId[] = ["chatgpt", "claude", "gemini", "grok"];

const DEFAULT_ACCOUNT: AccountConfig = { email: "unknown", profileDir: "_shared" };

interface AccountEntry {
  config: AccountConfig;
  quotaState: QuotaState;
  quotaDetectedAt?: number;
}

type AccountsFileRaw = Partial<Record<string, AccountConfig[]>>;

/**
 * Manages multiple accounts per provider.
 * Tracks the active account index and quota exhaustion state.
 * Reads from / writes to accounts.config.json.
 */
export class AccountManager {
  private readonly entries = new Map<ProviderId, AccountEntry[]>();
  private readonly activeIdx = new Map<ProviderId, number>();

  constructor(
    private readonly configPath: string,
    private readonly gatewayConfig: GatewayConfig,
  ) {
    this.load();
  }

  // ── Loading / saving ──────────────────────────────────────

  private load(): void {
    let raw: AccountsFileRaw = {};
    if (existsSync(this.configPath)) {
      try {
        raw = JSON.parse(readFileSync(this.configPath, "utf8")) as AccountsFileRaw;
      } catch {
        /* ignore parse errors, use defaults */
      }
    }
    for (const pid of PROVIDER_IDS) {
      const accounts: AccountConfig[] = ((raw[pid] as AccountConfig[] | undefined) ?? []).filter(
        (a) => a && typeof a.email === "string" && typeof a.profileDir === "string",
      );
      if (accounts.length === 0) accounts.push({ ...DEFAULT_ACCOUNT });
      this.entries.set(pid, accounts.map((c) => ({ config: c, quotaState: "ok" as QuotaState })));
      this.activeIdx.set(pid, 0);
    }
  }

  private save(): void {
    const raw: Record<string, AccountConfig[]> = {};
    for (const pid of PROVIDER_IDS) {
      raw[pid] = (this.entries.get(pid) ?? []).map((e) => e.config);
    }
    try {
      writeFileSync(this.configPath, JSON.stringify(raw, null, 2), "utf8");
    } catch {
      /* ignore write errors */
    }
  }

  // ── Path helpers ─────────────────────────────────────────

  /** Resolve a relative profile dir to an absolute path. */
  resolveProfilePath(relativeDir: string): string {
    return path.join(
      this.gatewayConfig.baseProfileDir,
      this.gatewayConfig.browserProfileNamespace,
      relativeDir,
    );
  }

  /** Relative profile dir for the active account of a provider. */
  getActiveRelativeDir(providerId: ProviderId): string {
    return this.getActiveEntry(providerId).config.profileDir;
  }

  /** Absolute profile path for SessionManager. */
  getActiveProfilePath(providerId: ProviderId): string {
    return this.resolveProfilePath(this.getActiveRelativeDir(providerId));
  }

  // ── State accessors ───────────────────────────────────────

  getActiveEmail(providerId: ProviderId): string {
    return this.getActiveEntry(providerId).config.email;
  }

  getQuotaState(providerId: ProviderId): QuotaState {
    return this.getActiveEntry(providerId).quotaState;
  }

  hasBackup(providerId: ProviderId): boolean {
    const list = this.entries.get(providerId) ?? [];
    const activeIdx = this.activeIdx.get(providerId) ?? 0;
    return list.some((entry, idx) => idx !== activeIdx && entry.quotaState !== "exhausted");
  }

  /** Full account list for a provider (for /accounts endpoint). */
  getAll(providerId: ProviderId): Array<AccountConfig & { active: boolean; quotaState: QuotaState }> {
    const list = this.entries.get(providerId) ?? [];
    const activeIdx = this.activeIdx.get(providerId) ?? 0;
    return list.map((entry, idx) => ({
      ...entry.config,
      active: idx === activeIdx,
      quotaState: entry.quotaState,
    }));
  }

  // ── Rotation / quota ─────────────────────────────────────

  /**
   * Marks the current active account as exhausted and rotates to the next
   * non-exhausted account. Returns the new account email if rotation
   * succeeded, or null if all accounts are exhausted.
   */
  rotate(providerId: ProviderId): string | null {
    const list = this.entries.get(providerId) ?? [];
    const currentIdx = this.activeIdx.get(providerId) ?? 0;

    // Mark current as exhausted
    if (list[currentIdx]) {
      list[currentIdx].quotaState = "exhausted";
      list[currentIdx].quotaDetectedAt = Date.now();
    }

    // Find next non-exhausted account
    for (let i = 1; i < list.length; i++) {
      const nextIdx = (currentIdx + i) % list.length;
      if (list[nextIdx]?.quotaState !== "exhausted") {
        this.activeIdx.set(providerId, nextIdx);
        return list[nextIdx].config.email;
      }
    }

    return null; // All exhausted
  }

  /** Reset quota flags for all accounts of a provider (e.g. after rate-limit window). */
  resetQuota(providerId: ProviderId): void {
    const list = this.entries.get(providerId) ?? [];
    for (const entry of list) {
      entry.quotaState = "ok";
      entry.quotaDetectedAt = undefined;
    }
    this.activeIdx.set(providerId, 0);
  }

  /** Add or update an account for a provider and persist to disk. */
  addAccount(providerId: ProviderId, account: AccountConfig): void {
    const list = this.entries.get(providerId) ?? [];
    const existingIdx = list.findIndex((e) => e.config.email === account.email);
    if (existingIdx >= 0) {
      list[existingIdx].config = account;
    } else {
      list.push({ config: account, quotaState: "ok" });
    }
    this.entries.set(providerId, list);
    this.save();
  }

  private getActiveEntry(providerId: ProviderId): AccountEntry {
    const list = this.entries.get(providerId) ?? [{ config: { ...DEFAULT_ACCOUNT }, quotaState: "ok" as QuotaState }];
    const idx = this.activeIdx.get(providerId) ?? 0;
    return list[Math.min(idx, list.length - 1)];
  }
}
