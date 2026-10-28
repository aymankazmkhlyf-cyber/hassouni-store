<?php
declare(strict_types=1);

/** Records a sensitive action. Never pass secrets, passwords or full personal data in $details. */
function audit(?array $actor, string $action, string $entityType, string|int|null $entityId, array $details = []): void
{
    $details = array_filter($details, fn($v) => $v !== null);
    insert('audit_logs', [
        'actor_id' => $actor['id'] ?? null,
        'actor_email' => $actor['email'] ?? null,
        'action' => $action,
        'entity_type' => $entityType,
        'entity_id' => $entityId === null ? null : (string) $entityId,
        'details' => json_out($details ?: new stdClass()),
        'created_at' => now_db(),
    ]);
}
