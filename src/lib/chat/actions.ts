import { PoolClient } from "pg";
import { pool } from "@/db/drizzle";
import {
  atomic,
  ChatError,
  conversation,
  hash,
  rows,
  Scope,
  authorize,
} from "./core";
import { executeOperation, Operation, recordHash, scoped } from "./finance";
import { parseTool, registry } from "./tools";

function payload(ops: Operation[]) {
  return ops.map((o) => ({
    toolName: o.toolName,
    arguments: o.arguments,
    generatedId: o.generatedId,
    generatedIds: o.generatedIds,
    preview: o.preview,
    preconditions: o.preconditions,
  }));
}
export async function prepare(
  c: PoolClient,
  scope: Scope,
  operations: Operation[],
) {
  if (!operations.length || operations.length > 25)
    throw new ChatError(400, "INVALID_BATCH_SIZE");
  if (
    operations.reduce(
      (n, o) =>
        n +
        (o.toolName === "bulk_create_categories"
          ? o.arguments.categories.length
          : 1),
      0,
    ) > 25
  )
    throw new ChatError(400, "INVALID_BATCH_SIZE");
  await c.query("SAVEPOINT preview_simulation");
  try {
    // Lock all finance rows for this scope in a consistent order, including empty-account creates via the conversation lock.
    for (const operation of operations) {
      if (!registry[operation.toolName]?.write)
        throw new ChatError(400, "NOT_A_WRITE_TOOL");
      parseTool(operation.toolName, operation.arguments);
      await executeOperation(c, scope, operation);
    }
    return { operations, previewHash: hash(payload(operations)) };
  } finally {
    await c.query("ROLLBACK TO SAVEPOINT preview_simulation");
    await c.query("RELEASE SAVEPOINT preview_simulation");
  }
}
export async function saveBatch(
  c: PoolClient,
  conversationId: string,
  runId: string,
  scope: Scope,
  operations: Operation[],
  previous?: any,
) {
  const prepared = await prepare(c, scope, operations);
  const [batch] = await rows(
    c,
    `INSERT INTO chat_action_batch(conversation_id,run_id,preview_hash,expires_at,supersedes_batch_id,version) VALUES($1,$2,$3,now()+interval '30 minutes',$4,$5) RETURNING *`,
    [
      conversationId,
      runId,
      prepared.previewHash,
      previous?.id || null,
      (previous?.version || 0) + 1,
    ],
  );
  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    await c.query(
      "INSERT INTO chat_action(batch_id,position,tool_call_id,tool_name,arguments,preview,preconditions) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        batch.id,
        i,
        op.toolCallId,
        op.toolName,
        JSON.stringify({
          values: op.arguments,
          generatedId: op.generatedId,
          generatedIds: op.generatedIds,
        }),
        JSON.stringify(op.preview),
        JSON.stringify(op.preconditions || {}),
      ],
    );
  }
  if (previous)
    await c.query(
      "UPDATE chat_action_batch SET status='superseded' WHERE id=$1",
      [previous.id],
    );
  return view(c, batch);
}
export async function view(c: Pick<PoolClient, "query">, batch: any) {
  const actions = await rows(
    c,
    "SELECT id,position,tool_name,arguments,preview,result FROM chat_action WHERE batch_id=$1 ORDER BY position",
    [batch.id],
  );
  return {
    batchId: batch.id,
    conversationId: batch.conversation_id,
    runId: batch.run_id,
    status:
      batch.status === "pending" && new Date(batch.expires_at) <= new Date()
        ? "expired"
        : batch.status,
    previewHash: batch.preview_hash,
    version: batch.version,
    expiresAt: batch.expires_at,
    result: batch.result,
    actions: actions.map((a) => ({
      id: a.id,
      position: a.position,
      toolName: a.tool_name,
      arguments: a.arguments.values,
      preview: a.preview,
      result: a.result,
    })),
  };
}
export async function ownedBatch(c: PoolClient, id: string, userId: string) {
  // Resolve owner first, then lock conversation before batch everywhere to avoid lock inversion.
  const [found] = await rows(
    c,
    "SELECT b.conversation_id FROM chat_action_batch b JOIN chat_conversation c ON c.id=b.conversation_id WHERE b.id=$1 AND c.user_id=$2",
    [id, userId],
  );
  if (!found) throw new ChatError(404, "BATCH_NOT_FOUND");
  const conv = await conversation(c, found.conversation_id, userId, true);
  const [batch] = await rows(
    c,
    "SELECT * FROM chat_action_batch WHERE id=$1 FOR UPDATE",
    [id],
  );
  if (!batch) throw new ChatError(404, "BATCH_NOT_FOUND");
  return {
    batch,
    conv,
    scope: { userId, organizationId: conv.organization_id } as Scope,
  };
}
export function pending(batch: any, previewHash?: string) {
  if (batch.status !== "pending") throw new ChatError(409, "BATCH_NOT_PENDING");
  if (new Date(batch.expires_at) <= new Date())
    throw new ChatError(410, "PREVIEW_EXPIRED");
  if (previewHash && batch.preview_hash !== previewHash)
    throw new ChatError(409, "PREVIEW_CHANGED");
}
export async function approve(
  id: string,
  userId: string,
  previewHash: string,
  executionKey: string,
) {
  try {
    return await atomic(async (c) => {
      const { batch, scope } = await ownedBatch(c, id, userId);
      await authorize(c, scope, true);
      if (batch.preview_hash !== previewHash)
        throw new ChatError(409, "PREVIEW_CHANGED");
      if (batch.status === "executed")
        return { status: "executed", result: batch.result };
      pending(batch, previewHash);
      const actions = await rows(
        c,
        "SELECT * FROM chat_action WHERE batch_id=$1 ORDER BY position",
        [id],
      );
      // Serialize all account mutations per scope, shared with ordinary API writes.
      await scopeLock(c, scope);
      const results = [];
      for (const action of actions) {
        for (const pre of Object.values(action.preconditions) as {
          table: string;
          id: string;
          hash: string;
        }[]) {
          const record = await scoped(
            c,
            pre.table,
            pre.id,
            scope,
            undefined,
            true,
          );
          if (recordHash(record) !== pre.hash)
            throw new ChatError(
              409,
              "STALE_PREVIEW",
              "The data changed. Request a new preview.",
            );
        }
        const op: Operation = {
          toolCallId: action.tool_call_id,
          toolName: action.tool_name,
          arguments: action.arguments.values,
          generatedId: action.arguments.generatedId,
          generatedIds: action.arguments.generatedIds,
        };
        const result = await executeOperation(c, scope, op);
        results.push(result);
        await c.query("UPDATE chat_action SET result=$2 WHERE id=$1", [
          action.id,
          JSON.stringify(result),
        ]);
      }
      const result = {
        resources: results,
        invalidate: [
          "accounts",
          "transactions",
          "categories",
          "tags",
          "payees",
          "subscriptions",
          "reminders",
          "dashboard",
          "insights",
          "profile",
          "organizations",
        ],
      };
      await c.query(
        "UPDATE chat_action_batch SET status='executed',approved_by=$2,approved_at=now(),executed_at=now(),execution_key=$3,result=$4 WHERE id=$1",
        [id, userId, executionKey, JSON.stringify(result)],
      );
      return { status: "executed", result };
    });
  } catch (error) {
    if (
      error instanceof ChatError &&
      ["STALE_PREVIEW", "INSUFFICIENT_BALANCE"].includes(error.code)
    ) {
      await pool.query(
        `UPDATE chat_action_batch b SET status='failed',error_code=$3 WHERE b.id=$1 AND b.status='pending' AND b.preview_hash=$4 AND EXISTS(SELECT 1 FROM chat_conversation c WHERE c.id=b.conversation_id AND c.user_id=$2)`,
        [id, userId, error.code, previewHash],
      );
    }
    throw error;
  }
}
export async function scopeLock(c: Pick<PoolClient, "query">, s: Scope) {
  await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
    s.organizationId ? "org:" + s.organizationId : "user:" + s.userId,
  ]);
}
export async function getBatch(id: string, userId: string) {
  return atomic(async (c) => {
    const { batch } = await ownedBatch(c, id, userId);
    return view(c, batch);
  });
}
export async function rejectBatch(id: string, userId: string) {
  return atomic(async (c) => {
    const { batch } = await ownedBatch(c, id, userId);
    pending(batch);
    await c.query(
      "UPDATE chat_action_batch SET status='rejected' WHERE id=$1",
      [id],
    );
    return { status: "rejected" };
  });
}
export async function editBatch(
  id: string,
  userId: string,
  previewHash: string,
  edits: { position: number; arguments: Record<string, unknown> }[],
) {
  return atomic(async (c) => {
    const { batch, scope } = await ownedBatch(c, id, userId);
    pending(batch, previewHash);
    await scopeLock(c, scope);
    const records = await rows(
      c,
      "SELECT * FROM chat_action WHERE batch_id=$1 ORDER BY position",
      [id],
    );
    if (
      new Set(edits.map((e) => e.position)).size !== edits.length ||
      edits.some((e) => !records[e.position])
    )
      throw new ChatError(400, "INVALID_ACTION_POSITION");
    const operations = records.map((a, i) => ({
      toolCallId: a.tool_call_id,
      toolName: a.tool_name,
      arguments:
        edits.find((e) => e.position === i)?.arguments || a.arguments.values,
      generatedId: a.arguments.generatedId,
      generatedIds: a.arguments.generatedIds,
    }));
    return saveBatch(
      c,
      batch.conversation_id,
      batch.run_id,
      scope,
      operations,
      batch,
    );
  });
}
export async function expireBatches() {
  await pool.query(
    "UPDATE chat_action_batch SET status='expired' WHERE status='pending' AND expires_at <= now()",
  );
}
