<?php

namespace App\Validator;

use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\Exception\UnexpectedValueException;
use Symfony\Component\PropertyAccess\Exception\UnexpectedTypeException;
use Symfony\Component\Validator\Constraint;
use Symfony\Component\Validator\ConstraintValidator;

final class UniqueEntityValueValidator extends ConstraintValidator
{
    public function __construct(private readonly EntityManagerInterface $em) {}

    public function validate(mixed $value, Constraint $constraint): void
    {
        if (! $constraint instanceof UniqueEntityValue) {
            throw new UnexpectedTypeException($constraint, UniqueEntityValue::class);
        }

        if ($value === null || $value === '') {
            return;
        }

        if (! is_string($value) && ! is_numeric($value)) {
            throw new UnexpectedValueException($value, 'string|int');
        }

        $entity = $this->em->getRepository($constraint->entityClass)
            ->findOneBy([$constraint->fieldName => $value]);

        if (! $entity) {
            return;
        }

        // TODO: implement the validation here
        $this->context->buildViolation($constraint->message)
            ->setParameter('{{ value }}', $value)
            ->addViolation();
    }
}
