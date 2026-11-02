import { pool } from "@/db/drizzle";
import { atomic, body, endpoint, rows, uuid } from "@/lib/chat/core";
import { scopeLock } from "@/lib/chat/actions";
import { scoped, publicRecord } from "@/lib/chat/finance";
import { requestScope } from "@/lib/chat/rest";
import { contribute } from "@/lib/chat/savings";
type Context = { params: Promise<{ id: string }> };
export async function POST(req: Request, ctx: Context) {
  return endpoint(req, async (userId) => {
    const id = uuid.parse((await ctx.params).id),
      s = await requestScope(req, userId, true),
      input = await body(req);
    return atomic(async (c) => {
      await scopeLock(c, s);
      return contribute(c, s, id, input, crypto.randomUUID());
    });
  });
}
export async function GET(req: Request, ctx: Context) {
  return endpoint(req, async (userId) => {
    const id = uuid.parse((await ctx.params).id),
      s = await requestScope(req, userId);
    await scoped(pool, "savings_goal", id, s);
    // Paginated ledger; cursor is an offset and is independent of monetary values.
    const { z } = await import("zod");
    const offset = z.coerce
      .number()
      .int()
      .min(0)
      .max(1000000)
      .parse(new URL(req.url).searchParams.get("offset") || 0);
    const data = await rows(
      pool,
      "SELECT * FROM savings_contribution WHERE goal_id=$1 ORDER BY created_at DESC,id DESC LIMIT 101 OFFSET $2",
      [id, offset],
    );
    return {
      data: data.slice(0, 100).map(publicRecord),
      nextOffset: data.length > 100 ? offset + 100 : null,
    };
  });
}
