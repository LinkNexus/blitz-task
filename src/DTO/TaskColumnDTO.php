<?php

namespace App\DTO;

use Symfony\Component\Validator\Constraints\NotBlank;

class TaskColumnDTO
{

    #[NotBlank(message: 'The name field cannot be null.')]
    public ?string $name = null;
    
    public ?int $score = null;

}
