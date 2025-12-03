<?php

namespace App\Enum;

enum TaskPriority: string
{
    case LOW = 'low';
    case MEDIUM = 'medium';
    case HIGH = 'high';
    case URGENT = 'urgent';

    public static function random(): self
    {
        $values = array_values(self::cases());
        return $values[array_rand($values)];
    }
}
