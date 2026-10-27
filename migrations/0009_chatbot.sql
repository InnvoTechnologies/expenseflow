CREATE TABLE "chat_action" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"tool_call_id" text NOT NULL,
	"tool_name" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"arguments" jsonb NOT NULL,
	"preview" jsonb NOT NULL,
	"preconditions" jsonb NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_action_position" CHECK ("chat_action"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "chat_action_batch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"supersedes_batch_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"preview_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"executed_at" timestamp with time zone,
	"execution_key" uuid,
	"result" jsonb,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_action_batch_execution_key_unique" UNIQUE("execution_key"),
	CONSTRAINT "chat_batch_status" CHECK ("chat_action_batch"."status" IN ('pending','superseded','rejected','expired','executed','failed')),
	CONSTRAINT "chat_batch_version" CHECK ("chat_action_batch"."version" > 0),
	CONSTRAINT "chat_batch_execution" CHECK ("chat_action_batch"."status" <> 'executed' OR ("chat_action_batch"."approved_at" IS NOT NULL AND "chat_action_batch"."executed_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "chat_conversation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid,
	"title" varchar(160) DEFAULT 'New conversation' NOT NULL,
	"timezone" text NOT NULL,
	"locale" varchar(64) NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"next_message_sequence" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_conversation_status" CHECK ("chat_conversation"."status" IN ('active','archived'))
);
--> statement-breakpoint
CREATE TABLE "chat_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"sequence" bigint NOT NULL,
	"role" text NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_message_role" CHECK ("chat_message"."role" IN ('user','assistant','tool'))
);
--> statement-breakpoint
CREATE TABLE "chat_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"client_request_id" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"provider" text DEFAULT 'openrouter' NOT NULL,
	"model" text DEFAULT 'openai/gpt-6-luna' NOT NULL,
	"timezone" text NOT NULL,
	"locale" varchar(64) NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"provider_request_id" text,
	"error_code" text,
	"lease_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "chat_run_status" CHECK ("chat_run"."status" IN ('queued','running','completed','failed','interrupted'))
);
--> statement-breakpoint
ALTER TABLE "category" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "category" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "finance_account" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "payee" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "reminder" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_tracking" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "tag" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "transaction" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "transaction" ADD COLUMN "destination_amount" numeric(19, 4);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_batch_scope_unique" ON "chat_action_batch" USING btree ("id","conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_run_scope_unique" ON "chat_run" USING btree ("id","conversation_id");--> statement-breakpoint
ALTER TABLE "chat_action" ADD CONSTRAINT "chat_action_batch_id_chat_action_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."chat_action_batch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_action_batch" ADD CONSTRAINT "chat_action_batch_conversation_id_chat_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_action_batch" ADD CONSTRAINT "chat_action_batch_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_action_batch" ADD CONSTRAINT "chat_action_batch_run_id_conversation_id_chat_run_id_conversation_id_fk" FOREIGN KEY ("run_id","conversation_id") REFERENCES "public"."chat_run"("id","conversation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_action_batch" ADD CONSTRAINT "chat_action_batch_supersedes_batch_id_conversation_id_chat_action_batch_id_conversation_id_fk" FOREIGN KEY ("supersedes_batch_id","conversation_id") REFERENCES "public"."chat_action_batch"("id","conversation_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversation" ADD CONSTRAINT "chat_conversation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversation" ADD CONSTRAINT "chat_conversation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_conversation_id_chat_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_run_id_conversation_id_chat_run_id_conversation_id_fk" FOREIGN KEY ("run_id","conversation_id") REFERENCES "public"."chat_run"("id","conversation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_run" ADD CONSTRAINT "chat_run_conversation_id_chat_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_action_position_unique" ON "chat_action" USING btree ("batch_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_action_call_unique" ON "chat_action" USING btree ("batch_id","tool_call_id");--> statement-breakpoint
CREATE INDEX "chat_batch_conversation_idx" ON "chat_action_batch" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "chat_batch_expiry_idx" ON "chat_action_batch" USING btree ("expires_at") WHERE "chat_action_batch"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "chat_personal_idx" ON "chat_conversation" USING btree ("user_id","updated_at","id") WHERE "chat_conversation"."organization_id" IS NULL;--> statement-breakpoint
CREATE INDEX "chat_organization_idx" ON "chat_conversation" USING btree ("user_id","organization_id","updated_at","id") WHERE "chat_conversation"."organization_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_message_sequence_unique" ON "chat_message" USING btree ("conversation_id","sequence");--> statement-breakpoint
CREATE INDEX "chat_message_run_idx" ON "chat_message" USING btree ("run_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_run_request_unique" ON "chat_run" USING btree ("conversation_id","client_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_one_active_run" ON "chat_run" USING btree ("conversation_id") WHERE "chat_run"."status" IN ('queued','running');