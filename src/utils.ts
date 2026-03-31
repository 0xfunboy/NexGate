import type { ChatMessage, ProviderId } from "./types.js";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function toPrompt(messages: ChatMessage[]): string {
  const chunks: string[] = [];

  const systemMessages = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content.trim())
    .filter(Boolean);

  if (systemMessages.length > 0) {
    chunks.push(systemMessages.join("\n\n"));
  }

  const conversationMessages = messages
    .filter((message) => message.role !== "system")
    .map((message) => message.content.trim())
    .filter(Boolean);

  if (conversationMessages.length > 0) {
    chunks.push(conversationMessages.join("\n\n"));
  }

  return chunks.join("\n\n");
}

export function parseModelProvider(model?: string): { provider?: ProviderId; model: string } {
  if (!model) {
    return { model: "frontend-default" };
  }

  const [maybeProvider, ...rest] = model.split(":");
  if (["chatgpt", "claude", "gemini", "grok"].includes(maybeProvider) && rest.length > 0) {
    return { provider: maybeProvider as ProviderId, model: rest.join(":") };
  }

  return { model };
}

export function nowUnix(): number {
  return Math.floor(Date.now() / 1000);
}

export function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
