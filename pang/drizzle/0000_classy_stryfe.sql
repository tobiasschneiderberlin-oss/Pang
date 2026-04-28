CREATE TYPE "public"."artwork_visibility_e" AS ENUM('private', 'shared', 'public');--> statement-breakpoint
CREATE TYPE "public"."document_type_e" AS ENUM('certificate', 'invoice', 'condition_report', 'appraisal', 'insurance', 'other');--> statement-breakpoint
CREATE TYPE "public"."membership_status_e" AS ENUM('invited', 'active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."sensitivity_tier_e" AS ENUM('standard', 'locked');--> statement-breakpoint
CREATE TYPE "public"."verification_status_e" AS ENUM('pending', 'confirmed', 'declined', 'expired');--> statement-breakpoint
CREATE TABLE "artist_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gallery_id" uuid NOT NULL,
	"name" text NOT NULL,
	"bio" text,
	"nationality" text,
	"birth_year" integer,
	"image_url" text,
	"website" text,
	"instagram" text,
	"media" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artworks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gallery_id" uuid NOT NULL,
	"collector_id" uuid NOT NULL,
	"artist_id" uuid,
	"artist_name" text NOT NULL,
	"title" text NOT NULL,
	"year" integer,
	"medium" text,
	"dimensions" text,
	"image_url" text,
	"description" text,
	"movement" text,
	"visibility" "artwork_visibility_e" DEFAULT 'private' NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"extraction_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collector_gallery_membership" (
	"collector_id" uuid NOT NULL,
	"gallery_id" uuid NOT NULL,
	"status" "membership_status_e" DEFAULT 'invited' NOT NULL,
	"hidden_from_gallery" boolean DEFAULT false NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"bound_at" timestamp with time zone,
	CONSTRAINT "collector_gallery_membership_collector_id_gallery_id_pk" PRIMARY KEY("collector_id","gallery_id")
);
--> statement-breakpoint
CREATE TABLE "collectors" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"location" text,
	"collecting_since" integer,
	"discoverable_in_circles" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gallery_id" uuid NOT NULL,
	"collector_id" uuid NOT NULL,
	"artwork_id" uuid NOT NULL,
	"type" "document_type_e" NOT NULL,
	"title" text NOT NULL,
	"storage_path" text NOT NULL,
	"mime_type" text,
	"size_bytes" integer,
	"sensitivity_tier" "sensitivity_tier_e" DEFAULT 'standard' NOT NULL,
	"locked_meta" jsonb,
	"tax_relevant" boolean DEFAULT false NOT NULL,
	"aml_relevant" boolean DEFAULT false NOT NULL,
	"verification_pending" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_locked_excludes_retrievable" CHECK ("documents"."sensitivity_tier" <> 'locked' OR (NOT "documents"."tax_relevant" AND NOT "documents"."aml_relevant" AND NOT "documents"."verification_pending"))
);
--> statement-breakpoint
CREATE TABLE "galleries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"country_code" text NOT NULL,
	"data_region" text DEFAULT 'eu-west-1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provenance_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artwork_id" uuid NOT NULL,
	"event_date" timestamp,
	"event" text NOT NULL,
	"location" text,
	"photos" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gallery_id" uuid NOT NULL,
	"artwork_id" uuid NOT NULL,
	"collector_id" uuid NOT NULL,
	"status" "verification_status_e" DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dispatched_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"reviewer_id" uuid,
	"reviewer_note" text
);
--> statement-breakpoint
ALTER TABLE "artist_profiles" ADD CONSTRAINT "artist_profiles_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."galleries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artworks" ADD CONSTRAINT "artworks_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."galleries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artworks" ADD CONSTRAINT "artworks_collector_id_collectors_id_fk" FOREIGN KEY ("collector_id") REFERENCES "public"."collectors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artworks" ADD CONSTRAINT "artworks_artist_id_artist_profiles_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artist_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collector_gallery_membership" ADD CONSTRAINT "collector_gallery_membership_collector_id_collectors_id_fk" FOREIGN KEY ("collector_id") REFERENCES "public"."collectors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collector_gallery_membership" ADD CONSTRAINT "collector_gallery_membership_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."galleries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."galleries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_collector_id_collectors_id_fk" FOREIGN KEY ("collector_id") REFERENCES "public"."collectors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_artwork_id_artworks_id_fk" FOREIGN KEY ("artwork_id") REFERENCES "public"."artworks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provenance_entries" ADD CONSTRAINT "provenance_entries_artwork_id_artworks_id_fk" FOREIGN KEY ("artwork_id") REFERENCES "public"."artworks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_gallery_id_galleries_id_fk" FOREIGN KEY ("gallery_id") REFERENCES "public"."galleries"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_artwork_id_artworks_id_fk" FOREIGN KEY ("artwork_id") REFERENCES "public"."artworks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_collector_id_collectors_id_fk" FOREIGN KEY ("collector_id") REFERENCES "public"."collectors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "collectors_email_uq" ON "collectors" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "galleries_slug_uq" ON "galleries" USING btree ("slug");