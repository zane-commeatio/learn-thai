CREATE TYPE "public"."clip_rights_status" AS ENUM('unknown', 'cleared', 'restricted', 'takedown');--> statement-breakpoint
CREATE TYPE "public"."clip_source_type" AS ENUM('original', 'licensed', 'public_domain', 'user_submitted');--> statement-breakpoint
CREATE TYPE "public"."processing_job_stage" AS ENUM('audio', 'asr', 'segment', 'tokenize', 'gloss', 'finalize');--> statement-breakpoint
CREATE TYPE "public"."processing_job_state" AS ENUM('uploaded', 'processing', 'needs_review', 'failed', 'manual_intervention');--> statement-breakpoint
CREATE TYPE "public"."audit_log_action" AS ENUM('upload', 'edit', 'publish', 'rollback', 'delete', 'retry', 'legal_delist', 'legal_reinstate', 'legal_hold', 'legal_remove');--> statement-breakpoint
CREATE TYPE "public"."audit_log_target_type" AS ENUM('clip', 'clip_version', 'segment', 'token', 'group', 'meaning', 'gloss', 'job');--> statement-breakpoint
CREATE TABLE "clips" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"source_type" "clip_source_type" NOT NULL,
	"rights_status" "clip_rights_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processing_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"clip_id" text NOT NULL,
	"state" "processing_job_state" NOT NULL,
	"stage" "processing_job_stage" NOT NULL,
	"error_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text,
	"action" "audit_log_action" NOT NULL,
	"target_type" "audit_log_target_type" NOT NULL,
	"target_id" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_clip_id_clips_id_fk" FOREIGN KEY ("clip_id") REFERENCES "public"."clips"("id") ON DELETE cascade ON UPDATE no action;