ALTER TABLE "processing_jobs" ALTER COLUMN "stage" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."processing_job_stage";--> statement-breakpoint
CREATE TYPE "public"."processing_job_stage" AS ENUM('audio', 'asr', 'segment', 'translate', 'finalize');--> statement-breakpoint
ALTER TABLE "processing_jobs" ALTER COLUMN "stage" SET DATA TYPE "public"."processing_job_stage" USING "stage"::"public"."processing_job_stage";