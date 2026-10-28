<?php
declare(strict_types=1);

/** Upper bound for any single order (IQD). Keeps totals well inside a 32-bit integer column. */
const MAX_ORDER_TOTAL_IQD = 1_000_000_000;

function is_valid_iqd_amount(mixed $v): bool
{
    return is_int($v) && $v >= 0 && $v <= MAX_ORDER_TOTAL_IQD;
}
