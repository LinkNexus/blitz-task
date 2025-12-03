<?php

namespace App\DTO;

use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\Validator\Constraints\NotBlank;

class MoveTaskDTO
{
    #[Assert\NotBlank(message: 'The id field cannot be empty.')]
    public ?int $id = null;

    public ?int $columnId = null;

    #[NotBlank(message: 'The score field cannot be empty.')]
    public ?int $score = null;
}
