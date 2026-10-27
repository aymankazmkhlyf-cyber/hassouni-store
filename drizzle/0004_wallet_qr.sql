CREATE TYPE "public"."topup_status" AS ENUM('submitted', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."wallet_tx_type" AS ENUM('topup', 'admin_credit', 'admin_debit', 'order_payment', 'order_refund');--> statement-breakpoint
ALTER TYPE "public"."file_kind" ADD VALUE 'payment_qr';--> statement-breakpoint
CREATE TABLE "wallet_topups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"amount" integer NOT NULL,
	"method_code" text NOT NULL,
	"method_name_ar" text NOT NULL,
	"method_name_en" text NOT NULL,
	"customer_reference" text,
	"receipt_file_id" uuid,
	"status" "topup_status" DEFAULT 'submitted' NOT NULL,
	"reviewed_by_id" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_topups_amount_ck" CHECK ("wallet_topups"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"type" "wallet_tx_type" NOT NULL,
	"amount" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"order_id" uuid,
	"topup_id" uuid,
	"staff_id" uuid,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_tx_ck" CHECK ("wallet_transactions"."amount" <> 0 AND "wallet_transactions"."balance_after" >= 0)
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_note" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD COLUMN "qr_file_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "wallet_balance" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "wallet_topups" ADD CONSTRAINT "wallet_topups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_topups" ADD CONSTRAINT "wallet_topups_receipt_file_id_files_id_fk" FOREIGN KEY ("receipt_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_topups" ADD CONSTRAINT "wallet_topups_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_topup_id_wallet_topups_id_fk" FOREIGN KEY ("topup_id") REFERENCES "public"."wallet_topups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_staff_id_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wallet_topups_user_idx" ON "wallet_topups" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wallet_topups_status_idx" ON "wallet_topups" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wallet_tx_user_idx" ON "wallet_transactions" USING btree ("user_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_tx_order_type_uq" ON "wallet_transactions" USING btree ("order_id","type");--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_qr_file_id_files_id_fk" FOREIGN KEY ("qr_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_uq" ON "users" USING btree ("username");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_wallet_ck" CHECK ("users"."wallet_balance" >= 0);