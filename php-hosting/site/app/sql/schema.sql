-- Hassouni store — MySQL 5.7+ / MariaDB 10.3+ schema.
-- Same tables and column names as the original PostgreSQL version, so data can be imported 1:1.
-- All times are stored in UTC (the app sets the session time_zone to +00:00).
-- CHECK constraints are enforced by MySQL 8.0.16+ and MariaDB 10.2+; the PHP code enforces them too.

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) CHARACTER SET ascii NOT NULL,
  email VARCHAR(191) NOT NULL,
  name VARCHAR(191) NOT NULL,
  phone VARCHAR(30) NULL,
  username VARCHAR(40) NULL,
  wallet_balance INT NOT NULL DEFAULT 0,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(16) NOT NULL DEFAULT 'customer',
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  last_login_at DATETIME(3) NULL,
  anonymized_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY users_email_uq (email),
  UNIQUE KEY users_username_uq (username),
  KEY users_role_idx (role),
  CONSTRAINT users_wallet_ck CHECK (wallet_balance >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id CHAR(64) CHARACTER SET ascii NOT NULL,
  user_id CHAR(36) CHARACTER SET ascii NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  user_agent VARCHAR(200) NULL,
  PRIMARY KEY (id),
  KEY sessions_user_idx (user_id),
  KEY sessions_expires_idx (expires_at),
  CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_codes (
  id CHAR(36) CHARACTER SET ascii NOT NULL,
  user_id CHAR(36) CHARACTER SET ascii NOT NULL,
  purpose VARCHAR(20) NOT NULL,
  code_hash CHAR(64) CHARACTER SET ascii NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  expires_at DATETIME(3) NOT NULL,
  used_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY auth_codes_user_idx (user_id, purpose),
  CONSTRAINT auth_codes_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS files (
  id CHAR(36) CHARACTER SET ascii NOT NULL,
  kind VARCHAR(20) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size INT NOT NULL,
  sha256 CHAR(64) CHARACTER SET ascii NOT NULL,
  data LONGBLOB NOT NULL,
  uploaded_by_id CHAR(36) CHARACTER SET ascii NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY files_kind_idx (kind),
  CONSTRAINT files_uploader_fk FOREIGN KEY (uploaded_by_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT files_size_ck CHECK (size > 0 AND size <= 5242880)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
  id INT NOT NULL AUTO_INCREMENT,
  slug VARCHAR(80) NOT NULL,
  name_ar VARCHAR(191) NOT NULL,
  name_en VARCHAR(191) NOT NULL,
  description_ar TEXT NOT NULL,
  description_en TEXT NOT NULL,
  icon VARCHAR(30) NOT NULL DEFAULT 'spark',
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY categories_slug_uq (slug),
  KEY categories_sort_idx (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id INT NOT NULL AUTO_INCREMENT,
  category_id INT NOT NULL,
  slug VARCHAR(80) NOT NULL,
  name_ar VARCHAR(191) NOT NULL,
  name_en VARCHAR(191) NOT NULL,
  summary_ar TEXT NOT NULL,
  summary_en TEXT NOT NULL,
  description_ar MEDIUMTEXT NOT NULL,
  description_en MEDIUMTEXT NOT NULL,
  icon VARCHAR(30) NOT NULL DEFAULT 'spark',
  image_file_id CHAR(36) CHARACTER SET ascii NULL,
  pricing_mode VARCHAR(10) NOT NULL DEFAULT 'unit',
  unit_price INT NULL,
  compare_at_price INT NULL,
  min_quantity INT NOT NULL DEFAULT 1,
  max_quantity INT NULL,
  delivery_time_ar VARCHAR(191) NOT NULL DEFAULT '',
  delivery_time_en VARCHAR(191) NOT NULL DEFAULT '',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_featured TINYINT(1) NOT NULL DEFAULT 0,
  is_sample TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY products_slug_uq (slug),
  KEY products_category_idx (category_id),
  KEY products_active_featured_idx (is_active, is_featured),
  CONSTRAINT products_category_fk FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT,
  CONSTRAINT products_image_fk FOREIGN KEY (image_file_id) REFERENCES files (id) ON DELETE SET NULL,
  CONSTRAINT products_unit_price_ck CHECK (unit_price IS NULL OR unit_price >= 0),
  CONSTRAINT products_qty_ck CHECK (min_quantity >= 1 AND (max_quantity IS NULL OR max_quantity >= min_quantity)),
  CONSTRAINT products_unit_mode_ck CHECK (pricing_mode <> 'unit' OR unit_price IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_packages (
  id INT NOT NULL AUTO_INCREMENT,
  product_id INT NOT NULL,
  label_ar VARCHAR(191) NOT NULL,
  label_en VARCHAR(191) NOT NULL,
  price INT NOT NULL,
  compare_at_price INT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY packages_product_idx (product_id),
  CONSTRAINT packages_product_fk FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
  CONSTRAINT packages_price_ck CHECK (price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS price_tiers (
  id INT NOT NULL AUTO_INCREMENT,
  product_id INT NOT NULL,
  min_quantity INT NOT NULL,
  unit_price INT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY tiers_product_min_uq (product_id, min_quantity),
  CONSTRAINT tiers_product_fk FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
  CONSTRAINT tiers_ck CHECK (min_quantity >= 1 AND unit_price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_fields (
  id INT NOT NULL AUTO_INCREMENT,
  product_id INT NOT NULL,
  `key` VARCHAR(40) NOT NULL,
  label_ar VARCHAR(191) NOT NULL,
  label_en VARCHAR(191) NOT NULL,
  help_ar TEXT NOT NULL,
  help_en TEXT NOT NULL,
  type VARCHAR(16) NOT NULL DEFAULT 'text',
  required TINYINT(1) NOT NULL DEFAULT 1,
  max_length INT NOT NULL DEFAULT 200,
  options LONGTEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY fields_product_key_uq (product_id, `key`),
  CONSTRAINT fields_product_fk FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_methods (
  id INT NOT NULL AUTO_INCREMENT,
  code VARCHAR(40) NOT NULL,
  name_ar VARCHAR(191) NOT NULL,
  name_en VARCHAR(191) NOT NULL,
  instructions_ar TEXT NOT NULL,
  instructions_en TEXT NOT NULL,
  account_details VARCHAR(300) NOT NULL DEFAULT '',
  requires_reference TINYINT(1) NOT NULL DEFAULT 1,
  allows_receipt TINYINT(1) NOT NULL DEFAULT 1,
  is_enabled TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  qr_file_id CHAR(36) CHARACTER SET ascii NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY payment_methods_code_uq (code),
  CONSTRAINT payment_methods_qr_fk FOREIGN KEY (qr_file_id) REFERENCES files (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id CHAR(36) CHARACTER SET ascii NOT NULL,
  reference VARCHAR(40) CHARACTER SET ascii NOT NULL,
  access_key_hash CHAR(64) CHARACTER SET ascii NOT NULL,
  access_key_expires_at DATETIME(3) NOT NULL,
  idempotency_key VARCHAR(64) CHARACTER SET ascii NOT NULL,
  user_id CHAR(36) CHARACTER SET ascii NULL,
  customer_name VARCHAR(191) NOT NULL,
  customer_phone VARCHAR(30) NOT NULL,
  customer_email VARCHAR(191) NULL,
  customer_notes TEXT NOT NULL,
  admin_notes TEXT NOT NULL,
  delivery_note TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending_payment',
  payment_method_id INT NULL,
  payment_method_code VARCHAR(40) NOT NULL,
  payment_method_name_ar VARCHAR(191) NOT NULL,
  payment_method_name_en VARCHAR(191) NOT NULL,
  subtotal INT NOT NULL,
  total INT NOT NULL,
  terms_accepted_at DATETIME(3) NOT NULL,
  locale VARCHAR(5) NOT NULL DEFAULT 'ar',
  paid_at DATETIME(3) NULL,
  completed_at DATETIME(3) NULL,
  anonymized_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY orders_reference_uq (reference),
  UNIQUE KEY orders_idempotency_uq (idempotency_key),
  KEY orders_status_idx (status),
  KEY orders_created_idx (created_at),
  KEY orders_user_idx (user_id),
  KEY orders_phone_idx (customer_phone),
  CONSTRAINT orders_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT orders_method_fk FOREIGN KEY (payment_method_id) REFERENCES payment_methods (id) ON DELETE SET NULL,
  CONSTRAINT orders_total_ck CHECK (total >= 0 AND subtotal >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id INT NOT NULL AUTO_INCREMENT,
  order_id CHAR(36) CHARACTER SET ascii NOT NULL,
  product_id INT NULL,
  package_id INT NULL,
  product_name_ar VARCHAR(191) NOT NULL,
  product_name_en VARCHAR(191) NOT NULL,
  package_label_ar VARCHAR(191) NULL,
  package_label_en VARCHAR(191) NULL,
  unit_price INT NOT NULL,
  quantity INT NOT NULL,
  line_total INT NOT NULL,
  inputs LONGTEXT NOT NULL,
  PRIMARY KEY (id),
  KEY order_items_order_idx (order_id),
  KEY order_items_product_idx (product_id),
  CONSTRAINT order_items_order_fk FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT order_items_product_fk FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL,
  CONSTRAINT order_items_package_fk FOREIGN KEY (package_id) REFERENCES product_packages (id) ON DELETE SET NULL,
  CONSTRAINT order_items_ck CHECK (quantity >= 1 AND unit_price >= 0 AND line_total = unit_price * quantity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id CHAR(36) CHARACTER SET ascii NOT NULL,
  order_id CHAR(36) CHARACTER SET ascii NOT NULL,
  method_code VARCHAR(40) NOT NULL,
  amount INT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'awaiting',
  customer_reference VARCHAR(191) NULL,
  receipt_file_id CHAR(36) CHARACTER SET ascii NULL,
  submitted_at DATETIME(3) NULL,
  reviewed_by_id CHAR(36) CHARACTER SET ascii NULL,
  reviewed_at DATETIME(3) NULL,
  review_note TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY payments_order_idx (order_id),
  KEY payments_status_idx (status),
  CONSTRAINT payments_order_fk FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT payments_receipt_fk FOREIGN KEY (receipt_file_id) REFERENCES files (id) ON DELETE SET NULL,
  CONSTRAINT payments_reviewer_fk FOREIGN KEY (reviewed_by_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_status_history (
  id INT NOT NULL AUTO_INCREMENT,
  order_id CHAR(36) CHARACTER SET ascii NOT NULL,
  from_status VARCHAR(20) NULL,
  to_status VARCHAR(20) NOT NULL,
  actor_type VARCHAR(16) NOT NULL,
  actor_id CHAR(36) CHARACTER SET ascii NULL,
  note TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY status_history_order_idx (order_id, created_at),
  CONSTRAINT status_history_order_fk FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT status_history_actor_fk FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS custom_requests (
  id CHAR(36) CHARACTER SET ascii NOT NULL,
  reference VARCHAR(40) CHARACTER SET ascii NOT NULL,
  user_id CHAR(36) CHARACTER SET ascii NULL,
  name VARCHAR(191) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(191) NULL,
  service_type VARCHAR(30) NOT NULL,
  description TEXT NOT NULL,
  quantity INT NULL,
  budget INT NULL,
  reference_url VARCHAR(500) NULL,
  notes TEXT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'new',
  admin_notes TEXT NOT NULL,
  anonymized_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY custom_requests_reference_uq (reference),
  KEY custom_requests_status_idx (status),
  CONSTRAINT custom_requests_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS store_settings (
  `key` VARCHAR(64) NOT NULL,
  value LONGTEXT NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_id CHAR(36) CHARACTER SET ascii NULL,
  actor_email VARCHAR(191) NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  entity_id VARCHAR(64) NULL,
  details LONGTEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY audit_created_idx (created_at),
  KEY audit_entity_idx (entity_type, entity_id),
  CONSTRAINT audit_actor_fk FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket VARCHAR(40) CHARACTER SET ascii NOT NULL,
  `key` CHAR(64) CHARACTER SET ascii NOT NULL,
  window_start DATETIME(3) NOT NULL,
  `count` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, `key`),
  KEY rate_limits_window_idx (window_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS support_threads (
  id CHAR(36) CHARACTER SET ascii NOT NULL,
  token_hash CHAR(64) CHARACTER SET ascii NOT NULL,
  user_id CHAR(36) CHARACTER SET ascii NULL,
  name VARCHAR(191) NOT NULL,
  phone VARCHAR(30) NULL,
  locale VARCHAR(5) NOT NULL DEFAULT 'ar',
  status VARCHAR(10) NOT NULL DEFAULT 'open',
  unread_for_staff INT NOT NULL DEFAULT 0,
  unread_for_customer INT NOT NULL DEFAULT 0,
  last_message_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_notified_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY support_threads_token_uq (token_hash),
  KEY support_threads_last_idx (last_message_at),
  KEY support_threads_unread_idx (unread_for_staff),
  CONSTRAINT support_threads_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS support_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  thread_id CHAR(36) CHARACTER SET ascii NOT NULL,
  sender VARCHAR(10) NOT NULL,
  staff_id CHAR(36) CHARACTER SET ascii NULL,
  body TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY support_messages_thread_idx (thread_id, id),
  CONSTRAINT support_messages_thread_fk FOREIGN KEY (thread_id) REFERENCES support_threads (id) ON DELETE CASCADE,
  CONSTRAINT support_messages_staff_fk FOREIGN KEY (staff_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT support_messages_len_ck CHECK (CHAR_LENGTH(body) BETWEEN 1 AND 2000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reviews (
  id INT NOT NULL AUTO_INCREMENT,
  order_item_id INT NOT NULL,
  order_id CHAR(36) CHARACTER SET ascii NOT NULL,
  product_id INT NULL,
  rating INT NOT NULL,
  comment TEXT NOT NULL,
  display_name VARCHAR(191) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'published',
  hidden_reason TEXT NULL,
  staff_reply TEXT NULL,
  staff_reply_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY reviews_item_uq (order_item_id),
  KEY reviews_product_idx (product_id, status, created_at),
  KEY reviews_created_idx (created_at),
  CONSTRAINT reviews_item_fk FOREIGN KEY (order_item_id) REFERENCES order_items (id) ON DELETE CASCADE,
  CONSTRAINT reviews_order_fk FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT reviews_product_fk FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL,
  CONSTRAINT reviews_rating_ck CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT reviews_comment_ck CHECK (CHAR_LENGTH(comment) <= 1000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INT NOT NULL AUTO_INCREMENT,
  order_id CHAR(36) CHARACTER SET ascii NOT NULL,
  endpoint VARCHAR(1000) CHARACTER SET ascii NOT NULL,
  endpoint_hash CHAR(64) CHARACTER SET ascii NOT NULL,
  p256dh VARCHAR(200) CHARACTER SET ascii NOT NULL,
  auth VARCHAR(64) CHARACTER SET ascii NOT NULL,
  locale VARCHAR(5) NOT NULL DEFAULT 'ar',
  failures INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY push_subscriptions_order_endpoint_uq (order_id, endpoint_hash),
  KEY push_subscriptions_order_idx (order_id),
  CONSTRAINT push_subscriptions_order_fk FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wallet_topups (
  id CHAR(36) CHARACTER SET ascii NOT NULL,
  user_id CHAR(36) CHARACTER SET ascii NULL,
  amount INT NOT NULL,
  method_code VARCHAR(40) NOT NULL,
  method_name_ar VARCHAR(191) NOT NULL,
  method_name_en VARCHAR(191) NOT NULL,
  customer_reference VARCHAR(191) NULL,
  receipt_file_id CHAR(36) CHARACTER SET ascii NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'submitted',
  reviewed_by_id CHAR(36) CHARACTER SET ascii NULL,
  reviewed_at DATETIME(3) NULL,
  review_note TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY wallet_topups_user_idx (user_id),
  KEY wallet_topups_status_idx (status),
  CONSTRAINT wallet_topups_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT wallet_topups_receipt_fk FOREIGN KEY (receipt_file_id) REFERENCES files (id) ON DELETE SET NULL,
  CONSTRAINT wallet_topups_reviewer_fk FOREIGN KEY (reviewed_by_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT wallet_topups_amount_ck CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id CHAR(36) CHARACTER SET ascii NULL,
  type VARCHAR(20) NOT NULL,
  amount INT NOT NULL,
  balance_after INT NOT NULL,
  order_id CHAR(36) CHARACTER SET ascii NULL,
  topup_id CHAR(36) CHARACTER SET ascii NULL,
  staff_id CHAR(36) CHARACTER SET ascii NULL,
  note TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY wallet_tx_user_idx (user_id, id),
  UNIQUE KEY wallet_tx_order_type_uq (order_id, type),
  CONSTRAINT wallet_tx_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT wallet_tx_order_fk FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE SET NULL,
  CONSTRAINT wallet_tx_topup_fk FOREIGN KEY (topup_id) REFERENCES wallet_topups (id) ON DELETE SET NULL,
  CONSTRAINT wallet_tx_staff_fk FOREIGN KEY (staff_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT wallet_tx_ck CHECK (amount <> 0 AND balance_after >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
