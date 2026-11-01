import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-5-5";

let client: Anthropic | undefined;

/** One Claude call that answers in JSON. Returns null on anything going wrong — no key, a
 * refusal, a timeout, unparseable output — because every caller has a non-LLM fallback and
 * none of them should fail a user action over this. */
export async function chatJson<T>(
  system: string,
  user: unknown,
  {
    maxTokens = 16_000,
    timeoutMs = 25_000,
    effort,
  }: { maxTokens?: number; timeoutMs?: number; effort?: "low" | "medium" | "high" } = {}
): Promise<T | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  // The key isn't scoped to one workspace, so every request has to name it.
  client ??= new Anthropic({
    defaultHeaders: { "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID },
  });

  try {
    const res = await client.beta.messages.create(
      {
        model: MODEL,
        max_tokens: maxTokens,
        output_config: effort ? { effort } : undefined,
        // A safety-classifier decline is re-run server-side on Anthropic's recommended model.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system,
        messages: [{ role: "user", content: typeof user === "string" ? user : JSON.stringify(user) }],
      },
      // Caps the whole call, the SDK's retries included.
      { signal: AbortSignal.timeout(timeoutMs) }
    );

    if (res.stop_reason !== "end_turn") {
      console.error("chatJson: stopped early", res.stop_reason);
      return null;
    }
    const text = res.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")?.text ?? "";
    // The prompts ask for bare JSON; cutting to the outer braces also survives a ```json fence.
    const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    return parsed && typeof parsed === "object" ? (parsed as T) : null;
  } catch (err) {
    console.error("chatJson failed:", err);
    return null;
  }
}
