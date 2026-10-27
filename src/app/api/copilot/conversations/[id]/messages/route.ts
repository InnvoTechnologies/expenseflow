import { pool } from "@/db/drizzle";
import { conversation, endpoint, rows } from "@/lib/chat/core";
import { view } from "@/lib/chat/actions";
import { z } from "zod";
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return endpoint(req, async (userId) => {
    const { id } = await ctx.params;
    await conversation(pool, id, userId);
    const cursor = z.coerce
      .number()
      .int()
      .positive()
      .optional()
      .parse(new URL(req.url).searchParams.get("cursor") || undefined);
    const records = await rows(
      pool,
      "SELECT * FROM chat_message WHERE conversation_id=$1 AND ($2::bigint IS NULL OR sequence<$2) ORDER BY sequence DESC LIMIT 101",
      [id, cursor],
    );
    const batches = await rows(
      pool,
      "SELECT * FROM chat_action_batch WHERE conversation_id=$1 AND status IN ('pending','executed') ORDER BY created_at DESC LIMIT 25",
      [id],
    );
    return {
      data: records.slice(0, 100).reverse(),
      nextCursor: records.length > 100 ? records[99].sequence : null,
      batches: await Promise.all(batches.map((b) => view(pool, b))),
    };
  });
}
