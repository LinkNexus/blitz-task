<?php

namespace App\DTO;

use App\Entity\User;
use App\Validator\UniqueEntityValue;
use Symfony\Component\ObjectMapper\Attribute\Map;
use Symfony\Component\Validator\Constraints as Assert;

class UserDTO
{
    #[Assert\Email(
        message: "The email '{{ value }}' is not a valid email.",
        groups: ['create']
    )]
    #[Assert\NotBlank(message: 'The email field cannot be empty.', groups: ['create'])]
    #[UniqueEntityValue('email', entityClass: User::class, message: 'The email "{{ value }}" is already in use.', groups: ['create'])]
    public ?string $email = null;

    #[Assert\NotBlank(message: 'The name field cannot be empty.', normalizer: 'trim', groups: ['create'])]
    #[Assert\Length(min: 2, max: 255, minMessage: 'The name must be at least {{ limit }} characters long.', maxMessage: 'The name cannot be longer than {{ limit }} characters.', groups: ['create'])]
    #[Assert\Regex(pattern: '/^[a-zA-Z0-9_ ]+$/', message: 'The name can only contain alphanumeric characters, spaces and underscores.', groups: ['create'])]
    public ?string $name = null;

    #[Assert\NotBlank(message: 'The password field cannot be empty.', groups: ['create', 'password'])]
    #[Assert\Sequentially([
        new Assert\PasswordStrength,
        new Assert\NotCompromisedPassword,
    ], groups: ['create', 'password'])]
    public ?string $password = null;

    #[Assert\EqualTo(propertyPath: 'password', message: 'The passwords do not match.', groups: ['create', 'password'])]
    #[Map(if: false)]
    public ?string $confirmPassword = null;
}
