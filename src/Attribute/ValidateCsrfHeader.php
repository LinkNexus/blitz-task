<?php

namespace App\Attribute;

use Attribute;

#[Attribute(Attribute::TARGET_METHOD | Attribute::TARGET_CLASS)]
class ValidateCsrfHeader
{
    public function __construct(
        public string $tokenId = 'api',
    ) {}
}
