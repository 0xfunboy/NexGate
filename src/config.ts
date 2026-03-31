import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type { GatewayConfig, ProviderConfig, ProviderId } from "./types.js";

const providerIds = ["chatgpt", "claude", "gemini", "grok"] as const satisfies ProviderId[];

const defaultProviders: Record<ProviderId, Omit<ProviderConfig, "id">> = {
  chatgpt: {
    label: "OpenAI ChatGPT",
    baseUrl: "https://chatgpt.com/",
    loginUrl: "https://chatgpt.com/auth/login",
    readySelectors: ["textarea", "[contenteditable='true']"],
    inputSelector: "textarea",
    submitSelector: "button[data-testid='send-button']",
    messageSelectors: ["article [data-message-author-role='assistant']", "[data-message-author-role='assistant']"],
    busySelectors: ["button[data-testid='stop-button']"],
  },
  claude: {
    label: "Anthropic Claude",
    baseUrl: "https://claude.ai/new",
    loginUrl: "https://claude.ai/login",
    readySelectors: ["div[contenteditable='true']", "textarea"],
    inputSelector: "div[contenteditable='true']",
    submitSelector: "button[aria-label*='Send']",
    messageSelectors: [".font-claude-message", "[data-is-streaming] .font-claude-message"],
    busySelectors: ["button[aria-label*='Stop']"],
  },
  gemini: {
    label: "Google Gemini",
    baseUrl: "https://gemini.google.com/app",
    readySelectors: ["div[contenteditable='true']", "textarea", "rich-textarea div[contenteditable='true']"],
    inputSelector: "rich-textarea div[contenteditable='true']",
    submitSelector: "button[aria-label*='Send'], button[aria-label*='Run'], button[aria-label*='Submit'], button[mattooltip*='Send'], button[type='submit']",
    messageSelectors: ["message-content", ".model-response-text", "response-container"],
    busySelectors: ["button[aria-label*='Stop']"],
  },
  grok: {
    label: "xAI Grok",
    baseUrl: "https://grok.com/",
    readySelectors: ["textarea", "div[contenteditable='true']"],
    inputSelector: "textarea",
    submitSelector: "button[type='submit']",
    messageSelectors: ["main article", "[data-testid='message-assistant']"],
    busySelectors: ["button[aria-label*='Stop']"],
  },
};

function resolveDefaultChromePath(): string | undefined {
  const candidates = ["/usr/bin/google-chrome-stable", "/usr/bin/google-chrome"];
  return candidates.find((candidate) => existsSync(candidate));
}

function resolveProfileNamespace(input: {
  browserChannel?: string;
  browserExecutablePath?: string;
}): string {
  if (process.env.PLAYWRIGHT_PROFILE_NAMESPACE) {
    return process.env.PLAYWRIGHT_PROFILE_NAMESPACE;
  }

  if (input.browserExecutablePath?.includes("google-chrome")) {
    return "chrome-stable";
  }

  if (input.browserChannel) {
    return input.browserChannel;
  }

  return "chromium";
}

function readBoolean(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function readNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function loadGatewayConfig(): GatewayConfig {
  const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL || undefined;
  const browserExecutablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || resolveDefaultChromePath();

  return {
    host: process.env.HOST ?? "0.0.0.0",
    port: readNumber("PORT", 3001),
    headless: readBoolean("PLAYWRIGHT_HEADLESS", false),
    browserChannel,
    browserExecutablePath,
    baseProfileDir: path.resolve(process.cwd(), process.env.PLAYWRIGHT_BASE_PROFILE_DIR ?? ".playwright/profiles"),
    browserProfileNamespace: resolveProfileNamespace({ browserChannel, browserExecutablePath }),
    streamPollIntervalMs: readNumber("STREAM_POLL_INTERVAL_MS", 700),
    streamStableTicks: readNumber("STREAM_STABLE_TICKS", 4),
    streamFirstChunkTimeoutMs: readNumber("STREAM_FIRST_CHUNK_TIMEOUT_MS", 25_000),
    streamMaxDurationMs: readNumber("STREAM_MAX_DURATION_MS", 90_000),
  };
}

export function loadProviderConfigs(): Record<ProviderId, ProviderConfig> {
  const configPath = path.resolve(process.cwd(), "providers.config.json");
  const overrides = existsSync(configPath)
    ? (JSON.parse(readFileSync(configPath, "utf8")) as Partial<Record<ProviderId, Partial<ProviderConfig>>>)
    : {};

  const merged = {} as Record<ProviderId, ProviderConfig>;

  for (const id of providerIds) {
    merged[id] = {
      id,
      ...defaultProviders[id],
      ...(overrides[id] ?? {}),
    };
  }

  return merged;
}
