import { POST as createTransaction } from "@/app/api/transactions/route";
import { POST as createSubscription } from "@/app/api/subscriptions/route";
import { reconcile0008 } from "../scripts/reconcile-0008";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
vi.hoisted(() => {
  if (process.env.CHATBOT_TEST_DATABASE_URL)
    process.env.DATABASE_URL = process.env.CHATBOT_TEST_DATABASE_URL;
});
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
import { pool } from "@/db/drizzle";
import { atomic, authorize, conversation, rows, Scope } from "@/lib/chat/core";
import { executeOperation, Operation, readTool } from "@/lib/chat/finance";
import {
  approve,
  editBatch,
  getBatch,
  rejectBatch,
  saveBatch,
  scopeLock,
} from "@/lib/chat/actions";
import { startRun } from "@/lib/chat/run";
import { auth } from "@/lib/auth";
import { POST as createCategory } from "@/app/api/categories/route";
import { POST as postTurn } from "@/app/api/copilot/route";
const integration = process.env.CHATBOT_TEST_DATABASE_URL
  ? describe
  : describe.skip;
let scope: Scope,
  otherUser: string,
  orgId: string,
  accountId: string,
  categoryId: string,
  convId: string,
  runId: string;
const op = (toolName: string, args: any): Operation => ({
  toolName,
  toolCallId: randomUUID(),
  arguments: args,
});
const date = "2026-10-27T12:00:00+10:30";
async function write(operation: Operation, s = scope) {
  return atomic(async (c) => {
    await scopeLock(c, s);
    return executeOperation(c, s, operation);
  });
}
async function batch(operations: Operation[], s = scope) {
  return atomic(async (c) => {
    await scopeLock(c, s);
    return saveBatch(c, convId, runId, s, operations);
  });
}
async function balance(id = accountId) {
  return (
    await rows(
      pool,
      "SELECT current_balance FROM finance_account WHERE id=$1",
      [id],
    )
  )[0].current_balance;
}
integration("PostgreSQL copilot integration", () => {
  beforeAll(async () => {
    const [db] = await rows(pool, "SELECT current_database() AS name");
    if (!db.name.includes("test"))
      throw new Error(
        "Integration tests require an isolated database with test in its name.",
      );
  });
  beforeEach(async () => {
    await pool.query('TRUNCATE "user",organization RESTART IDENTITY CASCADE');
    const userId = randomUUID();
    otherUser = randomUUID();
    orgId = randomUUID();
    await pool.query('INSERT INTO "user"(id,email) VALUES($1,$2),($3,$4)', [
      userId,
      "a@example.test",
      otherUser,
      "b@example.test",
    ]);
    scope = { userId, organizationId: null };
    await pool.query(
      "INSERT INTO organization(id,name,slug,user_id,created_at) VALUES($1,$2,$3,$4,now())",
      [orgId, "Studio", "studio", userId],
    );
    await pool.query(
      "INSERT INTO members(user_id,organization_id,role,status) VALUES($1,$2,'owner','active')",
      [userId, orgId],
    );
    accountId = (
      await write(
        op("create_account", {
          name: "Cash",
          currency: "PKR",
          type: "CASH",
          currentBalance: "10000",
        }),
      )
    ).resource.id;
    categoryId = (
      await write(op("create_category", { name: "Food", type: "EXPENSE" }))
    ).resource.id;
    [convId, runId] = [randomUUID(), randomUUID()];
    await pool.query(
      "INSERT INTO chat_conversation(id,user_id,timezone,locale) VALUES($1,$2,$3,$4)",
      [convId, userId, "Australia/Adelaide", "en-AU"],
    );
    await pool.query(
      "INSERT INTO chat_run(id,conversation_id,client_request_id,request_hash,status,timezone,locale) VALUES($1,$2,$3,'test','completed','Australia/Adelaide','en-AU')",
      [runId, convId, randomUUID()],
    );
  });
  afterAll(async () => {
    await pool.end();
  });
  it("previews without writing and executes concurrent approvals exactly once", async () => {
    const b = await batch([
      op("create_transaction", {
        amount: "0.1",
        feeAmount: "0.2",
        type: "EXPENSE",
        date,
        accountId,
        categoryId,
      }),
    ]);
    expect(await balance()).toBe("10000.0000");
    expect(await rows(pool, 'SELECT * FROM "transaction"')).toHaveLength(0);
    const [first, second] = await Promise.all([
      approve(b.batchId, scope.userId, b.previewHash, randomUUID()),
      approve(b.batchId, scope.userId, b.previewHash, randomUUID()),
    ]);
    expect(first.result).toEqual(second.result);
    expect(await balance()).toBe("9999.7000");
    expect(await rows(pool, 'SELECT * FROM "transaction"')).toHaveLength(1);
  });
  it("rolls back an entire batch when one operation cannot execute", async () => {
    await expect(
      batch([
        op("create_transaction", {
          amount: "100",
          type: "EXPENSE",
          date,
          accountId,
        }),
        op("create_transaction", {
          amount: "20000",
          type: "EXPENSE",
          date,
          accountId,
        }),
      ]),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_BALANCE" });
    expect(await balance()).toBe("10000.0000");
    expect(await rows(pool, "SELECT * FROM chat_action_batch")).toHaveLength(0);
  });
  it("validates scope and all foreign record references", async () => {
    const otherScope = { userId: otherUser, organizationId: null };
    const foreign = (
      await write(
        op("create_account", {
          name: "Other",
          currency: "PKR",
          currentBalance: "10",
        }),
        otherScope,
      )
    ).resource.id;
    await expect(
      batch([
        op("record_transfer", {
          amount: "1",
          date,
          accountId,
          toAccountId: foreign,
        }),
      ]),
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
    const foreignTag = (
      await write(op("create_tag", { name: "Secret" }), otherScope)
    ).resource.id;
    await expect(
      batch([
        op("create_transaction", {
          amount: "1",
          type: "EXPENSE",
          date,
          accountId,
          tagIds: [foreignTag],
        }),
      ]),
    ).rejects.toMatchObject({ code: "RESOURCE_NOT_FOUND" });
    await expect(conversation(pool, convId, otherUser)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      authorize(pool, { userId: otherUser, organizationId: orgId }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("rechecks revoked workspace membership at approval", async () => {
    await pool.query("UPDATE chat_conversation SET status=$2 WHERE id=$1", [
      convId,
      "active",
    ]);
    const orgScope = { userId: scope.userId, organizationId: orgId };
    // Use a real immutable organization-scoped conversation.
    convId = (
      await rows(
        pool,
        "INSERT INTO chat_conversation(user_id,organization_id,timezone,locale) VALUES($1,$2,$3,$4) RETURNING id",
        [scope.userId, orgId, "UTC", "en"],
      )
    )[0].id;
    runId = (
      await rows(
        pool,
        "INSERT INTO chat_run(conversation_id,client_request_id,request_hash,status,timezone,locale) VALUES($1,$2,'org','completed','UTC','en') RETURNING id",
        [convId, randomUUID()],
      )
    )[0].id;
    const b = await batch([op("create_tag", { name: "Work" })], orgScope);
    await pool.query(
      "UPDATE members SET status='inactive' WHERE user_id=$1 AND organization_id=$2",
      [scope.userId, orgId],
    );
    await expect(
      approve(b.batchId, scope.userId, b.previewHash, randomUUID()),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("blocks read-only members from writes", async () => {
    await pool.query("UPDATE members SET role='member' WHERE user_id=$1", [
      scope.userId,
    ]);
    await authorize(pool, { userId: scope.userId, organizationId: orgId });
    await expect(
      write(op("create_tag", { name: "No" }), {
        userId: scope.userId,
        organizationId: orgId,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("rejects stale previews after a legacy-style database update", async () => {
    const b = await batch([
      op("update_account", { id: accountId, patch: { name: "New cash" } }),
    ]);
    await pool.query("UPDATE finance_account SET name=$2 WHERE id=$1", [
      accountId,
      "Changed elsewhere",
    ]);
    await expect(
      approve(b.batchId, scope.userId, b.previewHash, randomUUID()),
    ).rejects.toMatchObject({ code: "STALE_PREVIEW" });
  });
  it("edits by replacing the preview and rejects superseded, rejected and expired plans", async () => {
    const b = await batch([op("create_tag", { name: "Old" })]);
    const replacement = await editBatch(
      b.batchId,
      scope.userId,
      b.previewHash,
      [{ position: 0, arguments: { name: "New" } }],
    );
    expect(replacement.previewHash).not.toBe(b.previewHash);
    await expect(
      approve(b.batchId, scope.userId, b.previewHash, randomUUID()),
    ).rejects.toMatchObject({ code: "BATCH_NOT_PENDING" });
    await rejectBatch(replacement.batchId, scope.userId);
    await expect(
      approve(
        replacement.batchId,
        scope.userId,
        replacement.previewHash,
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: "BATCH_NOT_PENDING" });
    const expired = await batch([op("create_tag", { name: "Expires" })]);
    await pool.query(
      "UPDATE chat_action_batch SET expires_at=now()-interval '1 minute' WHERE id=$1",
      [expired.batchId],
    );
    await expect(
      approve(expired.batchId, scope.userId, expired.previewHash, randomUUID()),
    ).rejects.toMatchObject({ status: 410 });
  });
  it("handles pending entries, edits, fees, and delete reversal exactly", async () => {
    const saved = (
      await write(
        op("create_transaction", {
          amount: "12.3456",
          feeAmount: "0.0001",
          type: "EXPENSE",
          date,
          accountId,
          status: "pending",
        }),
      )
    ).resource;
    expect(await balance()).toBe("10000.0000");
    await write(
      op("update_transaction", {
        id: saved.id,
        patch: { status: "completed" },
      }),
    );
    expect(await balance()).toBe("9987.6543");
    await write(
      op("update_transaction", { id: saved.id, patch: { amount: "15.0000" } }),
    );
    expect(await balance()).toBe("9984.9999");
    await write(op("delete_transaction", { id: saved.id }));
    expect(await balance()).toBe("10000.0000");
  });
  it("records FX transfers with approved rates and reverses both sides", async () => {
    const usd = (
      await write(
        op("create_account", {
          name: "USD",
          currency: "USD",
          currentBalance: "0",
        }),
      )
    ).resource.id;
    await expect(
      write(
        op("record_transfer", {
          amount: "100",
          date,
          accountId,
          toAccountId: usd,
        }),
      ),
    ).rejects.toMatchObject({ code: "FX_DETAILS_REQUIRED" });
    const tx = (
      await write(
        op("record_transfer", {
          amount: "100",
          feeAmount: "1",
          exchangeRate: "0.0036",
          destinationAmount: "0.36",
          date,
          accountId,
          toAccountId: usd,
        }),
      )
    ).resource;
    expect(await balance()).toBe("9899.0000");
    expect(await balance(usd)).toBe("0.3600");
    await write(op("delete_transaction", { id: tx.id }));
    expect(await balance()).toBe("10000.0000");
    expect(await balance(usd)).toBe("0.0000");
  });
  it("supports dependent proposed creates inside one atomic batch", async () => {
    const accountOp = op("create_account", {
      name: "New wallet",
      currency: "PKR",
      currentBalance: "100",
    });
    accountOp.generatedId = randomUUID();
    const b = await batch([
      accountOp,
      op("create_transaction", {
        amount: "10",
        type: "EXPENSE",
        date,
        accountId: accountOp.generatedId,
      }),
    ]);
    await approve(b.batchId, scope.userId, b.previewHash, randomUUID());
    expect(await balance(accountOp.generatedId)).toBe("90.0000");
  });
  it("allows sequential updates to the same account in one batch", async () => {
    const b = await batch([
      op("create_transaction", {
        amount: "1",
        type: "EXPENSE",
        date,
        accountId,
      }),
      op("create_transaction", {
        amount: "2",
        type: "EXPENSE",
        date,
        accountId,
      }),
    ]);
    await approve(b.batchId, scope.userId, b.previewHash, randomUUID());
    expect(await balance()).toBe("9997.0000");
  });
  it("creates category batches, subscription tracking, reminders, and workspaces", async () => {
    const b = await batch([
      op("bulk_create_categories", {
        categories: [
          { name: "Office", type: "EXPENSE" },
          { name: "Rent", type: "EXPENSE" },
        ],
      }),
      op("create_subscription", {
        title: "Netflix",
        amount: "15",
        currency: "PKR",
        billingCycle: "MONTHLY",
        startDate: date,
        accountId,
        categoryId,
      }),
      op("create_reminder", { title: "Pay bill", dueDate: date }),
      op("create_workspace", { name: "New workspace", slug: "new-workspace" }),
    ]);
    await approve(b.batchId, scope.userId, b.previewHash, randomUUID());
    expect(await rows(pool, "SELECT * FROM category")).toHaveLength(3);
    expect(
      await rows(pool, "SELECT * FROM subscription_tracking"),
    ).toHaveLength(1);
    expect(await rows(pool, "SELECT * FROM reminder")).toHaveLength(1);
    expect(await rows(pool, "SELECT * FROM organization")).toHaveLength(2);
  });
  it("reports the full dataset, excluding transfers and separating currencies", async () => {
    for (let i = 0; i < 25; i++)
      await write(
        op("create_transaction", {
          amount: "0.1",
          type: "EXPENSE",
          date,
          accountId,
          categoryId,
        }),
      );
    const report = await readTool(pool, scope, "category_breakdown", {
      from: "2026-10-01T00:00:00+10:30",
      to: "2026-11-01T00:00:00+10:30",
    });
    expect(report.totals[0]).toMatchObject({
      currency: "PKR",
      amount: "2.5000",
      count: 25,
    });
    const result = await readTool(pool, scope, "search_transactions", {
      minAmount: "0.1",
      limit: 20,
    });
    expect(result.data).toHaveLength(20);
    expect(result.total).toBe(25);
  });
  it("keeps transaction lookup filters and payee matches scoped", async () => {
    const payee = (await write(op("create_payee", { name: "Daniel" }))).resource
      .id;
    await write(
      op("create_transaction", {
        amount: "5001",
        type: "EXPENSE",
        date,
        accountId,
        payeeId: payee,
      }),
    );
    const found = await readTool(pool, scope, "search_transactions", {
      query: "Daniel",
      minAmount: "5000",
    });
    expect(found.total).toBe(1);
    expect(
      (
        await readTool(
          pool,
          { userId: otherUser, organizationId: null },
          "search_transactions",
          { query: "Daniel" },
        )
      ).total,
    ).toBe(0);
  });
  it("deduplicates submitted turns and rejects changed retry payloads", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-only");
    const turn = {
      conversationId: convId,
      clientRequestId: randomUUID(),
      message: "Hi",
      timezone: "Australia/Adelaide",
      locale: "en-AU",
    };
    const first = await startRun(scope.userId, turn),
      second = await startRun(scope.userId, turn);
    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.run.id).toBe(first.run.id);
    await expect(
      startRun(scope.userId, { ...turn, message: "Changed" }),
    ).rejects.toMatchObject({ code: "REQUEST_KEY_REUSED" });
    await expect(
      startRun(scope.userId, { ...turn, clientRequestId: randomUUID() }),
    ).rejects.toMatchObject({ code: "RUN_IN_PROGRESS" });
  });
  it("preserves the existing category POST response while validating permissions", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: scope.userId },
    } as any);
    const response = await createCategory(
      new NextRequest("http://localhost/api/categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Hardware",
          type: "EXPENSE",
          color: "#fff",
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      name: "Hardware",
      type: "EXPENSE",
      color: "#ffffff",
      userId: scope.userId,
      organizationId: null,
    });
  });
  it("rejects cross-origin writes and old arbitrary confirmation payloads", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: scope.userId },
    } as any);
    expect(
      (
        await createCategory(
          new NextRequest("http://localhost/api/categories", {
            method: "POST",
            headers: { origin: "https://evil.test" },
            body: "{}",
          }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await postTurn(
          new Request("http://localhost/api/copilot", {
            method: "POST",
            body: JSON.stringify({
              toolCallId: "fake",
              toolResult: { toolName: "create_transaction", params: {} },
            }),
          }),
        )
      ).status,
    ).toBe(400);
  });
  it("runs the streamed provider/tool loop and persists a recoverable preview without executing it", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-only");
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: scope.userId },
    } as any);
    const providerStream = (delta: any) =>
      new Response(
        "data: " +
          JSON.stringify({
            id: "mock-provider",
            choices: [
              {
                delta,
                finish_reason: delta.tool_calls ? "tool_calls" : "stop",
              },
            ],
          }) +
          "\n\ndata: [DONE]\n\n",
        { headers: { "content-type": "text/event-stream" } },
      );
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        providerStream({
          tool_calls: [
            {
              index: 0,
              id: "lookup",
              function: { name: "list_accounts", arguments: "{}" },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        providerStream({
          tool_calls: [
            {
              index: 0,
              id: "propose",
              function: {
                name: "create_transaction",
                arguments: JSON.stringify({
                  amount: "12",
                  type: "EXPENSE",
                  date,
                  accountId,
                  categoryId,
                }),
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        providerStream({ content: "Please review and save the expense." }),
      );
    vi.stubGlobal("fetch", fetcher);
    try {
      const turn = {
        conversationId: convId,
        clientRequestId: randomUUID(),
        message: "Lunch 12 from cash",
        timezone: "Australia/Adelaide",
        locale: "en-AU",
      };
      const response = await postTurn(
        new Request("http://localhost/api/copilot", {
          method: "POST",
          body: JSON.stringify(turn),
        }),
      );
      expect(response.headers.get("content-type")).toBe("text/event-stream");
      const output = await response.text();
      expect(output).toContain("event: action.preview");
      expect(output).toContain("event: run.completed");
      expect(output).not.toContain("event: error");
      expect(fetcher).toHaveBeenCalledTimes(3);
      expect(await balance()).toBe("10000.0000");
      const saved = await rows(
        pool,
        "SELECT * FROM chat_run WHERE client_request_id=$1",
        [turn.clientRequestId],
      );
      expect(saved[0].status).toBe("completed");
      const plan = (
        await rows(pool, "SELECT * FROM chat_action_batch WHERE run_id=$1", [
          saved[0].id,
        ])
      )[0];
      expect(plan.status).toBe("pending");
      const replay = await postTurn(
        new Request("http://localhost/api/copilot", {
          method: "POST",
          body: JSON.stringify(turn),
        }),
      );
      expect(await replay.json()).toMatchObject({
        runId: saved[0].id,
        replayed: true,
      });
      await approve(plan.id, scope.userId, plan.preview_hash, randomUUID());
      expect(await balance()).toBe("9988.0000");
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("records provider failures without executing any writes", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-only");
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: scope.userId },
    } as any);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 502 })),
    );
    try {
      const response = await postTurn(
        new Request("http://localhost/api/copilot", {
          method: "POST",
          body: JSON.stringify({
            conversationId: convId,
            clientRequestId: randomUUID(),
            message: "Hello",
            timezone: "UTC",
            locale: "en",
          }),
        }),
      );
      expect(await response.text()).toContain("event: error");
      expect(
        (
          await rows(
            pool,
            "SELECT status FROM chat_run ORDER BY created_at DESC LIMIT 1",
          )
        )[0].status,
      ).toBe("failed");
      expect(await balance()).toBe("10000.0000");
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("returns exact backend-calculated period changes", async () => {
    await write(
      op("create_transaction", {
        amount: "10",
        type: "EXPENSE",
        date: "2026-09-15T00:00:00Z",
        accountId,
        categoryId,
      }),
    );
    await write(
      op("create_transaction", {
        amount: "15",
        type: "EXPENSE",
        date,
        accountId,
        categoryId,
      }),
    );
    const report = await readTool(pool, scope, "compare_periods", {
      previous: { from: "2026-09-01T00:00:00Z", to: "2026-10-01T00:00:00Z" },
      current: { from: "2026-10-01T00:00:00Z", to: "2026-11-01T00:00:00Z" },
    });
    expect(report.changes[0]).toMatchObject({
      change: "5.0000",
      percentChange: "50.0000",
    });
    expect(report.categoryChanges[0].change).toBe("5.0000");
  });
  it("only reconciles the known historical migration after exact schema verification", async () => {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query(
        "DELETE FROM drizzle.__drizzle_migrations WHERE created_at >= $1",
        [1781329635203],
      );
      expect(await reconcile0008(c)).toBe(true);
      expect(await reconcile0008(c)).toBe(false);
      await c.query(
        "DELETE FROM drizzle.__drizzle_migrations WHERE created_at=$1",
        [1781329635203],
      );
      await c.query(
        `ALTER TABLE "user" ALTER COLUMN base_currency SET DEFAULT 'EUR'`,
      );
      await expect(reconcile0008(c)).rejects.toThrow("does not exactly match");
    } finally {
      await c.query("ROLLBACK");
      c.release();
    }
  });
  it("enforces the shared per-user rate limit across conversations", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-only");
    for (let i = 0; i < 10; i++)
      await pool.query(
        "INSERT INTO chat_run(conversation_id,client_request_id,request_hash,status,timezone,locale) VALUES($1,$2,'limit','completed','UTC','en')",
        [convId, randomUUID()],
      );
    await expect(
      startRun(scope.userId, {
        conversationId: convId,
        clientRequestId: randomUUID(),
        message: "Hello",
        timezone: "UTC",
        locale: "en",
      }),
    ).rejects.toMatchObject({ status: 429 });
  });

  it("preserves date-only and empty optional fee inputs from existing web forms", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: scope.userId },
    } as any);
    const response = await createTransaction(
      new NextRequest("http://localhost/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          amount: "12",
          feeAmount: "",
          type: "EXPENSE",
          date: "2026-10-28",
          description: "Lunch",
          accountId,
          categoryId,
          toAccountId: "",
          payeeId: "",
          subscriptionId: "",
          status: "completed",
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      amount: "12.0000",
      feeAmount: "0.0000",
      date: "2026-10-28T00:00:00.000Z",
    });
    const subscription = await createSubscription(
      new NextRequest("http://localhost/api/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          title: "Netflix",
          amount: "15",
          currency: "PKR",
          billingCycle: "MONTHLY",
          startDate: "2026-10-28",
          accountId,
          categoryId,
        }),
      }),
    );
    expect(subscription.status).toBe(200);
    expect(await subscription.json()).toMatchObject({
      startDate: "2026-10-28T00:00:00.000Z",
    });
  });
  it("normalizes local-offset dates and half-open report ranges to UTC", async () => {
    const saved = (
      await write(
        op("create_transaction", {
          amount: "5",
          type: "EXPENSE",
          date: "2026-10-28T00:30:00+10:30",
          accountId,
          categoryId,
        }),
      )
    ).resource;
    expect(saved.date).toBe("2026-10-27T14:00:00.000Z");
    const selected = await readTool(pool, scope, "category_breakdown", {
      from: "2026-10-28T00:00:00+10:30",
      to: "2026-10-29T00:00:00+10:30",
    });
    expect(selected.totals[0].amount).toBe("5.0000");
    expect(selected.categories[0].amount).toBe("5.0000");
    const previous = await readTool(pool, scope, "spending_summary", {
      from: "2026-10-27T00:00:00+10:30",
      to: "2026-10-28T00:00:00+10:30",
    });
    expect(previous.totals).toHaveLength(0);
  });
});
