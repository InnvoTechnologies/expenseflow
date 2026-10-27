import { z } from "zod";
import { atomic, body, conversation, endpoint, rows } from "@/lib/chat/core";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(req: Request, ctx: Context) {
  return endpoint(req, async (userId) => {
    const { id } = await ctx.params;
    const a = z
      .object({
        title: z.string().trim().min(1).max(160).optional(),
        status: z.enum(["active", "archived"]).optional(),
      })
      .strict()
      .refine((v) => Object.keys(v).length > 0)
      .parse(await body(req));
    return atomic(async (c) => {
      await conversation(c, id, userId, true);
      return (
        await rows(
          c,
          "UPDATE chat_conversation SET title=COALESCE($2,title),status=COALESCE($3,status),updated_at=now() WHERE id=$1 RETURNING *",
          [id, a.title, a.status],
        )
      )[0];
    });
  });
}
export async function DELETE(req: Request, ctx: Context) {
  return endpoint(req, async (userId) =>
    atomic(async (c) => {
      const { id } = await ctx.params;
      await conversation(c, id, userId, true);
      await c.query("DELETE FROM chat_conversation WHERE id=$1", [id]);
      return { deleted: true };
    }),
  );
}
