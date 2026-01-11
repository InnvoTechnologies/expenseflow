import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  integer,
  varchar,
  pgEnum,
  decimal
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
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: varchar("image", { length: 255 }).default(""),
  name: varchar("name", { length: 255 }),
  internalAccount: boolean("internal_account").default(false),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
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
  userId: uuid("user_id").notNull(),

  // FIXED: Changed from uuid to text to match organization.id definition
  organizationId: uuid("organization_id").notNull().references(() => organization.id),

  accountType: text("account_type").default("employee").notNull(),
  status: text("status").default("active"),
  role: text('role').notNull(),
  invitedBy: uuid("invited_by").references(() => user.id, { onDelete: "cascade" }),
  pin: integer("pin"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ----------------------------------------------------------------------
// 3. FINANCE SCHEMA (New Updates)
// ----------------------------------------------------------------------

// Represents a wallet, bank account, or cash drawer.
// Scoped to EITHER a User (Personal) OR an Organization (Business).
export const financeAccount = pgTable("finance_account", {
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
});

// Categories for Income/Expense. 
// Users create their own, Orgs create their own.
export const category = pgTable("category", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(), // "Groceries", "Server Costs"
  type: categoryTypeEnum("type").default("EXPENSE").notNull(),
  color: text("color").default("#9CA3AF").notNull(),

  // Ownership
  userId: uuid("user_id").references(() => user.id),
  organizationId: uuid("organization_id").references(() => organization.id),


  // Hierarchical categories (e.g. Utilities -> Electric)
  parentId: uuid("parent_id"), // Self-reference added in relations below

  createdAt: timestamp("created_at").defaultNow(),
});

// The Central Ledger
export const transaction = pgTable("transaction", {
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
  // Status tracking
  status: text("status").default("completed"), // pending, completed, failed

  // Tags
  tagIds: uuid("tag_ids").array(),

  // Link to Subscription (Optional)
  subscriptionId: uuid("subscription_id").references(() => subscriptionTracking.id),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Payees (People or Entities being paid)
export const payee = pgTable("payee", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  description: text("description"),

  // Ownership
  userId: uuid("user_id").references(() => user.id),
  organizationId: uuid("organization_id").references(() => organization.id),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Reminders for bills and financial obligations
export const reminder = pgTable("reminder", {
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
});

// Subscription Tracking - for tracking recurring subscriptions (Netflix, Spotify, etc.)
export const subscriptionTracking = pgTable("subscription_tracking", {
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
});

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
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  color: text("color").default("#000000").notNull(),

  // Ownership
  userId: uuid("user_id").references(() => user.id),
  organizationId: uuid("organization_id").references(() => organization.id),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

