import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface StoredConversation {
  url: string;
  updatedAt: string;
}

/**
 * Persistent store for the latest known conversation URL per provider/profile.
 * This lets the gateway reopen the same thread after a restart instead of
 * always landing on the provider home page.
 */
export class ConversationStore {
  private readonly filePath: string;
  private data: Record<string, StoredConversation> = {};

  constructor(baseDir: string) {
    mkdirSync(baseDir, { recursive: true });
    this.filePath = path.join(baseDir, "conversations.json");
    this.load();
  }

  get(key: string): StoredConversation | undefined {
    return this.data[key];
  }

  set(key: string, value: StoredConversation): void {
    this.data[key] = value;
    this.save();
  }

  delete(key: string): void {
    delete this.data[key];
    this.save();
  }

  private load(): void {
    try {
      this.data = JSON.parse(readFileSync(this.filePath, "utf8")) as Record<string, StoredConversation>;
    } catch {
      this.data = {};
    }
  }

  private save(): void {
    try {
      writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), "utf8");
    } catch (error) {
      console.error("[ConversationStore] Failed to persist conversation urls:", error);
    }
  }
}
