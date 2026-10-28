<?php
/*
 * Builds site/app/sql/seed.sql (fresh-install catalog) from a PostgreSQL
 * database prepared with the original migrate + seed + content-updates scripts.
 *   php tools/make-seed.php postgresql://user:pass@localhost/db mysql-dsn mysql-user mysql-pass
 * The MySQL connection is only used to read the target column lists.
 */

declare(strict_types=1);
require __DIR__ . '/../site/app/lib/importer.php';

[$_, $pgUrl, $myDsn, $myUser, $myPass] = $argv + [null, null, null, null, null];
$pg = pg_connect_url($pgUrl);
$my = new PDO($myDsn, $myUser, $myPass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

$targets = [];
foreach (SEED_TABLES as $t) $targets[$t] = mysql_columns($my, $t);

// Only files the catalog actually references (the payment QR, product images, logo).
$sql = "-- Fresh-install catalog generated from the original store (categories, services, prices, payment methods, settings).\n"
    . "SET NAMES utf8mb4;\nSET time_zone = '+00:00';\nSET FOREIGN_KEY_CHECKS = 0;\n"
    . sql_inserts($pg, SEED_TABLES, $targets)
    . "SET FOREIGN_KEY_CHECKS = 1;\n";
file_put_contents(__DIR__ . '/../site/app/sql/seed.sql', $sql);
echo 'seed.sql: ' . substr_count($sql, "\nINSERT") . " rows\n";
