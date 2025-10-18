<?php

namespace App\Validator;

use Symfony\Component\Validator\Constraint;

#[\Attribute(\Attribute::TARGET_PROPERTY | \Attribute::TARGET_METHOD | \Attribute::IS_REPEATABLE)]
final class UniqueEntityValue extends Constraint
{
    public string $message = 'The value "{{ value }}" is already in use.';

    // You can use #[HasNamedArguments] to make some constraint options required.
    // All configurable options must be passed to the constructor.
    public function __construct(
        public string $fieldName,
        public string $entityClass,
        ?string $message = null,
        ?array $groups = null,
        mixed $payload = null
    ) {
        $this->message = $message ?? $this->message;
        parent::__construct([], $groups, $payload);
    }
}
