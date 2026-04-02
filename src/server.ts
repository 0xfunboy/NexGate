import { readFile } from "node:fs/promises";
import path from "node:path";

import Fastify, { type FastifyReply } from "fastify";
import { z } from "zod";

import { AccountManager } from "./accounts.js";
import { AudioStore } from "./audio-store.js";
import { SessionManager } from "./browser/session-manager.js";
import { loadGatewayConfig, loadProviderConfigs } from "./config.js";
import { toUiError } from "./errors.js";
import { FrontendGateway, setupNdjsonHeaders, setupSseHeaders, writeNdjson, writeOpenAiDone, writeSse } from "./gateway.js";
import { ProviderRegistry } from "./providers/registry.js";
import type { AccountConfig, ChatMessage, ChatRole, CompletionRequest, ProviderId } from "./types.js";
import { nowUnix, parseModelProvider } from "./utils.js";

const providerSchema = z.enum(["chatgpt", "claude", "gemini", "grok"]);
const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.string(),
});

const textPartSchema = z.object({
  type: z.string().optional(),
  text: z.string().optional(),
  input_text: z.string().optional(),
}).passthrough();

const openAiMessageSchema = z.object({
  role: z.enum(["system", "developer", "user", "assistant", "tool"]),
  content: z.union([z.string(), z.array(textPartSchema), z.null()]).optional().default(""),
}).passthrough();

const openAiRequestSchema = z.object({
  provider: providerSchema.optional(),
  model: z.string().default("chatgpt:frontend-default"),
  messages: z.array(openAiMessageSchema).min(1),
  stream: z.boolean().optional().default(false),
}).passthrough();

const responseInputMessageSchema = z.object({
  role: z.enum(["system", "developer", "user", "assistant", "tool"]).optional().default("user"),
  content: z.union([
    z.string(),
    z.array(textPartSchema),
  ]),
}).passthrough();

const responsesRequestSchema = z.object({
  provider: providerSchema.optional(),
  model: z.string().default("chatgpt:frontend-default"),
  input: z.union([z.string().min(1), z.array(responseInputMessageSchema).min(1)]),
  instructions: z.string().optional(),
  stream: z.boolean().optional().default(false),
}).passthrough();

const ollamaGenerateSchema = z.object({
  provider: providerSchema.optional(),
  model: z.string().default("chatgpt:frontend-default"),
  prompt: z.string().min(1),
  system: z.string().optional(),
  stream: z.boolean().optional().default(true),
});

const ollamaChatSchema = z.object({
  provider: providerSchema.optional(),
  model: z.string().default("chatgpt:frontend-default"),
  messages: z.array(messageSchema).min(1),
  stream: z.boolean().optional().default(true),
});

const compareRequestSchema = z.object({
  providers: z.array(providerSchema).min(1),
  prompt: z.string().min(1),
});

function resolveProvider(model: string, explicitProvider?: ProviderId): { provider: ProviderId; model: string } {
  const parsed = parseModelProvider(model);
  const provider = explicitProvider ?? parsed.provider ?? "chatgpt";
  return { provider, model: parsed.model };
}

function toCompletionRequest(input: {
  provider?: ProviderId;
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
}): CompletionRequest {
  const resolved = resolveProvider(input.model, input.provider);
  return {
    provider: resolved.provider,
    model: resolved.model,
    messages: input.messages,
    stream: input.stream,
  };
}

function normalizeRole(role?: string): ChatRole {
  if (role === "developer") {
    return "system";
  }

  if (role === "system" || role === "user" || role === "assistant" || role === "tool") {
    return role;
  }

  return "user";
}

function extractTextContent(content: string | Array<{ text?: string; input_text?: string }> | null | undefined): string {
  if (typeof content === "string") {
    return content;
  }

  if (!content) {
    return "";
  }

  return content
    .map((part) => part.text ?? part.input_text ?? "")
    .filter(Boolean)
    .join("\n");
}

function toChatMessages(input: Array<{ role?: string; content?: string | Array<{ text?: string; input_text?: string }> | null }>): ChatMessage[] {
  return input
    .map((message) => ({
      role: normalizeRole(message.role),
      content: extractTextContent(message.content).trim(),
    }))
    .filter((message) => message.content.length > 0);
}

function toResponseMessages(
  input: string | Array<{ role?: string; content: string | Array<{ text?: string; input_text?: string }> }>,
  instructions?: string,
): ChatMessage[] {
  const messages: ChatMessage[] = [];

  if (instructions?.trim()) {
    messages.push({ role: "system", content: instructions.trim() });
  }

  if (typeof input === "string") {
    messages.push({ role: "user", content: input });
    return messages;
  }

  messages.push(...toChatMessages(input));
  return messages;
}

function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.max(1, Math.ceil(trimmed.length / 4));
}

function buildUsage(inputMessages: ChatMessage[], outputText: string) {
  const promptText = inputMessages.map((message) => message.content).join("\n");
  const promptTokens = estimateTokens(promptText);
  const completionTokens = estimateTokens(outputText);
  return {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: promptTokens + completionTokens,
  };
}

function toOpenAiResponseObject(args: {
  id: string;
  model: string;
  text: string;
  images?: { src: string; alt?: string }[];
  inputMessages?: ChatMessage[];
}) {
  const messageId = `msg_${args.id}`;
  return {
    id: args.id,
    object: "response",
    created_at: nowUnix(),
    status: "completed",
    model: args.model,
    output: [
      {
        id: messageId,
        type: "message",
        role: "assistant",
        content: [
          {
            type: "output_text",
            text: args.text,
            annotations: [],
          },
        ],
      },
    ],
    output_text: args.text,
    images: args.images ?? [],
    usage: buildUsage(args.inputMessages ?? [], args.text),
  };
}

async function executeCompareProvider(gateway: FrontendGateway, provider: ProviderId, prompt: string) {
  const startedAt = Date.now();

  try {
    const result = await gateway.complete({
      provider,
      model: "frontend-default",
      messages: [{ role: "user", content: prompt }],
    });

    return {
      provider,
      ok: true,
      latencyMs: Date.now() - startedAt,
      text: result.text,
      images: result.images,
      audioSupported: provider === "grok",
    };
  } catch (error) {
    const uiError = toUiError(error);
    return {
      provider,
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: uiError.detail,
      code: uiError.code,
      title: uiError.title,
      hint: uiError.hint,
      audioSupported: provider === "grok",
    };
  }
}

export async function buildServer() {
  const config = loadGatewayConfig();
  const providerConfigs = loadProviderConfigs();
  const registry = new ProviderRegistry(providerConfigs, config);
  const sessions = new SessionManager(config);
  const accountManager = new AccountManager(
    path.resolve(process.cwd(), "accounts.config.json"),
    config,
  );
  const gateway = new FrontendGateway(registry, sessions, accountManager, config);
  const audioStore = new AudioStore();
  const publicDir = path.resolve(process.cwd(), "public");

  const app = Fastify({ logger: true });

  app.setErrorHandler((error, _request, reply) => {
    const uiError = toUiError(error);
    const statusCode = uiError.code === "UNEXPECTED_ERROR" ? 500 : 409;
    reply.status(statusCode).send({
      statusCode,
      error: uiError.title,
      ...uiError,
    });
  });

  async function serveStatic(reply: FastifyReply, filePath: string, contentType: string) {
    const contents = await readFile(path.join(publicDir, filePath), "utf8");
    return reply.type(contentType).send(contents);
  }

  app.get("/", async (_request, reply) => serveStatic(reply, "index.html", "text/html; charset=utf-8"));
  app.get("/docs", async (_request, reply) => serveStatic(reply, "docs.html", "text/html; charset=utf-8"));
  app.get("/app.js", async (_request, reply) => serveStatic(reply, "app.js", "application/javascript; charset=utf-8"));
  app.get("/styles.css", async (_request, reply) => serveStatic(reply, "styles.css", "text/css; charset=utf-8"));

  app.get("/health", async () => ({
    ok: true,
    providers: registry.list().map((provider) => provider.config.id),
  }));

  app.get("/providers", async () =>
    registry.list().map((provider) => ({
      id: provider.config.id,
      label: provider.config.label,
      baseUrl: provider.config.baseUrl,
      accounts: accountManager.getAll(provider.config.id),
    })),
  );

  app.get("/providers/overview", async () => {
    const providers = registry.list();
    const statuses = await Promise.all(
      providers.map(async (provider) => {
        try {
          return await gateway.status(provider.config.id);
        } catch (error) {
          return {
            provider: provider.config.id,
            ready: false,
            launched: false,
            persisted: false,
            account: accountManager.getActiveEmail(provider.config.id),
            quotaState: accountManager.getQuotaState(provider.config.id),
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }),
    );

    return providers.map((provider) => {
      const status = statuses.find((entry) => entry.provider === provider.config.id);
      return {
        id: provider.config.id,
        label: provider.config.label,
        baseUrl: provider.config.baseUrl,
        accounts: accountManager.getAll(provider.config.id),
        status,
      };
    });
  });

  // ── Account management endpoints ──────────────────────────

  app.get("/accounts", async () => {
    const ids: ProviderId[] = ["chatgpt", "claude", "gemini", "grok"];
    const result: Record<string, ReturnType<typeof accountManager.getAll>> = {};
    for (const id of ids) result[id] = accountManager.getAll(id);
    return result;
  });

  app.post("/accounts/:provider", async (request) => {
    const params = z.object({ provider: providerSchema }).parse(request.params);
    const body = z
      .object({
        email: z.string().min(1),
        profileDir: z.string().regex(/^[\w-]+$/).min(1),
        label: z.string().optional(),
      })
      .parse(request.body);

    const account: AccountConfig = { email: body.email, profileDir: body.profileDir, label: body.label };
    accountManager.addAccount(params.provider, account);
    return { provider: params.provider, accounts: accountManager.getAll(params.provider) };
  });

  app.post("/providers/:provider/accounts/rotate", async (request) => {
    const params = z.object({ provider: providerSchema }).parse(request.params);
    const newEmail = accountManager.rotate(params.provider);
    if (newEmail !== null) {
      // Close current page so next request uses the new profile.
      await gateway.reset(params.provider);
    }
    return {
      provider: params.provider,
      rotated: newEmail !== null,
      active: {
        email: accountManager.getActiveEmail(params.provider),
        profileDir: accountManager.getActiveRelativeDir(params.provider),
      },
    };
  });

  app.post("/providers/:provider/accounts/reset-quota", async (request) => {
    const params = z.object({ provider: providerSchema }).parse(request.params);
    accountManager.resetQuota(params.provider);
    return { provider: params.provider, accounts: accountManager.getAll(params.provider) };
  });

  app.post("/providers/:provider/login", async (request) => {
    const params = z.object({ provider: providerSchema }).parse(request.params);
    return gateway.login(params.provider);
  });

  app.post("/providers/:provider/reset", async (request) => {
    const params = z.object({ provider: providerSchema }).parse(request.params);
    return gateway.reset(params.provider);
  });

  app.get("/providers/:provider/status", async (request) => {
    const params = z.object({ provider: providerSchema }).parse(request.params);
    return gateway.status(params.provider);
  });

  app.post("/providers/:provider/prompt", async (request) => {
    const params = z.object({ provider: providerSchema }).parse(request.params);
    const body = z.object({ prompt: z.string().min(1) }).parse(request.body);

    return gateway.complete({
      provider: params.provider,
      model: "frontend-default",
      messages: [{ role: "user", content: body.prompt }],
    });
  });

  app.post("/providers/:provider/audio", async (request) => {
    const params = z.object({ provider: providerSchema }).parse(request.params);
    const audio = await gateway.captureAudio(params.provider);
    const cached = audioStore.save({
      provider: params.provider,
      data: audio.data,
      mimeType: audio.mimeType,
      createdAt: new Date().toISOString(),
    });

    return {
      provider: params.provider,
      ok: true,
      mimeType: cached.mimeType,
      bytes: cached.data.length,
      createdAt: cached.createdAt,
      url: `/providers/${params.provider}/audio/latest?ts=${Date.now()}`,
    };
  });

  app.get("/providers/:provider/audio/latest", async (request, reply) => {
    const params = z.object({ provider: providerSchema }).parse(request.params);
    const cached = audioStore.get(params.provider);

    if (!cached) {
      reply.status(404);
      return {
        statusCode: 404,
        error: "Audio non trovato",
        detail: `Nessun audio disponibile per ${params.provider}. Genera prima il read aloud.`,
      };
    }

    reply.header("Cache-Control", "no-store");
    return reply.type(cached.mimeType).send(cached.data);
  });

  // Per-provider real-time SSE streaming (used by the dashboard for parallel streaming)
  app.post("/providers/:provider/stream", async (request, reply) => {
    const params = z.object({ provider: providerSchema }).parse(request.params);
    const body = z.object({ prompt: z.string().min(1) }).parse(request.body);

    setupSseHeaders(reply);

    try {
      await gateway.stream(
        {
          provider: params.provider,
          model: "frontend-default",
          messages: [{ role: "user", content: body.prompt }],
        },
        {
          onToken: async (token) => {
            await writeSse(reply, { type: "token", delta: token });
          },
          onComplete: async ({ text, images }) => {
            await writeSse(reply, { type: "done", text, images });
            reply.raw.end();
          },
          onQuotaRotating: async ({ fromEmail, toEmail }) => {
            await writeSse(reply, {
              type: "quota_rotating",
              provider: params.provider,
              fromEmail,
              toEmail,
            });
          },
        },
      );
    } catch (error) {
      const uiError = toUiError(error);
      await writeSse(reply, { type: "error", ...uiError });
      reply.raw.end();
    }

    return reply;
  });

  app.post("/compare", async (request) => {
    const body = compareRequestSchema.parse(request.body);

    const results = await Promise.all(body.providers.map((provider) => executeCompareProvider(gateway, provider, body.prompt)));

    return {
      prompt: body.prompt,
      createdAt: new Date().toISOString(),
      results,
    };
  });

  app.post("/compare/stream", async (request, reply) => {
    const body = compareRequestSchema.parse(request.body);
    setupNdjsonHeaders(reply);

    await Promise.all(
      body.providers.map(async (provider) => {
        const result = await executeCompareProvider(gateway, provider, body.prompt);
        await writeNdjson(reply, { type: "result", result });
      }),
    );

    await writeNdjson(reply, {
      type: "done",
      prompt: body.prompt,
      createdAt: new Date().toISOString(),
    });
    reply.raw.end();
    return reply;
  });

  app.post("/v1/chat/completions", async (request, reply) => {
    const body = openAiRequestSchema.parse(request.body);
    const messages = toChatMessages(body.messages);
    const completionRequest = toCompletionRequest({
      provider: body.provider,
      model: body.model,
      messages,
      stream: body.stream,
    });

    if (!body.stream) {
      const result = await gateway.complete(completionRequest);
      return {
        id: `chatcmpl_${result.id}`,
        object: "chat.completion",
        created: nowUnix(),
        model: `${completionRequest.provider}:${completionRequest.model}`,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: result.text },
            finish_reason: "stop",
          },
        ],
        images: result.images,
        usage: buildUsage(messages, result.text),
      };
    }

    setupSseHeaders(reply);
    const completionId = `chatcmpl_${Date.now()}`;
    let sentRoleChunk = false;

    await gateway.stream(completionRequest, {
      onToken: async (token) => {
        if (!sentRoleChunk) {
          sentRoleChunk = true;
          await writeSse(reply, {
            id: completionId,
            object: "chat.completion.chunk",
            created: nowUnix(),
            model: `${completionRequest.provider}:${completionRequest.model}`,
            choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }],
          });
        }
        await writeSse(reply, {
          id: completionId,
          object: "chat.completion.chunk",
          created: nowUnix(),
          model: `${completionRequest.provider}:${completionRequest.model}`,
          choices: [{ index: 0, delta: { content: token }, finish_reason: null }],
        });
      },
      onComplete: async () => {
        await writeSse(reply, {
          id: completionId,
          object: "chat.completion.chunk",
          created: nowUnix(),
          model: `${completionRequest.provider}:${completionRequest.model}`,
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
        });
        await writeOpenAiDone(reply);
        reply.raw.end();
      },
    });

    return reply;
  });

  app.get("/v1/models", async () => {
    const models = registry.list().map((provider) => ({
      id: `${provider.config.id}:frontend-default`,
      object: "model",
      created: 0,
      owned_by: "frontend-llm-gateway",
    }));

    return {
      object: "list",
      data: models,
    };
  });

  app.get("/v1/models/:model", async (request, reply) => {
    const params = z.object({ model: z.string().min(1) }).parse(request.params);
    const model = registry.list().find((provider) => `${provider.config.id}:frontend-default` === params.model);
    if (!model) {
      reply.status(404);
      return {
        error: {
          message: `Model ${params.model} not found`,
          type: "invalid_request_error",
          param: "model",
          code: "model_not_found",
        },
      };
    }

    return {
      id: `${model.config.id}:frontend-default`,
      object: "model",
      created: 0,
      owned_by: "frontend-llm-gateway",
    };
  });

  app.post("/v1/responses", async (request, reply) => {
    const body = responsesRequestSchema.parse(request.body);
    const messages = toResponseMessages(body.input, body.instructions);
    const completionRequest = toCompletionRequest({
      provider: body.provider,
      model: body.model,
      messages,
      stream: body.stream,
    });

    if (!body.stream) {
      const result = await gateway.complete(completionRequest);
      return toOpenAiResponseObject({
        id: result.id,
        model: `${completionRequest.provider}:${completionRequest.model}`,
        text: result.text,
        images: result.images,
        inputMessages: messages,
      });
    }

    setupSseHeaders(reply);
    const responseId = `resp_${Date.now()}`;
    const model = `${completionRequest.provider}:${completionRequest.model}`;
    const messageId = `msg_${responseId}`;
    let streamedText = "";

    await writeSse(reply, {
      type: "response.created",
      response: {
        id: responseId,
        object: "response",
        created_at: nowUnix(),
        status: "in_progress",
        model,
      },
    });

    await gateway.stream(completionRequest, {
      onToken: async (token) => {
        streamedText += token;
        await writeSse(reply, {
          type: "response.output_text.delta",
          response_id: responseId,
          item_id: messageId,
          output_index: 0,
          content_index: 0,
          delta: token,
        });
      },
      onComplete: async ({ text, images }) => {
        await writeSse(reply, {
          type: "response.output_text.done",
          response_id: responseId,
          item_id: messageId,
          output_index: 0,
          content_index: 0,
          text,
        });
        await writeSse(reply, {
          type: "response.completed",
          response: toOpenAiResponseObject({
            id: responseId,
            model,
            text: text || streamedText,
            images,
            inputMessages: messages,
          }),
        });
        reply.raw.end();
      },
    });

    return reply;
  });

  app.post("/api/generate", async (request, reply) => {
    const body = ollamaGenerateSchema.parse(request.body);
    const messages: ChatMessage[] = [];

    if (body.system) {
      messages.push({ role: "system", content: body.system });
    }
    messages.push({ role: "user", content: body.prompt });

    const completionRequest = toCompletionRequest({
      provider: body.provider,
      model: body.model,
      messages,
      stream: body.stream,
    });

    if (!body.stream) {
      const result = await gateway.complete(completionRequest);
      return {
        model: `${completionRequest.provider}:${completionRequest.model}`,
        created_at: new Date().toISOString(),
        response: result.text,
        images: result.images,
        done: true,
      };
    }

    setupNdjsonHeaders(reply);

    await gateway.stream(completionRequest, {
      onToken: async (token) => {
        await writeNdjson(reply, {
          model: `${completionRequest.provider}:${completionRequest.model}`,
          created_at: new Date().toISOString(),
          response: token,
          done: false,
        });
      },
      onComplete: async ({ text }) => {
        await writeNdjson(reply, {
          model: `${completionRequest.provider}:${completionRequest.model}`,
          created_at: new Date().toISOString(),
          response: "",
          done: true,
          done_reason: "stop",
          total_duration: 0,
          load_duration: 0,
          prompt_eval_count: 0,
          eval_count: text.length,
        });
        reply.raw.end();
      },
    });

    return reply;
  });

  app.post("/api/chat", async (request, reply) => {
    const body = ollamaChatSchema.parse(request.body);
    const completionRequest = toCompletionRequest(body);

    if (!body.stream) {
      const result = await gateway.complete(completionRequest);
      return {
        model: `${completionRequest.provider}:${completionRequest.model}`,
        created_at: new Date().toISOString(),
        message: { role: "assistant", content: result.text },
        images: result.images,
        done: true,
      };
    }

    setupNdjsonHeaders(reply);

    await gateway.stream(completionRequest, {
      onToken: async (token) => {
        await writeNdjson(reply, {
          model: `${completionRequest.provider}:${completionRequest.model}`,
          created_at: new Date().toISOString(),
          message: { role: "assistant", content: token },
          done: false,
        });
      },
      onComplete: async () => {
        await writeNdjson(reply, {
          model: `${completionRequest.provider}:${completionRequest.model}`,
          created_at: new Date().toISOString(),
          message: { role: "assistant", content: "" },
          done: true,
          done_reason: "stop",
        });
        reply.raw.end();
      },
    });

    return reply;
  });

  app.addHook("onClose", async () => {
    await gateway.close();
  });

  return { app, config, gateway, accountManager };
}
