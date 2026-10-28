<?php
/*
 * One-time web installer: checks the server, creates the MySQL tables, loads
 * the catalog (or imports everything from the old PostgreSQL/Neon database),
 * creates the admin account and writes app/config.php. It refuses to run again
 * once the site is installed — delete this file afterwards.
 */

declare(strict_types=1);

require __DIR__ . '/app/bootstrap.php';
require __DIR__ . '/app/lib/importer.php';

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');
header('X-Frame-Options: DENY');
$GLOBALS['LOCALE'] = 'ar';

function requirements(): array
{
    $ext = fn(string $e) => extension_loaded($e);
    return [
        ['PHP 8.1 أو أحدث', PHP_VERSION_ID >= 80100, true, PHP_VERSION],
        ['PDO MySQL', $ext('pdo_mysql'), true, ''],
        ['OpenSSL', $ext('openssl'), true, ''],
        ['mbstring', $ext('mbstring'), true, ''],
        ['cURL (تلكرام، الإيميل، الإشعارات)', $ext('curl'), false, ''],
        ['Argon2 أو Sodium (كلمات المرور)', defined('PASSWORD_ARGON2ID') || function_exists('sodium_crypto_pwhash_str_verify'), true, ''],
        ['PDO PostgreSQL (فقط لنقل البيانات من الموقع القديم)', $ext('pdo_pgsql'), false, ''],
        ['مجلد app قابل للكتابة', is_writable(APP_DIR), true, ''],
    ];
}

function run_sql_file(PDO $pdo, string $file): void
{
    $sql = preg_replace('/^--.*$/m', '', (string) file_get_contents($file));
    foreach (preg_split('/;\s*\n/', $sql) as $stmt) {
        if (trim($stmt) !== '') $pdo->exec($stmt);
    }
}

function write_config(array $c): bool
{
    $php = "<?php\n// Written by install.php on " . gmdate('Y-m-d H:i') . " UTC. Keep this file private.\nreturn " . var_export($c, true) . ";\n";
    return file_put_contents(APP_DIR . '/config.php', $php, LOCK_EX) !== false;
}

$installed = is_installed();
$errors = [];
$done = null;
$v = fn(string $k, string $d = '') => e((string) ($_POST[$k] ?? $d));
$guessUrl = (is_https() ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? '');

if (!$installed && method() === 'POST') {
    $in = fn(string $k) => trim((string) ($_POST[$k] ?? ''));
    $cfg = [
        'db_host' => $in('db_host') ?: 'localhost',
        'db_port' => (int) ($in('db_port') ?: 3306),
        'db_name' => $in('db_name'),
        'db_user' => $in('db_user'),
        'db_pass' => (string) ($_POST['db_pass'] ?? ''),
        'app_secret' => bin2hex(random_bytes(32)),
        'app_url' => rtrim($in('app_url'), '/'),
        'trust_proxy' => !empty($_POST['trust_proxy']),
        'telegram_bot_token' => $in('telegram_bot_token'),
        'resend_api_key' => $in('resend_api_key'),
        'email_from' => '',
    ];
    $adminEmail = strtolower($in('admin_email'));
    $adminName = $in('admin_name') ?: 'Admin';
    $adminPass = (string) ($_POST['admin_password'] ?? '');
    $source = ($_POST['source'] ?? 'fresh') === 'import' ? 'import' : 'fresh';
    $pgUrl = trim((string) ($_POST['pg_url'] ?? ''));

    foreach (requirements() as [$label, $ok, $required]) if ($required && !$ok) $errors[] = "المتطلب غير متوفر: $label";
    if ($cfg['db_name'] === '' || $cfg['db_user'] === '') $errors[] = 'اكتب اسم قاعدة البيانات واسم المستخدم.';
    if (!is_email($adminEmail)) $errors[] = 'بريد المدير غير صحيح.';
    if (mb_strlen($adminPass) < 12) $errors[] = 'كلمة مرور المدير لازم تكون 12 حرف أو أكثر.';
    if ($cfg['app_url'] !== '' && !is_safe_http_url($cfg['app_url'])) $errors[] = 'رابط الموقع غير صحيح.';
    if ($source === 'import' && $pgUrl === '') $errors[] = 'الصق رابط قاعدة البيانات القديمة (Neon) أو اختر "متجر جديد".';

    if (!$errors) {
        $GLOBALS['CONFIG'] = $cfg;
        try {
            $pdo = db();
            $pdo->query('SELECT 1');
        } catch (Throwable $e) {
            $errors[] = 'ما كدرت أتصل بقاعدة البيانات: ' . $e->getMessage();
        }
    }
    if (!$errors) {
        try {
            $hasUsers = (int) $pdo->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users'")->fetchColumn() > 0;
            if ($hasUsers && (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn() > 0) {
                throw new RuntimeException('قاعدة البيانات بيها بيانات من قبل. استخدم قاعدة بيانات فارغة.');
            }
            run_sql_file($pdo, APP_DIR . '/sql/schema.sql');
            $counts = [];
            if ($source === 'import') {
                if (!extension_loaded('pdo_pgsql')) throw new RuntimeException('الاستضافة ما بيها PDO PostgreSQL، فما أكدر أنقل من القاعدة القديمة. اختر "متجر جديد" أو فعّل الإضافة من cPanel → Select PHP Version.');
                $counts = import_from_pg(pg_connect_url($pgUrl), $pdo);
            } else {
                run_sql_file($pdo, APP_DIR . '/sql/seed.sql');
            }
            upsert_staff_account($adminEmail, $adminName, $adminPass, 'admin');
            if (!write_config($cfg)) throw new RuntimeException('ما كدرت أكتب app/config.php. خلي مجلد app قابل للكتابة (755) وجرب مرة ثانية.');
            $done = ['counts' => $counts, 'source' => $source];
            $installed = true;
        } catch (Throwable $e) {
            $errors[] = $e->getMessage();
        }
    }
}
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>تثبيت متجر حسوني</title>
<link rel="stylesheet" href="<?= e(asset('app.css')) ?>">
</head>
<body class="antialiased">
<main class="mx-auto max-w-2xl space-y-6 px-4 py-10">
  <div class="flex items-center gap-3"><?= logo_html('ar', 'متجر حسوني') ?><h1 class="text-xl font-extrabold">تثبيت الموقع</h1></div>

<?php if ($done): ?>
  <?= alert('success', 'تم التثبيت بنجاح 🎉', e('انحفظت الإعدادات وانعملت الجداول' . ($done['source'] === 'import' ? ' وانتقلت بياناتك من الموقع القديم.' : ' وانضافت كل الخدمات والأسعار.'))) ?>
  <?php if ($done['counts']): ?>
    <div class="rounded-xl border border-line bg-elevated p-4 text-sm"><p class="mb-2 font-bold">البيانات المنقولة:</p><ul class="grid grid-cols-2 gap-1">
      <?php foreach ($done['counts'] as $table => $n): ?><li><span class="ltr-nums" dir="ltr"><?= e($table) ?></span>: <b><?= (int) $n ?></b></li><?php endforeach; ?>
    </ul></div>
  <?php endif; ?>
  <?= alert('warning', 'مهم: احذف ملف install.php الآن', e('من مدير الملفات في cPanel احذف الملف install.php من مجلد public_html حتى ما يكدر أحد يستخدمه.')) ?>
  <p class="flex flex-wrap gap-2"><a class="<?= button_class() ?>" href="<?= e(url('/ar')) ?>">افتح المتجر</a><a class="<?= button_class('outline') ?>" href="<?= e(url('/ar/admin/login')) ?>">لوحة التحكم</a></p>

<?php elseif ($installed): ?>
  <?= alert('info', 'الموقع مثبت مسبقاً', e('لأمانك ما يشتغل المثبّت مرة ثانية. احذف ملف install.php من الاستضافة.')) ?>
  <p><a class="<?= button_class() ?>" href="<?= e(url('/ar')) ?>">افتح المتجر</a></p>

<?php else: ?>
  <?php if ($errors): ?><?= alert('danger', 'ما تم التثبيت', '<ul class="list-disc ps-4">' . implode('', array_map(fn($m) => '<li>' . e($m) . '</li>', $errors)) . '</ul>') ?><?php endif; ?>

  <section class="rounded-(--radius-card) border border-line bg-elevated p-5 shadow-soft">
    <h2 class="mb-3 font-bold">1) فحص الاستضافة</h2>
    <ul class="space-y-1.5 text-sm">
      <?php foreach (requirements() as [$label, $ok, $required, $info]): ?>
        <li class="flex items-center gap-2"><?= icon($ok ? 'check' : 'alert', 'size-4 ' . ($ok ? 'text-success' : ($required ? 'text-danger' : 'text-warning'))) ?><span><?= e($label) ?></span><?php if ($info): ?><span class="ltr-nums text-fg-subtle" dir="ltr"><?= e($info) ?></span><?php endif; ?><?php if (!$ok && !$required): ?><span class="text-xs text-fg-subtle">(اختياري)</span><?php endif; ?></li>
      <?php endforeach; ?>
    </ul>
  </section>

  <form method="post" class="space-y-6" autocomplete="off">
    <section class="space-y-4 rounded-(--radius-card) border border-line bg-elevated p-5 shadow-soft">
      <h2 class="font-bold">2) قاعدة البيانات MySQL</h2>
      <p class="text-sm text-fg-muted">من cPanel ← MySQL Databases: سوّي قاعدة بيانات ومستخدم، وأعطِ المستخدم كل الصلاحيات (ALL PRIVILEGES) على القاعدة.</p>
      <div class="grid gap-4 sm:grid-cols-2">
        <?= field('db_name', 'اسم قاعدة البيانات', input_tag(['id' => 'db_name', 'name' => 'db_name', 'value' => $_POST['db_name'] ?? '', 'required' => true, 'dir' => 'ltr']), ['required' => true]) ?>
        <?= field('db_user', 'اسم المستخدم', input_tag(['id' => 'db_user', 'name' => 'db_user', 'value' => $_POST['db_user'] ?? '', 'required' => true, 'dir' => 'ltr']), ['required' => true]) ?>
        <?= field('db_pass', 'كلمة مرور قاعدة البيانات', input_tag(['id' => 'db_pass', 'name' => 'db_pass', 'type' => 'password', 'dir' => 'ltr'])) ?>
        <div class="grid grid-cols-[1fr_6rem] gap-2">
          <?= field('db_host', 'الخادم', input_tag(['id' => 'db_host', 'name' => 'db_host', 'value' => $_POST['db_host'] ?? 'localhost', 'dir' => 'ltr'])) ?>
          <?= field('db_port', 'المنفذ', input_tag(['id' => 'db_port', 'name' => 'db_port', 'value' => $_POST['db_port'] ?? '3306', 'dir' => 'ltr'])) ?>
        </div>
      </div>
    </section>

    <section class="space-y-4 rounded-(--radius-card) border border-line bg-elevated p-5 shadow-soft">
      <h2 class="font-bold">3) البيانات</h2>
      <label class="flex cursor-pointer items-start gap-3 rounded-xl border border-line-strong p-3.5 has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
        <input type="radio" name="source" value="fresh" class="mt-1 size-4 accent-(--brand)" <?= ($_POST['source'] ?? 'fresh') === 'fresh' ? 'checked' : '' ?>>
        <span><span class="block font-semibold">متجر جديد</span><span class="text-sm text-fg-muted">كل الأقسام والخدمات والأسعار وطرق الدفع (مع باركود سوبر كي) جاهزة، بدون طلبات أو زبائن.</span></span>
      </label>
      <label class="flex cursor-pointer items-start gap-3 rounded-xl border border-line-strong p-3.5 has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
        <input type="radio" name="source" value="import" class="mt-1 size-4 accent-(--brand)" <?= ($_POST['source'] ?? '') === 'import' ? 'checked' : '' ?>>
        <span><span class="block font-semibold">نقل بياناتي من الموقع القديم (Neon)</span><span class="text-sm text-fg-muted">ينقل الزبائن، الطلبات، المحافظ والأرصدة، التقييمات، المحادثات، الصور والإعدادات كما هي.</span></span>
      </label>
      <?= field('pg_url', 'رابط قاعدة البيانات القديمة (DATABASE_URL من Netlify)', input_tag(['id' => 'pg_url', 'name' => 'pg_url', 'type' => 'password', 'dir' => 'ltr', 'placeholder' => 'postgresql://…neon.tech/neondb?sslmode=require']), ['hint' => 'يُستخدم مرة وحدة للنقل فقط، وما ينحفظ بأي مكان. لا تشاركه مع أحد.']) ?>
    </section>

    <section class="space-y-4 rounded-(--radius-card) border border-line bg-elevated p-5 shadow-soft">
      <h2 class="font-bold">4) حساب المدير والموقع</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <?= field('admin_name', 'اسم المدير', input_tag(['id' => 'admin_name', 'name' => 'admin_name', 'value' => $_POST['admin_name'] ?? '', 'required' => true])) ?>
        <?= field('admin_email', 'بريد المدير', input_tag(['id' => 'admin_email', 'name' => 'admin_email', 'type' => 'email', 'value' => $_POST['admin_email'] ?? '', 'required' => true, 'dir' => 'ltr']), ['required' => true]) ?>
        <?= field('admin_password', 'كلمة مرور المدير', input_tag(['id' => 'admin_password', 'name' => 'admin_password', 'type' => 'password', 'minlength' => '12', 'required' => true, 'dir' => 'ltr']), ['required' => true, 'hint' => '12 حرف أو أكثر. إذا نقلت بياناتك وبريدك موجود، تصير هاي كلمة المرور الجديدة.']) ?>
        <?= field('app_url', 'رابط الموقع', input_tag(['id' => 'app_url', 'name' => 'app_url', 'value' => $_POST['app_url'] ?? $guessUrl, 'dir' => 'ltr'])) ?>
        <?= field('telegram_bot_token', 'توكن بوت تلكرام (اختياري)', input_tag(['id' => 'telegram_bot_token', 'name' => 'telegram_bot_token', 'type' => 'password', 'dir' => 'ltr'])) ?>
        <?= field('resend_api_key', 'مفتاح Resend للإيميل (اختياري)', input_tag(['id' => 'resend_api_key', 'name' => 'resend_api_key', 'type' => 'password', 'dir' => 'ltr'])) ?>
      </div>
      <?= checkbox_tag(['name' => 'trust_proxy', 'value' => '1', 'checked' => !empty($_POST['trust_proxy'])], 'الموقع خلف Cloudflare') ?>
    </section>

    <button type="submit" class="<?= button_class('primary', 'lg', 'w-full') ?>">ثبّت الموقع</button>
  </form>
<?php endif; ?>
</main>
</body>
</html>
