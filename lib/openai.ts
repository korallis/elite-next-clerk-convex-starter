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
