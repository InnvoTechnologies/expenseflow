import { z } from "zod";
import { body, endpoint, uuid } from "@/lib/chat/core";
import { approve } from "@/lib/chat/actions";
export async function POST(
  req: Request,
  ctx: { params: Promise<{ batchId: string }> },
) {
  return endpoint(req, async (userId) => {
    const a = z
      .object({ previewHash: z.string().length(64), executionKey: uuid })
      .strict()
      .parse(await body(req));
    return approve(
      uuid.parse((await ctx.params).batchId),
      userId,
      a.previewHash,
      a.executionKey,
    );
  });
}
