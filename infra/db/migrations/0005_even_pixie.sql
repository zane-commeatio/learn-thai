CREATE TYPE "public"."clip_review_status" AS ENUM('generated', 'edited', 'approved', 'rejected', 'needs_fixes');--> statement-breakpoint
CREATE TYPE "public"."learner_event_name" AS ENUM('feed_loaded', 'clip_impression', 'clip_play_started', 'clip_play_completed', 'clip_replay', 'transcript_revealed', 'transcript_hidden', 'slow_hold_started', 'slow_hold_ended', 'clip_load_failed');--> statement-breakpoint
CREATE TABLE "clip_editor_states" (
	"clip_id" text PRIMARY KEY NOT NULL,
	"source_job_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"review_status" "clip_review_status" NOT NULL,
	"has_manual_changes" boolean DEFAULT false NOT NULL,
	"last_reseeded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learner_events" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"name" "learner_event_name" NOT NULL,
	"clip_id" text,
	"clip_version" integer,
	"feed_position" integer,
	"playback_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clip_editor_states" ADD CONSTRAINT "clip_editor_states_clip_id_clips_id_fk" FOREIGN KEY ("clip_id") REFERENCES "public"."clips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clip_editor_states" ADD CONSTRAINT "clip_editor_states_source_job_id_processing_jobs_id_fk" FOREIGN KEY ("source_job_id") REFERENCES "public"."processing_jobs"("id") ON DELETE cascade ON UPDATE no action;