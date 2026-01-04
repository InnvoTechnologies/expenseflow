ALTER TABLE "organization_members" RENAME TO "members";--> statement-breakpoint
ALTER TABLE "members" DROP CONSTRAINT "organization_members_organization_id_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "members" DROP CONSTRAINT "organization_members_invited_by_user_id_fk";
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "role" text NOT NULL;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;