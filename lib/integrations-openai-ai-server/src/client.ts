import OpenAI from "openai";

// Re-derived from the client's own call signature rather than deep-imported
// from "openai/resources/..." — that package only publishes types for its
// root export under moduleResolution "bundler" (no `types` condition on its
// ./resources/* subpaths). Consumers that don't otherwise depend on "openai"
// directly (e.g. api-server) should import these from here instead.
export type ChatCompletionCreateParams = Parameters<OpenAI["chat"]["completions"]["create"]>[0];
export type ChatCompletionMessageParam = ChatCompletionCreateParams["messages"][number];
export type ChatCompletionUserMessageParam = Extract<ChatCompletionMessageParam, { role: "user" }>;
export type ChatCompletionContentPart = Extract<
  ChatCompletionUserMessageParam["content"],
  readonly unknown[]
>[number];

// ─── Chat provider selection ────────────────────────────────────────────────
//
// OpenAI, DeepSeek and Gemini all expose an OpenAI-compatible Chat Completions
// endpoint, so a single `openai` SDK instance can talk to any of them — only
// the base URL, API key and model name differ. Switch providers with the
// AI_PROVIDER env var (defaults to "deepseek"); image generation and audio
// transcription (lib/image, lib/audio) stay on OpenAI regardless, since
// DeepSeek/Gemini aren't wired up for those yet.

export type ChatProvider = "openai" | "deepseek" | "gemini";

interface ProviderConfig {
  apiKey: string | undefined;
  baseURL: string | undefined;
  defaultModel: string;
  visionCapable: boolean;
}

const CHAT_PROVIDERS = {
  openai: {
    // Replit's own "AI Integrations" feature injects these two when connected;
    // fall back to a bare OPENAI_API_KEY otherwise. Do not remove this fallback.
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    defaultModel: "gpt-4o",
    visionCapable: true,
  },
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com",
    defaultModel: "deepseek-chat",
    visionCapable: false,
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    // Gemini's OpenAI-compatibility layer.
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    defaultModel: "gemini-2.5-flash",
    visionCapable: true,
  },
} satisfies Record<ChatProvider, ProviderConfig>;

const provider = (process.env.AI_PROVIDER as ChatProvider | undefined) ?? "deepseek";

/** Which provider the default `openai` client actually talks to — for cost-tracking/logging, not routing logic. */
export const ACTIVE_PROVIDER: ChatProvider = provider;

// Which provider handles messages that include an image attachment. The main
// AI_PROVIDER may be deepseek (cheap, but text-only), so vision requests fall
// back to this one instead. Defaults to "openai"; set AI_VISION_PROVIDER=gemini
// in secrets to switch without touching code — both are kept ready to go.
const visionProvider = (process.env.AI_VISION_PROVIDER as ChatProvider | undefined) ?? "openai";

// Chat model to use for the currently selected provider. Override with
// AI_CHAT_MODEL (e.g. to pin "deepseek-reasoner" or "gemini-2.5-pro"). Falls
// back to deepseek's default if AI_PROVIDER is misconfigured — this must
// never throw, see the lazy clients below for why.
export const CHAT_MODEL =
  process.env.AI_CHAT_MODEL ?? (CHAT_PROVIDERS[provider] ?? CHAT_PROVIDERS.deepseek).defaultModel;

// The provider actually used for vision requests: the default provider
// itself when it already supports images, otherwise AI_VISION_PROVIDER.
const effectiveVisionProvider: ChatProvider = CHAT_PROVIDERS[provider]?.visionCapable
  ? provider
  : visionProvider;

export const VISION_MODEL =
  effectiveVisionProvider === provider
    ? CHAT_MODEL
    : (CHAT_PROVIDERS[effectiveVisionProvider] ?? CHAT_PROVIDERS.openai).defaultModel;

/** Which provider the `visionOpenai` client actually talks to — for cost-tracking/logging. */
export const ACTIVE_VISION_PROVIDER: ChatProvider = effectiveVisionProvider;

// Clients are constructed lazily, on first use, rather than at module load.
// This module is imported by nearly every API route (directly or via chat
// calls), so an eager throw here for a missing/misconfigured provider key
// used to take down the ENTIRE server at startup instead of just the AI
// endpoints — one unset secret meant the whole app, including unrelated
// routes, stopped responding. Deferring the check means only requests that
// actually hit that provider fail (with a clear error), everything else
// keeps working.
const clients = new Map<ChatProvider, OpenAI>();

function getClientFor(p: ChatProvider): OpenAI {
  const cached = clients.get(p);
  if (cached) return cached;

  const config = CHAT_PROVIDERS[p];
  if (!config) {
    throw new Error(
      `Unknown AI provider "${p}". Expected one of: ${Object.keys(CHAT_PROVIDERS).join(", ")}.`,
    );
  }
  if (!config.apiKey) {
    throw new Error(
      `AI provider "${p}" is selected but its API key is not set. Please add it to secrets.`,
    );
  }

  const built = new OpenAI({
    apiKey: config.apiKey,
    ...(config.baseURL ? { baseURL: config.baseURL } : {}),
  });
  clients.set(p, built);
  return built;
}

function lazyProxy(resolveProvider: () => ChatProvider): OpenAI {
  return new Proxy({} as OpenAI, {
    get: (_target, prop, receiver) => Reflect.get(getClientFor(resolveProvider()), prop, receiver),
  });
}

/** Default chat client — talks to whichever provider AI_PROVIDER selects. */
export const openai: OpenAI = lazyProxy(() => provider);

/**
 * Vision-capable client for messages with image attachments. Reuses the
 * default client when AI_PROVIDER already supports vision (openai, gemini);
 * otherwise uses AI_VISION_PROVIDER (default "openai") since the default
 * provider might be deepseek, which has no vision support at all. Pair with
 * VISION_MODEL, not CHAT_MODEL, when calling this client.
 */
export const visionOpenai: OpenAI = lazyProxy(() => effectiveVisionProvider);
