<?php

namespace App\DTO;

use Symfony\Component\Validator\Constraints as Assert;

class InviteMemberDTO
{
    #[Assert\Email(
        message: "The email '{{ value }}' is not a valid email.",
    )]
    #[Assert\NotBlank(message: 'The email field cannot be empty.')]
    public ?string $email = null;
}
