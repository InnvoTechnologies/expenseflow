import { Connection, Scope, rows, units } from "./core";
import type { Entity } from "./tools";
import { publicRecord, nextBillingDate } from "./finance";

export function ownershipSql(s: Scope, alias = "", start = 1) {
  const prefix = alias ? alias + "." : "";
  return {
    sql: s.organizationId
      ? `${prefix}organization_id=$${start} AND ${prefix}user_id IS NULL`
      : `${prefix}user_id=$${start} AND ${prefix}organization_id IS NULL`,
    values: [s.organizationId || s.userId],
  };
}
// Response joins are always scoped, even if a historical row has a bad reference.
export async function enrichRecords(
  c: Connection,
  s: Scope,
  entity: Entity,
  records: Record<string, any>[],
): Promise<Record<string, any>[]> {
  if (!records.length) return [];
  const result = records.map(publicRecord);
  if (entity === "savings_goal")
    return result.map((r) => ({
      ...r,
      isCompleted: units(r.currentAmount) >= units(r.targetAmount),
    }));
  const relation = async (table: string, ids: string[], select: string) => {
    if (!ids.length) return new Map<string, any>();
    const where = ownershipSql(s, "", 2);
    return new Map(
      (
        await rows(
          c,
          `SELECT ${select} FROM "${table}" WHERE id=ANY($1::uuid[]) AND ${where.sql}`,
          [ids, ...where.values],
        )
      ).map((r) => [r.id, publicRecord(r)]),
    );
  };
  const accountIds = result.map((r) => r.accountId).filter(Boolean);
  const categoryIds = result
    .map((r) => r.defaultCategoryId || r.categoryId)
    .filter(Boolean);
  const accounts = await relation(
    "finance_account",
    accountIds,
    "id,name,currency,type,subtype",
  );
  const categories = await relation(
    "category",
    categoryIds,
    "id,name,type,color,icon_name",
  );
  for (const record of result) {
    if (entity === "payee")
      record.defaultCategory = categories.get(record.defaultCategoryId) || null;
    if (entity === "reminder" || entity === "subscription")
      record.account = accounts.get(record.accountId) || null;
    if (entity === "subscription") {
      record.category = categories.get(record.categoryId) || null;
      const raw = records.find((r) => r.id === record.id)!;
      record.nextBillingDate = nextBillingDate(raw);
    }
  }
  if (entity === "tag" || entity === "payee") {
    const accountScope = ownershipSql(s, "a", 2),
      ids = result.map((r) => r.id);
    const txScope = `${accountScope.sql} AND (t.to_account_id IS NULL OR t.to_account_id IN (SELECT id FROM finance_account a WHERE ${accountScope.sql}))`;
    if (entity === "tag") {
      const counts = await rows(
        c,
        `SELECT tags.id,count(DISTINCT t.id)::int AS count FROM "transaction" t JOIN finance_account a ON a.id=t.account_id CROSS JOIN LATERAL unnest(t.tag_ids) tags(id) WHERE tags.id=ANY($1::uuid[]) AND ${txScope} GROUP BY tags.id`,
        [ids, ...accountScope.values],
      );
      const map = new Map(counts.map((r) => [r.id, r.count]));
      for (const record of result) record.usageCount = map.get(record.id) || 0;
    } else {
      const counts = await rows(
        c,
        `SELECT t.payee_id,count(*)::int AS count FROM "transaction" t JOIN finance_account a ON a.id=t.account_id WHERE t.payee_id=ANY($1::uuid[]) AND ${txScope} GROUP BY t.payee_id`,
        [ids, ...accountScope.values],
      );
      const totals = await rows(
        c,
        `SELECT t.payee_id,a.currency,SUM(t.amount)::text AS amount FROM "transaction" t JOIN finance_account a ON a.id=t.account_id WHERE t.payee_id=ANY($1::uuid[]) AND ${txScope} AND t.type='EXPENSE' AND t.status='completed' GROUP BY t.payee_id,a.currency ORDER BY a.currency`,
        [ids, ...accountScope.values],
      );
      const countMap = new Map(counts.map((r) => [r.payee_id, r.count]));
      for (const record of result) {
        record.transactionCount = countMap.get(record.id) || 0;
        record.totalSpent = totals
          .filter((r) => r.payee_id === record.id)
          .map((r) => ({ currency: r.currency, amount: r.amount }));
      }
    }
  }
  return result;
}

export async function enrichTransactions(
  c: Connection,
  s: Scope,
  records: Record<string, any>[],
) {
  const data = records.map(publicRecord);
  async function lookup(table: string, ids: string[], select: string) {
    if (!ids.length) return new Map<string, any>();
    const where = ownershipSql(s, "", 2);
    return new Map(
      (
        await rows(
          c,
          `SELECT ${select} FROM "${table}" WHERE id=ANY($1::uuid[]) AND ${where.sql}`,
          [ids, ...where.values],
        )
      ).map((r) => [r.id, publicRecord(r)]),
    );
  }
  const accountIds = data
    .flatMap((r) => [r.accountId, r.toAccountId])
    .filter(Boolean);
  const [accounts, categories, payees, subscriptions, tags] = await Promise.all(
    [
      lookup("finance_account", accountIds, "id,name,currency,type,subtype"),
      lookup(
        "category",
        data.map((r) => r.categoryId).filter(Boolean),
        "id,name,type,color,icon_name",
      ),
      lookup(
        "payee",
        data.map((r) => r.payeeId).filter(Boolean),
        "id,name,color,icon_name",
      ),
      lookup(
        "subscription_tracking",
        data.map((r) => r.subscriptionId).filter(Boolean),
        "id,title,brand_key",
      ),
      lookup(
        "tag",
        data.flatMap((r) => r.tagIds || []),
        "id,name,color,icon_name",
      ),
    ],
  );
  return data.map((r) => ({
    ...r,
    category: categories.get(r.categoryId) || null,
    payee: payees.get(r.payeeId) || null,
    subscription: subscriptions.get(r.subscriptionId) || null,
    account: accounts.get(r.accountId) || null,
    toAccount: accounts.get(r.toAccountId) || null,
    tags: (r.tagIds || []).map((id: string) => tags.get(id)).filter(Boolean),
    currency: accounts.get(r.accountId)?.currency || r.currency,
  }));
}
