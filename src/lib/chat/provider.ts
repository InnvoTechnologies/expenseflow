import { ChatError } from "./core";
import { providerTools } from "./tools";
export type ProviderMessage = {
  role: string;
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
};
export type Completion = {
  message: ProviderMessage;
  id?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};
export const model = () => process.env.OPENROUTER_MODEL || "openai/gpt-6-luna";
export async function complete(
  messages: ProviderMessage[],
  onText: (text: string) => void,
  signal: AbortSignal,
): Promise<Completion> {
  if (!process.env.OPENROUTER_API_KEY)
    throw new ChatError(503, "PROVIDER_NOT_CONFIGURED");
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "X-Title": "ExpenseFlow",
      },
      body: JSON.stringify({
        model: model(),
        messages,
        tools: providerTools(),
        tool_choice: "auto",
        provider: { require_parameters: true, allow_fallbacks: false },
        stream: true,
        stream_options: { include_usage: true },
        max_tokens: 4096,
      }),
      signal,
    },
  );
  if (!response.ok || !response.body)
    throw new ChatError(response.status === 429 ? 429 : 502, "PROVIDER_ERROR");
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = "",
    content = "",
    id: string | undefined,
    usage: Completion["usage"];
  const calls: Record<number, any> = {};
  let finished = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") {
          finished = true;
          continue;
        }
        if (!data) continue;
        let frame: any;
        try {
          frame = JSON.parse(data);
        } catch {
          throw new ChatError(502, "INVALID_PROVIDER_STREAM");
        }
        if (frame.error) throw new ChatError(502, "PROVIDER_ERROR");
        id = frame.id || id;
        usage = frame.usage || usage;
        const delta = frame.choices?.[0]?.delta;
        if (frame.choices?.[0]?.finish_reason === "length")
          throw new ChatError(502, "PROVIDER_OUTPUT_TRUNCATED");
        if (delta?.content) {
          content += delta.content;
          onText(delta.content);
        }
        for (const call of delta?.tool_calls || []) {
          const current =
            calls[call.index] ||
            (calls[call.index] = {
              id: "",
              type: "function",
              function: { name: "", arguments: "" },
            });
          if (call.id) current.id = call.id;
          if (call.function?.name) current.function.name += call.function.name;
          if (call.function?.arguments)
            current.function.arguments += call.function.arguments;
        }
      }
      if (
        content.length > 24000 ||
        Object.keys(calls).length > 25 ||
        JSON.stringify(calls).length > 64000
      )
        throw new ChatError(502, "PROVIDER_OUTPUT_TOO_LARGE");
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
  if (!finished) throw new ChatError(502, "PROVIDER_STREAM_INTERRUPTED");
  const tool_calls = Object.values(calls);
  if (tool_calls.some((c) => !c.id || !c.function.name))
    throw new ChatError(502, "INVALID_PROVIDER_TOOL_CALL");
  return {
    id,
    usage,
    message: {
      role: "assistant",
      content: content || null,
      ...(tool_calls.length ? { tool_calls } : {}),
    },
  };
}
