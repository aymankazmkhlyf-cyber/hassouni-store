#!/usr/bin/env bash
# Builds php-hosting/dist/hassouni-php-store.zip from the current sources.
# Run from the repository root:  bash php-hosting/build/package.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

npx tsx php-hosting/build/export-data.tsx
node php-hosting/islands/build.mjs
node php-hosting/build/build-css.mjs

for f in $(find php-hosting/site -name "*.php"); do php -l "$f" > /dev/null; done

rm -rf php-hosting/dist && mkdir -p php-hosting/dist
(cd php-hosting/site && zip -qr ../dist/hassouni-php-store.zip . -x "app/config.php" -x "*.DS_Store")
# One SQL file for phpMyAdmin: tables + catalog (no customers, orders or admin password).
{
  echo "-- قاعدة بيانات متجر حسوني (MySQL / MariaDB): الجداول + الأقسام والخدمات والأسعار وطرق الدفع."
  echo "-- الاستيراد: phpMyAdmin ← اختر القاعدة ← Import ← هذا الملف. بعدها شغّل install.php لإنشاء حساب المدير وملف الإعدادات."
  cat php-hosting/site/app/sql/schema.sql php-hosting/site/app/sql/seed.sql
} > php-hosting/dist/hassouni-database.sql
ls -lh php-hosting/dist
