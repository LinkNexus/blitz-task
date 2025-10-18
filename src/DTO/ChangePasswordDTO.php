<?php

namespace App\DTO;

use Symfony\Component\Validator\Constraints as Assert;

class ChangePasswordDTO
{
    #[Assert\NotBlank(message: 'The password field cannot be empty.')]
    #[Assert\Sequentially([
        new Assert\PasswordStrength,
        new Assert\NotCompromisedPassword,
    ])]
    public ?string $password = null;

    #[Assert\EqualTo(propertyPath: 'password', message: 'The passwords do not match.')]
    public ?string $confirmPassword = null;
}
