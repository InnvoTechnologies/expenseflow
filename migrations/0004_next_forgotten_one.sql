CREATE TYPE "public"."subscription_billing_cycle" AS ENUM('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');--> statement-breakpoint
CREATE TABLE "subscription_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"amount" numeric(19, 4) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"billing_cycle" "subscription_billing_cycle" NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"account_id" uuid,
	"category_id" uuid,
	"reminder_enabled" boolean DEFAULT true,
	"notify_days_before" integer,
	"status" text DEFAULT 'ACTIVE',
	"user_id" uuid,
	"organization_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "subscription_tracking" ADD CONSTRAINT "subscription_tracking_account_id_finance_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."finance_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_tracking" ADD CONSTRAINT "subscription_tracking_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_tracking" ADD CONSTRAINT "subscription_tracking_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_tracking" ADD CONSTRAINT "subscription_tracking_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;