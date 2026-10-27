import { randomUUID } from "node:crypto";
import currencies from "currency-codes";
import {
  ChatError,
  Connection,
  Scope,
  authorize,
  rows,
  units,
  decimal,
  hash,
} from "./core";
import { entities, Entity, parseTool } from "./tools";

export type Preconditions = Record<
  string,
  { table: string; id: string; hash: string }
>;
export type Operation = {
  toolCallId: string;
  toolName: string;
  arguments: Record<string, any>;
  generatedId?: string;
  generatedIds?: string[];
  preview?: any;
  preconditions?: Preconditions;
  result?: any;
};
export const recordHash = (record: Record<string, any>) =>
  hash(
    Object.fromEntries(
      Object.entries(record).filter(
        ([key]) =>
          !["created_at", "updated_at", "createdAt", "updatedAt"].includes(key),
      ),
    ),
  );
const tables = new Set([
  ...Object.values(entities).map((v) => v.table),
  "transaction",
  "organization",
  "user",
]);
export const snake = (v: string) =>
  v.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
export const camel = (v: string) =>
  v.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
export function publicRecord(record: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(record).map(([k, v]) => [
      camel(k),
      v instanceof Date ? v.toISOString() : v,
    ]),
  );
}
const scopeWhere = (s: Scope, start = 1) =>
  s.organizationId
    ? {
        sql: `organization_id=$${start} AND user_id IS NULL`,
        values: [s.organizationId],
      }
    : {
        sql: `user_id=$${start} AND organization_id IS NULL`,
        values: [s.userId],
      };
export async function scoped(
  c: Connection,
  table: string,
  id: string,
  scope: Scope,
  pre?: Preconditions,
  lock = false,
) {
  if (!tables.has(table)) throw new Error("Invalid internal table");
  let predicate: string;
  let values: unknown[];
  if (table === "transaction") {
    const s = scopeWhere(scope, 2);
    predicate = `id=$1 AND account_id IN (SELECT id FROM finance_account WHERE ${s.sql}) AND (to_account_id IS NULL OR to_account_id IN (SELECT id FROM finance_account WHERE ${s.sql}))`;
    values = [id, ...s.values];
  } else if (table === "organization") {
    predicate = "id=$1";
    values = [scope.organizationId];
    if (id !== scope.organizationId)
      throw new ChatError(404, "RESOURCE_NOT_FOUND");
  } else if (table === "user") {
    predicate = "id=$1";
    values = [scope.userId];
    if (id !== scope.userId) throw new ChatError(404, "RESOURCE_NOT_FOUND");
  } else {
    const s = scopeWhere(scope, 2);
    predicate = `id=$1 AND ${s.sql}`;
    values = [id, ...s.values];
  }
  const [record] = await rows(
    c,
    `SELECT * FROM "${table}" WHERE ${predicate} ${lock ? "FOR UPDATE" : ""}`,
    values,
  );
  if (!record) throw new ChatError(404, "RESOURCE_NOT_FOUND");
  if (pre) pre[`${table}:${id}`] = { table, id, hash: recordHash(record) };
  return record;
}
async function insert(
  c: Connection,
  table: string,
  values: Record<string, any>,
) {
  const keys = Object.keys(values).filter((k) => values[k] !== undefined);
  return (
    await rows(
      c,
      `INSERT INTO "${table}" (${keys.map((k) => `"${k}"`).join(",")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(",")}) RETURNING *`,
      keys.map((k) =>
        values[k] instanceof Date ? values[k].toISOString() : values[k],
      ),
    )
  )[0];
}
async function update(
  c: Connection,
  table: string,
  id: string,
  values: Record<string, any>,
) {
  const keys = Object.keys(values).filter((k) => values[k] !== undefined);
  if (!keys.length) throw new ChatError(400, "EMPTY_PATCH");
  return (
    await rows(
      c,
      `UPDATE "${table}" SET ${keys.map((k, i) => `"${k}"=$${i + 2}`).join(",")} WHERE id=$1 RETURNING *`,
      [
        id,
        ...keys.map((k) =>
          values[k] instanceof Date ? values[k].toISOString() : values[k],
        ),
      ],
    )
  )[0];
}
const dbFields = (v: Record<string, any>) =>
  Object.fromEntries(
    Object.entries(v)
      .filter(([, value]) => value !== undefined)
      .map(([k, value]) => [
        snake(k),
        value !== null &&
        ["date", "startDate", "endDate", "dueDate"].includes(k)
          ? new Date(value).toISOString()
          : value,
      ]),
  );
const ownership = (s: Scope) => ({
  user_id: s.organizationId ? null : s.userId,
  organization_id: s.organizationId,
});
async function validateEntity(
  c: Connection,
  s: Scope,
  entity: Entity,
  data: Record<string, any>,
  id: string,
  pre: Preconditions,
) {
  if (entity === "account" && data.currency) {
    const [linked] = await rows(
      c,
      "SELECT id FROM subscription_tracking WHERE account_id=$1 AND currency<>$2 LIMIT 1",
      [id, data.currency],
    );
    if (linked) throw new ChatError(409, "ACCOUNT_CURRENCY_IN_USE");
    const [used] = await rows(
      c,
      'SELECT id FROM "transaction" WHERE account_id=$1 OR to_account_id=$1 LIMIT 1',
      [id],
    );
    if (used) {
      const old = await scoped(c, "finance_account", id, s, pre);
      if (old.currency !== data.currency)
        throw new ChatError(409, "ACCOUNT_CURRENCY_IN_USE");
    }
  }
  if (entity === "category" && data.type) {
    const [used] = await rows(
      c,
      `SELECT 1 FROM "transaction" WHERE category_id=$1 AND type::text<>$2
      UNION ALL SELECT 1 FROM subscription_tracking WHERE category_id=$1 AND $2<>'EXPENSE'
      UNION ALL SELECT 1 FROM category WHERE parent_id=$1 AND type::text<>$2 LIMIT 1`,
      [id, data.type],
    );
    if (used) throw new ChatError(409, "CATEGORY_TYPE_IN_USE");
  }
  if (data.parentId) {
    let parentId: string | null = data.parentId;
    const visited = new Set([id]);
    while (parentId) {
      if (visited.has(parentId)) throw new ChatError(400, "CATEGORY_CYCLE");
      visited.add(parentId);
      const parent = await scoped(c, "category", parentId, s, pre);
      if (parent.type !== data.type)
        throw new ChatError(400, "CATEGORY_TYPE_MISMATCH");
      parentId = parent.parent_id;
    }
  }
  if (data.accountId) {
    const acc = await scoped(c, "finance_account", data.accountId, s, pre);
    if (data.currency && acc.currency !== data.currency)
      throw new ChatError(400, "CURRENCY_MISMATCH");
  }
  if (data.categoryId) {
    const cat = await scoped(c, "category", data.categoryId, s, pre);
    if (cat.type !== "EXPENSE")
      throw new ChatError(400, "CATEGORY_TYPE_MISMATCH");
  }
  if (
    data.startDate &&
    data.endDate &&
    new Date(data.endDate) < new Date(data.startDate)
  )
    throw new ChatError(400, "INVALID_DATE_RANGE");
}
async function validateTransaction(
  c: Connection,
  s: Scope,
  data: Record<string, any>,
  pre: Preconditions,
) {
  const source = await scoped(c, "finance_account", data.accountId, s, pre);
  if (data.type === "TRANSFER") {
    if (!data.toAccountId || data.accountId === data.toAccountId)
      throw new ChatError(400, "INVALID_TRANSFER");
    const destination = await scoped(
      c,
      "finance_account",
      data.toAccountId,
      s,
      pre,
    );
    if (destination.currency !== source.currency) {
      if (
        !data.exchangeRate ||
        !data.destinationAmount ||
        Number(data.exchangeRate) <= 0
      )
        throw new ChatError(400, "FX_DETAILS_REQUIRED");
      // Rate scale six; round half up to the existing four-place ledger precision.
      const rate = BigInt(
        data.exchangeRate
          .replace(".", "")
          .padEnd(
            data.exchangeRate.includes(".")
              ? data.exchangeRate.split(".")[0].length + 6
              : data.exchangeRate.length + 6,
            "0",
          ),
      );
      const expected =
        (units(data.amount) * rate + BigInt(500000)) / BigInt(1000000);
      if (expected !== units(data.destinationAmount))
        throw new ChatError(400, "FX_AMOUNT_MISMATCH");
    } else if (
      (data.exchangeRate && Number(data.exchangeRate) !== 1) ||
      (data.destinationAmount &&
        units(data.destinationAmount) !== units(data.amount))
    )
      throw new ChatError(400, "INVALID_SAME_CURRENCY_TRANSFER");
  } else if (
    data.toAccountId ||
    data.destinationAmount ||
    (data.exchangeRate && Number(data.exchangeRate) !== 1)
  )
    throw new ChatError(400, "UNEXPECTED_TRANSFER_FIELDS");
  if (data.categoryId) {
    const cat = await scoped(c, "category", data.categoryId, s, pre);
    if (data.type === "TRANSFER" || cat.type !== data.type)
      throw new ChatError(400, "CATEGORY_TYPE_MISMATCH");
  }
  if (data.payeeId) await scoped(c, "payee", data.payeeId, s, pre);
  for (const tagId of data.tagIds || []) await scoped(c, "tag", tagId, s, pre);
  if (data.subscriptionId)
    await scoped(c, "subscription_tracking", data.subscriptionId, s, pre);
  if (
    data.type === "INCOME" &&
    units(data.feeAmount || "0") > units(data.amount)
  )
    throw new ChatError(400, "FEE_EXCEEDS_INCOME");
  return source;
}
export function ledgerEffects(data: Record<string, any>): Map<string, bigint> {
  const changes = new Map<string, bigint>();
  if (data.status !== "completed") return changes;
  const amount = units(data.amount),
    fee = units(data.feeAmount ?? data.fee_amount ?? "0");
  const accountId = data.accountId ?? data.account_id,
    toAccountId = data.toAccountId ?? data.to_account_id;
  changes.set(
    accountId,
    data.type === "INCOME" ? amount - fee : -(amount + fee),
  );
  if (data.type === "TRANSFER") {
    const destination = data.destinationAmount ?? data.destination_amount;
    if (
      !destination &&
      Number(data.exchangeRate ?? data.exchange_rate ?? "1") !== 1
    )
      throw new ChatError(409, "LEGACY_FX_REQUIRES_REVIEW");
    changes.set(toAccountId, units(destination || data.amount));
  }
  return changes;
}
async function ledger(
  c: Connection,
  s: Scope,
  old: Record<string, any> | undefined,
  next: Record<string, any> | undefined,
  pre: Preconditions,
) {
  const changes = new Map<string, bigint>();
  if (old) for (const [id, n] of ledgerEffects(old)) changes.set(id, -n);
  if (next)
    for (const [id, n] of ledgerEffects(next))
      changes.set(id, (changes.get(id) || BigInt(0)) + n);
  for (const id of [...changes.keys()].sort()) {
    const acc = await scoped(c, "finance_account", id, s, pre, true);
    const nextBalance = units(acc.current_balance) + changes.get(id)!;
    if (nextBalance < BigInt(0))
      throw new ChatError(409, "INSUFFICIENT_BALANCE");
    await c.query(
      "UPDATE finance_account SET current_balance=$2, updated_at=now() WHERE id=$1",
      [id, decimal(nextBalance)],
    );
  }
}
export async function executeOperation(
  c: Connection,
  s: Scope,
  op: Operation,
): Promise<any> {
  await authorize(c, s, true);
  const args = parseTool(op.toolName, op.arguments) as Record<string, any>;
  const pre: Preconditions = {};
  let result: Record<string, any>;
  let before: Record<string, any> | undefined;
  let path = "";
  let tool = op.toolName;
  if (tool === "record_transfer") {
    tool = "create_transaction";
    args.type = "TRANSFER";
  }
  if (tool === "archive_payee") {
    tool = "update_payee";
    args.patch = { isArchived: true };
  }
  if (tool === "cancel_subscription" || tool === "resume_subscription") {
    args.patch = {
      status: tool === "cancel_subscription" ? "CANCELLED" : "ACTIVE",
      endDate: null,
    };
    tool = "update_subscription";
  }
  if (tool === "complete_reminder") {
    tool = "update_reminder";
    args.patch = { status: "COMPLETED" };
  }
  const generatedId = op.generatedId || (op.generatedId = randomUUID());
  if (tool === "bulk_create_categories") {
    const results = [];
    for (let i = 0; i < args.categories.length; i++) {
      const sub: Operation = {
        toolCallId: op.toolCallId + ":" + i,
        toolName: "create_category",
        arguments: args.categories[i],
        generatedId: op.generatedIds?.[i],
      };
      results.push(await executeOperation(c, s, sub));
      Object.assign(pre, sub.preconditions);
      if (!op.generatedIds) op.generatedIds = [];
      op.generatedIds[i] = sub.generatedId!;
    }
    op.preview = { operation: op.toolName, after: results };
    op.preconditions = pre;
    op.result = { resources: results };
    return { resources: results };
  }
  if (tool.endsWith("_transaction")) {
    path = "/transactions";
    if (args.id) before = await scoped(c, "transaction", args.id, s, pre, true);
    if (tool === "delete_transaction") {
      await ledger(c, s, before, undefined, pre);
      await c.query('DELETE FROM "transaction" WHERE id=$1', [args.id]);
      result = { id: args.id, deleted: true };
    } else {
      const merged =
        tool === "update_transaction"
          ? { ...publicRecord(before!), ...args.patch }
          : args;
      // Revalidate the complete merged object after a patch.
      const { transactionInput } = await import("./tools");
      const allowed = Object.keys(transactionInput.shape);
      const data = transactionInput.parse(
        Object.fromEntries(
          allowed
            .filter((k) => merged[k] !== undefined)
            .map((k) => [k, merged[k]]),
        ),
      );
      const source = await validateTransaction(c, s, data, pre);
      await ledger(c, s, before, data, pre);
      const fields = dbFields(data);
      if (!data.destinationAmount && data.type === "TRANSFER")
        fields.destination_amount = data.amount;
      if (data.type !== "TRANSFER") {
        fields.destination_amount = null;
        fields.to_account_id = null;
        fields.exchange_rate = "1";
      }
      result =
        tool === "create_transaction"
          ? await insert(c, "transaction", { id: generatedId, ...fields })
          : await update(c, "transaction", args.id, {
              ...fields,
              updated_at: new Date(),
            });
      result.currency = source.currency;
    }
  } else if (tool === "create_workspace") {
    // Match current product entitlement: at most five owned workspaces.
    await c.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [s.userId]);
    const [count] = await rows(
      c,
      "SELECT count(*)::int AS count FROM organization WHERE user_id=$1",
      [s.userId],
    );
    if (count.count >= 5) throw new ChatError(409, "WORKSPACE_LIMIT_REACHED");
    const { timezone } = await import("./core");
    if (args.timezone) timezone.parse(args.timezone);
    result = await insert(c, "organization", {
      id: generatedId,
      ...dbFields(args),
      user_id: s.userId,
      created_at: new Date(),
    });
    await insert(c, "members", {
      id: randomUUID(),
      organization_id: result.id,
      user_id: s.userId,
      role: "owner",
      status: "active",
    });
    path = "/settings";
  } else if (tool === "update_workspace" || tool === "update_preferences") {
    const profile = tool === "update_preferences";
    if (profile && s.organizationId)
      throw new ChatError(403, "PERSONAL_SCOPE_REQUIRED");
    if (!profile && !s.organizationId)
      throw new ChatError(400, "WORKSPACE_REQUIRED");
    const table = profile ? "user" : "organization",
      id = profile ? s.userId : s.organizationId!;
    before = await scoped(c, table, id, s, pre, true);
    if (args.timezone) {
      const { timezone } = await import("./core");
      timezone.parse(args.timezone);
    }
    const fields = dbFields(args);
    if (profile) {
      if ("base_currency" in fields) {
        fields.base_currency = args.baseCurrency;
      }
    }
    result = await update(c, table, id, fields);
    path = "/settings";
  } else {
    const entity = tool.split("_").slice(1).join("_") as Entity;
    const config = entities[entity];
    if (!config) throw new ChatError(400, "UNKNOWN_TOOL");
    path = config.path;
    if (args.id) before = await scoped(c, config.table, args.id, s, pre, true);
    if (tool.startsWith("delete_")) {
      if (entity === "tag") {
        // Validate all impacted rows before altering array references.
        const scope = scopeWhere(s);
        const affected = await rows(
          c,
          `SELECT t.id FROM "transaction" t JOIN finance_account a ON a.id=t.account_id WHERE $1=ANY(t.tag_ids) AND a.id IN (SELECT id FROM finance_account WHERE ${scopeWhere(s, 2).sql}) ORDER BY t.id`,
          [args.id, ...scope.values],
        );
        for (const tx of affected)
          await scoped(c, "transaction", tx.id, s, pre, true);
        await c.query(
          'UPDATE "transaction" SET tag_ids=array_remove(tag_ids,$1::uuid), updated_at=now() WHERE $1=ANY(tag_ids) AND account_id IN (SELECT id FROM finance_account WHERE ' +
            scopeWhere(s, 2).sql +
            ")",
          [args.id, ...scope.values],
        );
      }
      if (entity === "category") {
        const [used] = await rows(
          c,
          "SELECT id FROM category WHERE parent_id=$1 LIMIT 1",
          [args.id],
        );
        if (used) throw new ChatError(409, "CATEGORY_HAS_CHILDREN");
      }
      await c.query(`DELETE FROM "${config.table}" WHERE id=$1`, [args.id]);
      result = { id: args.id, deleted: true };
    } else {
      const data = tool.startsWith("create_")
        ? args
        : { ...publicRecord(before!), ...args.patch };
      await validateEntity(c, s, entity, data, args.id || generatedId, pre);
      const fields = dbFields(tool.startsWith("create_") ? args : args.patch);
      result = tool.startsWith("create_")
        ? await insert(c, config.table, {
            id: generatedId,
            ...fields,
            ...ownership(s),
          })
        : await update(c, config.table, args.id, {
            ...fields,
            updated_at: new Date(),
          });
    }
  }
  const saved = publicRecord(result);
  if (tool === "update_preferences") {
    for (const key of Object.keys(saved))
      if (
        ![
          "id",
          "name",
          "baseCurrency",
          "country",
          "numberFormat",
          "version",
        ].includes(key)
      )
        delete saved[key];
  }
  const subject = saved.deleted && before ? publicRecord(before) : saved;
  const display: Record<string, any> = { currency: subject.currency };
  for (const [field, table, key] of [
    ["accountId", "finance_account", "account"],
    ["toAccountId", "finance_account", "destination"],
    ["categoryId", "category", "category"],
    ["parentId", "category", "parent"],
    ["payeeId", "payee", "payee"],
    ["subscriptionId", "subscription_tracking", "subscription"],
  ] as const) {
    if (subject[field]) {
      const record = await scoped(c, table, subject[field], s);
      display[key] = record.name || record.title;
      if (field === "accountId") display.currency = record.currency;
    }
  }
  if (subject.tagIds?.length)
    display.tags = await Promise.all(
      subject.tagIds.map(
        async (id: string) => (await scoped(c, "tag", id, s)).name,
      ),
    );
  const preview = {
    operation: op.toolName,
    before: before
      ? Object.fromEntries(
          Object.entries(publicRecord(before)).filter(
            ([key]) =>
              tool !== "update_preferences" ||
              [
                "id",
                "name",
                "baseCurrency",
                "country",
                "numberFormat",
                "version",
              ].includes(key),
          ),
        )
      : null,
    after: saved,
    display,
    navigation: path,
  };
  op.preconditions = pre;
  op.preview = preview;
  op.result = saved;
  return { resource: saved, navigation: path };
}

export async function readTool(
  c: Connection,
  s: Scope,
  name: string,
  input: unknown,
): Promise<any> {
  await authorize(c, s);
  const a = parseTool(name, input) as Record<string, any>;
  if (name === "list_supported_currencies") return currencies.codes();
  if (name === "get_preferences") {
    const [u] = await rows(
      c,
      s.organizationId
        ? "SELECT id,name,base_currency,country,number_format,timezone,version FROM organization WHERE id=$1"
        : 'SELECT id,name,base_currency,country,number_format,version FROM "user" WHERE id=$1',
      [s.organizationId || s.userId],
    );
    return publicRecord(u);
  }
  if (name === "list_workspaces")
    return await rows(
      c,
      "SELECT o.id,o.name,o.slug,m.role FROM organization o JOIN members m ON m.organization_id=o.id WHERE m.user_id=$1 AND m.status='active' AND m.role IN ('owner','admin','member','employee') ORDER BY o.name LIMIT 100",
      [s.userId],
    );
  if (name === "get_transaction")
    return publicRecord(await scoped(c, "transaction", a.id, s));
  if (name === "search_transactions") {
    const condition = scopeWhere(s);
    const values: unknown[] = [...condition.values];
    const where = [
      `t.account_id IN (SELECT id FROM finance_account WHERE ${condition.sql})`,
      `(t.to_account_id IS NULL OR t.to_account_id IN (SELECT id FROM finance_account WHERE ${condition.sql}))`,
    ];
    const add = (sql: string, value: unknown) => {
      values.push(value);
      where.push(sql.replace("?", `$${values.length}`));
    };
    for (const [key, column] of Object.entries({
      accountId: "account_id",
      categoryId: "category_id",
      payeeId: "payee_id",
      type: "type",
    }))
      if (a[key]) add(`t.${column}=?`, a[key]);
    if (a.tagId) add("?::uuid=ANY(t.tag_ids)", a.tagId);
    if (a.from) add("t.date>=?", new Date(a.from).toISOString());
    if (a.to) add("t.date<?", new Date(a.to).toISOString());
    if (a.minAmount) add("t.amount>=?", a.minAmount);
    if (a.maxAmount) add("t.amount<=?", a.maxAmount);
    if (a.query)
      add(
        "(COALESCE(t.description,'') || ' ' || COALESCE(p.name,'') || ' ' || COALESCE(cat.name,'')) ILIKE ?",
        `%${a.query}%`,
      );
    const records = await rows(
      c,
      `SELECT t.*,a.name AS account_name,a.currency,p.name AS payee_name,cat.name AS category_name,count(*) OVER()::int AS total FROM "transaction" t JOIN finance_account a ON a.id=t.account_id LEFT JOIN payee p ON p.id=t.payee_id LEFT JOIN category cat ON cat.id=t.category_id WHERE ${where.join(" AND ")} ORDER BY t.date DESC,t.id LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, a.limit, a.offset],
    );
    return {
      data: records.map(publicRecord),
      total: records[0]?.total || 0,
      limit: a.limit,
      offset: a.offset,
    };
  }
  if (name === "compare_periods") {
    const current = await aggregateReport(c, s, a.current, true),
      previous = await aggregateReport(c, s, a.previous, true);
    const deltas = (now: any[], before: any[], category = false) => {
      const key = (r: any) =>
        r.currency + (category ? ":" + (r.category_id || "uncategorized") : "");
      const currentMap = new Map(now.map((r) => [key(r), r])),
        previousMap = new Map(before.map((r) => [key(r), r]));
      return [...new Set([...currentMap.keys(), ...previousMap.keys()])]
        .map((k) => {
          const n = currentMap.get(k),
            p = previousMap.get(k);
          const currentAmount = units(n?.amount || "0"),
            previousAmount = units(p?.amount || "0");
          return {
            currency: (n || p).currency,
            ...(category
              ? {
                  categoryId: (n || p).category_id,
                  categoryName: (n || p).category_name,
                }
              : {}),
            currentAmount: decimal(currentAmount),
            previousAmount: decimal(previousAmount),
            change: decimal(currentAmount - previousAmount),
            percentChange:
              previousAmount === BigInt(0)
                ? null
                : decimal(
                    ((currentAmount - previousAmount) * BigInt(1000000)) /
                      previousAmount,
                  ),
          };
        })
        .sort((x, y) =>
          units(x.change) > units(y.change)
            ? -1
            : units(x.change) < units(y.change)
              ? 1
              : 0,
        );
    };
    return {
      current,
      previous,
      changes: deltas(current.totals, previous.totals),
      categoryChanges: deltas(current.categories, previous.categories, true),
    };
  }
  if (name === "dashboard_overview") {
    const expenses = await aggregateReport(c, s, { ...a, type: "EXPENSE" }),
      income = await aggregateReport(c, s, { ...a, type: "INCOME" });
    const scope = scopeWhere(s);
    const balances = await rows(
      c,
      `SELECT currency,SUM(current_balance)::text AS balance FROM finance_account WHERE ${scope.sql} GROUP BY currency ORDER BY currency`,
      scope.values,
    );
    return { expenses, income, balances };
  }
  if (
    ["spending_summary", "category_breakdown", "dashboard_overview"].includes(
      name,
    )
  ) {
    return aggregateReport(c, s, a);
  }

  if (name === "next_billing_date") {
    const sub = await scoped(c, "subscription_tracking", a.id, s);
    return {
      id: a.id,
      status: sub.status,
      nextBillingDate: nextBillingDate(sub),
    };
  }
  if (name.startsWith("get_")) {
    const entity = name.slice(4) as Entity;
    if (entities[entity])
      return publicRecord(await scoped(c, entities[entity].table, a.id, s));
  }
  if (name.startsWith("list_")) {
    const plural = name.slice(5);
    const entity = (
      plural === "categories"
        ? "category"
        : plural === "payees"
          ? "payee"
          : plural.slice(0, -1)
    ) as Entity;
    const config = entities[entity];
    if (config) {
      const scope = scopeWhere(s);
      const values: unknown[] = [...scope.values];
      let where = scope.sql;
      if (a.query) {
        values.push(`%${a.query}%`);
        where += ` AND ${entity === "subscription" || entity === "reminder" ? "title" : "name"} ILIKE $2`;
      }
      const result = await rows(
        c,
        `SELECT * FROM "${config.table}" WHERE ${where} ORDER BY id LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, a.limit, a.offset],
      );
      // Do not disclose payee contact data in lookup results.
      return result.map((r) => {
        if (entity === "payee")
          return { id: r.id, name: r.name, isArchived: r.is_archived };
        return publicRecord(r);
      });
    }
  }
  throw new ChatError(400, "UNKNOWN_READ_TOOL");
}
export function nextBillingDate(
  sub: Record<string, any>,
  now = new Date(),
): string | null {
  if (sub.status !== "ACTIVE") return null;
  const start = new Date(sub.start_date);
  let next = new Date(start);
  const months: Record<string, number> = {
    MONTHLY: 1,
    QUARTERLY: 3,
    YEARLY: 12,
  };
  if (months[sub.billing_cycle]) {
    const step = months[sub.billing_cycle];
    let n = Math.max(
      0,
      Math.floor(
        ((now.getUTCFullYear() - start.getUTCFullYear()) * 12 +
          now.getUTCMonth() -
          start.getUTCMonth()) /
          step,
      ),
    );
    const at = (i: number) => {
      const d = new Date(start);
      d.setUTCDate(1);
      d.setUTCMonth(start.getUTCMonth() + i * step);
      const last = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
      ).getUTCDate();
      d.setUTCDate(Math.min(start.getUTCDate(), last));
      return d;
    };
    next = at(n);
    if (next < now) next = at(++n);
  } else {
    const step = sub.billing_cycle === "DAILY" ? 86400000 : 604800000;
    const n = Math.max(0, Math.ceil((now.getTime() - start.getTime()) / step));
    next = new Date(start.getTime() + n * step);
  }
  if (sub.end_date && next > new Date(sub.end_date)) return null;
  return next.toISOString();
}

async function aggregateReport(
  c: Connection,
  s: Scope,
  a: Record<string, any>,
  allCategories = false,
) {
  if (new Date(a.from) >= new Date(a.to))
    throw new ChatError(400, "INVALID_DATE_RANGE");
  const scope = scopeWhere(s, 4);
  const totals = await rows(
    c,
    `SELECT fa.currency, SUM(t.amount)::text AS amount, SUM(COALESCE(t.fee_amount,0))::text AS fees, count(*)::int AS count FROM "transaction" t JOIN finance_account fa ON fa.id=t.account_id WHERE t.date >= $1 AND t.date < $2 AND t.type=$3 AND t.status='completed' AND fa.id IN (SELECT id FROM finance_account WHERE ${scope.sql}) GROUP BY fa.currency ORDER BY fa.currency`,
    [
      new Date(a.from).toISOString(),
      new Date(a.to).toISOString(),
      a.type,
      ...scope.values,
    ],
  );
  const categories = await rows(
    c,
    `SELECT fa.currency,t.category_id,c.name AS category_name,SUM(t.amount)::text AS amount,SUM(COALESCE(t.fee_amount,0))::text AS fees,count(*)::int AS count FROM "transaction" t JOIN finance_account fa ON fa.id=t.account_id LEFT JOIN category c ON c.id=t.category_id WHERE t.date >= $1 AND t.date < $2 AND t.type=$3 AND t.status='completed' AND fa.id IN (SELECT id FROM finance_account WHERE ${scope.sql}) GROUP BY fa.currency,t.category_id,c.name ORDER BY SUM(t.amount) DESC ${allCategories ? "" : "LIMIT $5"}`,
    [
      new Date(a.from).toISOString(),
      new Date(a.to).toISOString(),
      a.type,
      ...scope.values,
      ...(allCategories ? [] : [a.topN]),
    ],
  );
  return {
    from: a.from,
    to: a.to,
    type: a.type,
    totals,
    categories,
    feePolicy: "amount excludes separately reported fees; transfers excluded",
  };
}

// Preserve ordinary REST deletion semantics while chat uses archive/cancel tools.
export async function deleteEntity(
  c: Connection,
  s: Scope,
  entity: "payee" | "subscription",
  id: string,
) {
  await authorize(c, s, true);
  const table = entities[entity].table;
  await scoped(c, table, id, s, undefined, true);
  await c.query(`DELETE FROM "${table}" WHERE id=$1`, [id]);
  return { resource: { id, deleted: true } };
}
