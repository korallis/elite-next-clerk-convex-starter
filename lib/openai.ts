import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is required");
    }
    client = new OpenAI({ apiKey });
  }
  return client;
}

export function tryGetOpenAIClient(): OpenAI | null {
  try {
    return getOpenAIClient();
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("OpenAI client unavailable", error);
    }
    return null;
  }
}

export const DEFAULT_SUMMARIZER_MODEL =
  process.env.OPENAI_TABLE_SUMMARIZER_MODEL ?? "o4-mini";

export const DEFAULT_EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-large";

export const DEFAULT_ANALYST_MODEL =
  process.env.OPENAI_ANALYST_MODEL ?? "o4-mini";

// Simple retry helper for OpenAI calls with jittered backoff
export async function withOpenAIRetry<T>(fn: () => Promise<T>, opts?: { retries?: number }) {
  const maxRetries = Math.max(0, Math.floor(opts?.retries ?? 2));
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status;
      const retriable = status === 429 || status >= 500 || err?.code === "ETIMEDOUT";
      if (attempt >= maxRetries || !retriable) throw err;
      const delay = Math.min(2000 * (attempt + 1), 8000) + Math.floor(Math.random() * 250);
      await new Promise((r) => setTimeout(r, delay));
      attempt++;
    }
  }
}
