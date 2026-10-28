<?php
declare(strict_types=1);

function action_custom_request(): array
{
    $in = [];
    foreach (['name', 'phone', 'email', 'serviceType', 'description', 'quantity', 'budget', 'referenceUrl', 'notes'] as $k) $in[$k] = form_str($k);
    [$data, $errors] = v_custom_request($in);
    if ($data === null) return ['error' => 'validation', 'fieldErrors' => $errors];
    if (!consume_rate_limit('customRequest', client_ip())) return ['error' => 'rateLimited'];
    $user = current_user();
    $reference = create_custom_request($data, $user['id'] ?? null);
    return ['ok' => true, 'data' => ['reference' => $reference]];
}
