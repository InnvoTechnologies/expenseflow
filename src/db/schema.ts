import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  integer,
  varchar,
  pgEnum,
  decimal,
  jsonb,
  bigint,
  index,
  uniqueIndex,
  check,
  foreignKey
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ----------------------------------------------------------------------
// 1. ENUMS (Finance Specific)
// ----------------------------------------------------------------------

// Type of the financial account (e.g., a Wallet, a real Bank, Cash on hand)
export const financeAccountTypeEnum = pgEnum('finance_account_type', [
  'BANK',
  'CASH',
  'MOBILE_WALLET',
  'CREDIT_CARD'
]);

// Type of transaction movement
export const transactionTypeEnum = pgEnum('transaction_type', [
  'INCOME',        // Money In
  'EXPENSE',       // Money Out
  'TRANSFER'       // Movement between accounts (includes Profit Withdrawal)
]);

export const categoryTypeEnum = pgEnum('category_type', [
  'EXPENSE',
  'INCOME'
]);

// Billing cycle for subscription tracking
export const subscriptionBillingCycleEnum = pgEnum('subscription_billing_cycle', [
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'YEARLY'
]);
// ----------------------------------------------------------------------
// 2. PROVIDED AUTH & ORG SCHEMA (Preserved as requested)
// ----------------------------------------------------------------------

export const user = pgTable("user", {
  version: integer("version").notNull().default(1),
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: varchar("image", { length: 255 }).default(""),
  name: varchar("name", { length: 255 }),
  internalAccount: boolean("internal_account").default(false),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  baseCurrency: text("base_currency").default("USD").notNull(),
  country: text("country").default("US").notNull(),
  numberFormat: integer("number_format").default(2).notNull(),
});

export const session = pgTable("session", {
  id: uuid("id").primaryKey().defaultRandom(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: uuid("userId").notNull().references(() => user.id),
});

// This is the OAuth Account (Google, GitHub, etc.)
export const account = pgTable("account", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: uuid("userId").notNull().references(() => user.id),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const verification = pgTable("verification", {
  id: uuid("id").primaryKey().defaultRandom(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt"),
  updatedAt: timestamp("updatedAt"),
});

export const subscription = pgTable("subscription", {
  id: uuid("id").primaryKey().defaultRandom(),
  plan: text("plan").notNull(),
  referenceId: text("reference_id").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  status: text("status").default("incomplete").notNull(),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  seats: integer("seats").default(1),
  trialStart: timestamp("trial_start"),
  trialEnd: timestamp("trial_end"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const organization = pgTable("organization", {
  version: integer("version").notNull().default(1),
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  logo: text("logo"),
  createdAt: timestamp("created_at").notNull(),
  metadata: text("metadata"),
  userId: uuid("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  timezone: text("timezone"),
  subscriptionStatus: text("subscription_status"),
  subscriptionGraceEndDate: timestamp("subscription_grace_end_date"),
  baseCurrency: text("base_currency").default("USD").notNull(),
  country: text("country").default("US").notNull(),
  numberFormat: integer("number_format").default(2).notNull(),
});

export const invitation = pgTable("invitation", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role"),
  status: text("status").default("pending").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const member = pgTable("members", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),

  // FIXED: Changed from uuid to text to match organization.id definition
  organizationId: uuid("organization_id").notNull().references(() => organization.id),

  accountType: text("account_type").default("employee").notNull(),
  status: text("status").default("active"),
  role: text('role').notNull(),
  invitedBy: uuid("invited_by").references(() => user.id, { onDelete: "cascade" }),
  pin: integer("pin"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, t => [
  uniqueIndex("members_user_org_unique").on(t.userId, t.organizationId),
  index("members_lookup_idx").on(t.userId, t.organizationId, t.status),
]);

// ----------------------------------------------------------------------
// 3. FINANCE SCHEMA (New Updates)
// ----------------------------------------------------------------------

// Represents a wallet, bank account, or cash drawer.
// Scoped to EITHER a User (Personal) OR an Organization (Business).
export const financeAccount = pgTable("finance_account", {
  version: integer("version").notNull().default(1),
  id: uuid("id").primaryKey().defaultRandom(),

  name: text("name").notNull(), // e.g. "Chase Business", "Personal Savings"
  type: financeAccountTypeEnum("type").default("BANK").notNull(),
  currency: text("currency").default("USD").notNull(),

  // Real-time balance (updated via app logic/triggers)
  currentBalance: decimal("current_balance", { precision: 19, scale: 4 }).default("0").notNull(),

  // Ownership (Mutually exclusive ideally, enforced by app logic)
  userId: uuid("user_id").references(() => user.id),
  organizationId: uuid("organization_id").references(() => organization.id),

  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, t => [
  check("finance_account_ownership", sql`(${t.userId} IS NULL) <> (${t.organizationId} IS NULL)`),
  index("finance_account_user_idx").on(t.userId),
  index("finance_account_org_idx").on(t.organizationId),
]);

// Categories for Income/Expense. 
// Users create their own, Orgs create their own.
export const category = pgTable("category", {
  version: integer("version").notNull().default(1),
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(), // "Groceries", "Server Costs"
  type: categoryTypeEnum("type").default("EXPENSE").notNull(),
  color: text("color").default("#9CA3AF").notNull(),

  // Ownership
  userId: uuid("user_id").references(() => user.id),
  organizationId: uuid("organization_id").references(() => organization.id),


  // Hierarchical categories (e.g. Utilities -> Electric)
  parentId: uuid("parent_id"), // Self-reference added in relations below

  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, t => [
  check("category_ownership", sql`(${t.userId} IS NULL) <> (${t.organizationId} IS NULL)`),
  index("category_user_idx").on(t.userId),
  index("category_org_idx").on(t.organizationId),
]);

// The Central Ledger
export const transaction = pgTable("transaction", {
  version: integer("version").notNull().default(1),
  id: uuid("id").primaryKey().defaultRandom(),

  amount: decimal("amount", { precision: 19, scale: 4 }).notNull(),
  type: transactionTypeEnum("type").notNull(),
  date: timestamp("date").notNull().defaultNow(),
  description: text("description"),

  // The primary account affected (Money comes out of here for Expense/Transfer, goes into here for Income)
  accountId: uuid("account_id").notNull().references(() => financeAccount.id),

  // For Transfers: The destination account.
  // CRITICAL: This allows transferring from an Org Account to a User Account (Profit Withdrawal)
  toAccountId: uuid("to_account_id").references(() => financeAccount.id),

  // Classification
  categoryId: uuid("category_id").references(() => category.id),

  // Payee (Money directed to/from this person/entity)
  payeeId: uuid("payee_id").references(() => payee.id),

  // Fees (e.g. Stripe fee, Wire fee).
  // Deducted from the transaction amount effectively, or tracked alongside it.
  feeAmount: decimal("fee_amount", { precision: 19, scale: 4 }).default("0"),
  exchangeRate: decimal("exchange_rate", { precision: 19, scale: 6 }).default("1"),
  destinationAmount: decimal("destination_amount", { precision: 19, scale: 4 }),
  // Status tracking
  status: text("status").default("completed"), // pending, completed, failed

  // Tags
  tagIds: uuid("tag_ids").array(),

  // Link to Subscription (Optional)
  subscriptionId: uuid("subscription_id").references(() => subscriptionTracking.id),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, t => [
  index("transaction_account_date_idx").on(t.accountId, t.date, t.id),
  index("transaction_destination_date_idx").on(t.toAccountId, t.date, t.id),
]);

// Payees (People or Entities being paid)
export const payee = pgTable("payee", {
  version: integer("version").notNull().default(1),
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  description: text("description"),

  // Ownership
  userId: uuid("user_id").references(() => user.id),
  organizationId: uuid("organization_id").references(() => organization.id),

  isArchived: boolean("is_archived").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, t => [
  check("payee_ownership", sql`(${t.userId} IS NULL) <> (${t.organizationId} IS NULL)`),
  index("payee_user_idx").on(t.userId),
  index("payee_org_idx").on(t.organizationId),
]);

// Reminders for bills and financial obligations
export const reminder = pgTable("reminder", {
  version: integer("version").notNull().default(1),
  id: uuid("id").primaryKey().defaultRandom(),

  title: text("title").notNull(), // "Pay Electricity Bill"
  description: text("description"),

  dueDate: timestamp("due_date").notNull(),

  // Status of this reminder
  status: text("status").default("PENDING"), // PENDING, COMPLETED, SKIPPED

  // Ownership
  userId: uuid("user_id").references(() => user.id),
  organizationId: uuid("organization_id").references(() => organization.id),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, t => [
  check("reminder_ownership", sql`(${t.userId} IS NULL) <> (${t.organizationId} IS NULL)`),
  index("reminder_user_idx").on(t.userId),
  index("reminder_org_idx").on(t.organizationId),
]);

// Subscription Tracking - for tracking recurring subscriptions (Netflix, Spotify, etc.)
export const subscriptionTracking = pgTable("subscription_tracking", {
  version: integer("version").notNull().default(1),
  id: uuid("id").primaryKey().defaultRandom(),

  title: text("title").notNull(), // "Netflix Premium", "Spotify Premium"
  description: text("description"),

  // Billing information
  amount: decimal("amount", { precision: 19, scale: 4 }).notNull(),
  currency: text("currency").default("USD").notNull(),
  billingCycle: subscriptionBillingCycleEnum("billing_cycle").notNull(), // DAILY, WEEKLY, MONTHLY, QUARTERLY, YEARLY

  // Dates
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"), // For cancelled subscriptions
  // Note: nextBillingDate is calculated from startDate and billingCycle

  // Payment method
  accountId: uuid("account_id").references(() => financeAccount.id), // Link to finance account used for payment

  // Category for expense tracking
  categoryId: uuid("category_id").references(() => category.id),

  // Notification settings
  reminderEnabled: boolean("reminder_enabled").default(true),
  notifyDaysBefore: integer("notify_days_before"), // Single number of days before billing to notify (e.g., 3)

  // Status
  status: text("status").default("ACTIVE"), // ACTIVE, CANCELLED, PAUSED, EXPIRED

  // Ownership
  userId: uuid("user_id").references(() => user.id),
  organizationId: uuid("organization_id").references(() => organization.id),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, t => [
  check("subscription_tracking_ownership", sql`(${t.userId} IS NULL) <> (${t.organizationId} IS NULL)`),
  index("subscription_tracking_user_idx").on(t.userId),
  index("subscription_tracking_org_idx").on(t.organizationId),
]);

// ----------------------------------------------------------------------
// 4. RELATIONS
// ----------------------------------------------------------------------

export const userRelations = relations(user, ({ many }) => ({
  financeAccounts: many(financeAccount),
  organizations: many(organization),
  categories: many(category),
  reminders: many(reminder),
  payees: many(payee),
  subscriptionTrackings: many(subscriptionTracking),
}));

export const organizationRelations = relations(organization, ({ many }) => ({
  financeAccounts: many(financeAccount),
  categories: many(category),
  members: many(member),
  reminders: many(reminder),
  payees: many(payee),
  subscriptionTrackings: many(subscriptionTracking),
}));

export const financeAccountRelations = relations(financeAccount, ({ one, many }) => ({
  user: one(user, {
    fields: [financeAccount.userId],
    references: [user.id],
  }),
  organization: one(organization, {
    fields: [financeAccount.organizationId],
    references: [organization.id],
  }),
  transactions: many(transaction, { relationName: "account_transactions" }),
  incomingTransfers: many(transaction, { relationName: "transfer_destination" }),
}));

export const categoryRelations = relations(category, ({ one, many }) => ({
  parent: one(category, {
    fields: [category.parentId],
    references: [category.id],
    relationName: "sub_categories"
  }),
  children: many(category, { relationName: "sub_categories" }),
  transactions: many(transaction),
}));

export const transactionRelations = relations(transaction, ({ one, many }) => ({
  // The source account
  account: one(financeAccount, {
    fields: [transaction.accountId],
    references: [financeAccount.id],
    relationName: "account_transactions"
  }),
  // The destination account (for Transfers/Withdrawals)
  toAccount: one(financeAccount, {
    fields: [transaction.toAccountId],
    references: [financeAccount.id],
    relationName: "transfer_destination"
  }),
  category: one(category, {
    fields: [transaction.categoryId],
    references: [category.id],
  }),
  payee: one(payee, {
    fields: [transaction.payeeId],
    references: [payee.id],
  }),
  subscription: one(subscriptionTracking, {
    fields: [transaction.subscriptionId],
    references: [subscriptionTracking.id],
  }),
}));

export const payeeRelations = relations(payee, ({ one, many }) => ({
  user: one(user, {
    fields: [payee.userId],
    references: [user.id],
  }),
  organization: one(organization, {
    fields: [payee.organizationId],
    references: [organization.id],
  }),
  transactions: many(transaction),
}));

export const reminderRelations = relations(reminder, ({ one }) => ({
  user: one(user, {
    fields: [reminder.userId],
    references: [user.id],
  }),
  organization: one(organization, {
    fields: [reminder.organizationId],
    references: [organization.id],
  }),
}));

export const subscriptionTrackingRelations = relations(subscriptionTracking, ({ one, many }) => ({
  user: one(user, {
    fields: [subscriptionTracking.userId],
    references: [user.id],
  }),
  organization: one(organization, {
    fields: [subscriptionTracking.organizationId],
    references: [organization.id],
  }),
  category: one(category, {
    fields: [subscriptionTracking.categoryId],
    references: [category.id],
  }),
  account: one(financeAccount, {
    fields: [subscriptionTracking.accountId],
    references: [financeAccount.id],
  }),
  transactions: many(transaction),
}));

export const tag = pgTable("tag", {
  version: integer("version").notNull().default(1),
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  color: text("color").default("#000000").notNull(),

  // Ownership
  userId: uuid("user_id").references(() => user.id),
  organizationId: uuid("organization_id").references(() => organization.id),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, t => [
  check("tag_ownership", sql`(${t.userId} IS NULL) <> (${t.organizationId} IS NULL)`),
  index("tag_user_idx").on(t.userId),
  index("tag_org_idx").on(t.organizationId),
]);


// Persisted copilot conversations. Organization scope is immutable in the service.
const instant = (name: string) => timestamp(name, { withTimezone: true });
export const chatConversation = pgTable("chat_conversation", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").references(() => organization.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 160 }).notNull().default("New conversation"),
  timezone: text("timezone").notNull(), locale: varchar("locale", { length: 64 }).notNull(),
  status: text("status").notNull().default("active"),
  nextMessageSequence: bigint("next_message_sequence", { mode: "number" }).notNull().default(1),
  createdAt: instant("created_at").notNull().defaultNow(), updatedAt: instant("updated_at").notNull().defaultNow(),
}, t => [
  index("chat_personal_idx").on(t.userId, t.updatedAt, t.id).where(sql`${t.organizationId} IS NULL`),
  index("chat_organization_idx").on(t.userId, t.organizationId, t.updatedAt, t.id).where(sql`${t.organizationId} IS NOT NULL`),
  check("chat_conversation_status", sql`${t.status} IN ('active','archived')`),
]);
export const chatRun = pgTable("chat_run", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => chatConversation.id, { onDelete: "cascade" }),
  clientRequestId: uuid("client_request_id").notNull(), requestHash: text("request_hash").notNull(),
  status: text("status").notNull().default("queued"),
  provider: text("provider").notNull().default("openrouter"), model: text("model").notNull().default("openai/gpt-6-luna"),
  timezone: text("timezone").notNull(), locale: varchar("locale", { length: 64 }).notNull(),
  inputTokens: integer("input_tokens"), outputTokens: integer("output_tokens"), providerRequestId: text("provider_request_id"),
  errorCode: text("error_code"), leaseExpiresAt: instant("lease_expires_at"),
  createdAt: instant("created_at").notNull().defaultNow(), completedAt: instant("completed_at"),
}, t => [
  uniqueIndex("chat_run_request_unique").on(t.conversationId, t.clientRequestId),
  uniqueIndex("chat_run_scope_unique").on(t.id, t.conversationId),
  uniqueIndex("chat_one_active_run").on(t.conversationId).where(sql`${t.status} IN ('queued','running')`),
  check("chat_run_status", sql`${t.status} IN ('queued','running','completed','failed','interrupted')`),
]);
export const chatMessage = pgTable("chat_message", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => chatConversation.id, { onDelete: "cascade" }),
  runId: uuid("run_id").notNull(), sequence: bigint("sequence", { mode: "number" }).notNull(),
  role: text("role").notNull(), content: jsonb("content").notNull(),
  createdAt: instant("created_at").notNull().defaultNow(),
}, t => [
  uniqueIndex("chat_message_sequence_unique").on(t.conversationId, t.sequence),
  index("chat_message_run_idx").on(t.runId, t.sequence),
  foreignKey({ columns: [t.runId, t.conversationId], foreignColumns: [chatRun.id, chatRun.conversationId] }).onDelete("cascade"),
  check("chat_message_role", sql`${t.role} IN ('user','assistant','tool')`),
]);
export const chatActionBatch = pgTable("chat_action_batch", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => chatConversation.id, { onDelete: "cascade" }),
  runId: uuid("run_id").notNull(), supersedesBatchId: uuid("supersedes_batch_id"),
  version: integer("version").notNull().default(1), status: text("status").notNull().default("pending"),
  previewHash: text("preview_hash").notNull(), expiresAt: instant("expires_at").notNull(),
  approvedBy: uuid("approved_by").references(() => user.id, { onDelete: "set null" }),
  approvedAt: instant("approved_at"), executedAt: instant("executed_at"), executionKey: uuid("execution_key").unique(),
  result: jsonb("result"), errorCode: text("error_code"), createdAt: instant("created_at").notNull().defaultNow(),
}, t => [
  uniqueIndex("chat_batch_scope_unique").on(t.id, t.conversationId),
  index("chat_batch_conversation_idx").on(t.conversationId, t.createdAt),
  index("chat_batch_expiry_idx").on(t.expiresAt).where(sql`${t.status} = 'pending'`),
  foreignKey({ columns: [t.runId, t.conversationId], foreignColumns: [chatRun.id, chatRun.conversationId] }).onDelete("cascade"),
  foreignKey({ columns: [t.supersedesBatchId, t.conversationId], foreignColumns: [t.id, t.conversationId] }),
  check("chat_batch_status", sql`${t.status} IN ('pending','superseded','rejected','expired','executed','failed')`),
  check("chat_batch_version", sql`${t.version} > 0`),
  check("chat_batch_execution", sql`${t.status} <> 'executed' OR (${t.approvedAt} IS NOT NULL AND ${t.executedAt} IS NOT NULL)`),
]);
export const chatAction = pgTable("chat_action", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: uuid("batch_id").notNull().references(() => chatActionBatch.id, { onDelete: "cascade" }),
  position: integer("position").notNull(), toolCallId: text("tool_call_id").notNull(), toolName: text("tool_name").notNull(),
  schemaVersion: integer("schema_version").notNull().default(1),
  arguments: jsonb("arguments").notNull(), preview: jsonb("preview").notNull(), preconditions: jsonb("preconditions").notNull(),
  result: jsonb("result"), createdAt: instant("created_at").notNull().defaultNow(),
}, t => [
  uniqueIndex("chat_action_position_unique").on(t.batchId, t.position),
  uniqueIndex("chat_action_call_unique").on(t.batchId, t.toolCallId),
  check("chat_action_position", sql`${t.position} >= 0`),
]);
