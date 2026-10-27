import { pool } from "@/db/drizzle";
import {
  atomic,
  authorize,
  body,
  contextSchema,
  endpoint,
  rows,
  uuid,
} from "@/lib/chat/core";
export const runtime = "nodejs";
export async function POST(req: Request) {
  return endpoint(req, async (userId) => {
    const a = contextSchema
      .extend({ organizationId: uuid.nullable() })
      .strict()
      .parse(await body(req));
    return atomic(async (c) => {
      await authorize(c, { userId, organizationId: a.organizationId });
      const [record] = await rows(
        c,
        "INSERT INTO chat_conversation(user_id,organization_id,timezone,locale) VALUES($1,$2,$3,$4) RETURNING *",
        [userId, a.organizationId, a.timezone, a.locale],
      );
      return record;
    });
  });
}
export async function GET(req: Request) {
  return endpoint(req, async (userId) => {
    const url = new URL(req.url),
      organizationId = url.searchParams.get("organizationId");
    if (organizationId) uuid.parse(organizationId);
    await authorize(pool, { userId, organizationId });
    const cursor = url.searchParams.get("cursor");
    if (cursor) uuid.parse(cursor);
    const records = await rows(
      pool,
      `SELECT * FROM chat_conversation WHERE user_id=$1 AND organization_id IS NOT DISTINCT FROM $2::uuid AND ($3::uuid IS NULL OR (updated_at,id)<(SELECT updated_at,id FROM chat_conversation WHERE id=$3 AND user_id=$1 AND organization_id IS NOT DISTINCT FROM $2::uuid)) ORDER BY updated_at DESC,id DESC LIMIT 51`,
      [userId, organizationId, cursor],
    );
    return {
      data: records.slice(0, 50),
      nextCursor: records.length > 50 ? records[49].id : null,
    };
  });
}
