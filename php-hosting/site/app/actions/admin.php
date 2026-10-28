<?php
/* Admin actions: every one goes through guarded() (server-side permission check + uniform errors). */

declare(strict_types=1);

function guarded(string $permission, callable $fn): array
{
    try {
        $user = assert_permission($permission);
        return $fn(actor_of($user));
    } catch (ActionRedirect $r) {
        throw $r;
    } catch (AuthError $e) {
        return ['error' => $e->codeKey];
    } catch (ServiceError $e) {
        return ['error' => $e->codeKey];
    } catch (Throwable $e) {
        log_error('admin action failed: ' . $e->getMessage());
        return ['error' => 'generic'];
    }
}

/* -------------------------------- Orders ------------------------------- */

function action_admin_review_payment(): array
{
    return guarded('payments:review', function ($actor) {
        $paymentId = form_str('paymentId');
        $decision = form_str('decision');
        $note = trim_js(form_str('note'));
        if (!is_uuid($paymentId) || !in_array($decision, ['confirm', 'reject'], true) || js_len($note) > 500) return ['error' => 'validation'];
        $r = review_payment(strtolower($paymentId), $decision, $note, $actor);
        $base = site_url();
        after_response(fn() => notify_customer($r['orderId'], $decision === 'confirm' ? 'paid' : 'paymentRejected', $base));
        return ['ok' => true];
    });
}

function action_admin_change_order_status(): array
{
    return guarded('orders:update', function ($actor) {
        $orderId = form_str('orderId');
        $to = form_str('toStatus');
        $note = trim_js(form_str('note'));
        if (!is_uuid($orderId) || !in_array($to, ORDER_STATUSES, true) || js_len($note) > 500) return ['error' => 'validation'];
        transition_order(strtolower($orderId), $to, ['type' => 'staff', 'user' => $actor], $note !== '' ? $note : null);
        if ($event = event_for_status($to)) {
            $base = site_url();
            after_response(fn() => notify_customer(strtolower($orderId), $event, $base));
        }
        return ['ok' => true];
    });
}

function action_admin_save_admin_notes(): array
{
    return guarded('orders:update', function ($actor) {
        $orderId = form_str('orderId');
        $notes = trim_js(form_str('adminNotes'));
        if (!is_uuid($orderId) || js_len($notes) > 5000) return ['error' => 'validation'];
        update_admin_notes(strtolower($orderId), $notes, $actor);
        return ['ok' => true, 'message' => 'saved'];
    });
}

function action_admin_save_delivery_note(): array
{
    return guarded('orders:update', function ($actor) {
        $orderId = form_str('orderId');
        $note = trim_js(form_str('deliveryNote'));
        if (!is_uuid($orderId) || js_len($note) > 3000) return ['error' => 'validation'];
        update_delivery_note(strtolower($orderId), $note, $actor);
        return ['ok' => true, 'message' => 'saved'];
    });
}

/* -------------------------------- Wallet ------------------------------- */

function action_admin_review_topup(): array
{
    return guarded('payments:review', function ($actor) {
        $id = form_str('topupId');
        $decision = form_str('decision');
        $note = trim_js(form_str('note'));
        if (!is_uuid($id) || !in_array($decision, ['approve', 'reject'], true) || js_len($note) > 300) return ['error' => 'validation'];
        review_topup(strtolower($id), $decision, $note, $actor);
        return ['ok' => true, 'message' => 'saved'];
    });
}

function action_admin_adjust_wallet(): array
{
    return guarded('wallet:adjust', function ($actor) {
        $userId = form_str('userId');
        $direction = form_str('direction');
        $amount = coerce_int($_POST['amount'] ?? null);
        $note = trim_js(form_str('note'));
        if (!is_uuid($userId) || !in_array($direction, ['credit', 'debit'], true) || $amount === null || $amount < 250 || $amount > 10_000_000 || js_len($note) > 300) return ['error' => 'validation'];
        $balance = admin_adjust_wallet(strtolower($userId), $direction === 'credit' ? $amount : -$amount, $note, $actor);
        return ['ok' => true, 'message' => 'saved', 'data' => ['balance' => $balance]];
    });
}

/* ------------------------------- Reviews ------------------------------- */

function action_admin_moderate_review(): array
{
    return guarded('reviews:manage', function ($actor) {
        $id = coerce_int($_POST['reviewId'] ?? null);
        $status = form_str('status');
        $reason = trim_js(form_str('reason'));
        if ($id === null || $id < 1 || !in_array($status, ['published', 'hidden'], true) || js_len($reason) > 300) return ['error' => 'validation'];
        set_review_status($id, $status, $reason, $actor);
        return ['ok' => true, 'message' => 'saved'];
    });
}

function action_admin_reply_review(): array
{
    return guarded('reviews:manage', function ($actor) {
        $id = coerce_int($_POST['reviewId'] ?? null);
        $reply = trim_js(form_str('reply'));
        if ($id === null || $id < 1 || js_len($reply) > 1000) return ['error' => 'validation'];
        reply_to_review($id, $reply, $actor);
        return ['ok' => true, 'message' => 'saved'];
    });
}

/* ------------------------------- Products ------------------------------ */

const SLUG_RE = '/^[a-z0-9]+(?:-[a-z0-9]+)*$/';

function v_slug(V $v): void
{
    $s = strtolower(trim_js(str_in($v->raw('slug'))));
    if (js_len($s) < 2 || js_len($s) > 80 || !preg_match(SLUG_RE, $s)) $v->err('slug', 'validation');
    $v->data['slug'] = $s;
}

function v_product(array $in): array
{
    $v = new V($in);
    $cat = coerce_int($v->raw('categoryId'));
    if ($cat === null || $cat < 1) $v->err('categoryId', 'validation');
    $v->data['categoryId'] = $cat;
    v_slug($v);
    $v->str('nameAr', 120, 1);
    $v->str('nameEn', 120, 1);
    $v->str('summaryAr', 300);
    $v->str('summaryEn', 300);
    $v->str('descriptionAr', 5000);
    $v->str('descriptionEn', 5000);
    $icon = $v->raw('icon') === null ? 'spark' : $v->str('icon', 30);
    $v->data['icon'] = $icon;
    $v->enum('pricingMode', ['unit', 'package']);
    $v->optInt('unitPrice', 0);
    $v->optInt('compareAtPrice', 0);
    $v->int('minQuantity', 1, 1_000_000, 1);
    $v->optInt('maxQuantity', 1);
    $v->str('deliveryTimeAr', 120);
    $v->str('deliveryTimeEn', 120);
    foreach (['isActive', 'isFeatured', 'isSample', 'removeImage'] as $b) $v->bool($b);
    $v->int('sortOrder', -10000, 10000, 0);
    $v->str('packages', 5000);
    $v->str('tiers', 2000);
    $v->str('fields', 5000);
    $d = $v->data;
    if (($d['pricingMode'] ?? null) === 'unit' && ($d['unitPrice'] ?? null) === null && !isset($v->errors['unitPrice'])) $v->err('unitPrice', 'validation');
    if (($d['maxQuantity'] ?? null) !== null && ($d['minQuantity'] ?? null) !== null && $d['maxQuantity'] < $d['minQuantity']) $v->err('maxQuantity', 'validation');
    if (($d['compareAtPrice'] ?? null) !== null && ($d['unitPrice'] ?? null) !== null && $d['compareAtPrice'] <= $d['unitPrice']) $v->err('compareAtPrice', 'validation');
    return [$v->ok() ? $v->data : null, $v->errors];
}

function action_admin_save_product(): array
{
    return guarded('products:write', function ($actor) {
        $idRaw = form_str('id');
        $id = $idRaw !== '' ? int_or_null($idRaw) : null;
        if ($idRaw !== '' && $id === null) return ['error' => 'validation'];
        [$data, $errors] = v_product(form_entries());
        if ($data === null) return ['error' => 'validation', 'fieldErrors' => $errors];
        $imageId = null;
        $file = check_upload('image', IMAGE_TYPES);
        if ($file) {
            if (!$file['ok']) return ['error' => $file['error'], 'fieldErrors' => ['image' => $file['error']]];
            $imageId = store_file('product_image', $file['mime'], $file['bytes'], $actor['id']);
        }
        $result = save_product($id, $data, $imageId, $data['removeImage'], $actor);
        if (!$result['ok']) {
            $err = $result['error'];
            return ['error' => 'validation', 'fieldErrors' => [$err['field'] => !empty($err['line']) ? "line:{$err['line']}:{$err['reason']}" : $err['reason']]];
        }
        action_redirect('/' . action_locale() . "/admin/products/{$result['id']}?saved=1");
    });
}

function action_admin_delete_product(): array
{
    return guarded('products:write', function ($actor) {
        $id = int_or_null(form_str('id'));
        if ($id === null) return ['error' => 'validation'];
        if (delete_product($id, $actor) === 'deactivated') return ['ok' => true, 'message' => 'deactivated'];
        action_redirect('/' . action_locale() . '/admin/products');
    });
}

/* ------------------------------ Categories ----------------------------- */

function v_category(array $in): array
{
    $v = new V($in);
    v_slug($v);
    $v->str('nameAr', 80, 1);
    $v->str('nameEn', 80, 1);
    $v->str('descriptionAr', 500);
    $v->str('descriptionEn', 500);
    $v->data['icon'] = $v->raw('icon') === null ? 'spark' : $v->str('icon', 30);
    $v->int('sortOrder', -10000, 10000, 0);
    $v->bool('isActive');
    return [$v->ok() ? $v->data : null, $v->errors];
}

function action_admin_save_category(): array
{
    return guarded('categories:write', function ($actor) {
        $idRaw = form_str('id');
        $id = $idRaw !== '' ? int_or_null($idRaw) : null;
        [$data, $errors] = v_category(form_entries());
        if ($data === null) return ['error' => 'validation', 'fieldErrors' => $errors];
        $res = save_category($id, $data, $actor);
        if (!$res['ok']) return ['error' => 'validation', 'fieldErrors' => ['slug' => 'taken']];
        return ['ok' => true, 'message' => 'saved'];
    });
}

function action_admin_move_category(): array
{
    return guarded('categories:write', function ($actor) {
        $id = int_or_null(form_str('id'));
        if ($id !== null) move_category($id, form_str('direction') === 'up' ? 'up' : 'down', $actor);
        return ['ok' => true];
    });
}

function action_admin_delete_category(): array
{
    return guarded('categories:write', function ($actor) {
        $id = int_or_null(form_str('id'));
        if ($id === null) return ['error' => 'validation'];
        if (delete_category($id, $actor) === 'has_products') return ['error' => 'hasProducts'];
        return ['ok' => true];
    });
}

/* ---------------------------- Payment methods -------------------------- */

function action_admin_save_payment_method(): array
{
    return guarded('payment_methods:write', function ($actor) {
        $id = int_or_null(form_str('id'));
        $v = new V(form_entries());
        $v->str('nameAr', 80, 1);
        $v->str('nameEn', 80, 1);
        $v->str('instructionsAr', 3000);
        $v->str('instructionsEn', 3000);
        $v->str('accountDetails', 300);
        foreach (['requiresReference', 'allowsReceipt', 'isEnabled'] as $b) $v->bool($b);
        $v->int('sortOrder', -1000, 1000, 0);
        if (!$v->ok() || $id === null) return ['error' => 'validation'];
        $qrId = null;
        $file = check_upload('qr', IMAGE_TYPES);
        if ($file) {
            if (!$file['ok']) return ['error' => $file['error']];
            $qrId = store_file('payment_qr', $file['mime'], $file['bytes'], $actor['id']);
        }
        update_payment_method($id, $v->data, $actor, $qrId, form_str('removeQr') === 'on');
        return ['ok' => true, 'message' => 'saved'];
    });
}

/* -------------------------------- Settings ----------------------------- */

function action_admin_save_settings(): array
{
    return guarded('settings:write', function ($actor) {
        $v = new V(form_entries());
        $v->str('storeNameAr', 120, 1);
        $v->str('storeNameEn', 120, 1);
        $whatsappRaw = $v->str('whatsapp', 30);
        $tg = $v->str('telegram', 40);
        if (!isset($v->errors['telegram']) && !preg_match('/^@?[A-Za-z0-9_]{0,32}$/', $tg)) $v->err('telegram', 'validation');
        $ig = $v->str('instagram', 300);
        if (!isset($v->errors['instagram']) && $ig !== '' && !is_safe_http_url($ig)) $v->err('instagram', 'invalidUrl');
        $email = str_in($v->raw('supportEmail'));
        if ($email !== '' && !is_email((string) $v->raw('supportEmail'))) $v->err('supportEmail', 'invalidEmail');
        $v->data['supportEmail'] = (string) ($v->raw('supportEmail') ?? '');
        foreach (['hoursAr' => 200, 'hoursEn' => 200, 'noticeAr' => 300, 'noticeEn' => 300, 'heroTitleAr' => 120, 'heroTitleEn' => 120, 'heroSubtitleAr' => 400, 'heroSubtitleEn' => 400] as $k => $max) $v->str($k, $max);
        $v->int('retentionDays', 30, 3650);
        foreach (['termsAr', 'termsEn', 'privacyAr', 'privacyEn', 'refundAr', 'refundEn'] as $k) $v->text($k, 20000);
        if (!$v->ok()) return ['error' => 'validation', 'fieldErrors' => $v->errors];
        $whatsapp = $whatsappRaw !== '' ? normalize_phone($whatsappRaw) : '';
        if ($whatsapp === null) return ['error' => 'validation', 'fieldErrors' => ['whatsapp' => 'invalidPhone']];

        $current = load_settings(true);
        $logoId = $current['logoFileId'];
        $logo = check_upload('logo', IMAGE_TYPES);
        if ($logo) {
            if (!$logo['ok']) return ['error' => $logo['error'], 'fieldErrors' => ['logo' => $logo['error']]];
            $logoId = store_file('logo', $logo['mime'], $logo['bytes'], $actor['id']);
        } elseif (form_str('removeLogo') === 'on') {
            $logoId = null;
        }
        $changed = false;
        foreach (['termsAr', 'termsEn', 'privacyAr', 'privacyEn', 'refundAr', 'refundEn'] as $k) if ($current[$k] !== $v->data[$k]) $changed = true;
        save_settings(array_merge($v->data, [
            'telegram' => preg_replace('/^@/', '', $v->data['telegram']),
            'whatsapp' => $whatsapp,
            'logoFileId' => $logoId,
            'ordersEnabled' => form_str('ordersEnabled') === 'on',
            'showOffers' => form_str('showOffers') === 'on',
            'policiesUpdatedAt' => $changed ? gmdate('Y-m-d\TH:i:s.000\Z') : $current['policiesUpdatedAt'],
        ]));
        audit($actor, 'settings.update', 'settings', 'store', ['policiesChanged' => $changed]);
        return ['ok' => true, 'message' => 'saved'];
    });
}

/* ------------------------------- Customers ----------------------------- */

function action_admin_set_customer_status(): array
{
    return guarded('customers:write', function ($actor) {
        $id = form_str('id');
        if (!is_uuid($id)) return ['error' => 'validation'];
        set_customer_status(strtolower($id), form_str('status') === 'suspended' ? 'suspended' : 'active', $actor);
        return ['ok' => true];
    });
}

function action_admin_anonymize_customer(): array
{
    return guarded('customers:write', function ($actor) {
        $id = form_str('id');
        if (!is_uuid($id)) return ['error' => 'validation'];
        anonymize_customer(strtolower($id), $actor);
        action_redirect('/' . action_locale() . '/admin/customers');
    });
}

/* ---------------------------- Custom requests -------------------------- */

function action_admin_update_request(): array
{
    return guarded('requests:manage', function ($actor) {
        $id = form_str('id');
        $status = form_str('status');
        $notes = trim_js(form_str('adminNotes'));
        if (!is_uuid($id) || !in_array($status, ['new', 'in_review', 'quoted', 'closed'], true) || js_len($notes) > 3000) return ['error' => 'validation'];
        update_custom_request(strtolower($id), $status, $notes, $actor);
        return ['ok' => true, 'message' => 'saved'];
    });
}
