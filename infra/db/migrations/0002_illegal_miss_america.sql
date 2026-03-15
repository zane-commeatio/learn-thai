ALTER TABLE "processing_jobs" ADD COLUMN "lock_token" text;--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD COLUMN "lock_expires_at" timestamp with time zone;