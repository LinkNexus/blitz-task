<?php

namespace App\DTO\Task;

use Symfony\Component\Validator\Constraints\NotBlank;

class MoveTaskDTO
{
    #[NotBlank(message: "The id field cannot be empty.")]
    public ?int $id = null;

    public ?int $columnId = null;

    #[NotBlank(message: "The score field cannot be empty.")]
    public ?float $score = null;

    #[NotBlank(message: "The project field cannot be empty.")]
    public ?int $projectId = null;
}
