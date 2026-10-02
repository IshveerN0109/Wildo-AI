import OpenAI from "openai";

// ─── Chat provider selection ────────────────────────────────────────────────
//
// OpenAI, DeepSeek and Gemini all expose an OpenAI-compatible Chat Completions
// endpoint, so a single `openai` SDK instance can talk to any of them — only
// the base URL, API key and model name differ. Switch providers with the
// AI_PROVIDER env var (defaults to "deepseek"); image generation and audio
// transcription (lib/image, lib/audio) stay on OpenAI regardless, since
// DeepSeek/Gemini aren't wired up for those yet.

export type ChatProvider = "openai" | "deepseek" | "gemini";

const CHAT_PROVIDERS = {
  openai: {
    // Replit's own "AI Integrations" feature injects these two when connected;
    // fall back to a bare OPENAI_API_KEY otherwise. Do not remove this fallback.
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    defaultModel: "gpt-4o",
  },
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com",
    defaultModel: "deepseek-chat",
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    // Gemini's OpenAI-compatibility layer.
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    defaultModel: "gemini-2.5-flash",
  },
} satisfies Record<ChatProvider, { apiKey: string | undefined; baseURL: string | undefined; defaultModel: string }>;

const provider = (process.env.AI_PROVIDER as ChatProvider | undefined) ?? "deepseek";

// Chat model to use for the currently selected provider. Override with
// AI_CHAT_MODEL (e.g. to pin "deepseek-reasoner" or "gemini-2.5-pro"). Falls
// back to deepseek's default if AI_PROVIDER is misconfigured — this must
// never throw, see the lazy client below for why.
export const CHAT_MODEL =
  process.env.AI_CHAT_MODEL ?? (CHAT_PROVIDERS[provider] ?? CHAT_PROVIDERS.deepseek).defaultModel;

// The client is constructed lazily, on first use, rather than at module load.
// This module is imported by nearly every API route (directly or via chat
// calls), so an eager throw here for a missing/misconfigured provider key
// used to take down the ENTIRE server at startup instead of just the AI
// endpoints — one unset secret meant the whole app, including unrelated
// routes, stopped responding. Deferring the check means only requests that
// actually hit the AI provider fail (with a clear error), everything else
// keeps working.
let client: OpenAI | undefined;
let visionClient: OpenAI | undefined;

function getClient(): OpenAI {
  if (client) return client;

  const config = CHAT_PROVIDERS[provider];
  if (!config) {
    throw new Error(
      `Unknown AI_PROVIDER "${provider}". Expected one of: ${Object.keys(CHAT_PROVIDERS).join(", ")}.`,
    );
  }
  if (!config.apiKey) {
    throw new Error(
      `AI_PROVIDER is "${provider}" but its API key is not set. Please add it to secrets.`,
    );
  }

  client = new OpenAI({
    apiKey: config.apiKey,
    ...(config.baseURL ? { baseURL: config.baseURL } : {}),
  });
  return client;
}

export const openai: OpenAI = new Proxy({} as OpenAI, {
  get: (_target, prop, receiver) => Reflect.get(getClient(), prop, receiver),
});

function getVisionClient(): OpenAI {
  if (visionClient) return visionClient;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY must be set to analyze image attachments.");
  }

  visionClient = new OpenAI({ apiKey });
  return visionClient;
}

// Keep image analysis on the student's explicitly supplied OpenAI key without
// changing the provider used for the rest of the application.
export const openaiVision: OpenAI = new Proxy({} as OpenAI, {
  get: (_target, prop, receiver) => Reflect.get(getVisionClient(), prop, receiver),
});

export const VISION_CHAT_MODEL = "gpt-4o";
