import { endpoint, uuid } from "@/lib/chat/core";
import { rejectBatch } from "@/lib/chat/actions";
export async function POST(
  req: Request,
  ctx: { params: Promise<{ batchId: string }> },
) {
  return endpoint(req, async (userId) =>
    rejectBatch(uuid.parse((await ctx.params).batchId), userId),
  );
}
