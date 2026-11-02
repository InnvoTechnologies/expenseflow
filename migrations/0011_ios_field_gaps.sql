CREATE TABLE "savings_contribution" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"amount" numeric(19, 4) NOT NULL,
	"client_request_id" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "savings_contribution_amount" CHECK ("savings_contribution"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "savings_goal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"target_amount" numeric(19, 4) NOT NULL,
	"current_amount" numeric(19, 4) DEFAULT '0' NOT NULL,
	"currency" text NOT NULL,
	"deadline" timestamp with time zone,
	"icon_name" text DEFAULT 'target' NOT NULL,
	"color" text DEFAULT '#9CA3AF' NOT NULL,
	"category" text DEFAULT 'General' NOT NULL,
	"user_id" uuid,
	"organization_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "savings_goal_ownership" CHECK (("savings_goal"."user_id" IS NULL) <> ("savings_goal"."organization_id" IS NULL)),
	CONSTRAINT "savings_goal_amounts" CHECK ("savings_goal"."target_amount" > 0 AND "savings_goal"."current_amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "category" ADD COLUMN "icon_name" text DEFAULT 'cart.fill' NOT NULL;--> statement-breakpoint
ALTER TABLE "category" ADD COLUMN "monthly_budget" numeric(19, 4);--> statement-breakpoint
ALTER TABLE "category" ADD COLUMN "budget_currency" text;--> statement-breakpoint
ALTER TABLE "finance_account" ADD COLUMN "institution" text;--> statement-breakpoint
ALTER TABLE "finance_account" ADD COLUMN "account_mask" text;--> statement-breakpoint
ALTER TABLE "finance_account" ADD COLUMN "color" text;--> statement-breakpoint
ALTER TABLE "finance_account" ADD COLUMN "card_network" text;--> statement-breakpoint
ALTER TABLE "finance_account" ADD COLUMN "subtype" text;--> statement-breakpoint
ALTER TABLE "payee" ADD COLUMN "icon_name" text DEFAULT 'person.crop.circle.fill' NOT NULL;--> statement-breakpoint
ALTER TABLE "payee" ADD COLUMN "color" text;--> statement-breakpoint
ALTER TABLE "payee" ADD COLUMN "brand_key" text;--> statement-breakpoint
ALTER TABLE "payee" ADD COLUMN "default_category_id" uuid;--> statement-breakpoint
ALTER TABLE "reminder" ADD COLUMN "amount" numeric(19, 4);--> statement-breakpoint
ALTER TABLE "reminder" ADD COLUMN "currency" text;
--> statement-breakpoint
UPDATE reminder r SET currency=CASE WHEN r.organization_id IS NOT NULL THEN (SELECT base_currency FROM organization WHERE id=r.organization_id) ELSE (SELECT base_currency FROM "user" WHERE id=r.user_id) END;
--> statement-breakpoint
ALTER TABLE reminder ALTER COLUMN currency SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reminder" ADD COLUMN "frequency" text DEFAULT 'ONCE' NOT NULL;--> statement-breakpoint
ALTER TABLE "reminder" ADD COLUMN "notify_days_before" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "reminder" ADD COLUMN "is_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "reminder" ADD COLUMN "icon_name" text DEFAULT 'bell.fill' NOT NULL;--> statement-breakpoint
ALTER TABLE "reminder" ADD COLUMN "account_id" uuid;--> statement-breakpoint
ALTER TABLE "subscription_tracking" ADD COLUMN "brand_key" text;--> statement-breakpoint
ALTER TABLE "subscription_tracking" ADD COLUMN "color" text;--> statement-breakpoint
ALTER TABLE "subscription_tracking" ADD COLUMN "icon_name" text;--> statement-breakpoint
ALTER TABLE "subscription_tracking" ADD COLUMN "auto_renew" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "tag" ADD COLUMN "icon_name" text DEFAULT 'tag.fill' NOT NULL;--> statement-breakpoint
ALTER TABLE "transaction" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "avatar_symbol" text;--> statement-breakpoint
ALTER TABLE "savings_contribution" ADD CONSTRAINT "savings_contribution_goal_id_savings_goal_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."savings_goal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_contribution" ADD CONSTRAINT "savings_contribution_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_goal" ADD CONSTRAINT "savings_goal_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_goal" ADD CONSTRAINT "savings_goal_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "savings_contribution_request_unique" ON "savings_contribution" USING btree ("goal_id","client_request_id");--> statement-breakpoint
CREATE INDEX "savings_contribution_goal_idx" ON "savings_contribution" USING btree ("goal_id","created_at");--> statement-breakpoint
CREATE INDEX "savings_goal_user_idx" ON "savings_goal" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "savings_goal_org_idx" ON "savings_goal" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "payee" ADD CONSTRAINT "payee_default_category_id_category_id_fk" FOREIGN KEY ("default_category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder" ADD CONSTRAINT "reminder_account_id_finance_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."finance_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_budget" CHECK (("category"."monthly_budget" IS NULL AND "category"."budget_currency" IS NULL) OR ("category"."monthly_budget" IS NOT NULL AND "category"."monthly_budget" >= 0 AND "category"."budget_currency" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "finance_account" ADD CONSTRAINT "finance_account_subtype" CHECK ("finance_account"."subtype" IS NULL OR ("finance_account"."type" = 'BANK' AND "finance_account"."subtype" IN ('CHECKING','SAVINGS','INVESTMENT')));--> statement-breakpoint
ALTER TABLE "reminder" ADD CONSTRAINT "reminder_amount" CHECK ("reminder"."amount" IS NULL OR "reminder"."amount" >= 0);--> statement-breakpoint
ALTER TABLE "reminder" ADD CONSTRAINT "reminder_notify_days" CHECK ("reminder"."notify_days_before" >= 0);--> statement-breakpoint
ALTER TABLE "reminder" ADD CONSTRAINT "reminder_frequency" CHECK ("reminder"."frequency" IN ('ONCE','DAILY','WEEKLY','MONTHLY','YEARLY'));
--> statement-breakpoint
-- Safe defaults for existing income categories; unknown amounts and associations stay NULL.
UPDATE category SET icon_name='briefcase.fill' WHERE type='INCOME';
--> statement-breakpoint
CREATE TRIGGER copilot_version BEFORE UPDATE ON savings_goal FOR EACH ROW EXECUTE FUNCTION expenseflow_increment_version();
