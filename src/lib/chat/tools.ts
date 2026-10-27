import { z, ZodTypeAny } from "zod";
import currencies from "currency-codes";
import { uuid, money, nonnegativeMoney, ChatError } from "./core";

const name = z.string().trim().min(1).max(160);
const text = z.string().max(2000);
export const currency = z
  .string()
  .length(3)
  .refine((v) => !!currencies.code(v), "Unsupported ISO currency");
const date = z.string().datetime({ offset: true });
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const nullableId = uuid.nullable().optional();
const transactionFields = {
  amount: money,
  feeAmount: nonnegativeMoney.default("0"),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  date,
  description: text.nullable().optional(),
  accountId: uuid,
  toAccountId: nullableId,
  categoryId: nullableId,
  payeeId: nullableId,
  tagIds: z.array(uuid).max(50).nullable().optional(),
  subscriptionId: nullableId,
  status: z.enum(["pending", "completed", "failed"]).default("completed"),
  exchangeRate: z
    .string()
    .regex(/^\d{1,13}(\.\d{1,6})?$/)
    .optional(),
  destinationAmount: money.nullable().optional(),
};
export const transactionInput = z.object(transactionFields).strict();
export const transactionPatch = z
  .object(transactionFields)
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Empty patch");
export const entities = {
  account: {
    table: "finance_account",
    path: "/accounts",
    fields: z
      .object({
        name,
        type: z
          .enum(["BANK", "CASH", "MOBILE_WALLET", "CREDIT_CARD"])
          .default("BANK"),
        currency: currency.default("USD"),
        currentBalance: nonnegativeMoney.default("0"),
        isDefault: z.boolean().optional(),
      })
      .strict(),
  },
  category: {
    table: "category",
    path: "/categories",
    fields: z
      .object({
        name,
        type: z.enum(["EXPENSE", "INCOME"]).default("EXPENSE"),
        color: color.default("#9CA3AF"),
        parentId: nullableId,
      })
      .strict(),
  },
  tag: {
    table: "tag",
    path: "/tags",
    fields: z.object({ name, color: color.default("#000000") }).strict(),
  },
  payee: {
    table: "payee",
    path: "/payees",
    fields: z
      .object({
        name,
        email: z.string().email().max(254).nullable().optional(),
        phone: z.string().max(60).nullable().optional(),
        address: text.nullable().optional(),
        description: text.nullable().optional(),
        isArchived: z.boolean().optional(),
      })
      .strict(),
  },
  subscription: {
    table: "subscription_tracking",
    path: "/subscriptions",
    fields: z
      .object({
        title: name,
        description: text.nullable().optional(),
        amount: money,
        currency: currency.default("USD"),
        billingCycle: z.enum([
          "DAILY",
          "WEEKLY",
          "MONTHLY",
          "QUARTERLY",
          "YEARLY",
        ]),
        startDate: date,
        endDate: date.nullable().optional(),
        accountId: nullableId,
        categoryId: nullableId,
        reminderEnabled: z.boolean().default(true),
        notifyDaysBefore: z
          .number()
          .int()
          .min(0)
          .max(365)
          .nullable()
          .optional(),
        status: z
          .enum(["ACTIVE", "CANCELLED", "PAUSED", "EXPIRED"])
          .default("ACTIVE"),
      })
      .strict(),
  },
  reminder: {
    table: "reminder",
    path: "/reminders",
    fields: z
      .object({
        title: name,
        description: text.nullable().optional(),
        dueDate: date,
        status: z.enum(["PENDING", "COMPLETED", "SKIPPED"]).default("PENDING"),
      })
      .strict(),
  },
};
export type Entity = keyof typeof entities;
export type Tool = { schema: ZodTypeAny; write: boolean; description: string };
export const registry: Record<string, Tool> = {};
const add = (
  key: string,
  schema: ZodTypeAny,
  write: boolean,
  description: string,
) => {
  registry[key] = { schema, write, description };
};
const empty = z.object({}).strict();
const list = z
  .object({
    query: z.string().max(160).optional(),
    limit: z.number().int().min(1).max(100).default(50),
    offset: z.number().int().min(0).max(10000).default(0),
  })
  .strict();
for (const [entity, config] of Object.entries(entities)) {
  const plural =
    entity === "category"
      ? "categories"
      : entity === "payee"
        ? "payees"
        : entity + "s";
  add(
    `list_${plural}`,
    list,
    false,
    `List ${plural} in this conversation scope. Names can be ambiguous; ask the user to choose. Paginate using offset.`,
  );
  add(
    `get_${entity}`,
    z.object({ id: uuid }).strict(),
    false,
    `Get one scoped ${entity}.`,
  );
  add(
    `create_${entity}`,
    config.fields,
    true,
    `Preview creation of a ${entity}. All writes require explicit approval.`,
  );
  add(
    `update_${entity}`,
    z
      .object({
        id: uuid,
        patch: (config.fields as z.AnyZodObject)
          .partial()
          .strict()
          .refine((v: Record<string, unknown>) => Object.keys(v).length > 0),
      })
      .strict(),
    true,
    `Preview editing a ${entity}.`,
  );
  if (entity !== "subscription" && entity !== "payee")
    add(
      `delete_${entity}`,
      z.object({ id: uuid }).strict(),
      true,
      `Preview deleting a ${entity}; referenced records cannot be deleted except tags, whose references are removed.`,
    );
}
add(
  "archive_payee",
  z.object({ id: uuid }).strict(),
  true,
  "Archive a payee, retaining transaction history.",
);
for (const verb of ["cancel", "resume"])
  add(
    `${verb}_subscription`,
    z.object({ id: uuid }).strict(),
    true,
    `${verb} tracking only; does not contact the subscription provider.`,
  );
add(
  "next_billing_date",
  z.object({ id: uuid }).strict(),
  false,
  "Calculate the next subscription billing date.",
);
add(
  "complete_reminder",
  z.object({ id: uuid }).strict(),
  true,
  "Mark a reminder completed.",
);
add(
  "bulk_create_categories",
  z
    .object({ categories: z.array(entities.category.fields).min(1).max(25) })
    .strict(),
  true,
  "Preview creating categories in an atomic batch.",
);
add(
  "create_transaction",
  transactionInput,
  true,
  "Preview an income, expense or recorded transfer. Dates must be ISO instants with timezone offset. Money must be decimal strings.",
);
add(
  "update_transaction",
  z.object({ id: uuid, patch: transactionPatch }).strict(),
  true,
  "Preview a transaction edit with correct reversal of the old balance effect.",
);
add(
  "delete_transaction",
  z.object({ id: uuid }).strict(),
  true,
  "Preview transaction deletion and reversal of balances.",
);
add(
  "record_transfer",
  transactionInput.omit({ type: true }).extend({ toAccountId: uuid }).strict(),
  true,
  "Record a transfer inside this scope. Does not move money at a bank. For unlike currencies supply rate and destinationAmount.",
);
export const searchSchema = z
  .object({
    query: z.string().max(160).optional(),
    accountId: uuid.optional(),
    categoryId: uuid.optional(),
    payeeId: uuid.optional(),
    tagId: uuid.optional(),
    type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]).optional(),
    from: date.optional(),
    to: date.optional(),
    minAmount: nonnegativeMoney.optional(),
    maxAmount: nonnegativeMoney.optional(),
    limit: z.number().int().min(1).max(100).default(30),
    offset: z.number().int().min(0).max(10000).default(0),
  })
  .strict();
add(
  "search_transactions",
  searchSchema,
  false,
  "Search the scoped ledger with inclusive from and exclusive to instants. Paginate using offset.",
);
add(
  "get_transaction",
  z.object({ id: uuid }).strict(),
  false,
  "Get one transaction in this scope.",
);
const period = z
  .object({
    from: date,
    to: date,
    type: z.enum(["INCOME", "EXPENSE"]).default("EXPENSE"),
    topN: z.number().int().min(1).max(50).default(10),
  })
  .strict();
for (const key of [
  "spending_summary",
  "category_breakdown",
  "dashboard_overview",
])
  add(
    key,
    period,
    false,
    "Exact full-dataset SQL aggregates grouped by currency, excluding transfers. Dates are half-open instants in the user timezone.",
  );
add(
  "compare_periods",
  z.object({ current: period, previous: period }).strict(),
  false,
  "Compare exact spending by category and currency. Explain measured differences; do not invent causes.",
);
add(
  "list_workspaces",
  empty,
  false,
  "List authorized workspace metadata; does not access their finance data.",
);
const workspace = z
  .object({
    name,
    logo: z.string().url().max(2000).nullable().optional(),
    metadata: z.string().max(4000).nullable().optional(),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(100),
    timezone: z.string().max(100).optional(),
    baseCurrency: currency.optional(),
    country: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .optional(),
    numberFormat: z.number().int().min(0).max(4).optional(),
  })
  .strict();
add(
  "create_workspace",
  workspace,
  true,
  "Create a workspace and owner membership, leaving conversation scope unchanged.",
);
add(
  "update_workspace",
  workspace
    .partial()
    .strict()
    .refine((v) => Object.keys(v).length > 0),
  true,
  "Update selected workspace settings; requires owner/admin.",
);
add("get_preferences", empty, false, "Get profile preferences only.");
add(
  "update_preferences",
  z
    .object({
      name: name.optional(),
      baseCurrency: currency.optional(),
      country: z
        .string()
        .regex(/^[A-Z]{2}$/)
        .optional(),
      numberFormat: z.number().int().min(0).max(4).optional(),
    })
    .strict()
    .refine((v) => Object.keys(v).length > 0),
  true,
  "Update profile preferences in Personal scope only.",
);
add(
  "list_supported_currencies",
  empty,
  false,
  "List supported ISO currencies.",
);

// Convert this deliberately limited Zod vocabulary to provider JSON Schema.
export function jsonSchema(schema: ZodTypeAny): Record<string, unknown> {
  const d = schema._def;
  const t = d.typeName;
  if (t === "ZodEffects") return jsonSchema(d.schema);
  if (t === "ZodOptional" || t === "ZodDefault") return jsonSchema(d.innerType);
  if (t === "ZodNullable")
    return { anyOf: [jsonSchema(d.innerType), { type: "null" }] };
  if (t === "ZodObject") {
    const shape = d.shape();
    return {
      type: "object",
      properties: Object.fromEntries(
        Object.entries(shape).map(([k, v]) => [k, jsonSchema(v as ZodTypeAny)]),
      ),
      required: Object.keys(shape).filter((k) => !shape[k].isOptional()),
      additionalProperties: false,
    };
  }
  if (t === "ZodEnum") return { type: "string", enum: d.values };
  if (t === "ZodArray")
    return {
      type: "array",
      items: jsonSchema(d.type),
      ...(d.maxLength ? { maxItems: d.maxLength.value } : {}),
      ...(d.minLength ? { minItems: d.minLength.value } : {}),
    };
  if (t === "ZodString") {
    const result: Record<string, unknown> = { type: "string" };
    for (const c of d.checks) {
      if (c.kind === "max") result.maxLength = c.value;
      if (c.kind === "min") result.minLength = c.value;
      if (c.kind === "uuid") result.format = "uuid";
      if (c.kind === "datetime") result.format = "date-time";
      if (c.kind === "regex") result.pattern = c.regex.source;
    }
    return result;
  }
  if (t === "ZodBoolean") return { type: "boolean" };
  if (t === "ZodNumber") {
    const result: Record<string, unknown> = {
      type: d.checks.some((c: any) => c.kind === "int") ? "integer" : "number",
    };
    for (const c of d.checks) {
      if (c.kind === "min") result.minimum = c.value;
      if (c.kind === "max") result.maximum = c.value;
    }
    return result;
  }
  throw new Error(`Unsupported schema ${t}`);
}
export function parseTool(name: string, args: unknown) {
  const tool = registry[name];
  if (!tool) throw new ChatError(400, "UNKNOWN_TOOL");
  return tool.schema.parse(args);
}
export function providerTools() {
  return Object.entries(registry).map(([name, t]) => ({
    type: "function",
    function: {
      name,
      description: t.description,
      parameters: jsonSchema(t.schema),
    },
  }));
}
