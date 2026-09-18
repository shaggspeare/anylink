const MODEL = "gpt-5.6-luna";

/** One JSON-mode chat call. Returns null on anything going wrong — no key, a refusal,
 * a timeout, unparseable output — because every caller has a non-LLM fallback and none
 * of them should fail a user action over this. */
export async function chatJson<T>(
  system: string,
  user: unknown,
  { maxTokens = 4000, timeoutMs = 25_000 }: { maxTokens?: number; timeoutMs?: number } = {}
): Promise<T | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: "json_object" },
        max_completion_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: typeof user === "string" ? user : JSON.stringify(user) },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      console.error("chatJson: request failed", res.status, await res.text().catch(() => ""));
      return null;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;

    const parsed = JSON.parse(content);
    return parsed && typeof parsed === "object" ? (parsed as T) : null;
  } catch (err) {
    console.error("chatJson failed:", err);
    return null;
  }
}
