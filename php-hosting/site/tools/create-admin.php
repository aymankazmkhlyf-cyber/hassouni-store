<?php
/*
 * Creates or resets a staff/admin account from the command line (cPanel → Terminal):
 *   php tools/create-admin.php email@example.com "Name" 'StrongPassword123' [admin|staff]
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') exit("CLI only\n");
require __DIR__ . '/../app/bootstrap.php';
[$_, $email, $name, $password, $role] = $argv + [null, null, null, null, 'admin'];
if (!$email || !is_email(strtolower($email)) || !$name || !$password || strlen($password) < 12 || !in_array($role, ['admin', 'staff'], true)) {
    exit("usage: php tools/create-admin.php email name password(12+ chars) [admin|staff]\n");
}
upsert_staff_account($email, $name, $password, $role);
echo "ok: $email ($role)\n";
