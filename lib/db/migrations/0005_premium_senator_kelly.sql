ALTER TABLE "action_log" ADD COLUMN "voids_id" uuid;--> statement-breakpoint
ALTER TABLE "action_log" ADD CONSTRAINT "action_log_voids_id_action_log_id_fk" FOREIGN KEY ("voids_id") REFERENCES "public"."action_log"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "action_log_voids_id_idx" ON "action_log" USING btree ("voids_id");