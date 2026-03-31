import type { Locator, Page, Response } from "playwright";

import type { GatewayConfig, GeneratedImage, ProviderConfig, ProviderId } from "../types.js";
import { sleep } from "../utils.js";

/** Quota-exhaustion message patterns per provider. */
const QUOTA_PATTERNS: Record<ProviderId, RegExp[]> = {
  chatgpt: [
    /you('ve| have) (reached|hit) your (usage |message |daily |free )?(limit|cap)/i,
    /usage limit reached/i,
    /too many requests/i,
    /upgrade (to|your) (chatgpt|plus|pro|premium)/i,
    /your limit (will )?reset/i,
    /come back (after|later|tomorrow)/i,
  ],
  claude: [
    /you('ve| have) (reached|hit|exceeded) (your |the )?(usage |message |daily |free )?limit/i,
    /usage limit (for claude|reached|exceeded)/i,
    /claude\.ai (usage|message) limit/i,
    /free plan limit/i,
    /limit resets? (at|on|in)/i,
    /message limit for this (conversation|chat)/i,
  ],
  gemini: [
    /you('ve| have) (reached|exceeded|hit) (your |the )?(daily |usage |message |free )?limit/i,
    /quota (exceeded|limit|reached)/i,
    /rate limit/i,
    /try again (in|after) \d/i,
    /daily usage limit/i,
  ],
  grok: [
    /you('ve| have) (reached|hit|exceeded) (your |the |a )?(daily |usage |message )?limit/i,
    /rate limit/i,
    /daily limit/i,
    /try again (in|after)/i,
    /limit resets?/i,
  ],
};

export class GenericFrontendProvider {
  constructor(
    public readonly config: ProviderConfig,
    private readonly gatewayConfig: GatewayConfig,
  ) {}

  /**
   * Returns true if the given response text looks like a quota/rate-limit
   * message from this provider rather than a real answer.
   */
  isQuotaExhausted(text: string): boolean {
    const patterns = QUOTA_PATTERNS[this.config.id] ?? [];
    return patterns.some((re) => re.test(text));
  }

  async goto(page: Page): Promise<void> {
    // Use origin-based check: stay on the same site (including /chat/UUID, /c/UUID, etc.)
    // Navigate to baseUrl only if we're on a completely different origin or about:blank
    let baseOrigin: string;
    try {
      baseOrigin = new URL(this.config.baseUrl).origin;
    } catch {
      baseOrigin = this.config.baseUrl;
    }
    if (!page.url().startsWith(baseOrigin)) {
      await page.goto(this.config.baseUrl, { waitUntil: "domcontentloaded" });
    }
  }

  async ensureReady(page: Page): Promise<void> {
    await this.goto(page);

    const selector = await this.findFirstVisible(page, this.config.readySelectors, 30_000);
    if (!selector) {
      throw new Error(
        `Provider ${this.config.id} non pronto. Aggiorna providers.config.json con i selettori corretti dopo il login.`,
      );
    }
  }

  async countMessages(page: Page): Promise<number> {
    for (const selector of this.config.messageSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        return count;
      }
    }

    return 0;
  }

  async snapshotConversation(page: Page): Promise<{ count: number; lastText: string; mainText: string }> {
    const mainText = await this.readMainText(page);

    const providerText = await this.readProviderAssistantText(page);
    if (providerText) {
      return {
        count: await this.countProviderAssistantNodes(page),
        lastText: providerText,
        mainText,
      };
    }

    for (const selector of this.config.messageSelectors) {
      const locator = page.locator(selector);
      const count = await locator.count();
      if (count === 0) {
        continue;
      }

      const lastText = this.sanitizeText(((await locator.last().innerText().catch(() => "")) || "").trim());
      return { count, lastText, mainText };
    }

    return { count: 0, lastText: "", mainText };
  }

  async sendPrompt(page: Page, prompt: string): Promise<void> {
    await this.ensureReady(page);
    await this.waitUntilIdle(page, 20_000);

    const input = await this.firstVisibleLocator(page, [this.config.inputSelector, ...this.config.readySelectors], 10_000);
    if (!input) {
      throw new Error(`Input non trovato per ${this.config.id}.`);
    }

    await input.click();

    const tagName = await input.evaluate((element) => element.tagName.toLowerCase());
    if (tagName === "textarea" || tagName === "input") {
      await input.fill(prompt);
    } else {
      await input.evaluate((element) => {
        (element as { focus?: () => void; textContent: string | null }).focus?.();
        element.textContent = "";
      });
      await page.keyboard.type(prompt);
    }

    let attemptedSubmit = false;

    if (this.config.submitSelector) {
      const submit = page.locator(this.config.submitSelector).first();
      if (await submit.isVisible().catch(() => false)) {
        await submit.waitFor({ state: "visible", timeout: 5_000 }).catch(() => undefined);
        // Dismiss any notification/popup overlay that may intercept the click
        // (e.g. ChatGPT's "Notifications" panel that covers the send button).
        await page.keyboard.press("Escape").catch(() => undefined);
        await sleep(150);
        // Use force:true to bypass Playwright's pointer-interception check if a
        // transparent overlay is still blocking the button after Escape.
        await submit.click({ force: true }).catch(async () => {
          await input.press("Enter").catch(async () => {
            await page.keyboard.press("Enter");
          });
        });
        attemptedSubmit = true;
      }
    }

    if (!attemptedSubmit) {
      await input.press("Enter").catch(async () => {
        await page.keyboard.press("Enter");
      });
    }

    await this.ensurePromptSubmitted(page, input, prompt);
  }

  async *streamResponse(
    page: Page,
    baseline: { count: number; lastText: string; mainText: string; prompt?: string },
  ): AsyncGenerator<string, { text: string; images: GeneratedImage[] }> {
    const startedAt = Date.now();
    let previous = "";
    let stableTicks = 0;
    let firstUsefulSignalSeen = false;

    while (stableTicks < this.gatewayConfig.streamStableTicks) {
      if (Date.now() - startedAt > this.gatewayConfig.streamMaxDurationMs) {
        throw new Error(`Provider ${this.config.id} ha superato il timeout massimo di risposta.`);
      }

      const current = await this.readLastMessage(page, baseline);
      const hasImageSignal = await this.hasLastResponseImages(page);
      if (current && current !== previous) {
        const delta = current.startsWith(previous) ? current.slice(previous.length) : "";
        previous = current;
        stableTicks = 0;
        if (delta) {
          firstUsefulSignalSeen = true;
          yield delta;
        }
      }

      if (hasImageSignal) {
        firstUsefulSignalSeen = true;
      }

      const busy = await this.isBusy(page);
      const canSettleWhileBusy = firstUsefulSignalSeen && ["claude", "gemini"].includes(this.config.id);
      if (!current || current === previous) {
        stableTicks = busy && !canSettleWhileBusy ? 0 : stableTicks + 1;
      }

      if (!firstUsefulSignalSeen && Date.now() - startedAt > this.gatewayConfig.streamFirstChunkTimeoutMs) {
        throw new Error(`Provider ${this.config.id} non ha iniziato a rispondere entro il timeout iniziale.`);
      }

      await sleep(this.gatewayConfig.streamPollIntervalMs);
    }

    previous = await this.finalizeStreamedMessage(page, baseline, previous, startedAt);
    const images = await this.captureLastResponseImages(page);

    if (!previous.trim() && images.length === 0) {
      throw new Error(`Provider ${this.config.id} non ha prodotto testo utile in risposta.`);
    }

    return { text: previous, images };
  }

  async captureReadAloud(page: Page): Promise<{ data: Buffer; mimeType: string }> {
    if (this.config.id !== "grok") {
      throw new Error(`Provider ${this.config.id} non supporta read aloud.`);
    }

    await this.goto(page);

    const responsePromise = page
      .waitForResponse(
        (response) => this.isAudioResponse(response),
        { timeout: 15_000 },
      )
      .catch(() => null);

    const button = await this.findGrokReadAloudButton(page);
    await button.click();

    const audioResponse = await responsePromise;
    if (audioResponse) {
      return {
        data: Buffer.from(await audioResponse.body()),
        mimeType: this.normalizeMimeType(audioResponse.headers()["content-type"]),
      };
    }

    const audioFromDom = await this.readAudioElement(page);
    if (audioFromDom) {
      return {
        data: Buffer.from(audioFromDom.base64, "base64"),
        mimeType: audioFromDom.mimeType,
      };
    }

    throw new Error("Grok non ha esposto un audio leggibile dopo il click su read aloud.");
  }

  private async readLastMessage(page: Page, baseline: { count: number; lastText: string; mainText: string; prompt?: string }): Promise<string> {
    const providerText = this.sanitizeText(await this.readProviderAssistantText(page), baseline.prompt);
    if (providerText && providerText !== baseline.lastText) {
      // Handle in-place updates (e.g. Gemini appending new response after old in same container).
      // Strip the baseline prefix so we return only the new content.
      if (baseline.lastText && providerText.startsWith(baseline.lastText)) {
        const newContent = providerText.slice(baseline.lastText.length).trim();
        if (newContent.length > 5) return newContent;
        // Not enough new content yet — wait for more
        return "";
      }
      return providerText;
    }

    for (const selector of this.config.messageSelectors) {
      const locator = page.locator(selector);
      const count = await locator.count();
      if (count === 0) {
        continue;
      }

      const index = Math.max(count - 1, baseline.count > 0 ? baseline.count : count - 1);
      const node = locator.nth(index >= count ? count - 1 : index);
      const text = this.sanitizeText((await node.innerText().catch(() => ""))?.trim() ?? "", baseline.prompt);
      if (!text) {
        continue;
      }

      if (count === baseline.count && text === baseline.lastText) {
        continue;
      }

      if (count > baseline.count && text === baseline.lastText) {
        continue;
      }

      if (text) {
        return text;
      }
    }

    if (!this.shouldUseSelectorFallback()) {
      return "";
    }

    const mainText = await this.readMainText(page);
    const fallback = this.sanitizeText(this.extractTextDelta(baseline.mainText, mainText), baseline.prompt);
    if (fallback) {
      return fallback;
    }

    return "";
  }

  private async isBusy(page: Page): Promise<boolean> {
    const busySelectors = this.config.busySelectors ?? [];
    for (const selector of busySelectors) {
      const locator = page.locator(selector).first();
      if (await locator.isVisible().catch(() => false)) {
        return true;
      }
    }

    return false;
  }

  private isAudioResponse(response: Response): boolean {
    const contentType = (response.headers()["content-type"] ?? "").toLowerCase();
    const url = response.url().toLowerCase();
    return (
      contentType.startsWith("audio/") ||
      [".mp3", ".wav", ".ogg", ".m4a", ".aac", ".webm"].some((suffix) => url.includes(suffix))
    );
  }

  private async waitUntilIdle(page: Page, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (!(await this.isBusy(page))) {
        return;
      }

      await sleep(300);
    }

    throw new Error(`Provider ${this.config.id} occupato troppo a lungo; impossibile inviare un nuovo prompt.`);
  }

  private async findFirstVisible(page: Page, selectors: string[], timeoutMs: number): Promise<string | null> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      for (const selector of selectors) {
        const visible = await page
          .locator(selector)
          .first()
          .isVisible()
          .catch(() => false);
        if (visible) {
          return selector;
        }
      }

      await sleep(300);
    }

    return null;
  }

  private async firstVisibleLocator(page: Page, selectors: string[], timeoutMs: number): Promise<Locator | null> {
    const selector = await this.findFirstVisible(page, selectors, timeoutMs);
    return selector ? page.locator(selector).first() : null;
  }

  private async ensurePromptSubmitted(page: Page, input: Locator, prompt: string): Promise<void> {
    if (this.config.id !== "gemini") {
      return;
    }

    const normalizedPrompt = prompt.trim();
    const looksUnsent = async (): Promise<boolean> => {
      const current = await input
        .evaluate((element) => {
          const field = element as {
            value?: string;
            textContent?: string | null;
            innerText?: string;
          };
          return (field.value || field.innerText || field.textContent || "").trim();
        })
        .catch(() => "");

      return Boolean(current) && current.includes(normalizedPrompt);
    };

    await sleep(250);
    if (!(await looksUnsent())) {
      return;
    }

    for (const key of ["Control+Enter", "Meta+Enter", "Enter"]) {
      await page.keyboard.press(key).catch(() => undefined);
      await sleep(350);
      if (!(await looksUnsent())) {
        return;
      }
    }
  }

  async isReady(page: Page): Promise<boolean> {
    const selector = await this.findFirstVisible(page, this.config.readySelectors, 1_500);
    return Boolean(selector);
  }

  /**
   * Navigates to a new conversation only when the existing one has grown too large.
   * Keeps the same conversation going by default — no navigation = no DOM flicker.
   */
  async ensureConversationNotFull(page: Page, maxMessages = 40): Promise<void> {
    const count = await this.countMessages(page);
    if (count >= maxMessages) {
      await page.goto(this.config.baseUrl, { waitUntil: "domcontentloaded" });
      await this.findFirstVisible(page, this.config.readySelectors, 15_000);
    }
  }

  private async readMainText(page: Page): Promise<string> {
    // Claude.ai has no <main> element; falling back to body would include the
    // entire sidebar and produce garbage in extractTextDelta. Return "" for Claude
    // so the extractTextDelta fallback path is never triggered.
    if (this.config.id === "claude") return "";
    const main = page.locator("main").first();
    const text = (await main.innerText().catch(async () => page.locator("body").innerText().catch(() => ""))) || "";
    return text.trim();
  }

  private async readProviderAssistantText(page: Page): Promise<string> {
    if (this.config.id === "claude") {
      return this.readClaudeAssistantText(page);
    }

    if (this.config.id === "chatgpt") {
      return this.readChatGptAssistantText(page);
    }

    if (this.config.id === "gemini") {
      return this.readGeminiAssistantText(page);
    }

    if (this.config.id === "grok") {
      return this.readLastVisibleText(page, this.config.messageSelectors);
    }

    return "";
  }

  private async countProviderAssistantNodes(page: Page): Promise<number> {
    if (this.config.id === "claude") {
      // Use the same [data-is-streaming] approach as readClaudeAssistantText,
      // counting only containers that are not inside a nav/sidebar.
      const count = await page.evaluate((): number => {
        type DomLike = {
          body?: unknown;
          querySelectorAll: (selector: string) => unknown[];
        };
        type NodeLike = {
          tagName?: string;
          getAttribute?: (name: string) => string | null;
          parentElement?: NodeLike | null;
        };

        const doc = (globalThis as { document?: DomLike }).document;
        if (!doc) return 0;

        const isInSidebar = (el: NodeLike): boolean => {
          let cur: NodeLike | null = el;
          while (cur && cur !== doc.body) {
            const tag = cur.tagName ?? "";
            if (tag === "NAV" || tag === "ASIDE") return true;
            const role = cur.getAttribute?.("role") ?? "";
            if (role === "navigation" || role === "complementary") return true;
            cur = cur.parentElement ?? null;
          }
          return false;
        };

        return doc.querySelectorAll("[data-is-streaming]").filter((el) => !isInSidebar(el as NodeLike)).length;
      }).catch(() => 0);
      if (count > 0) return count;
      // Fallback: try config selectors
      for (const sel of this.config.messageSelectors) {
        const c = await page.locator(sel).count().catch(() => 0);
        if (c > 0) return c;
      }
      return 0;
    }

    if (this.config.id === "chatgpt") {
      return page.locator("[data-message-author-role='assistant']").count().catch(() => 0);
    }

    if (this.config.id === "gemini") {
      const count = await page.evaluate((): number => {
        type DomLike = {
          querySelectorAll: (selector: string) => unknown[];
        };
        type NodeLike = {
          parentElement?: {
            closest?: (selector: string) => unknown;
          } | null;
        };

        const doc = (globalThis as { document?: DomLike }).document;
        if (!doc) return 0;

        const all = doc.querySelectorAll("message-content") as NodeLike[];
        return all.filter((el) => el.parentElement?.closest?.("message-content") === null).length;
      }).catch(() => 0);

      if (count > 0) return count;
      return page.locator("response-container").count().catch(() => 0);
    }

    if (this.config.id === "grok") {
      for (const sel of this.config.messageSelectors) {
        const count = await page.locator(sel).count().catch(() => 0);
        if (count > 0) return count;
      }
    }

    return 0;
  }

  private async findGrokReadAloudButton(page: Page): Promise<Locator> {
    const selectors = [
      "button[aria-label*='Read aloud']",
      "button[title*='Read aloud']",
      "button[aria-label*='read aloud']",
      "button[title*='read aloud']",
      "button[aria-label*='Listen']",
      "button[title*='Listen']",
      "button[aria-label*='Audio']",
      "button[title*='Audio']",
    ];

    for (const selector of selectors) {
      const locator = page.locator(selector).last();
      if (await locator.isVisible().catch(() => false)) {
        return locator;
      }
    }

    const roleLocator = page.getByRole("button", { name: /read aloud|listen|audio/i }).last();
    if (await roleLocator.isVisible().catch(() => false)) {
      return roleLocator;
    }

    throw new Error("Pulsante read aloud di Grok non trovato.");
  }

  private async readAudioElement(page: Page): Promise<{ base64: string; mimeType: string } | null> {
    await page
      .waitForFunction(() => Boolean((globalThis as { document?: { querySelector: (selector: string) => unknown } }).document?.querySelector("audio[src]")), undefined, {
        timeout: 8_000,
      })
      .catch(() => undefined);

    return page
      .evaluate(async () => {
        const doc = globalThis as {
          document?: { querySelector: (selector: string) => { src?: string; currentSrc?: string } | null };
        };
        const audio = doc.document?.querySelector("audio[src]") ?? null;
        if (!audio?.src) {
          return null;
        }

        const response = await fetch(audio.src);
        const buffer = await response.arrayBuffer();
        const bytes = Array.from(new Uint8Array(buffer));
        const binary = bytes.map((value) => String.fromCharCode(value)).join("");
        return {
          base64: btoa(binary),
          mimeType: response.headers.get("content-type") || (audio.currentSrc?.endsWith(".wav") ? "audio/wav" : "audio/mpeg"),
        };
      })
      .catch(() => null);
  }

  private async readClaudeAssistantText(page: Page): Promise<string> {
    // Claude.ai has no <main> — all selectors must avoid reading the sidebar.
    // Strategy: every assistant response container in Claude.ai has a data-is-streaming
    // attribute (value "true" while streaming, "false" or absent when done).
    // We find ALL such containers, exclude anything inside <nav>/<aside>, and return
    // the innerText of the LAST one — that is always the most recent response.
    const jsText = await page.evaluate((): string => {
      type DomLike = {
        body?: unknown;
        querySelectorAll: (selector: string) => unknown[];
      };
      type NodeLike = {
        tagName?: string;
        getAttribute?: (name: string) => string | null;
        parentElement?: NodeLike | null;
        innerText?: string;
      };

      const doc = (globalThis as { document?: DomLike }).document;
      if (!doc) return "";

      const isInSidebar = (el: NodeLike): boolean => {
        let cur: NodeLike | null = el;
        while (cur && cur !== doc.body) {
          const tag = cur.tagName ?? "";
          if (tag === "NAV" || tag === "ASIDE") return true;
          const role = cur.getAttribute?.("role") ?? "";
          if (role === "navigation" || role === "complementary") return true;
          const testId = cur.getAttribute?.("data-testid") ?? "";
          if (testId.includes("sidebar") || testId.includes("nav")) return true;
          cur = cur.parentElement ?? null;
        }
        return false;
      };

      // All Claude assistant containers have data-is-streaming (any value).
      const containers = doc
        .querySelectorAll("[data-is-streaming]")
        .filter((el) => !isInSidebar(el as NodeLike)) as NodeLike[];

      if (containers.length > 0) {
        const last = containers[containers.length - 1];
        const txt = last.innerText?.trim() ?? "";
        if (txt.length > 5) return txt;
      }

      // Fallback: any prose/markdown element not in sidebar.
      const proseEls = doc
        .querySelectorAll('[class*="font-claude"],[class*="prose"],[class*="markdown"]')
        .filter((el) => !isInSidebar(el as NodeLike)) as NodeLike[];

      if (proseEls.length > 0) {
        const last = proseEls[proseEls.length - 1];
        const txt = last.innerText?.trim() ?? "";
        if (txt.length > 5) return txt;
      }

      return "";
    }).catch(() => "");

    return jsText;
  }

  private async readChatGptAssistantText(page: Page): Promise<string> {
    return this.readLastVisibleText(page, [
      "[data-message-author-role='assistant'] .markdown",
      "[data-message-author-role='assistant'] [class*='markdown']",
      "article [data-message-author-role='assistant']",
      "[data-message-author-role='assistant']",
    ]);
  }

  private async readGeminiAssistantText(page: Page): Promise<string> {
    // Use page.evaluate to find top-level message-content elements only.
    // Gemini nests message-content inside response-container; we want the LAST
    // top-level message-content (not children of another message-content).
    const jsText = await page.evaluate((): string => {
      type DomLike = {
        querySelectorAll: (selector: string) => unknown[];
      };
      type NodeLike = {
        parentElement?: {
          closest?: (selector: string) => unknown;
        } | null;
        innerText?: string;
      };

      const doc = (globalThis as { document?: DomLike }).document;
      if (!doc) return "";

      const all = doc.querySelectorAll("message-content") as NodeLike[];
      // Keep only elements whose closest ancestor message-content is themselves.
      const topLevel = all.filter(
        (el) => el.parentElement?.closest?.("message-content") === null,
      );
      if (topLevel.length === 0) return "";
      const last = topLevel[topLevel.length - 1];
      return last.innerText?.trim() ?? "";
    }).catch(() => "");

    if (jsText) return jsText;

    return this.readLastVisibleText(page, [
      "response-container message-content",
      ".model-response-text",
      "response-container",
    ]);
  }

  private async readLastVisibleText(page: Page, selectors: string[]): Promise<string> {
    for (const selector of selectors) {
      const locator = page.locator(selector);
      const count = await locator.count().catch(() => 0);
      if (count === 0) {
        continue;
      }

      for (let index = count - 1; index >= 0; index -= 1) {
        const node = locator.nth(index);
        const visible = await node.isVisible().catch(() => false);
        if (!visible) {
          continue;
        }

        const text = ((await node.innerText().catch(() => "")) || "").trim();
        if (text) {
          return text;
        }
      }
    }

    return "";
  }

  private async captureLastResponseImages(page: Page): Promise<GeneratedImage[]> {
    return this.captureImagesFromSelectors(page, this.getImageSelectors());
  }

  private async hasLastResponseImages(page: Page): Promise<boolean> {
    return (await this.countImageCandidates(page, this.getImageSelectors())) > 0;
  }

  private getImageSelectors(): string[] {
    if (this.config.id === "chatgpt") {
      return ["[id^='image-'] img[src]", ".group\\/imagegen-image img[src]"];
    }

    if (this.config.id === "gemini") {
      return [".generated-images img[src]", "generated-image img[src]", "single-image img[src]", ".attachment-container img[src]"];
    }

    if (this.config.id === "grok") {
      return ["main article img[src]", "[data-testid='message-assistant'] img[src]"];
    }

    if (this.config.id === "claude") {
      return ["[data-is-streaming] img[src]", ".font-claude-response img[src]"];
    }

    return [];
  }

  private async countImageCandidates(page: Page, selectors: string[]): Promise<number> {
    let total = 0;

    for (const selector of selectors) {
      const locator = page.locator(selector);
      const count = await locator.count().catch(() => 0);
      if (count === 0) continue;

      for (let index = Math.max(0, count - 6); index < count; index += 1) {
        const node = locator.nth(index);
        const visible = await node.isVisible().catch(() => false);
        if (!visible) continue;

        const box = await node.boundingBox().catch(() => null);
        if (!box || box.width < 120 || box.height < 120) continue;
        total += 1;
      }
    }

    return total;
  }

  private async captureImagesFromSelectors(page: Page, selectors: string[]): Promise<GeneratedImage[]> {
    const results: GeneratedImage[] = [];
    const seen = new Set<string>();

    for (const selector of selectors) {
      const locator = page.locator(selector);
      const count = await locator.count().catch(() => 0);
      if (count === 0) continue;

      for (let index = Math.max(0, count - 6); index < count; index += 1) {
        if (results.length >= 4) {
          return results;
        }

        const node = locator.nth(index);
        const visible = await node.isVisible().catch(() => false);
        if (!visible) continue;

        const box = await node.boundingBox().catch(() => null);
        if (!box || box.width < 120 || box.height < 120) continue;

        const meta = await node
          .evaluate((element) => {
            const image = element as {
              currentSrc?: string;
              src?: string;
              alt?: string;
            };

            return {
              src: image.currentSrc || image.src || "",
              alt: image.alt || "",
            };
          })
          .catch(() => ({ src: "", alt: "" }));

        const dedupeKey = meta.src || `${selector}:${index}:${Math.round(box.width)}x${Math.round(box.height)}`;
        if (seen.has(dedupeKey)) continue;

        const screenshot = await node.screenshot({ type: "png" }).catch(() => null);
        if (!screenshot) continue;

        seen.add(dedupeKey);
        results.push({
          src: `data:image/png;base64,${screenshot.toString("base64")}`,
          alt: meta.alt || undefined,
        });
      }
    }

    return results;
  }

  private async readChatGptGeneratedImages(page: Page): Promise<GeneratedImage[]> {
    return page.evaluate(async (): Promise<GeneratedImage[]> => {
      type DomLike = {
        querySelectorAll: (selector: string) => unknown[];
      };
      type ImgLike = {
        src?: string;
        currentSrc?: string;
        alt?: string;
        naturalWidth?: number;
        width?: number;
        closest?: (selector: string) => unknown;
      };
      type NodeLike = {
        querySelectorAll?: (selector: string) => ImgLike[];
      };

      const toDisplaySrc = async (src: string): Promise<string> => {
        if (!src || src.startsWith("data:")) return src;
        try {
          const response = await fetch(src, { credentials: "include" });
          if (!response.ok) return src;
          const blob = await response.blob();
          const buffer = await blob.arrayBuffer();
          const bytes = Array.from(new Uint8Array(buffer));
          const binary = bytes.map((value) => String.fromCharCode(value)).join("");
          return `data:${blob.type || "image/png"};base64,${btoa(binary)}`;
        } catch {
          return src;
        }
      };

      const doc = (globalThis as { document?: DomLike }).document;
      if (!doc) return [];
      const containers = Array.from(doc.querySelectorAll("[data-message-author-role='assistant']")) as NodeLike[];
      const last = containers.at(-1);
      if (!last?.querySelectorAll) return [];

      const candidates = Array.from(last.querySelectorAll("img[src]"))
        .map((img) => ({
          src: img.currentSrc || img.src || "",
          alt: img.alt || "",
          score:
            (/generated image/i.test(img.alt || "") ? 10 : 0) +
            (img.closest?.(".group\\/imagegen-image, [id^='image-'], [data-testid='image-gen-overlay-actions']") ? 10 : 0) +
            ((img.naturalWidth || img.width || 0) >= 256 ? 5 : 0),
        }))
        .filter((img) => img.src && img.score > 0);

      const seen = new Set<string>();
      const unique = candidates.filter((img) => {
        if (seen.has(img.src)) return false;
        seen.add(img.src);
        return true;
      }).slice(0, 4);

      return Promise.all(unique.map(async (img) => ({ src: await toDisplaySrc(img.src), alt: img.alt })));
    }).catch(() => []);
  }

  private async readGeminiGeneratedImages(page: Page): Promise<GeneratedImage[]> {
    return page.evaluate(async (): Promise<GeneratedImage[]> => {
      type DomLike = {
        querySelectorAll: (selector: string) => unknown[];
      };
      type ImgLike = {
        src?: string;
        currentSrc?: string;
        alt?: string;
        naturalWidth?: number;
        width?: number;
        closest?: (selector: string) => unknown;
      };
      type NodeLike = {
        parentElement?: {
          closest?: (selector: string) => unknown;
        } | null;
        querySelectorAll?: (selector: string) => ImgLike[];
      };

      const toDisplaySrc = async (src: string): Promise<string> => {
        if (!src || src.startsWith("data:")) return src;
        try {
          const response = await fetch(src, { credentials: "include" });
          if (!response.ok) return src;
          const blob = await response.blob();
          const buffer = await blob.arrayBuffer();
          const bytes = Array.from(new Uint8Array(buffer));
          const binary = bytes.map((value) => String.fromCharCode(value)).join("");
          return `data:${blob.type || "image/png"};base64,${btoa(binary)}`;
        } catch {
          return src;
        }
      };

      const doc = (globalThis as { document?: DomLike }).document;
      if (!doc) return [];
      const all = Array.from(doc.querySelectorAll("message-content")) as NodeLike[];
      const topLevel = all.filter((el) => el.parentElement?.closest?.("message-content") === null);
      const last = topLevel.at(-1);
      if (!last?.querySelectorAll) return [];

      const candidates = Array.from(last.querySelectorAll("img[src]"))
        .map((img) => ({
          src: img.currentSrc || img.src || "",
          alt: img.alt || "",
          score:
            (img.closest?.(".generated-images, generated-image, single-image, .attachment-container, .image-container") ? 10 : 0) +
            ((img.naturalWidth || img.width || 0) >= 256 ? 5 : 0),
        }))
        .filter((img) => img.src && img.score > 0);

      const seen = new Set<string>();
      const unique = candidates.filter((img) => {
        if (seen.has(img.src)) return false;
        seen.add(img.src);
        return true;
      }).slice(0, 4);

      return Promise.all(unique.map(async (img) => ({ src: await toDisplaySrc(img.src), alt: img.alt })));
    }).catch(() => []);
  }

  private async readGrokGeneratedImages(page: Page): Promise<GeneratedImage[]> {
    return page.evaluate(async (): Promise<GeneratedImage[]> => {
      type DomLike = {
        querySelectorAll: (selector: string) => unknown[];
      };
      type ImgLike = {
        src?: string;
        currentSrc?: string;
        alt?: string;
        naturalWidth?: number;
        width?: number;
      };
      type NodeLike = {
        querySelectorAll?: (selector: string) => ImgLike[];
      };

      const toDisplaySrc = async (src: string): Promise<string> => {
        if (!src || src.startsWith("data:")) return src;
        try {
          const response = await fetch(src, { credentials: "include" });
          if (!response.ok) return src;
          const blob = await response.blob();
          const buffer = await blob.arrayBuffer();
          const bytes = Array.from(new Uint8Array(buffer));
          const binary = bytes.map((value) => String.fromCharCode(value)).join("");
          return `data:${blob.type || "image/png"};base64,${btoa(binary)}`;
        } catch {
          return src;
        }
      };

      const doc = (globalThis as { document?: DomLike }).document;
      if (!doc) return [];
      const containers = Array.from(doc.querySelectorAll("[data-testid='message-assistant'], main article")) as NodeLike[];
      const last = containers.at(-1);
      if (!last?.querySelectorAll) return [];

      const candidates = Array.from(last.querySelectorAll("img[src]"))
        .map((img) => ({
          src: img.currentSrc || img.src || "",
          alt: img.alt || "",
          score:
            (/\/generated\//i.test(img.currentSrc || img.src || "") ? 10 : 0) +
            ((img.naturalWidth || img.width || 0) >= 256 ? 5 : 0),
        }))
        .filter((img) => img.src && img.score > 0);

      const seen = new Set<string>();
      const unique = candidates.filter((img) => {
        if (seen.has(img.src)) return false;
        seen.add(img.src);
        return true;
      }).slice(0, 4);

      return Promise.all(unique.map(async (img) => ({ src: await toDisplaySrc(img.src), alt: img.alt })));
    }).catch(() => []);
  }

  private async readClaudeGeneratedImages(page: Page): Promise<GeneratedImage[]> {
    return page.evaluate(async (): Promise<GeneratedImage[]> => {
      type DomLike = {
        querySelectorAll: (selector: string) => unknown[];
      };
      type ImgLike = {
        src?: string;
        currentSrc?: string;
        alt?: string;
        naturalWidth?: number;
        width?: number;
      };
      const toDisplaySrc = async (src: string): Promise<string> => {
        if (!src || src.startsWith("data:")) return src;
        try {
          const response = await fetch(src, { credentials: "include" });
          if (!response.ok) return src;
          const blob = await response.blob();
          const buffer = await blob.arrayBuffer();
          const bytes = Array.from(new Uint8Array(buffer));
          const binary = bytes.map((value) => String.fromCharCode(value)).join("");
          return `data:${blob.type || "image/png"};base64,${btoa(binary)}`;
        } catch {
          return src;
        }
      };

      const doc = (globalThis as { document?: DomLike }).document;
      if (!doc) return [];
      const containers = Array.from(doc.querySelectorAll("[data-is-streaming], .font-claude-response"));
      const last = containers.at(-1) as { querySelectorAll?: (selector: string) => ImgLike[] } | undefined;
      if (!last?.querySelectorAll) return [];

      const candidates = Array.from(last.querySelectorAll("img[src]"))
        .map((img) => ({
          src: img.currentSrc || img.src || "",
          alt: img.alt || "",
          score: (img.naturalWidth || img.width || 0) >= 256 ? 5 : 0,
        }))
        .filter((img) => img.src && img.score > 0)
        .slice(0, 4);

      const seen = new Set<string>();
      const unique = candidates.filter((img) => {
        if (seen.has(img.src)) return false;
        seen.add(img.src);
        return true;
      });

      return Promise.all(unique.map(async (img) => ({ src: await toDisplaySrc(img.src), alt: img.alt })));
    }).catch(() => []);
  }

  private async finalizeStreamedMessage(
    page: Page,
    baseline: { count: number; lastText: string; mainText: string; prompt?: string },
    current: string,
    startedAt: number,
  ): Promise<string> {
    let latest = current;
    let stableReads = 0;
    const settleDeadline = Math.min(
      startedAt + this.gatewayConfig.streamMaxDurationMs,
      Date.now() + Math.max(this.gatewayConfig.streamPollIntervalMs * 4, 2_500),
    );

    while (Date.now() < settleDeadline) {
      const next = await this.readLastMessage(page, baseline);
      if (next && next !== latest) {
        latest = next;
        stableReads = 0;
      } else {
        stableReads += 1;
      }

      const busy = await this.isBusy(page);
      if (!busy && stableReads >= 2) {
        break;
      }

      await sleep(Math.min(this.gatewayConfig.streamPollIntervalMs, 700));
    }

    return latest;
  }

  private shouldUseSelectorFallback(): boolean {
    return this.config.id === "grok";
  }

  private extractTextDelta(before: string, after: string): string {
    const normalizedBefore = before.trim();
    const normalizedAfter = after.trim();

    if (!normalizedAfter || normalizedAfter === normalizedBefore) {
      return "";
    }

    let prefix = 0;
    while (
      prefix < normalizedBefore.length &&
      prefix < normalizedAfter.length &&
      normalizedBefore[prefix] === normalizedAfter[prefix]
    ) {
      prefix += 1;
    }

    let suffix = 0;
    while (
      suffix < normalizedBefore.length - prefix &&
      suffix < normalizedAfter.length - prefix &&
      normalizedBefore[normalizedBefore.length - 1 - suffix] === normalizedAfter[normalizedAfter.length - 1 - suffix]
    ) {
      suffix += 1;
    }

    const candidate = normalizedAfter.slice(prefix, normalizedAfter.length - suffix).trim();
    return candidate.length >= 20 ? candidate : "";
  }

  private sanitizeText(text: string, prompt?: string): string {
    let cleaned = text.trim();
    if (!cleaned) {
      return "";
    }

    if (prompt) {
      cleaned = cleaned.split(prompt).join(" ").trim();
    }

    const commonNoise = [
      "ChatGPT can make mistakes. Check important info.",
      "See Cookie Preferences.",
      "Gemini isn't human. It can make mistakes, including about people, so double-check it.",
      "Your privacy & Gemini Apps",
      "Get notified when Grok finishes answering",
      "Think Harder",
      "Tools",
      "Fast",
      "Auto",
      "Enable",
      "Share",
      "Reply...",
      "Claude is AI and can make mistakes. Please double-check responses.",
      "Opens in a new window",
      "Google may display inaccurate info",
    ];

    for (const marker of commonNoise) {
      cleaned = cleaned.replaceAll(marker, " ");
    }

    if (this.config.id === "chatgpt") {
      cleaned = cleaned.replace(/Cookie Preferences[\s\S]*$/i, " ");
      cleaned = cleaned.replace(/^You said:\s*/i, "");
      cleaned = cleaned.replace(/^ChatGPT said:\s*/i, "");
      cleaned = cleaned.replace(/^You said\s*/i, "");
      cleaned = cleaned.replace(/^ChatGPT said\s*/i, "");
      cleaned = cleaned.replace(/^Ask anything\s*/i, "");
      cleaned = cleaned.replace(/^What’s on the agenda today\?\s*/i, "");
    }

    if (this.config.id === "gemini") {
      cleaned = cleaned.replace(/Gemini Apps Activity[\s\S]*$/i, " ");
      cleaned = cleaned.replace(/^Opens in a new window\s*/i, "");
      cleaned = cleaned.replace(/^Gemini\s*/i, "");
      cleaned = cleaned.replace(/^Gemini said\s*/i, "");
      cleaned = cleaned.replace(/^said\s*/i, "");
      cleaned = cleaned.replace(/^You said\s*/i, "");
      cleaned = cleaned.replace(/^Caricamento di .*$/gim, " ");
      cleaned = cleaned.replace(/Gemini isn[’']t human\.[\s\S]*?double-check it\.\s*/i, "");
      cleaned = cleaned.replace(/Your privacy & Gemini[\s\S]*$/i, " ");
      cleaned = cleaned.replace(/^Ask Gemini 3\s*/i, "");
      cleaned = cleaned.replace(/\bCreate image\b/gi, " ");
      cleaned = cleaned.replace(/\bHelp me learn\b/gi, " ");
      cleaned = cleaned.replace(/\bBoost my day\b/gi, " ");
    }

    if (this.config.id === "grok") {
      cleaned = cleaned.replace(/Get notified when Grok finishes answering[\s\S]*$/i, " ");
      cleaned = cleaned.replace(/\bFast\b/g, " ");
      cleaned = cleaned.replace(/\bAuto\b/g, " ");
    }

    if (this.config.id === "claude") {
      cleaned = cleaned.replace(/^Reply\.\.\.\s*/i, "");
      cleaned = cleaned.replace(/Claude is AI and can make mistakes\.[\s\S]*$/i, " ");
      cleaned = cleaned.replace(/Share\s*$/i, " ");
      cleaned = cleaned.replace(/^New chat\s*/i, "");
      cleaned = cleaned.replace(/^Search\s*/i, "");
      cleaned = cleaned.replace(/^Customize\s*/i, "");
      cleaned = cleaned.replace(/^Chats\s*/i, "");
      cleaned = cleaned.replace(/^Projects\s*/i, "");
      cleaned = cleaned.replace(/^Artifacts\s*/i, "");
      cleaned = cleaned.replace(/^Code\s*/i, "");
      cleaned = cleaned.replace(/^Search past conversations\s*/i, "");
      cleaned = cleaned.replace(/^Add context Claude remembers\s*/i, "");
      cleaned = cleaned.replace(/^Build prototypes instantly\s*/i, "");
      cleaned = cleaned.replace(/^Pair program with Claude\s*/i, "");
      cleaned = cleaned.replace(/^Recents\s*/i, "");
      cleaned = cleaned.replace(/^Hide\s*/i, "");
      cleaned = cleaned.replace(/^Free plan\s*/i, "");
      cleaned = cleaned.replace(/^Getaway\s*/i, "");
      cleaned = cleaned.replace(/^Sonnet\s+\d+(?:\.\d+)?\s*/i, "");
      cleaned = cleaned.replace(/^\d{1,2}:\d{2}\s*(?:AM|PM)?\s*$/gim, "");
      cleaned = cleaned.replace(/^G\s*$/gim, "");
      cleaned = cleaned.replace(/^Shar\s*$/gim, "");
    }

    const providerNoiseByLine = {
      chatgpt: new Set([
        "you said:",
        "chatgpt said:",
        "chatgpt can make mistakes. check important info.",
        "see cookie preferences.",
        "what’s on the agenda today?",
        "ask anything",
      ]),
      gemini: new Set([
        "you said",
        "gemini",
        "gemini said",
        "said",
        "tools",
        "fast",
        "ask gemini 3",
      ]),
      claude: new Set([
        "search past conversations",
        "projects",
        "add context claude remembers",
        "artifacts",
        "build prototypes instantly",
        "code",
        "pair program with claude",
        "recents",
        "hide",
        "free plan",
        "getaway",
      ]),
    } as const;
    const activeNoise = providerNoiseByLine[this.config.id as keyof typeof providerNoiseByLine] ?? new Set<string>();

    cleaned = cleaned
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => {
        if (!line) {
          return false;
        }

        const normalized = line.toLowerCase();
        return ![
          "share",
          "tools",
          "fast",
          "auto",
          "enable",
          "reply...",
          "think harder",
          "claude is ai and can make mistakes. please double-check responses.",
          "opens in a new window",
          "gemini",
          "your privacy & gemini",
          "you said",
          "you said:",
          "chatgpt said",
          "chatgpt said:",
        ].includes(normalized);
      })
      .filter((line) => {
        const normalized = line.toLowerCase();
        if (activeNoise.has(normalized)) {
          return false;
        }

        if (this.config.id === "claude" && /^\d{1,2}:\d{2}\s*(am|pm)?$/i.test(line)) {
          return false;
        }

        if (this.config.id === "chatgpt" && normalized.startsWith("please verify your age")) {
          return false;
        }

        if (this.config.id === "gemini" && (normalized.includes("gemini isn’t human") || normalized.includes("gemini isn't human"))) {
          return false;
        }

        if (this.config.id === "gemini" && normalized.startsWith("caricamento di ")) {
          return false;
        }

        return true;
      })
      .join("\n")
      .trim();

    return cleaned;
  }

  private normalizeMimeType(value?: string): string {
    if (!value) {
      return "audio/mpeg";
    }

    return value.split(";")[0]?.trim() || "audio/mpeg";
  }
}
