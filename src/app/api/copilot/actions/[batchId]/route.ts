import { z } from "zod";
import { body, endpoint, uuid } from "@/lib/chat/core";
import { editBatch, getBatch } from "@/lib/chat/actions";
type Context = { params: Promise<{ batchId: string }> };
export async function GET(req: Request, ctx: Context) {
  return endpoint(req, async (userId) =>
    getBatch(uuid.parse((await ctx.params).batchId), userId),
  );
}
export async function PATCH(req: Request, ctx: Context) {
  return endpoint(req, async (userId) => {
    const a = z
      .object({
        previewHash: z.string().length(64),
        edits: z
          .array(
            z
              .object({
                position: z.number().int().min(0).max(24),
                arguments: z.record(z.unknown()),
              })
              .strict(),
          )
          .min(1)
          .max(25),
      })
      .strict()
      .parse(await body(req));
    return editBatch(
      uuid.parse((await ctx.params).batchId),
      userId,
      a.previewHash,
      a.edits,
    );
  });
}
