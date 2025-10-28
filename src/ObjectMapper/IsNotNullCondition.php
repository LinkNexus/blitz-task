<?php

namespace App\ObjectMapper;

use Symfony\Component\ObjectMapper\ConditionCallableInterface;

final class IsNotNullCondition implements ConditionCallableInterface
{
    public function __invoke($value, object $source, ?object $target): bool
    {
        return $value !== null;
    }
}
