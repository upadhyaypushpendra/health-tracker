export interface ChatMessage {
  role: "user" | "model";
  content: string;
}

const WORKER_URL = import.meta.env.VITE_AI_WORKER_URL as string;
const APP_SECRET = import.meta.env.VITE_APP_SECRET as string;

import { Preferences } from "@capacitor/preferences";

const PREF_KEY = "gemini_api_key";
export const getGeminiApiKey = async (): Promise<string> => {
  const { value } = await Preferences.get({ key: PREF_KEY });
  return value ?? "";
};
export const setGeminiApiKey = async (key: string): Promise<void> => {
  if (key.trim()) await Preferences.set({ key: PREF_KEY, value: key.trim() });
  else await Preferences.remove({ key: PREF_KEY });
};

const MODEL_INDEX_KEY = "gemini_model_index";
const getModelIndex = () => localStorage.getItem(MODEL_INDEX_KEY) ?? "0";
const saveModelIndex = (res: Response) => {
  const next = res.headers.get("X-Model-Index");
  console.log(res.headers);
  if (next !== null) {
    localStorage.setItem(MODEL_INDEX_KEY, next);
  }
};

async function buildHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-App-Secret": APP_SECRET,
    "X-Model-Index": getModelIndex(),
  };
  const userKey = await getGeminiApiKey();
  if (userKey) headers["X-Api-Key"] = userKey;
  return headers;
}

// Appends ?stream → Worker uses streamGenerateContent?alt=sse.
// Use for Progress Feedback (live token-by-token updates).
export async function streamChat(
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const contents = messages.map((m) => ({
    role: m.role,
    parts: [{ text: m.content }],
  }));

  const response = await fetch(`${WORKER_URL}?stream`, {
    method: "POST",
    headers: await buildHeaders(),
    body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: 88192 } }),
    signal,
  });

  if (!response.ok) throw new Error(`Request failed: ${response.status}`);

  saveModelIndex(response);

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (!data) continue;
      try {
        const parsed = JSON.parse(data);
        const text: string | undefined =
          parsed.candidates?.[0]?.content?.parts
            ?.filter((p: { thought?: boolean }) => !p.thought)
            ?.map((p: { text?: string }) => p.text ?? "")
            .join("");
        if (text) onChunk(text);
      } catch {
        // incomplete chunk, skip
      }
    }
  }
}

// ── Non-streaming ─────────────────────────────────────────────────────────────
// No query param → Worker uses generateContent (plain JSON).
// Use for Plan Creator (needs complete JSON before parsing).

interface GeminiPart {
  text?: string;
  thought?: boolean;
}
interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }>;
}

export async function chat(
  messages: ChatMessage[],
  signal?: AbortSignal
): Promise<string> {
  const contents = messages.map((m) => ({
    role: m.role,
    parts: [{ text: m.content }],
  }));

  let fullText = "";

  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: await buildHeaders(),
      body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: 88192 } }),
      signal,
    });

    const rawText = await response.text();

    saveModelIndex(response);

    if (!response.ok) {
      console.error("[chat] error", response.status, rawText.slice(0, 300));
      throw new Error(`Worker returned ${response.status}: ${rawText.slice(0, 150)}`);
    }

    let data: GeminiResponse;
    try {
      data = JSON.parse(rawText);
    } catch {
      console.error("[chat] JSON parse failed:", rawText.slice(0, 300));
      throw new Error("Response was not valid JSON — check Worker endpoint config.");
    }

    const candidate = data.candidates?.[0];
    const chunk =
      candidate?.content?.parts
        ?.filter((p) => !p.thought && p.text)
        ?.map((p) => p.text ?? "")
        .join("") ?? "";

    fullText += chunk;

    if (candidate?.finishReason !== "MAX_TOKENS") break;

    // Continuation: append what the model produced so far, then ask it to continue
    contents.push({ role: "model", parts: [{ text: chunk }] });
    contents.push({ role: "user", parts: [{ text: "Continue exactly from where you left off. Do not repeat any content." }] });
  }

  if (!fullText) {
    throw new Error("Gemini returned no text.");
  }

  return fullText;
}
