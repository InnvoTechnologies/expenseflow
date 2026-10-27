import { pool } from "@/db/drizzle";
import { ChatError, conversation, endpoint, rows, uuid } from "@/lib/chat/core";
import { view } from "@/lib/chat/actions";
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return endpoint(req, async (userId) => {
    const { id } = await ctx.params;
    uuid.parse(id);
    const [run] = await rows(
      pool,
      "SELECT r.* FROM chat_run r JOIN chat_conversation c ON c.id=r.conversation_id WHERE r.id=$1 AND c.user_id=$2",
      [id, userId],
    );
    if (!run) throw new ChatError(404, "RUN_NOT_FOUND");
    await conversation(pool, run.conversation_id, userId);
    const messages = await rows(
      pool,
      "SELECT * FROM chat_message WHERE run_id=$1 ORDER BY sequence",
      [id],
    );
    const batches = await rows(
      pool,
      "SELECT * FROM chat_action_batch WHERE run_id=$1 ORDER BY created_at",
      [id],
    );
    return {
      runId: id,
      status: run.status,
      error: run.error_code,
      messages,
      batches: await Promise.all(batches.map((b) => view(pool, b))),
    };
  });
}
