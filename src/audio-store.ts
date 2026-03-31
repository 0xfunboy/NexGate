import type { ProviderId } from "./types.js";

export interface CachedAudio {
  provider: ProviderId;
  data: Buffer;
  mimeType: string;
  createdAt: string;
}

export class AudioStore {
  private readonly entries = new Map<ProviderId, CachedAudio>();

  save(entry: CachedAudio): CachedAudio {
    this.entries.set(entry.provider, entry);
    return entry;
  }

  get(provider: ProviderId): CachedAudio | undefined {
    return this.entries.get(provider);
  }
}
