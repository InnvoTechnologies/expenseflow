ALTER TABLE "members" ADD CONSTRAINT "members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "category_user_idx" ON "category" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "category_org_idx" ON "category" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "finance_account_user_idx" ON "finance_account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "finance_account_org_idx" ON "finance_account" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "members_user_org_unique" ON "members" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE INDEX "members_lookup_idx" ON "members" USING btree ("user_id","organization_id","status");--> statement-breakpoint
CREATE INDEX "payee_user_idx" ON "payee" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payee_org_idx" ON "payee" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "reminder_user_idx" ON "reminder" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reminder_org_idx" ON "reminder" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "subscription_tracking_user_idx" ON "subscription_tracking" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscription_tracking_org_idx" ON "subscription_tracking" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tag_user_idx" ON "tag" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tag_org_idx" ON "tag" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "transaction_account_date_idx" ON "transaction" USING btree ("account_id","date","id");--> statement-breakpoint
CREATE INDEX "transaction_destination_date_idx" ON "transaction" USING btree ("to_account_id","date","id");--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_ownership" CHECK (("category"."user_id" IS NULL) <> ("category"."organization_id" IS NULL));--> statement-breakpoint
ALTER TABLE "finance_account" ADD CONSTRAINT "finance_account_ownership" CHECK (("finance_account"."user_id" IS NULL) <> ("finance_account"."organization_id" IS NULL));--> statement-breakpoint
ALTER TABLE "payee" ADD CONSTRAINT "payee_ownership" CHECK (("payee"."user_id" IS NULL) <> ("payee"."organization_id" IS NULL));--> statement-breakpoint
ALTER TABLE "reminder" ADD CONSTRAINT "reminder_ownership" CHECK (("reminder"."user_id" IS NULL) <> ("reminder"."organization_id" IS NULL));--> statement-breakpoint
ALTER TABLE "subscription_tracking" ADD CONSTRAINT "subscription_tracking_ownership" CHECK (("subscription_tracking"."user_id" IS NULL) <> ("subscription_tracking"."organization_id" IS NULL));--> statement-breakpoint
ALTER TABLE "tag" ADD CONSTRAINT "tag_ownership" CHECK (("tag"."user_id" IS NULL) <> ("tag"."organization_id" IS NULL));--> statement-breakpoint
-- Increment versions even when legacy web routes update a record. This keeps
-- copilot previews from overwriting edits made through any other application.
CREATE FUNCTION expenseflow_increment_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['user','organization','finance_account','transaction','category','tag','payee','subscription_tracking','reminder'] LOOP
    EXECUTE format('CREATE TRIGGER copilot_version BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION expenseflow_increment_version()', t);
  END LOOP;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION expenseflow_immutable_chat_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'Conversation scope is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER immutable_chat_scope BEFORE UPDATE ON chat_conversation FOR EACH ROW EXECUTE FUNCTION expenseflow_immutable_chat_scope();
