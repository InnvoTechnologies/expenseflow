import { createHash } from "node:crypto";
import { PoolClient, QueryResultRow } from "pg";
import { pool } from "@/db/drizzle";
import { auth } from "@/lib/auth";
import { z } from "zod";

export class ChatError extends Error {
  constructor(
    public status: number,
    public code: string,
    message = code,
  ) {
    super(message);
  }
}
export type Scope = { userId: string; organizationId: string | null };
export type Connection = Pick<PoolClient, "query">;
export async function rows<T extends QueryResultRow = Record<string, any>>(
  c: Connection,
  sql: string,
  values: unknown[] = [],
): Promise<T[]> {
  return (await c.query<T>(sql, values)).rows;
}
export async function atomic<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SET LOCAL lock_timeout = '10s'");
    await c.query("SET LOCAL statement_timeout = '20s'");
    const result = await fn(c);
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export function hash(value: unknown): string {
  const canonical = (v: any): any =>
    v instanceof Date
      ? v.toISOString()
      : Array.isArray(v)
        ? v.map(canonical)
        : v && typeof v === "object"
          ? Object.fromEntries(
              Object.keys(v)
                .sort()
                .map((k) => [k, canonical(v[k])]),
            )
          : v;
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}
export const uuid = z.string().uuid();
export const timezone = z
  .string()
  .max(100)
  .refine((v) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }, "Invalid IANA timezone");
export const locale = z
  .string()
  .max(64)
  .refine((v) => {
    try {
      return Intl.getCanonicalLocales(v).length === 1;
    } catch {
      return false;
    }
  }, "Invalid locale");
export const contextSchema = z.object({ timezone, locale });
export async function identity(req: Request): Promise<string> {
  if (!["GET", "HEAD"].includes(req.method)) {
    const origin = req.headers.get("origin");
    if (
      (origin && origin !== new URL(req.url).origin) ||
      req.headers.get("sec-fetch-site") === "cross-site"
    )
      throw new ChatError(403, "INVALID_ORIGIN");
  }
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) throw new ChatError(401, "UNAUTHENTICATED");
  return session.user.id;
}
export async function authorize(c: Connection, scope: Scope, write = false) {
  if (!scope.organizationId) return;
  const [membership] = await rows(
    c,
    `SELECT m.role FROM members m JOIN organization o ON o.id=m.organization_id WHERE m.user_id=$1 AND m.organization_id=$2 AND m.status='active' FOR SHARE OF m, o`,
    [scope.userId, scope.organizationId],
  );
  if (
    !membership ||
    !["owner", "admin", "member", "employee"].includes(membership.role) ||
    (write && !["owner", "admin"].includes(membership.role))
  )
    throw new ChatError(403, "WORKSPACE_ACCESS_DENIED");
}
export async function conversation(
  c: Connection,
  id: string,
  userId: string,
  lock = false,
) {
  uuid.parse(id);
  const [record] = await rows(
    c,
    `SELECT * FROM chat_conversation WHERE id=$1 AND user_id=$2 ${lock ? "FOR UPDATE" : ""}`,
    [id, userId],
  );
  if (!record) throw new ChatError(404, "CONVERSATION_NOT_FOUND");
  await authorize(c, { userId, organizationId: record.organization_id });
  return record;
}
export async function body(req: Request) {
  if (Number(req.headers.get("content-length") || 0) > 65536)
    throw new ChatError(400, "REQUEST_TOO_LARGE");
  const reader = req.body?.getReader();
  const decoder = new TextDecoder();
  let text = "",
    size = 0;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 65536) {
          await reader.cancel();
          throw new ChatError(400, "REQUEST_TOO_LARGE");
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      reader.releaseLock();
    }
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new ChatError(400, "INVALID_JSON");
  }
}
export function failure(error: unknown): Response {
  if (error instanceof ChatError)
    return Response.json(
      { error: error.code, message: error.message },
      { status: error.status },
    );
  if (error instanceof z.ZodError)
    return Response.json(
      { error: "INVALID_INPUT", issues: error.issues },
      { status: 400 },
    );
  const code = (error as { code?: string })?.code;
  if (code === "23505" || code === "40001" || code === "40P01")
    return Response.json({ error: "CONFLICT" }, { status: 409 });
  if (code === "23503" || code === "23514")
    return Response.json({ error: "RESOURCE_CONSTRAINT" }, { status: 409 });
  console.error("Chat failure", {
    code,
    name: error instanceof Error ? error.name : "unknown",
  });
  return Response.json({ error: "CHAT_UNAVAILABLE" }, { status: 503 });
}
export async function endpoint(
  req: Request,
  fn: (userId: string) => Promise<unknown>,
): Promise<Response> {
  try {
    const result = await fn(await identity(req));
    const response =
      result instanceof Response ? result : Response.json(result);
    response.headers.set(
      "Cache-Control",
      response.headers.get("Cache-Control") || "no-store",
    );
    return response;
  } catch (e) {
    const response = failure(e);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
export async function message(
  c: Connection,
  conversationId: string,
  runId: string,
  role: string,
  content: unknown,
) {
  const [record] = await rows(
    c,
    "UPDATE chat_conversation SET next_message_sequence=next_message_sequence+1, updated_at=now() WHERE id=$1 RETURNING next_message_sequence-1 AS sequence",
    [conversationId],
  );
  await c.query(
    "INSERT INTO chat_message(conversation_id,run_id,sequence,role,content) VALUES($1,$2,$3,$4,$5)",
    [conversationId, runId, record.sequence, role, JSON.stringify(content)],
  );
}
// Fixed scale arithmetic for NUMERIC(19,4). No floating point conversion of money.
export function units(value: string): bigint {
  if (!/^-?\d{1,15}(\.\d{1,4})?$/.test(value))
    throw new ChatError(400, "INVALID_DECIMAL");
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = value.replace("-", "").split(".");
  return BigInt(whole + fraction.padEnd(4, "0")) * BigInt(negative ? -1 : 1);
}
export function decimal(value: bigint): string {
  const n = value < BigInt(0) ? -value : value;
  const s = n.toString().padStart(5, "0");
  return `${value < BigInt(0) ? "-" : ""}${s.slice(0, -4)}.${s.slice(-4)}`;
}
export const money = z.string().refine((v) => {
  try {
    return units(v) > BigInt(0);
  } catch {
    return false;
  }
}, "Use a positive decimal string with up to four fractional digits");
export const nonnegativeMoney = z.string().refine((v) => {
  try {
    return units(v) >= BigInt(0);
  } catch {
    return false;
  }
});
