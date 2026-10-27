import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
import { complete } from "@/lib/chat/provider";
function stream(frames: any[]) {
  return new Response(
    new ReadableStream({
      start(c) {
        const text = frames
          .map(
            (f) =>
              "data: " +
              (typeof f === "string" ? f : JSON.stringify(f)) +
              "\n\n",
          )
          .join("");
        const bytes = new TextEncoder().encode(text);
        for (let i = 0; i < bytes.length; i += 7)
          c.enqueue(bytes.slice(i, i + 7));
        c.close();
      },
    }),
    { headers: { "content-type": "text/event-stream" } },
  );
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("OpenRouter transport", () => {
  it("streams text and reconstructs function arguments across arbitrary byte boundaries", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-only");
    const fetcher = vi.fn().mockResolvedValue(
      stream([
        { id: "request", choices: [{ delta: { content: "Hello " } }] },
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_1",
                    function: { name: "list_accounts", arguments: '{"lim' },
                  },
                ],
              },
            },
          ],
        },
        {
          choices: [
            {
              delta: {
                content: "there",
                tool_calls: [{ index: 0, function: { arguments: 'it":5}' } }],
              },
              finish_reason: "tool_calls",
            },
          ],
        },
        { usage: { prompt_tokens: 10, completion_tokens: 8 }, choices: [] },
        "[DONE]",
      ]),
    );
    vi.stubGlobal("fetch", fetcher);
    const text: string[] = [];
    const result = await complete(
      [{ role: "user", content: "Accounts" }],
      (s) => text.push(s),
      AbortSignal.timeout(1000),
    );
    expect(text.join("")).toBe("Hello there");
    expect(result.message.tool_calls?.[0]).toMatchObject({
      id: "call_1",
      function: { name: "list_accounts", arguments: '{"limit":5}' },
    });
    const sent = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(sent.model).toBe("openai/gpt-6-luna");
    expect(sent.provider).toEqual({
      require_parameters: true,
      allow_fallbacks: false,
    });
    expect(sent.tools.length).toBeGreaterThan(40);
    expect(result.usage?.completion_tokens).toBe(8);
  });
  it("fails closed on missing credentials, provider errors and interrupted/truncated output", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    await expect(
      complete([], () => {}, AbortSignal.timeout(1000)),
    ).rejects.toMatchObject({ code: "PROVIDER_NOT_CONFIGURED" });
    vi.stubEnv("OPENROUTER_API_KEY", "test-only");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 429 })),
    );
    await expect(
      complete([], () => {}, AbortSignal.timeout(1000)),
    ).rejects.toMatchObject({ status: 429 });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          stream([{ choices: [{ delta: { content: "partial" } }] }]),
        ),
    );
    await expect(
      complete([], () => {}, AbortSignal.timeout(1000)),
    ).rejects.toMatchObject({ code: "PROVIDER_STREAM_INTERRUPTED" });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          stream([
            { choices: [{ delta: {}, finish_reason: "length" }] },
            "[DONE]",
          ]),
        ),
    );
    await expect(
      complete([], () => {}, AbortSignal.timeout(1000)),
    ).rejects.toMatchObject({ code: "PROVIDER_OUTPUT_TRUNCATED" });
  });
});
