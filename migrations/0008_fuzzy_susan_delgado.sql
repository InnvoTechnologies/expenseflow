ALTER TABLE "organization" ADD COLUMN "base_currency" text DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "country" text DEFAULT 'US' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "number_format" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "base_currency" text DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "country" text DEFAULT 'US' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "number_format" integer DEFAULT 2 NOT NULL;