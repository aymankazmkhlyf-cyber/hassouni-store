<?php
declare(strict_types=1);

function create_custom_request(array $in, ?string $userId): string
{
    $r = random_base32(8);
    $reference = 'REQ-' . substr($r, 0, 4) . '-' . substr($r, 4);
    insert('custom_requests', [
        'id' => uuid4(), 'reference' => $reference, 'user_id' => $userId, 'name' => $in['name'], 'phone' => $in['phone'], 'email' => $in['email'],
        'service_type' => $in['serviceType'], 'description' => $in['description'], 'quantity' => $in['quantity'], 'budget' => $in['budget'],
        'reference_url' => $in['referenceUrl'], 'notes' => $in['notes'], 'admin_notes' => '', 'created_at' => now_db(), 'updated_at' => now_db(),
    ]);
    return $reference;
}

function list_custom_requests(?string $status, int $page): array
{
    $pageSize = 20;
    $page = max($page, 1);
    $where = $status ? 'WHERE status = ?' : '';
    $params = $status ? [$status] : [];
    $rows = all("SELECT * FROM custom_requests $where ORDER BY created_at DESC LIMIT ? OFFSET ?", [...$params, $pageSize, ($page - 1) * $pageSize]);
    $total = (int) val("SELECT COUNT(*) FROM custom_requests $where", $params);
    return ['rows' => $rows, 'page' => $page, 'pages' => max(1, (int) ceil($total / $pageSize))];
}

function update_custom_request(string $id, string $status, string $adminNotes, array $actor): void
{
    update('custom_requests', ['status' => $status, 'admin_notes' => $adminNotes], 'id = ?', [$id]);
    audit($actor, 'custom_request.update', 'custom_request', $id, ['status' => $status]);
}
