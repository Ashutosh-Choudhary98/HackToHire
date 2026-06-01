// Server-only helper for Lovable AI Gateway.
const BASE_URL = "https://ai.gateway.lovable.dev/v1";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function aiJSON<T = unknown>(
  messages: ChatMessage[],
  opts?: { model?: string; temperature?: number },
): Promise<T> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Lovable-API-Key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts?.model ?? "google/gemini-3-flash-preview",
      messages,
      temperature: opts?.temperature ?? 0.5,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("AI rate limit reached. Please wait a moment and try again.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
    throw new Error(`AI request failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content) as T;
  } catch {
    // Fallback: try to find a JSON block
    const match = content.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error("AI returned non-JSON response");
  }
}
