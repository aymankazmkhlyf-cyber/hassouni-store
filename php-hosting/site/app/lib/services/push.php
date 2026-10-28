<?php
/*
 * Standard Web Push (VAPID, RFC 8291 aes128gcm encryption) implemented with
 * PHP's built-in OpenSSL functions — no Composer packages. Works on
 * Android/desktop browsers, and on iPhone once the store is installed to the
 * home screen (iOS 16.4+). The VAPID key pair is generated on first use and
 * kept in its own store_settings row — never in the public settings object.
 * Keys use the same format as the original (Node web-push), so imported
 * subscriptions keep working.
 */

declare(strict_types=1);

const PUSH_HOST_SUFFIXES = ['fcm.googleapis.com', 'android.googleapis.com', 'push.services.mozilla.com', 'notify.windows.com', 'push.apple.com'];
/** At most this many devices per order. */
const MAX_PUSH_PER_ORDER = 5;

function get_vapid_keys(): ?array
{
    $read = function () {
        $row = one('SELECT value FROM store_settings WHERE `key` = ?', ['vapid']);
        $v = $row ? json_col($row['value'], []) : [];
        return !empty($v['publicKey']) && !empty($v['privateKey']) ? ['publicKey' => $v['publicKey'], 'privateKey' => $v['privateKey']] : null;
    };
    if ($k = $read()) return $k;
    $pair = ec_generate();
    if (!$pair) return null;
    $keys = ['publicKey' => base64url($pair['public']), 'privateKey' => base64url($pair['d'])];
    // Concurrent first requests: only one insert wins, everyone reads the winner.
    q('INSERT IGNORE INTO store_settings (`key`, value, updated_at) VALUES (?, ?, ?)', ['vapid', json_out($keys), now_db()]);
    return $read();
}

/**
 * The server POSTs to the subscription endpoint, so only real browser push
 * services are accepted (prevents using the store to reach arbitrary URLs).
 */
function is_allowed_push_endpoint(string $endpoint): bool
{
    $u = parse_url($endpoint);
    if (!$u || strtolower($u['scheme'] ?? '') !== 'https' || isset($u['port']) || isset($u['user']) || isset($u['pass']) || empty($u['host'])) return false;
    $host = strtolower($u['host']);
    foreach (PUSH_HOST_SUFFIXES as $s) if ($host === $s || str_ends_with($host, ".$s")) return true;
    return false;
}

function save_subscription(string $orderId, array $sub, string $locale): bool
{
    if (!is_allowed_push_endpoint($sub['endpoint'])) return false;
    return tx(function () use ($orderId, $sub, $locale) {
        q(
            'INSERT INTO push_subscriptions (order_id, endpoint, endpoint_hash, p256dh, auth, locale, failures, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)
             ON DUPLICATE KEY UPDATE p256dh = VALUES(p256dh), auth = VALUES(auth), locale = VALUES(locale), failures = 0',
            [$orderId, $sub['endpoint'], sha256($sub['endpoint']), $sub['keys']['p256dh'], $sub['keys']['auth'], $locale, now_db()],
        );
        // Keep only the newest few devices for this order.
        $keep = array_column(all('SELECT id FROM push_subscriptions WHERE order_id = ? ORDER BY created_at DESC, id DESC LIMIT ' . MAX_PUSH_PER_ORDER, [$orderId]), 'id');
        if ($keep) q('DELETE FROM push_subscriptions WHERE order_id = ? AND id NOT IN (' . placeholders($keep) . ')', [$orderId, ...$keep]);
        return true;
    });
}

function remove_subscription(string $orderId, string $endpoint): void
{
    q('DELETE FROM push_subscriptions WHERE order_id = ? AND endpoint_hash = ?', [$orderId, sha256($endpoint)]);
}

/** Sends to every device subscribed to the order. Gone subscriptions are removed. Never throws. */
function push_to_order(string $orderId, array $payload, string $contact): int
{
    $delivered = 0;
    try {
        $subs = all('SELECT * FROM push_subscriptions WHERE order_id = ?', [$orderId]);
        if (!$subs) return 0;
        $keys = get_vapid_keys();
        if (!$keys) return 0;
        $body = json_out($payload);
        foreach ($subs as $s) {
            $status = webpush_send($s['endpoint'], $s['p256dh'], $s['auth'], $body, $keys, $contact);
            if ($status >= 200 && $status < 300) {
                $delivered++;
            } elseif ($status === 404 || $status === 410 || (int) $s['failures'] >= 4) {
                q('DELETE FROM push_subscriptions WHERE id = ?', [$s['id']]);
            } else {
                q('UPDATE push_subscriptions SET failures = ? WHERE id = ?', [(int) $s['failures'] + 1, $s['id']]);
            }
        }
    } catch (Throwable) {
        log_error('push send failed');
    }
    return $delivered;
}

/* ------------------------------ Crypto (P-256, ES256, aes128gcm) ------------------------------ */

const P256_SPKI_PREFIX = "\x30\x59\x30\x13\x06\x07\x2a\x86\x48\xce\x3d\x02\x01\x06\x08\x2a\x86\x48\xce\x3d\x03\x01\x07\x03\x42\x00";

/** New P-256 key pair: ['d' => 32 bytes, 'public' => 65-byte uncompressed point, 'key' => OpenSSL key]. */
function ec_generate(): ?array
{
    $key = @openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
    if (!$key) return null;
    $ec = openssl_pkey_get_details($key)['ec'] ?? null;
    if (!$ec) return null;
    $pad = fn(string $b) => str_pad($b, 32, "\0", STR_PAD_LEFT);
    return ['d' => $pad($ec['d']), 'public' => "\x04" . $pad($ec['x']) . $pad($ec['y']), 'key' => $key];
}

function pem(string $der, string $label): string
{
    return "-----BEGIN $label-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END $label-----\n";
}

/** OpenSSL private key from the raw 32-byte scalar and 65-byte public point (SEC1 DER). */
function ec_private_key(string $d, string $public): mixed
{
    $der = "\x30\x77\x02\x01\x01\x04\x20" . $d . "\xa0\x0a\x06\x08\x2a\x86\x48\xce\x3d\x03\x01\x07\xa1\x44\x03\x42\x00" . $public;
    return openssl_pkey_get_private(pem($der, 'EC PRIVATE KEY'));
}

function ec_public_key(string $public): mixed
{
    return openssl_pkey_get_public(pem(P256_SPKI_PREFIX . $public, 'PUBLIC KEY'));
}

/** DER ECDSA signature → raw 64-byte r||s (JOSE format). */
function der_to_raw_signature(string $der): string
{
    $pos = 2;
    if (ord($der[1]) & 0x80) $pos += ord($der[1]) & 0x7f;
    $read = function () use ($der, &$pos) {
        $len = ord($der[$pos + 1]);
        $v = substr($der, $pos + 2, $len);
        $pos += 2 + $len;
        return str_pad(ltrim($v, "\0"), 32, "\0", STR_PAD_LEFT);
    };
    return $read() . $read();
}

function vapid_jwt(string $audience, string $subject, array $keys): ?string
{
    $d = base64url_decode($keys['privateKey']);
    $pub = base64url_decode($keys['publicKey']);
    $priv = ec_private_key($d, $pub);
    if (!$priv) return null;
    $input = base64url(json_out(['typ' => 'JWT', 'alg' => 'ES256'])) . '.' . base64url(json_out(['aud' => $audience, 'exp' => time() + 12 * 3600, 'sub' => $subject]));
    if (!openssl_sign($input, $der, $priv, OPENSSL_ALGO_SHA256)) return null;
    return $input . '.' . base64url(der_to_raw_signature($der));
}

/** RFC 8291 payload encryption. Returns the aes128gcm body or null. */
function webpush_encrypt(string $payload, string $uaPublic, string $authSecret): ?string
{
    $local = ec_generate();
    if (!$local) return null;
    $peer = ec_public_key($uaPublic);
    if (!$peer) return null;
    $ecdh = openssl_pkey_derive($peer, $local['key'], 32);
    if ($ecdh === false) return null;
    $ikm = hash_hkdf('sha256', $ecdh, 32, "WebPush: info\0" . $uaPublic . $local['public'], $authSecret);
    $salt = random_bytes(16);
    $cek = hash_hkdf('sha256', $ikm, 16, "Content-Encoding: aes128gcm\0", $salt);
    $nonce = hash_hkdf('sha256', $ikm, 12, "Content-Encoding: nonce\0", $salt);
    $cipher = openssl_encrypt($payload . "\x02", 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag);
    if ($cipher === false) return null;
    return $salt . pack('N', 4096) . chr(65) . $local['public'] . $cipher . $tag;
}

/** Sends one push message. Returns the HTTP status (0 on failure before sending). */
function webpush_send(string $endpoint, string $p256dh, string $auth, string $payload, array $keys, string $contact): int
{
    if (!is_allowed_push_endpoint($endpoint) || !function_exists('curl_init')) return 0;
    $body = webpush_encrypt($payload, base64url_decode($p256dh), base64url_decode($auth));
    $u = parse_url($endpoint);
    $jwt = vapid_jwt($u['scheme'] . '://' . $u['host'], $contact, $keys);
    if ($body === null || $jwt === null) return 0;
    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 5,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/octet-stream',
            'Content-Encoding: aes128gcm',
            'TTL: ' . (3 * 86400),
            'Urgency: high',
            'Authorization: vapid t=' . $jwt . ', k=' . $keys['publicKey'],
        ],
    ]);
    $res = curl_exec($ch);
    $status = $res === false ? 0 : (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    return $status;
}
