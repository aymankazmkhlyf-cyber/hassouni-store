<?php
declare(strict_types=1);

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Detects the real file type from magic bytes. The browser-supplied MIME type
 * and file name are never trusted. SVG is deliberately not accepted (it can carry script).
 */
function detect_file_type(string $buf): ?string
{
    if (strlen($buf) >= 3 && substr($buf, 0, 3) === "\xFF\xD8\xFF") return 'image/jpeg';
    if (strlen($buf) >= 8 && substr($buf, 0, 8) === "\x89PNG\r\n\x1a\n") return 'image/png';
    if (strlen($buf) >= 12 && substr($buf, 0, 4) === 'RIFF' && substr($buf, 8, 4) === 'WEBP') return 'image/webp';
    if (strlen($buf) >= 5 && substr($buf, 0, 5) === '%PDF-') return 'application/pdf';
    return null;
}

/**
 * Checks an uploaded file field. Returns null when no file was chosen,
 * ['ok' => true, 'mime', 'bytes'] or ['ok' => false, 'error'].
 */
function check_upload(string $field, array $allowed): ?array
{
    $f = $_FILES[$field] ?? null;
    if (!is_array($f) || is_array($f['error'] ?? null)) return null;
    if (($f['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) return null;
    if (in_array($f['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) return ['ok' => false, 'error' => 'file_too_large'];
    if ($f['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) return ['ok' => false, 'error' => 'file_missing'];
    if ((int) $f['size'] === 0) return null;
    if ((int) $f['size'] > MAX_UPLOAD_BYTES) return ['ok' => false, 'error' => 'file_too_large'];
    $bytes = (string) file_get_contents($f['tmp_name']);
    $mime = detect_file_type($bytes);
    if (!$mime || !in_array($mime, $allowed, true)) return ['ok' => false, 'error' => 'file_type'];
    return ['ok' => true, 'mime' => $mime, 'bytes' => $bytes];
}

function store_file(string $kind, string $mime, string $bytes, ?string $uploadedById): string
{
    $id = uuid4();
    $st = db()->prepare('INSERT INTO files (id, kind, mime_type, size, sha256, data, uploaded_by_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $st->bindValue(1, $id);
    $st->bindValue(2, $kind);
    $st->bindValue(3, $mime);
    $st->bindValue(4, strlen($bytes), PDO::PARAM_INT);
    $st->bindValue(5, sha256(base64_encode($bytes)));
    $st->bindValue(6, $bytes, PDO::PARAM_LOB);
    $st->bindValue(7, $uploadedById, $uploadedById === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
    $st->execute();
    return $id;
}

function read_file_row(string $id): ?array
{
    if (!preg_match('/^[0-9a-f-]{36}$/i', $id)) return null;
    return one('SELECT * FROM files WHERE id = ?', [strtolower($id)]);
}

function delete_file(string $id): void
{
    q('DELETE FROM files WHERE id = ?', [$id]);
}
