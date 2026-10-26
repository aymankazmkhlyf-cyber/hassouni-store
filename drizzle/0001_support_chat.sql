CREATE TYPE "public"."support_sender" AS ENUM('customer', 'staff', 'bot');--> statement-breakpoint
CREATE TYPE "public"."support_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TABLE "support_messages" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"thread_id" uuid NOT NULL,
	"sender" "support_sender" NOT NULL,
	"staff_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_messages_len_ck" CHECK (char_length("support_messages"."body") BETWEEN 1 AND 2000)
);
--> statement-breakpoint
CREATE TABLE "support_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"phone" text,
	"locale" text DEFAULT 'ar' NOT NULL,
	"status" "support_status" DEFAULT 'open' NOT NULL,
	"unread_for_staff" integer DEFAULT 0 NOT NULL,
	"unread_for_customer" integer DEFAULT 0 NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_thread_id_support_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."support_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_staff_id_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_threads" ADD CONSTRAINT "support_threads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "support_messages_thread_idx" ON "support_messages" USING btree ("thread_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "support_threads_token_uq" ON "support_threads" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "support_threads_last_idx" ON "support_threads" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "support_threads_unread_idx" ON "support_threads" USING btree ("unread_for_staff");