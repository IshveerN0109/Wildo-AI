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

export const openai = new OpenAI({
  apiKey: config.apiKey,
  ...(config.baseURL ? { baseURL: config.baseURL } : {}),
});

// Chat model to use for the currently selected provider. Override with
// AI_CHAT_MODEL (e.g. to pin "deepseek-reasoner" or "gemini-2.5-pro").
export const CHAT_MODEL = process.env.AI_CHAT_MODEL ?? config.defaultModel;
