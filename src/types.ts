export type ProviderId = "chatgpt" | "claude" | "gemini" | "grok";

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ProviderConfig {
  id: ProviderId;
  label: string;
  baseUrl: string;
  loginUrl?: string;
  readySelectors: string[];
  inputSelector: string;
  submitSelector?: string;
  messageSelectors: string[];
  busySelectors?: string[];
}

export interface GatewayConfig {
  host: string;
  port: number;
  headless: boolean;
  browserChannel?: string;
  browserExecutablePath?: string;
  baseProfileDir: string;
  browserProfileNamespace: string;
  streamPollIntervalMs: number;
  streamStableTicks: number;
  streamFirstChunkTimeoutMs: number;
  streamMaxDurationMs: number;
}

export interface GeneratedImage {
  src: string;
  alt?: string;
}

export interface ConversationSnapshot {
  count: number;
  lastText: string;
  mainText: string;
  imageKeys: string[];
  imageNodeCount: number;
  prompt?: string;
}

export interface CompletionResult {
  id: string;
  text: string;
  images: GeneratedImage[];
}

export interface CompletionRequest {
  provider: ProviderId;
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
}

export interface UiErrorPayload {
  code: string;
  title: string;
  detail: string;
  hint?: string;
  retryable?: boolean;
}

export interface AccountConfig {
  /** Displayed in the UI and used to identify the account. */
  email: string;
  /** Profile directory name relative to <baseProfileDir>/<namespace>/. Default: "_shared". */
  profileDir: string;
  /** Optional human-readable label. */
  label?: string;
}

export type QuotaState = "ok" | "exhausted";
